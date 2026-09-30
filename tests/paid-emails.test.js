const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { pickPaidEmail, pickSharedEmail, buildPaidEmail, isTransactional, PAID_EMAIL_KEYS, TRANSACTIONAL } = require("../api/_lib/paidEmails");
const { buildAnyEmail, ALL_EMAIL_KEYS, sampleContext } = require("../api/_lib/emailAny");
const { runFreeEmailJob } = require("../api/_lib/emailJob");
const { notifyBillingEvent } = require("../api/_lib/billingNotify");
const { SITE } = require("../api/_lib/emailTemplate");
const { fakeDb } = require("./fakedb");
const { loadHandler, fakeRes, did } = require("./harness");

const DAY = 86400000;
const MON = new Date("2026-10-12T22:00:00Z"); // a Monday (UTC)
const TUE = new Date("2026-10-13T22:00:00Z");
const ago = (days, from = MON) => new Date(from.getTime() - days * DAY);
const TOKEN = "11111111-2222-3333-4444-555555555555";

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
  const restore = () => { for (const k of Object.keys(vars)) { if (saved[k] == null) delete process.env[k]; else process.env[k] = saved[k]; } };
  return Promise.resolve().then(fn).finally(restore);
}
const LIVE = { EMAIL_LIVE: "true", RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: "PO Box 1, Town" };

// ------------------------------------------------------------------ who gets which paid email

const pf = (over = {}) => ({ tier: "core", createdAt: ago(60), completedTotal: 3, completedLast7d: 0, examAgeLast14d: false, lastActivityAt: ago(3), sent: {}, ...over });

test("Core: the weekly report goes out on Mondays to people active this week, once a week", () => {
  const f = pf({ completedLast7d: 2 });
  assert.deepEqual(pickPaidEmail(f, MON), { key: "core-weekly", dedupeKey: "core-weekly:2026-10-12" });
  assert.equal(pickPaidEmail(f, TUE), null, "not a Monday");
  assert.equal(pickPaidEmail({ ...f, sent: { "core-weekly:2026-10-12": ago(0.1) } }, MON), null, "already sent this week");
  assert.equal(pickPaidEmail(pf({ completedLast7d: 0 }), MON), null, "nothing to report");
});

test("Premium gets the household digest instead of the Core report", () => {
  assert.equal(pickPaidEmail(pf({ tier: "premium", completedLast7d: 2 }), MON).key, "prem-digest");
});

test("the 10th and 25th completed piece each get a milestone email, once, the highest first", () => {
  assert.equal(pickPaidEmail(pf({ completedTotal: 10 }), TUE).key, "milestone-10");
  assert.equal(pickPaidEmail(pf({ completedTotal: 9 }), TUE), null);
  assert.equal(pickPaidEmail(pf({ completedTotal: 12, sent: { "milestone-10": ago(5, TUE) } }), TUE), null);
  assert.equal(pickPaidEmail(pf({ completedTotal: 26 }), TUE).key, "milestone-25");
  assert.equal(pickPaidEmail(pf({ completedTotal: 26, sent: { "milestone-25": ago(5, TUE) } }), TUE).key, "milestone-10", "25 already sent, but 10 never was");
});

test("a Core parent whose child writes at an exam age is invited to Premium, once", () => {
  assert.equal(pickPaidEmail(pf({ examAgeLast14d: true }), TUE).key, "core-to-premium");
  assert.equal(pickPaidEmail(pf({ examAgeLast14d: true, tier: "premium" }), TUE), null, "Premium customers are not sold Premium");
  assert.equal(pickPaidEmail(pf({ examAgeLast14d: true, sent: { "core-to-premium": ago(40, TUE) } }), TUE), null);
  assert.equal(pickPaidEmail(pf({ examAgeLast14d: true, completedTotal: 1 }), TUE), null, "not until they have used it a little");
});

test("paid emails keep the 2-day quiet gap", () => {
  assert.equal(pickPaidEmail(pf({ completedTotal: 10, sent: { "core-welcome:sub_1": ago(1, TUE) } }), TUE), null);
});

