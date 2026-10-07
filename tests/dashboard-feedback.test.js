const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadHandler, call, did } = require("./harness");

// The "Tell us what you think" card on the parent dashboard sends feedback from a signed-in parent to the same place as
// feedback from the emails, tied to their account, where it reaches the owner's backlog.

function db(inserted, { recent = 0 } = {}) {
  return (q) => {
    if (q.table === "feedback" && did(q, "insert")) { inserted.push(q.ops.find(([n]) => n === "insert")[1]); return { data: null, error: null }; }
    if (q.table === "feedback") return { data: null, count: recent, error: null };
    return { data: null, error: null };
  };
}
const AUTH = { authorization: "Bearer a-real-looking-token" };
const post = (h, body, headers) => call(h, { method: "POST", query: { action: "feedback" }, body, headers });

test("feedback from the dashboard is saved against the signed-in parent's account, as app feedback", async () => {
  const inserted = [];
  const res = await post(loadHandler("email.js", { db: db(inserted) }), { source: "app", emailKey: "app-dashboard", category: "idea", message: "  Please add a spelling game  ", contactOk: true }, AUTH);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(inserted.length, 1);
  const row = inserted[0];
  assert.equal(row.profile_id, "user-1", "tied to the account that sent it");
  assert.equal(row.source, "app");
  assert.equal(row.email_key, "app-dashboard");
  assert.equal(row.category, "idea");
  assert.equal(row.message, "Please add a spelling game", "trimmed");
  assert.equal(row.contact_ok, true);
});

test("without a sign-in it is still accepted, but as anonymous email-style feedback, never attributed to an account", async () => {
  const inserted = [];
  const res = await post(loadHandler("email.js", { db: db(inserted) }), { source: "app", emailKey: "app-dashboard", category: "bug", message: "Something looks odd on my screen" });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(inserted[0].profile_id, null);
  assert.equal(inserted[0].source, "email");
});

test("the form's rules still apply: a message or rating is needed, it cannot be too long, and the category is checked", async () => {
  const inserted = [];
  const h = loadHandler("email.js", { db: db(inserted) });
  assert.equal((await post(h, { source: "app", category: "idea", message: "   " }, AUTH)).statusCode, 400);
  assert.equal((await post(h, { source: "app", category: "idea", message: "x".repeat(2001) }, AUTH)).statusCode, 400);
  const ok = await post(h, { source: "app", category: "made-up", message: "A real message here" }, AUTH);
  assert.equal(ok.statusCode, 200);
  assert.equal(inserted[0].category, "other", "an unknown category becomes other");
  assert.equal(inserted.length, 1, "nothing saved for the refused ones");
});

test("the hourly limit protects the form even when signed in", async () => {
  const inserted = [];
  const res = await post(loadHandler("email.js", { db: db(inserted, { recent: 5 }) }), { source: "app", category: "idea", message: "Another message" }, AUTH);
  assert.equal(res.statusCode, 429);
  assert.equal(inserted.length, 0);
});

test("the contact permission is only taken as given, never assumed", async () => {
  const inserted = [];
  const h = loadHandler("email.js", { db: db(inserted) });
  await post(h, { source: "app", category: "praise", message: "Lovely feedback on essays" }, AUTH);
  await post(h, { source: "app", category: "praise", message: "Lovely feedback on essays", contactOk: "yes" }, AUTH);
  assert.deepEqual(inserted.map((r) => r.contact_ok), [false, false]);
});

const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");

test("the dashboard shows the card, sends it as app feedback with the right label, and gives a thank-you", () => {
  assert.match(APP, /function FeedbackCard/);
  assert.match(APP, /<FeedbackCard session=\{session\} backendLive=\{backendLive\} \/>/);
  assert.match(APP, /source: "app", emailKey: "app-dashboard"/);
  assert.match(APP, /Tell us what you think/);
  assert.match(APP, /Thank you, we have it\./);
  const kinds = APP.slice(APP.indexOf("const FEEDBACK_KINDS"), APP.indexOf("function FeedbackCard"));
  for (const k of ["idea", "bug", "praise", "question", "other"]) assert.ok(kinds.includes('"' + k + '"'), k);
});

test("the daily task labels dashboard feedback so it reads sensibly in the backlog", () => {
  const task = path.join(process.env.USERPROFILE || process.env.HOME || "", ".claude", "scheduled-tasks", "refresh-analytics-tab", "SKILL.md");
  if (!fs.existsSync(task)) return; // the task lives on the owner's machine, not in the repository
  assert.match(fs.readFileSync(task, "utf8"), /app-dashboard/);
});
