const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The password-reset journey: "Forgot your password?" on the log-in screen, the
// email, the link back, and the "choose a new password" screen. The screens
// themselves were driven in a browser against a stand-in sign-in service; these
// tests keep the wiring from being lost.

const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const INDEX = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("the log-in screen offers 'Forgot your password?' and sends the reset email back to the app", () => {
  assert.ok(APP.includes("Forgot your password?"));
  assert.ok(APP.includes('supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/app.html" })'));
  assert.ok(APP.includes("Send me a link"));
});

test("the confirmation after asking for a reset never says whether the address has an account", () => {
  const msg = APP.match(/If there's a LiteracyLab AI account for[^<]*<strong>\{email\}<\/strong>[^<]*/);
  assert.ok(msg, "the generic message is there");
  assert.ok(!/no account|not found|doesn't exist|unknown email/i.test(APP.slice(APP.indexOf("function AuthScreen"), APP.indexOf("function SetNewPassword"))), "the sign-in screens never reveal whether an account exists");
});

test("following the emailed link shows 'Choose a new password' before the app, and saves it with updateUser", () => {
  assert.ok(APP.includes("function SetNewPassword"));
  assert.ok(APP.includes("supabaseClient.auth.updateUser({ password })"));
  assert.ok(APP.includes('event === "PASSWORD_RECOVERY"'));
  assert.ok(APP.includes("if (recovering) {"));
  // recovery is checked before the app is ever rendered
  assert.ok(APP.indexOf("if (recovering) {") < APP.indexOf("return <App session={session} />;", APP.indexOf("function AuthGate")));
});

test("the new password must be 8+ characters and typed twice the same, checked before anything is sent", () => {
  const body = APP.slice(APP.indexOf("function SetNewPassword"), APP.indexOf("function AuthGate"));
  assert.ok(body.includes("password.length < 8"));
  assert.ok(body.includes("password !== again"));
  assert.ok(body.indexOf("password !== again") < body.indexOf("supabaseClient.auth.updateUser"));
  assert.ok(body.includes("window.history.replaceState"), "the one-time token is removed from the address bar");
});

test("the recovery check recognises a reset link and ignores ordinary sign-in addresses", () => {
  const src = APP.match(/useState\(\(\)=> (\/\(\^\|\[#&\?\]\)type=recovery\\b\/)\.test/);
  assert.ok(src, "the recovery pattern is in the app");
  const re = new RegExp("(^|[#&?])type=recovery\\b");
  assert.ok(re.test("#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery"));
  assert.ok(re.test("?type=recovery"));
  assert.ok(!re.test("#access_token=abc&token_type=bearer"), "token_type=bearer is not a recovery");
  assert.ok(!re.test("#type=signup"));
  assert.ok(!re.test(""));
});

// ---- the homepage passes reset and confirmation links on to the app

function runHomepageForwarder(hash) {
  const marker = "passed straight on to the app";
  const start = INDEX.lastIndexOf("<script>", INDEX.indexOf(marker));
  const end = INDEX.indexOf("</script>", INDEX.indexOf(marker));
  const code = INDEX.slice(start + "<script>".length, end);
  const calls = [];
  vm.runInNewContext(code, { location: { hash, replace: (u) => calls.push(u) } });
  return calls;
}

test("homepage: a reset or sign-up confirmation link that lands here is forwarded to the app with its token", () => {
  const rec = "#access_token=abc&expires_in=3600&token_type=bearer&type=recovery";
  const sign = "#access_token=abc&refresh_token=r&type=signup";
  assert.deepEqual(runHomepageForwarder(rec), ["/app.html" + rec]);
  assert.deepEqual(runHomepageForwarder(sign), ["/app.html" + sign]);
});

test("homepage: nothing else is forwarded: ordinary anchors, links without a token, and other link types", () => {
  for (const hash of ["", "#pricing", "#faq", "#type=recovery", "#access_token=abc&token_type=bearer", "#access_token=abc&type=magiclink", "#access_token=abc&type=recoveryx"]) {
    assert.deepEqual(runHomepageForwarder(hash), [], `"${hash}" must not be forwarded`);
  }
});