test("the we-miss-you email goes to someone who used it, then went quiet for 2 weeks, at most monthly", () => {
  const f = { plan: "core", createdAt: ago(90), completedTotal: 4, lastActivityAt: ago(20), sent: {} };
  assert.deepEqual(pickSharedEmail(f, MON), { key: "all-inactive", dedupeKey: "all-inactive:2026-10" });
  assert.equal(pickSharedEmail({ ...f, lastActivityAt: ago(5) }, MON), null, "still active");
  assert.equal(pickSharedEmail({ ...f, completedTotal: 0 }, MON), null, "never used it: the nudge covers that");
  assert.equal(pickSharedEmail({ ...f, sent: { "all-inactive:2026-10": ago(2) } }, MON), null, "already this month");
  assert.equal(pickSharedEmail({ ...f, createdAt: ago(5) }, MON), null, "too new");
});

test("the win-back goes to a cancelled parent 30 to 120 days later, who is still on Free, once", () => {
  const f = (days, over = {}) => ({ plan: "free", createdAt: ago(200), completedTotal: 0, lastActivityAt: null, sent: { "bill-cancel:sub_1": ago(days) }, ...over });
  assert.equal(pickSharedEmail(f(35), MON).key, "bill-winback");
  assert.equal(pickSharedEmail(f(10), MON), null, "too soon");
  assert.equal(pickSharedEmail(f(200), MON), null, "too long ago");
  assert.equal(pickSharedEmail(f(35, { plan: "core" }), MON), null, "they came back");
  assert.equal(pickSharedEmail(f(35, { sent: { "bill-cancel:sub_1": ago(35), "bill-winback": ago(2) } }), MON), null, "only once");
});

// ------------------------------------------------------------------ what each paid email says

const SAMPLE_COUNT = ALL_EMAIL_KEYS.length;

