const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// Analytics is a privacy-sensitive feature on a product used by children, so
// these tests pin the promises the privacy policy makes: nothing is tracked
// before consent, events carry no personal data, and every public page is
// covered by the same consent banner.

test("every page loads the analytics script, so the consent banner appears everywhere", () => {
  for (const f of ["index.html", "app.html", "privacy.html", "terms.html"]) {
    assert.ok(read(f).includes('<script src="analytics.js"></script>'), `${f} does not load analytics.js`);
  }
});

function runAnalytics(localStorageData = {}) {
  const dataLayer = [];
  const listeners = {};
  const appended = [];
  const win = { dataLayer };
  const document = {
    readyState: "complete",
    head: { appendChild: (el) => appended.push(el) },
    body: { appendChild: () => {} },
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {} }),
    getElementById: () => ({ addEventListener() {} }),
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const ctx = { window: win, document, localStorage: { getItem: (k) => localStorageData[k] ?? null, setItem: (k, v) => { localStorageData[k] = v; } }, location: { pathname: "/index.html" } };
  ctx.window.document = document;
  vm.runInNewContext(read("analytics.js"), ctx);
  return { win, dataLayer, listeners, appended };
}

test("before consent, analytics storage and every advertising signal are denied", () => {
  const { dataLayer } = runAnalytics();
  const first = [...dataLayer[0]];
  assert.deepEqual(JSON.parse(JSON.stringify(first.slice(0, 2))), ["consent", "default"]);
  assert.deepEqual(JSON.parse(JSON.stringify(first[2])), { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  assert.ok(!dataLayer.some((e) => e[0] === "consent" && e[1] === "update"), "consent must not be granted without a click");
});

test("a returning visitor who accepted is remembered; one who declined stays denied", () => {
  const accepted = runAnalytics({ ll_cookie_consent: "granted" });
  assert.ok(accepted.dataLayer.some((e) => e[0] === "consent" && e[1] === "update" && e[2].analytics_storage === "granted"));
  const declined = runAnalytics({ ll_cookie_consent: "denied" });
  assert.ok(!declined.dataLayer.some((e) => e[0] === "consent" && e[1] === "update"));
});

test("llTrack sends a named event with its parameters", () => {
  const { win, dataLayer } = runAnalytics();
  win.llTrack("submission_complete", { kind: "writing", tier: "high" });
  const ev = [...dataLayer.at(-1)];
  assert.equal(ev[0], "event");
  assert.equal(ev[1], "submission_complete");
  assert.deepEqual(JSON.parse(JSON.stringify(ev[2])), { kind: "writing", tier: "high" });
});

test("a click on a link into the app is recorded as a CTA click, with the button text only", () => {
  const { dataLayer, listeners } = runAnalytics();
  const link = { getAttribute: () => "app.html", textContent: "  Start free  " };
  listeners.click({ target: { closest: () => link } });
  const ev = [...dataLayer.at(-1)];
  assert.equal(ev[1], "cta_click");
  assert.deepEqual(JSON.parse(JSON.stringify(ev[2])), { cta_text: "Start free", page: "/index.html" });
  const before = dataLayer.length;
  listeners.click({ target: { closest: () => ({ getAttribute: () => "privacy.html", textContent: "Privacy" }) } });
  assert.equal(dataLayer.length, before, "other links must not be counted as CTA clicks");
});

test("the app records the key events, and never passes personal data or writing to analytics", () => {
  const app = read("app.html");
  for (const name of ["sign_up", "login", "begin_checkout", "submission_complete", "first_submission", "view_plans"]) {
    assert.ok(app.includes(`llTrack("${name}"`) || app.includes(`llTrack(\\"${name}\\"`) || app.includes(`window.llTrack("${name}"`) || app.includes(`window.llTrack && window.llTrack("${name}"`), `event ${name} is not recorded`);
  }
  const calls = app.match(/llTrack\("[a-z_]+"(, \{[^}]*\})?\)/g) || [];
  assert.ok(calls.length >= 6);
  // Only these parameter names may ever be sent: a login method, a plan, a kind of exercise, an age tier.
  const allowedKeys = new Set(["method", "plan", "kind", "tier"]);
  for (const c of calls) {
    const keys = [...c.matchAll(/([a-zA-Z_]+):/g)].map((m) => m[1]);
    for (const k of keys) assert.ok(allowedKeys.has(k), `analytics call sends an unapproved field "${k}": ${c}`);
  }
});

test("the privacy policy describes analytics: consent, what is collected, and that no content is sent", () => {
  const p = read("privacy.html");
  assert.match(p, /Analytics and cookies\./);
  assert.match(p, /analytics cookies are not set/i);
  assert.match(p, /no submission content, names or email addresses/);
  assert.match(p, /<td>Analytics data<\/td>/);
});
