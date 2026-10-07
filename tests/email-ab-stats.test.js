const test = require("node:test");
const assert = require("node:assert/strict");
const { SUBJECT_B, variantFor, applyVariant } = require("../api/_lib/emailAb");
const { summarise, totals, fetchRecent } = require("../api/_lib/emailStats");
const { buildAnyEmail, sampleContext } = require("../api/_lib/emailAny");
const { loadHandler, call } = require("./harness");

test("subject test: each parent is always in the same half, and the halves are roughly even", () => {
  const ids = Array.from({ length: 400 }, (_, i) => `profile-${i}`);
  for (const key of Object.keys(SUBJECT_B)) {
    const first = ids.map((id) => variantFor(key, id));
    assert.deepEqual(ids.map((id) => variantFor(key, id)), first, "stable for the same parent");
    const b = first.filter((v) => v === "B").length;
    assert.ok(b > 140 && b < 260, `${key}: ${b} of 400 in half B`);
  }
  assert.equal(variantFor("free-reset", "profile-1"), null, "emails outside the test are untouched");
});

test("subject test: only the subject changes, the alternatives are real subjects, and the original is unchanged for half A", () => {
  for (const key of Object.keys(SUBJECT_B)) {
    const alt = SUBJECT_B[key];
    assert.ok(alt.length >= 20 && alt.length <= 70, `${key}: a subject that fits a phone's inbox`);
    assert.ok(!/[!?]{2,}|FREE|\p{Extended_Pictographic}/u.test(alt), `${key}: no spammy styling`);
    const built = buildAnyEmail(key, sampleContext(key));
    assert.notEqual(alt, built.subject);
    const a = applyVariant(key, [..."abcdefghijklmnopqrstuvwxyz"].map((c) => "p" + c).find((id) => variantFor(key, id) === "A"), built);
    const b = applyVariant(key, [..."abcdefghijklmnopqrstuvwxyz"].map((c) => "p" + c).find((id) => variantFor(key, id) === "B"), built);
    assert.equal(a.subject, built.subject);
    assert.equal(b.subject, alt);
    assert.equal(b.html, built.html);
    assert.equal(b.text, built.text);
  }
});

test("email stats: groups by subject and counts delivered, opened (including clicked), clicked and bounced", () => {
  const rows = summarise([
    { subject: "A", last_event: "delivered" }, { subject: "A", last_event: "opened" }, { subject: "A", last_event: "clicked" }, { subject: "A", last_event: "bounced" },
    { subject: "B", last_event: "opened" },
  ]);
  const a = rows.find((r) => r.subject === "A");
  assert.deepEqual({ sent: a.sent, delivered: a.delivered, opened: a.opened, clicked: a.clicked, bounced: a.bounced }, { sent: 4, delivered: 3, opened: 2, clicked: 1, bounced: 1 });
  assert.equal(a.openRate, 66.7); assert.equal(a.clickRate, 33.3);
  assert.equal(rows[0].subject, "A", "most-sent first");
  const t = totals(rows);
  assert.equal(t.sent, 5); assert.equal(t.opened, 3);
  assert.equal(summarise([]).length, 0);
  assert.equal(summarise([{ subject: "X" }])[0].openRate, null, "no delivered emails means no rate, not 0%");
});

test("email stats: reads Resend page by page and reports a refusal clearly", async () => {
  const pages = [{ data: [{ id: "1", subject: "A", last_event: "opened" }], has_more: true }, { data: [{ id: "2", subject: "A", last_event: "delivered" }], has_more: false }];
  const urls = [];
  const fetchImpl = async (url, init) => { urls.push(url); assert.equal(init.headers.Authorization, "Bearer k"); return { ok: true, json: async () => pages[urls.length - 1] }; };
  const out = await fetchRecent({ apiKey: "k", fetchImpl });
  assert.equal(out.length, 2);
  assert.match(urls[1], /after=1/);
  await assert.rejects(() => fetchRecent({ apiKey: "k", fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ message: "bad key" }) }) }), /bad key/);
});

test("email stats endpoint: closed to everyone but the cron secret or an admin", async () => {
  const h = loadHandler("email.js", {});
  const res = await call(h, { method: "GET", query: { action: "stats" }, headers: {} });
  assert.equal(res.statusCode, 401);
});

test("email stats endpoint: explains how to switch it on when only the send-only key exists", async () => {
  const saved = { c: process.env.CRON_SECRET, r: process.env.RESEND_READ_KEY };
  process.env.CRON_SECRET = "s"; delete process.env.RESEND_READ_KEY;
  const h = loadHandler("email.js", {});
  const res = await call(h, { method: "GET", query: { action: "stats" }, headers: { authorization: "Bearer s" } });
  if (saved.c === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved.c;
  if (saved.r !== undefined) process.env.RESEND_READ_KEY = saved.r;
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.available, false);
  assert.match(res.body.reason, /RESEND_READ_KEY/);
});