for (const key of PAID_EMAIL_KEYS) {
  test(`${key}: on brand, with the feedback link and address, and the right unsubscribe behaviour`, () => {
    const e = buildAnyEmail(key, { token: TOKEN, address: "1 Example St", ...sampleContext(key) });
    assert.ok(e.subject.length > 5 && e.subject.length <= 70, `subject length ${e.subject.length}`);
    assert.ok(e.html.includes("LiteracyLab <span class=\"ll-ai\""), "header wordmark");
    assert.ok(e.html.includes("#7A3B45"), "brand wine");
    assert.ok(e.html.includes("1 Example St"), "postal address");
    if (isTransactional(key)) {
      assert.ok(!e.html.includes("Something missing or confusing?"), "a payment, welcome or account notice has no feedback line");
      assert.ok(!e.html.includes("Was this email useful?"));
    } else {
      assert.ok(e.html.includes(`${SITE}/feedback?e=${key}&amp;t=${TOKEN}&amp;r=more`), "quiet feedback line");
      assert.ok(e.text.includes("Something missing or confusing? Tell us:"), "plain-text feedback line");
    }
    assert.ok(!/undefined|NaN|\[object/.test(e.html), "no broken placeholders in the page");
    if (isTransactional(key)) {
      assert.equal(e.transactional, true);
      assert.ok(!e.html.includes("/unsubscribe?t="), "account emails have no unsubscribe link");
      assert.ok(!e.text.includes("Unsubscribe:"));
    } else {
      assert.equal(e.transactional, false);
      assert.ok(e.html.includes(`${SITE}/unsubscribe?t=${TOKEN}`), "lifecycle emails have the unsubscribe link");
    }
  });
}

test("which emails are account emails (sent even after an unsubscribe) is exactly: paid welcomes, learners paused, payment failed, cancellation", () => {
  assert.deepEqual([...TRANSACTIONAL].sort(), ["bill-cancel", "bill-failed", "core-welcome", "prem-paused", "prem-welcome"]);
});

test("only the weekly reports copy the owner, and only they carry the Yes/No row", () => {
  for (const key of PAID_EMAIL_KEYS) {
    const e = buildAnyEmail(key, { token: TOKEN, address: "x", ...sampleContext(key) });
    const weekly = key === "core-weekly" || key === "prem-digest";
    assert.deepEqual(e.bcc, weekly ? ["support@literacylabai.com"] : undefined, key);
    assert.equal(e.html.includes("Was this email useful?"), weekly, key);
  }
});

test("Core weekly report shows the real numbers, the reading average and the focus skills", () => {
  const e = buildPaidEmail("core-weekly", { token: TOKEN, address: "x", pieces: 4, words: 512, days: 3, readingAvg: 75, glow: "Similes", grow: "Commas" });
  assert.match(e.html, /This week: 4 pieces completed, 512 words written, on 3 days\./);
  assert.match(e.html, /Reading comprehension average: 75%\./);
  assert.match(e.html, /What went well: Similes\./);
  assert.match(e.html, /Next skill to work on: Commas\./);
  const bare = buildPaidEmail("core-weekly", { token: TOKEN, address: "x", pieces: 1, words: 0, days: 1, readingAvg: null, glow: null, grow: null });
  assert.match(bare.html, /This week: 1 piece completed, on 1 day\./);
  assert.ok(!/Reading comprehension average|What went well|Next skill/.test(bare.html), "nothing invented when the data is missing");
});

test("Premium digest lists every learner and the household total", () => {
  const e = buildPaidEmail("prem-digest", { token: TOKEN, address: "x", pieces: 3, words: 420, glow: null, grow: null, learners: [{ name: "Maya", pieces: 2, words: 300 }, { name: "Sam", pieces: 1, words: 120 }] });
  assert.match(e.html, /Across the household: 3 pieces completed, 420 words written\./);
  assert.match(e.html, /Maya: 2 pieces, 300 words\./);
  assert.match(e.html, /Sam: 1 piece, 120 words\./);
});

test("a learner's name in the digest is escaped, never treated as markup", () => {
  const e = buildPaidEmail("prem-digest", { token: TOKEN, address: "x", pieces: 1, words: 10, learners: [{ name: "<img src=x onerror=1>", pieces: 1, words: 10 }] });
  assert.ok(!e.html.includes("<img src=x"));
  assert.ok(e.html.includes("&lt;img src=x onerror=1&gt;"));
});

test("cancellation email states the end date when access continues, and links to the feedback form", () => {
  const scheduled = buildPaidEmail("bill-cancel", { token: TOKEN, address: "x", endDate: "30 October 2026" });
  assert.match(scheduled.text, /You'll keep your plan until 30 October 2026\./);
  assert.ok(scheduled.html.includes(`${SITE}/feedback?e=bill-cancel&amp;t=${TOKEN}&amp;r=more`), "the 'Tell us why' button opens the feedback form");
  const ended = buildPaidEmail("bill-cancel", { token: TOKEN, address: "x", endDate: null });
  assert.match(ended.html, /Your account has moved to the Free plan\./);
  assert.ok(!ended.text.includes("You'll keep your plan until"));
});

test("learners-paused email states how many are covered and paused", () => {
  const one = buildPaidEmail("prem-paused", { token: TOKEN, address: "x", maxLearners: 1, paused: 2 });
  assert.match(one.html, /covers 1 learner, so 2 learners are paused/);
  const two = buildPaidEmail("prem-paused", { token: TOKEN, address: "x", maxLearners: 1, paused: 1 });
  assert.match(two.html, /so 1 learner is paused/);
});

test("the payment-failed email says the plan is off now (no grace period) and how to switch it back on", () => {
  const e = buildPaidEmail("bill-failed", { token: TOKEN, address: "x" });
  assert.ok(!/stays active|remain active|keep your plan while|to keep your plan/i.test(e.text), "no promise that the plan stays on");
  assert.match(e.text, /moved to the Free plan/);
  assert.match(e.text, /choose See plans and pick your plan again/);
  assert.match(e.text, /All of your learners' work is safe/);
});

test("feedback is asked for only where it is relevant: the rating row on four emails, the footer line on optional emails, never on payment or account emails", () => {
  const rated = [], footer = [], none = [];
  for (const key of ALL_EMAIL_KEYS) {
    const e = buildAnyEmail(key, { token: TOKEN, address: "x", ...sampleContext(key) });
    if (e.html.includes("Was this email useful?")) rated.push(key);
    else if (e.html.includes("Something missing or confusing?")) footer.push(key);
    else none.push(key);
  }
  assert.deepEqual(rated.sort(), ["core-weekly", "free-weekly-lite", "free-welcome", "prem-digest"]);
  assert.deepEqual(none.sort(), ["bill-cancel", "bill-failed", "core-welcome", "prem-paused", "prem-welcome"], "the account emails: the cancellation asks through its own button");
  assert.equal(footer.length + rated.length + none.length, ALL_EMAIL_KEYS.length);
});

test("every email in the catalogue is covered by the owner's test-copies action", () => {
  assert.ok(SAMPLE_COUNT >= 19, `${SAMPLE_COUNT} emails`);
  for (const key of ALL_EMAIL_KEYS) assert.ok(buildAnyEmail(key, { token: TOKEN, address: "x", ...sampleContext(key) }).html.length > 1000, key);
});

// ------------------------------------------------------------------ the daily job, for paid accounts

const recorder = () => { const sent = []; return { sent, send: async (m) => { sent.push(m); return { id: "re_" + sent.length }; } }; };
const done = (profile, child, days, extra = {}, from = MON) => ({ profile_id: profile, child_id: child, created_at: ago(days, from).toISOString(), kind: "writing", tier: "elementary", score: null, total_questions: null, word_count: 100, feedback: {}, glow: "Similes", grow: "Commas", ...extra });

function paidWorld(plan, submissions, extra = {}) {
  return {
    profiles: [{ id: "p-paid", email: "paid@example.com", plan, created_at: ago(90).toISOString() }],
    email_preferences: extra.prefs || [], email_log: extra.log || [], submissions,
    child_profiles: extra.kids || [{ id: "c1", profile_id: "p-paid", display_name: "Maya" }, { id: "c2", profile_id: "p-paid", display_name: "Sam" }],
  };
}

test("job: a Core parent gets the weekly report on Monday, with real stats, the owner copied and an unsubscribe header", async () => {
  const tables = paidWorld("core", [
    done("p-paid", "c1", 30), done("p-paid", "c1", 20),
    done("p-paid", "c1", 5, { kind: "reading", score: 3, total_questions: 4 }),
    done("p-paid", "c1", 4, { kind: "reading", score: 4, total_questions: 4 }),
    done("p-paid", "c1", 2),
  ]);
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "PO Box 1, Town", dryRun: false });
  assert.equal(s.sent, 1);
  const m = r.sent[0];
  assert.equal(m.to, "paid@example.com");
  assert.match(m.subject, /weekly progress report/);
  assert.match(m.html, /This week: 3 pieces completed, 300 words written, on 3 days\./);
  assert.match(m.html, /Reading comprehension average: 88%\./, "(75% and 100%) averaged");
  assert.match(m.html, /What went well: Similes\./);
  assert.deepEqual(m.bcc, ["support@literacylabai.com"]);
  assert.match(m.oneClickUrl, /action=unsubscribe/);
  assert.equal(tables.email_log[0].dedupe_key, "core-weekly:2026-10-12");
});

test("job: a Premium parent gets a digest that names each learner's week", async () => {
  const tables = paidWorld("premium", [done("p-paid", "c1", 30), done("p-paid", "c1", 2), done("p-paid", "c1", 1), done("p-paid", "c2", 3, { word_count: 50 })]);
  const r = recorder();
  await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false });
  assert.match(r.sent[0].subject, /household's week/);
  assert.match(r.sent[0].html, /Across the household: 3 pieces completed, 250 words written\./);
  assert.match(r.sent[0].html, /Maya: 2 pieces, 200 words\./);
  assert.match(r.sent[0].html, /Sam: 1 piece, 50 words\./);
});

test("job: 'pro' (the legacy plan) is treated as Premium", async () => {
  const tables = paidWorld("pro", [done("p-paid", "c1", 30), done("p-paid", "c1", 2)]);
  const r = recorder();
  await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false });
  assert.match(r.sent[0].subject, /household's week/);
});

test("job: the 10th piece triggers the milestone with the lifetime word count", async () => {
  const subs = Array.from({ length: 10 }, (_, i) => done("p-paid", "c1", 40 + i * 3));
  const tables = paidWorld("core", subs);
  const r = recorder();
  await runFreeEmailJob({ supabase: fakeDb(tables), now: TUE, send: r.send, address: "x", dryRun: false });
  assert.equal(r.sent.length, 1);
  assert.match(r.sent[0].subject, /^10 pieces done$/);
  assert.match(r.sent[0].text, /That's 10 completed pieces on LiteracyLab AI, with 1000 words written\./);
});

test("job: a Core parent with a recent High School piece is invited to Premium", async () => {
  const tables = paidWorld("core", [done("p-paid", "c1", 30), done("p-paid", "c1", 20), done("p-paid", "c1", 6, { tier: "high" })]);
  const r = recorder();
  await runFreeEmailJob({ supabase: fakeDb(tables), now: TUE, send: r.send, address: "x", dryRun: false });
  assert.match(r.sent[0].subject, /exam-technique scoring/);
});

test("job: someone quiet for 3 weeks gets the we-miss-you email; a Free one too", async () => {
  for (const plan of ["core", "free"]) {
    const tables = paidWorld(plan, [done("p-paid", "c1", 40), done("p-paid", "c1", 30), done("p-paid", "c1", 25)]);
    const r = recorder();
    await runFreeEmailJob({ supabase: fakeDb(tables), now: TUE, send: r.send, address: "x", dryRun: false });
    assert.match(r.sent[0].subject, /little while/, plan);
  }
});

test("job: a cancelled parent, 35 days on, gets the win-back once", async () => {
  const tables = paidWorld("free", [], { log: [{ id: "x", profile_id: "p-paid", email_key: "bill-cancel", dedupe_key: "bill-cancel:sub_1", sent_at: ago(35).toISOString() }] });
  const r = recorder();
  await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false });
  assert.match(r.sent[0].subject, /love to have you back/);
  const again = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false });
  assert.equal(again.sent, 0);
});

test("job: paid parents who unsubscribed get no lifecycle email", async () => {
  const tables = paidWorld("core", [done("p-paid", "c1", 30), done("p-paid", "c1", 2)], { prefs: [{ profile_id: "p-paid", marketing_opt_out: true, unsubscribe_token: "t" }] });
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false });
  assert.equal(s.optedOut, 1);
  assert.equal(r.sent.length, 0);
});

test("job: the daily run never sends the account emails (welcome, failed payment, cancellation, paused): only Stripe events do", async () => {
  const tables = paidWorld("core", [done("p-paid", "c1", 2)]);
  const r = recorder();
  await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false });
  for (const m of r.sent) assert.ok(!/Welcome to LiteracyLab AI Core|payment|cancelled|paused/i.test(m.subject), m.subject);
});

test("job: a dry run over paid accounts reports the plan and changes nothing", async () => {
  const tables = paidWorld("core", [done("p-paid", "c1", 30), done("p-paid", "c1", 2)]);
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: true });
  assert.equal(s.eligible, 1);
  assert.equal(s.plan[0].email, "core-weekly");
  assert.equal(r.sent.length, 0);
  assert.equal(tables.email_log.length, 0);
});

// ------------------------------------------------------------------ billing emails from Stripe events

function billingWorld(extra = {}) {
  return {
    profiles: [{ id: "p1", email: "parent@example.com", plan: extra.plan || "premium", created_at: ago(90).toISOString() }],
    email_preferences: extra.prefs || [], email_log: [],
    child_profiles: Array.from({ length: extra.kids == null ? 3 : extra.kids }, (_, i) => ({ id: `c${i}`, profile_id: "p1" })),
  };
}
const ev = (type, object, previous, id = "evt_1") => ({ id, type, data: { object, previous_attributes: previous } });
const BEFORE = { id: "p1", email: "parent@example.com", plan: "premium" };

test("billing: paying for Core sends the Core welcome, and Premium sends the Premium welcome, each once", () => withEnv(LIVE, async () => {
  for (const [plan, subject] of [["core", /Welcome to LiteracyLab AI Core/], ["premium", /Welcome to LiteracyLab AI Premium/]]) {
    const tables = billingWorld();
    const r = recorder();
    const event = ev("checkout.session.completed", { subscription: "sub_1" });
    const out = await notifyBillingEvent({ event, supabase: fakeDb(tables), after: { profileId: "p1", plan }, before: null, send: r.send });
    assert.deepEqual(out, ["sent"]);
    assert.match(r.sent[0].subject, subject);
    assert.equal(r.sent[0].oneClickUrl, undefined, "an account email has no unsubscribe header");
    const again = await notifyBillingEvent({ event, supabase: fakeDb(tables), after: { profileId: "p1", plan }, before: null, send: r.send });
    assert.deepEqual(again, ["skipped: already sent"], "Stripe retrying the same event sends nothing more");
    assert.equal(r.sent.length, 1);
  }
}));

test("billing: a cancellation scheduled for the end of the period says when access ends; an immediate one says it has ended", () => withEnv(LIVE, async () => {
  const end = Math.floor(new Date("2026-10-30T00:00:00Z").getTime() / 1000);
  const tables = billingWorld();
  const r = recorder();
  await notifyBillingEvent({ event: ev("customer.subscription.updated", { id: "sub_1", cancel_at_period_end: true, current_period_end: end, status: "active" }, { cancel_at_period_end: false }), supabase: fakeDb(tables), after: { plan: "premium" }, before: BEFORE, send: r.send });
  assert.match(r.sent[0].subject, /cancelled/);
  assert.match(r.sent[0].text, /You'll keep your plan until 30 October 2026\./);

  // the later deleted event for the same subscription adds nothing
  const out = await notifyBillingEvent({ event: ev("customer.subscription.deleted", { id: "sub_1", status: "canceled" }, undefined, "evt_2"), supabase: fakeDb(tables), after: { plan: "free" }, before: BEFORE, send: r.send });
  assert.ok(out.includes("skipped: already sent"));
  assert.equal(r.sent.filter((m) => /cancelled/.test(m.subject)).length, 1, "one cancellation email per subscription");

  const t2 = billingWorld({ kids: 1 });
  const r2 = recorder();
  await notifyBillingEvent({ event: ev("customer.subscription.deleted", { id: "sub_9", status: "canceled" }), supabase: fakeDb(t2), after: { plan: "free" }, before: BEFORE, send: r2.send });
  assert.match(r2.sent[0].html, /Your account has moved to the Free plan\./);
}));

test("billing: a payment failing (active to past due) sends the failed-payment email once per billing period", () => withEnv(LIVE, async () => {
  const tables = billingWorld({ kids: 1 });
  const r = recorder();
  const event = ev("customer.subscription.updated", { id: "sub_1", status: "past_due", current_period_end: 1790000000 }, { status: "active" });
  await notifyBillingEvent({ event, supabase: fakeDb(tables), after: { plan: "free" }, before: { ...BEFORE, plan: "core" }, send: r.send });
  assert.match(r.sent[0].subject, /couldn't take your LiteracyLab AI payment/);
  const again = await notifyBillingEvent({ event: { ...event, id: "evt_retry" }, supabase: fakeDb(tables), after: { plan: "free" }, before: { ...BEFORE, plan: "core" }, send: r.send });
  assert.ok(again.includes("skipped: already sent"));
  // an ordinary renewal or an already-failing subscription does not trigger it
  const quiet = await notifyBillingEvent({ event: ev("customer.subscription.updated", { id: "sub_2", status: "active" }, { current_period_end: 1 }, "evt_3"), supabase: fakeDb(tables), after: { plan: "core" }, before: { ...BEFORE, plan: "core" }, send: r.send });
  assert.deepEqual(quiet, []);
}));

test("billing: a downgrade that leaves more learners than the plan covers sends the paused email", () => withEnv(LIVE, async () => {
  const tables = billingWorld({ kids: 3 });
  const r = recorder();
  await notifyBillingEvent({ event: ev("customer.subscription.updated", { id: "sub_1", status: "active" }, {}), supabase: fakeDb(tables), after: { plan: "core" }, before: BEFORE, send: r.send });
  assert.match(r.sent[0].subject, /paused/);
  assert.match(r.sent[0].html, /covers 1 learner, so 2 learners are paused/);

  const fine = billingWorld({ kids: 1 });
  const r2 = recorder();
  const out = await notifyBillingEvent({ event: ev("customer.subscription.updated", { id: "sub_1", status: "active" }, {}), supabase: fakeDb(fine), after: { plan: "core" }, before: BEFORE, send: r2.send });
  assert.deepEqual(out, [], "one learner fits the smaller plan: nothing to say");
}));

test("billing: nothing is sent until emails are switched on, and a missing key or address also stops it", async () => {
  for (const env of [{ EMAIL_LIVE: undefined, RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: "x" }, { EMAIL_LIVE: "true", RESEND_API_KEY: undefined, EMAIL_POSTAL_ADDRESS: "x" }, { EMAIL_LIVE: "true", RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: undefined }]) {
    await withEnv(env, async () => {
      const tables = billingWorld();
      const r = recorder();
      const out = await notifyBillingEvent({ event: ev("checkout.session.completed", { subscription: "sub_1" }), supabase: fakeDb(tables), after: { profileId: "p1", plan: "core" }, before: null, send: r.send });
      assert.match(out[0], /^skipped/);
      assert.equal(r.sent.length, 0);
      assert.equal(tables.email_log.length, 0, "nothing recorded as sent");
    });
  }
});

test("billing: a parent who unsubscribed from lifecycle emails still gets their own payment and cancellation emails", () => withEnv(LIVE, async () => {
  const tables = billingWorld({ kids: 1, prefs: [{ profile_id: "p1", marketing_opt_out: true, unsubscribe_token: "tok" }] });
  const r = recorder();
  await notifyBillingEvent({ event: ev("customer.subscription.deleted", { id: "sub_1", status: "canceled" }), supabase: fakeDb(tables), after: { plan: "free" }, before: BEFORE, send: r.send });
  assert.equal(r.sent.length, 1);
}));

test("billing: if sending fails, nothing throws, the claim is released, and Stripe's retry can send it", () => withEnv(LIVE, async () => {
  const tables = billingWorld({ kids: 1 });
  const event = ev("customer.subscription.deleted", { id: "sub_1", status: "canceled" });
  const out = await notifyBillingEvent({ event, supabase: fakeDb(tables), after: { plan: "free" }, before: BEFORE, send: async () => { throw new Error("Resend is down"); } });
  assert.match(out[0], /^error: Resend is down/);
  assert.equal(tables.email_log.length, 0);
  const r = recorder();
  const retry = await notifyBillingEvent({ event, supabase: fakeDb(tables), after: { plan: "free" }, before: BEFORE, send: r.send });
  assert.deepEqual(retry, ["sent"]);
}));

// ------------------------------------------------------------------ the real webhook handler, end to end with the emails

function webhookReq(event) {
  const req = new EventEmitter();
  req.method = "POST";
  req.headers = { "stripe-signature": "t=1,v1=sig" };
  process.nextTick(() => { req.emit("data", Buffer.from(JSON.stringify(event))); req.emit("end"); });
  return req;
}
const whSub = (price, status = "active", extra = {}) => ({ id: "sub_1", customer: "cus_1", status, items: { data: [{ price: { id: price } }] }, ...extra });

async function runWebhookWithEmails(event, { kids = 3, plan = "premium", retrieved } = {}) {
  const sentMail = [];
  const updates = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { sentMail.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ id: "re_" + sentMail.length }) }; };
  try {
    return await withEnv({ ...LIVE, STRIPE_WEBHOOK_SECRET: "whsec", STRIPE_PRICE_ID_CORE: "price_core", STRIPE_PRICE_ID_PREMIUM: "price_premium" }, async () => {
      const stripe = { webhooks: { constructEvent: (raw) => JSON.parse(raw.toString()) }, subscriptions: { retrieve: async () => retrieved } };
      const h = loadHandler("stripe-webhook.js", {
        stripe,
        db: (q) => {
          if (q.table === "profiles" && did(q, "update")) { updates.push(q.ops.find(([n]) => n === "update")[1]); return { data: null, error: null }; }
          if (q.table === "profiles") return { data: { id: "p1", email: "parent@example.com", plan }, error: null };
          if (q.table === "email_preferences" && !did(q, "upsert")) return { data: { unsubscribe_token: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }, error: null };
          if (q.table === "email_log" && did(q, "insert")) return { data: { id: "log1" }, error: null };
          if (q.table === "child_profiles") return { data: null, count: kids, error: null };
          return { data: null, error: null };
        },
      });
      const res = fakeRes();
      await h(webhookReq(event), res);
      return { res, mail: sentMail, updates };
    });
  } finally { globalThis.fetch = realFetch; }
}

test("webhook: a Core purchase updates the plan AND sends the Core welcome", async () => {
  const { res, mail, updates } = await runWebhookWithEmails(
    { id: "evt_a", type: "checkout.session.completed", data: { object: { mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: "p1" } } },
    { retrieved: whSub("price_core") });
  assert.equal(res.statusCode, 200);
  assert.equal(updates[0].plan, "core");
  assert.equal(mail.length, 1);
  assert.match(mail[0].subject, /Welcome to LiteracyLab AI Core/);
  assert.deepEqual(mail[0].to, ["parent@example.com"]);
});

test("webhook: cancelling updates the plan to Free and sends the cancellation email", async () => {
  const { res, mail, updates } = await runWebhookWithEmails({ id: "evt_b", type: "customer.subscription.deleted", data: { object: whSub("price_premium", "canceled") } }, { kids: 1 });
  assert.equal(res.statusCode, 200);
  assert.equal(updates[0].plan, "free");
  assert.match(mail[0].subject, /cancelled/);
});

test("webhook: a Premium to Core downgrade with 3 learners sends the paused email", async () => {
  const { mail, updates } = await runWebhookWithEmails({ id: "evt_c", type: "customer.subscription.updated", data: { object: whSub("price_core"), previous_attributes: {} } }, { kids: 3 });
  assert.equal(updates[0].plan, "core");
  assert.match(mail[0].subject, /paused/);
});

test("webhook: a failing email service never stops the plan update or fails the webhook", async () => {
  const realFetch = globalThis.fetch;
  try {
    await withEnv({ ...LIVE, STRIPE_WEBHOOK_SECRET: "whsec", STRIPE_PRICE_ID_CORE: "price_core", STRIPE_PRICE_ID_PREMIUM: "price_premium" }, async () => {
      globalThis.fetch = async () => { throw new Error("network down"); };
      const updates = [];
      const h = loadHandler("stripe-webhook.js", {
        stripe: { webhooks: { constructEvent: (raw) => JSON.parse(raw.toString()) }, subscriptions: { retrieve: async () => whSub("price_core") } },
        db: (q) => {
          if (q.table === "profiles" && did(q, "update")) { updates.push(q.ops.find(([n]) => n === "update")[1]); return { data: null, error: null }; }
          if (q.table === "profiles") return { data: { id: "p1", email: "parent@example.com", plan: "premium" }, error: null };
          if (q.table === "email_preferences" && !did(q, "upsert")) return { data: { unsubscribe_token: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" }, error: null };
          if (q.table === "email_log" && did(q, "insert")) return { data: { id: "log1" }, error: null };
          return { data: null, count: 1, error: null };
        },
      });
      const res = fakeRes();
      await h(webhookReq({ id: "evt_d", type: "customer.subscription.deleted", data: { object: whSub("price_core", "canceled") } }), res);
      assert.equal(res.statusCode, 200, "Stripe must get a success so it does not keep retrying");
      assert.equal(updates[0].plan, "free", "the plan still changed");
    });
  } finally { globalThis.fetch = realFetch; }
});

test("webhook: with emails switched off, billing behaves exactly as before and sends nothing", async () => {
  const realFetch = globalThis.fetch;
  let called = 0;
  try {
    globalThis.fetch = async () => { called++; return { ok: true, json: async () => ({ id: "x" }) }; };
    await withEnv({ EMAIL_LIVE: undefined, RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: "x", STRIPE_WEBHOOK_SECRET: "whsec", STRIPE_PRICE_ID_CORE: "price_core", STRIPE_PRICE_ID_PREMIUM: "price_premium" }, async () => {
      const h = loadHandler("stripe-webhook.js", {
        stripe: { webhooks: { constructEvent: (raw) => JSON.parse(raw.toString()) }, subscriptions: { retrieve: async () => whSub("price_core") } },
        db: () => ({ data: null, count: 1, error: null }),
      });
      const res = fakeRes();
      await h(webhookReq({ id: "evt_e", type: "customer.subscription.deleted", data: { object: whSub("price_core", "canceled") } }), res);
      assert.equal(res.statusCode, 200);
      assert.equal(called, 0);
    });
  } finally { globalThis.fetch = realFetch; }
});

// ------------------------------------------------------------------ Supabase sign-in emails (pasted into Supabase)

const fs = require("node:fs");
const path = require("node:path");
const { buildAuthEmails, LINK, AUTH_EMAIL_ADDRESS } = require("../api/_lib/authEmails");
const TEMPLATE_DIR = path.join(__dirname, "..", "supabase", "email-templates");
const ADDRESS = AUTH_EMAIL_ADDRESS;

test("auth emails: the confirm and reset templates carry Supabase's link placeholder exactly once, on the button", () => {
  const { confirm, reset } = buildAuthEmails(ADDRESS);
  for (const e of [confirm, reset]) {
    assert.equal(e.html.split(LINK).length - 1, 1, "one placeholder in the HTML");
    assert.ok(e.html.includes(`href="${LINK}"`), "the button points at the placeholder");
    assert.ok(e.text.includes(LINK));
    assert.ok(e.html.includes("#7A3B45") && e.html.includes("LiteracyLab <span"), "on brand");
    assert.ok(e.html.includes(ADDRESS));
    assert.ok(!e.html.includes("/unsubscribe"), "account emails have no unsubscribe link");
  }
  assert.equal(confirm.subject, "Confirm your LiteracyLab AI email");
  assert.equal(reset.subject, "Reset your LiteracyLab AI password");
});

test("auth emails: the committed files to paste into Supabase match what the code produces", () => {
  const { confirm, reset } = buildAuthEmails(ADDRESS);
  assert.equal(fs.readFileSync(path.join(TEMPLATE_DIR, "confirm-signup.html"), "utf8").replace(/\r\n/g, "\n"), confirm.html);
  assert.equal(fs.readFileSync(path.join(TEMPLATE_DIR, "reset-password.html"), "utf8").replace(/\r\n/g, "\n"), reset.html);
});
