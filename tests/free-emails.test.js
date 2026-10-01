const test = require("node:test");
const assert = require("node:assert/strict");
const { pickEmail, buildFreeEmail, FREE_EMAIL_KEYS } = require("../api/_lib/freeEmails");
const { runFreeEmailJob } = require("../api/_lib/emailJob");
const { sendEmail } = require("../api/_lib/emailSend");
const { SITE } = require("../api/_lib/emailTemplate");
const { loadHandler, call } = require("./harness");

const DAY = 86400000;
// A Monday (UTC), mid-month, so weekly and reset rules are easy to place.
const MON = new Date("2026-10-12T22:00:00Z");
const ago = (days, from = MON) => new Date(from.getTime() - days * DAY);
const facts = (over = {}) => ({ createdAt: ago(30), usedThisMonth: 0, completedTotal: 0, firstCompletedAt: null, completedLast7d: 0, sent: {}, ...over });

// ------------------------------------------------------------------ who gets which email

test("a brand-new account gets the welcome, once", () => {
  assert.equal(pickEmail(facts({ createdAt: ago(0.5) }), MON).key, "free-welcome");
  assert.equal(pickEmail(facts({ createdAt: ago(0.5), sent: { "free-welcome": ago(0.4) } }), MON), null);
});

test("an old account is never back-filled with a welcome", () => {
  assert.notEqual(pickEmail(facts({ createdAt: ago(40) }), MON)?.key, "free-welcome");
});

test("hitting 3 pieces sends the limit email once per month", () => {
  const p = pickEmail(facts({ usedThisMonth: 3 }), MON);
  assert.deepEqual(p, { key: "free-limit", dedupeKey: "free-limit:2026-10" });
  assert.equal(pickEmail(facts({ usedThisMonth: 3, sent: { "free-limit:2026-10": ago(1) } }), MON), null);
  // next month it can fire again
  const nov = new Date("2026-11-10T22:00:00Z");
  assert.equal(pickEmail(facts({ usedThisMonth: 3, sent: { "free-limit:2026-10": ago(20, nov) } }), nov).dedupeKey, "free-limit:2026-11");
});

test("the '2 of 3' email goes to someone on exactly 2, and not after the limit email", () => {
  assert.equal(pickEmail(facts({ usedThisMonth: 2 }), MON).key, "free-2-of-3");
  assert.equal(pickEmail(facts({ usedThisMonth: 2, sent: { "free-limit:2026-10": ago(5) } }), MON), null);
});

test("no two non-essential emails within 2 days, but the welcome and limit notices always go", () => {
  const recent = { "free-nudge": ago(1) };
  assert.equal(pickEmail(facts({ usedThisMonth: 2, sent: recent }), MON), null, "2-of-3 waits");
  assert.equal(pickEmail(facts({ usedThisMonth: 3, sent: recent }), MON).key, "free-limit", "limit is essential");
  assert.equal(pickEmail(facts({ createdAt: ago(0.2), sent: recent }), MON).key, "free-welcome", "welcome is essential");
});

test("the monthly reset email only goes in the first days of the month to people who hit last month's limit", () => {
  const first = new Date("2026-11-02T22:00:00Z");
  const sent = { "free-limit:2026-10": ago(20, first) };
  assert.equal(pickEmail(facts({ sent }), first).key, "free-reset");
  assert.equal(pickEmail(facts({ sent }), new Date("2026-11-20T22:00:00Z")), null, "too late in the month");
  assert.equal(pickEmail(facts({}), first), null, "they never hit the limit");
  assert.equal(pickEmail(facts({ sent, usedThisMonth: 1 }), first), null, "already back using it");
});

test("the first-feedback follow-up goes 1 to 6 days after the first completed piece", () => {
  const base = { completedTotal: 1 };
  assert.equal(pickEmail(facts({ ...base, firstCompletedAt: ago(2) }), MON).key, "free-first-followup");
  assert.equal(pickEmail(facts({ ...base, firstCompletedAt: ago(0.3) }), MON), null, "too soon");
  assert.equal(pickEmail(facts({ ...base, firstCompletedAt: ago(20) }), MON), null, "too late");
});

test("the nudge goes to people who signed up 2 to 14 days ago and have not finished a piece", () => {
  const welcomed = (days) => ({ "free-welcome": ago(days) });
  assert.equal(pickEmail(facts({ createdAt: ago(3), sent: welcomed(2.9) }), MON).key, "free-nudge");
  assert.equal(pickEmail(facts({ createdAt: ago(1), sent: welcomed(0.9) }), MON), null, "too soon");
  assert.equal(pickEmail(facts({ createdAt: ago(30), sent: welcomed(29) }), MON), null, "too late");
  assert.equal(pickEmail(facts({ createdAt: ago(3), sent: welcomed(2.9), completedTotal: 1, firstCompletedAt: ago(3) }), MON).key, "free-first-followup");
});

test("the weekly summary goes on Mondays to people active this week, once a week", () => {
  const active = { completedTotal: 3, completedLast7d: 2, firstCompletedAt: ago(20) };
  assert.equal(pickEmail(facts(active), MON).key, "free-weekly-lite");
  assert.equal(pickEmail(facts(active), new Date("2026-10-13T22:00:00Z")), null, "not a Monday");
  assert.equal(pickEmail(facts({ ...active, sent: { "free-weekly-lite:2026-10-12": ago(0.1) } }), MON), null, "already sent this week");
  assert.equal(pickEmail(facts({ ...active, completedLast7d: 0 }), MON), null, "nothing to report");
});

// ------------------------------------------------------------------ what each email says

const TOKEN = "11111111-2222-3333-4444-555555555555";
for (const key of FREE_EMAIL_KEYS) {
  test(`${key}: on brand, with unsubscribe, feedback link, address and analytics tags`, () => {
    const e = buildFreeEmail(key, { token: TOKEN, address: "1 Example St", stats: { pieces: 2, words: 340 } });
    assert.ok(e.subject.length > 5 && e.subject.length <= 70, `subject length ${e.subject.length}`);
    assert.ok(e.html.includes(`LiteracyLab <span class="ll-ai"`), "header wordmark");
    assert.ok(e.html.includes("#7A3B45"), "brand wine");
    assert.ok(e.html.includes(`${SITE}/unsubscribe?t=${TOKEN}`), "unsubscribe link");
    assert.ok(e.html.includes(`${SITE}/feedback?e=${key}&amp;t=${TOKEN}&amp;r=more`), "every email links to the feedback page, carrying the email and token");
    const rated = key === "free-welcome" || key === "free-weekly-lite";
    assert.equal(e.html.includes("Was this email useful?"), rated, rated ? "the rating row belongs on the welcome and the weekly summary" : "the other emails only have the quiet footer line");
    assert.equal(e.html.includes(`${SITE}/feedback?e=${key}&amp;t=${TOKEN}&amp;r=up`), rated, "thumbs links only where the row is");
    assert.ok(e.html.includes("Something missing or confusing?"), "every email has the quiet feedback line in the footer");
    assert.ok(e.html.includes("1 Example St"), "postal address");
    assert.ok(e.html.includes("utm_campaign=" + key.replace(/-/g, "_")), "analytics tag");
    assert.match(e.text, /Unsubscribe:/);
    assert.match(e.text, /Something missing or confusing\? Tell us: /);
    assert.equal(e.text.includes("Was this email useful?"), rated);
  });
}

test("only the weekly summary copies the owner", () => {
  for (const key of FREE_EMAIL_KEYS) {
    const e = buildFreeEmail(key, { token: TOKEN, address: "x", stats: { pieces: 1, words: 10 } });
    if (key === "free-weekly-lite") assert.deepEqual(e.bcc, ["support@literacylabai.com"]);
    else assert.equal(e.bcc, undefined, key);
  }
});

test("the weekly summary reports the real numbers", () => {
  const e = buildFreeEmail("free-weekly-lite", { token: TOKEN, address: "x", stats: { pieces: 3, words: 420 } });
  assert.match(e.html, /This week: 3 pieces completed, 420 words written\./);
  const one = buildFreeEmail("free-weekly-lite", { token: TOKEN, address: "x", stats: { pieces: 1, words: 0 } });
  assert.match(one.html, /This week: 1 piece completed\./);
});

// ------------------------------------------------------------------ the daily job, against an in-memory database

function fakeDb(tables, { blindSelect = [] } = {}) {
  let seq = 0;
  function from(table) {
    const q = { op: "select", filters: [], payload: null, single: false, maybe: false, opts: {} };
    const api = {
      select() { return api; },
      insert(p) { q.op = "insert"; q.payload = p; return api; },
      update(p) { q.op = "update"; q.payload = p; return api; },
      delete() { q.op = "delete"; return api; },
      upsert(p, o) { q.op = "upsert"; q.payload = p; q.opts = o || {}; return api; },
      eq(c, v) { q.filters.push((r) => r[c] === v); return api; },
      in(c, vs) { q.filters.push((r) => vs.includes(r[c])); return api; },
      not(c, op, v) { if (op === "is" && v === null) q.filters.push((r) => r[c] != null); return api; },
      gte(c, v) { q.filters.push((r) => String(r[c]) >= String(v)); return api; },
      order() { return api; },
      limit() { return api; },
      single() { q.single = true; return api; },
      maybeSingle() { q.single = true; q.maybe = true; return api; },
      then(ok, bad) { try { ok(run()); } catch (e) { bad(e); } },
    };
    function run() {
      const rows = tables[table] || [];
      const match = rows.filter((r) => q.filters.every((f) => f(r)));
      const one = (data) => (q.single ? (data[0] ? { data: data[0], error: null } : q.maybe ? { data: null, error: null } : { data: null, error: { message: "no rows" } }) : { data, error: null });
      if (q.op === "select") return one(blindSelect.includes(table) ? [] : match.map((r) => ({ ...r })));
      if (q.op === "insert") {
        if (table === "email_log" && rows.some((r) => r.profile_id === q.payload.profile_id && r.dedupe_key === q.payload.dedupe_key)) return { data: null, error: { code: "23505", message: "duplicate" } };
        const row = { id: `row${++seq}`, sent_at: new Date().toISOString(), ...q.payload };
        rows.push(row);
        return one([row]);
      }
      if (q.op === "update") { match.forEach((r) => Object.assign(r, q.payload)); return one(match); }
      if (q.op === "delete") { tables[table] = rows.filter((r) => !match.includes(r)); return { data: null, error: null }; }
      if (q.op === "upsert") {
        const exists = rows.some((r) => r.profile_id === q.payload.profile_id);
        if (!exists) rows.push({ marketing_opt_out: false, unsubscribe_token: `token-${q.payload.profile_id}`, ...q.payload });
        return { data: null, error: null };
      }
      throw new Error("unsupported " + q.op);
    }
    return api;
  }
  return { from };
}

function world(extra = {}) {
  return {
    profiles: [{ id: "p-new", email: "new@example.com", plan: "free", created_at: ago(0.5).toISOString() }, ...(extra.profiles || [])],
    email_preferences: extra.prefs || [],
    email_log: extra.log || [],
    submissions: extra.submissions || [],
  };
}
const recorder = () => { const sent = []; return { sent, send: async (m) => { sent.push(m); return { id: "re_" + sent.length }; } }; };

test("job: a dry run reports what it would do and sends and records nothing", async () => {
  const tables = world();
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: true });
  assert.equal(s.eligible, 1);
  assert.equal(s.sent, 0);
  assert.equal(r.sent.length, 0);
  assert.equal(tables.email_log.length, 0);
  assert.deepEqual(s.plan, [{ email: "free-welcome", account: "p-new" }]);
});

test("job: live run sends the welcome once, records it, and creates the parent's unsubscribe token", async () => {
  const tables = world();
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "1 Example St", dryRun: false });
  assert.equal(s.sent, 1);
  assert.equal(r.sent[0].to, "new@example.com");
  assert.match(r.sent[0].subject, /Welcome to LiteracyLab AI/);
  assert.equal(r.sent[0].oneClickUrl, `${SITE}/api/email?action=unsubscribe&t=token-p-new`);
  assert.equal(r.sent[0].idempotencyKey, "p-new:free-welcome");
  assert.equal(tables.email_log.length, 1);
  assert.equal(tables.email_log[0].dedupe_key, "free-welcome");
  assert.equal(tables.email_log[0].resend_id, "re_1");
  assert.equal(tables.email_preferences.length, 1);
});

test("job: running again the same day sends nothing more", async () => {
  const tables = world();
  const r = recorder();
  await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false });
  const again = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false });
  assert.equal(again.sent, 0);
  assert.equal(r.sent.length, 1);
});

test("job: a parent who unsubscribed is never emailed", async () => {
  const tables = world({ prefs: [{ profile_id: "p-new", marketing_opt_out: true, unsubscribe_token: "t" }] });
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false });
  assert.equal(s.optedOut, 1);
  assert.equal(r.sent.length, 0);
});

test("job: admin and test accounts are skipped", async () => {
  const tables = world();
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false, adminEmails: ["new@example.com"] });
  assert.equal(s.considered, 0);
  assert.equal(r.sent.length, 0);
});

test("job: if sending fails, the claim is released so the next run retries", async () => {
  const tables = world();
  const s1 = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: async () => { throw new Error("boom"); }, address: "x", dryRun: false });
  assert.equal(s1.errors, 1);
  assert.equal(s1.sent, 0);
  assert.equal(tables.email_log.length, 0, "nothing is recorded as sent");
  const r = recorder();
  const s2 = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false });
  assert.equal(s2.sent, 1);
});

test("job: two overlapping runs cannot both send (the database refuses the second claim)", async () => {
  // The welcome is already recorded, but this run read the log before that happened,
  // so it decides to send. The unique (parent, key) claim is what stops it.
  const tables = world({ log: [{ id: "x", profile_id: "p-new", email_key: "free-welcome", dedupe_key: "free-welcome", sent_at: ago(0).toISOString() }] });
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables, { blindSelect: ["email_log"] }), now: MON, send: r.send, address: "x", dryRun: false });
  assert.equal(r.sent.length, 0, "nothing was sent a second time");
  assert.equal(s.sent, 0);
  assert.equal(s.errors, 0, "losing the race is normal, not an error");
  assert.equal(tables.email_log.length, 1);
});

test("job: at most maxPerRun emails are sent in one run", async () => {
  const profiles = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, email: `p${i}@example.com`, plan: "free", created_at: ago(0.5).toISOString() }));
  const tables = { profiles, email_preferences: [], email_log: [], submissions: [] };
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false, maxPerRun: 2 });
  assert.equal(s.sent, 2);
  assert.equal(r.sent.length, 2);
});

test("job: unfinished pieces do not count as completed, but they do use a free piece", async () => {
  const tables = world({
    profiles: [{ id: "p-old", email: "old@example.com", plan: "free", created_at: ago(5).toISOString() }],
    submissions: [{ profile_id: "p-old", created_at: ago(1).toISOString(), word_count: null, feedback: { _pending: true }, pending: "true" }],
  });
  tables.profiles = tables.profiles.filter((p) => p.id === "p-old");
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: true });
  assert.equal(s.plan[0].email, "free-nudge", "still counts as never finishing a piece");
});

// ------------------------------------------------------------------ sending through Resend

test("sendEmail: posts to Resend with the brand sender, reply-to, BCC and one-click unsubscribe headers", async () => {
  let call1;
  const fetchImpl = async (url, opts) => { call1 = { url, opts, body: JSON.parse(opts.body) }; return { ok: true, json: async () => ({ id: "re_123" }) }; };
  const out = await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi", bcc: ["support@literacylabai.com"], oneClickUrl: "https://x/u", idempotencyKey: "k1", apiKey: "key", fetchImpl });
  assert.equal(out.id, "re_123");
  assert.equal(call1.url, "https://api.resend.com/emails");
  assert.equal(call1.opts.headers.Authorization, "Bearer key");
  assert.equal(call1.opts.headers["Idempotency-Key"], "k1");
  assert.equal(call1.body.from, "LiteracyLab AI <hello@literacylabai.com>");
  assert.equal(call1.body.reply_to, "support@literacylabai.com");
  assert.deepEqual(call1.body.bcc, ["support@literacylabai.com"]);
  assert.equal(call1.body.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(call1.body.headers["List-Unsubscribe"], /<https:\/\/x\/u>/);
});

test("sendEmail: refuses without a key, and surfaces a provider rejection", async () => {
  const saved = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  await assert.rejects(() => sendEmail({ to: "a@b.c", subject: "s", html: "h", text: "t" }), /RESEND_API_KEY/);
  if (saved) process.env.RESEND_API_KEY = saved;
  await assert.rejects(() => sendEmail({ to: "a@b.c", subject: "s", html: "h", text: "t", apiKey: "k", fetchImpl: async () => ({ ok: false, status: 422, json: async () => ({ message: "bad domain" }) }) }), /422.*bad domain/);
});

// ------------------------------------------------------------------ the endpoint: cron, unsubscribe, feedback

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
  const restore = () => { for (const k of Object.keys(vars)) { if (saved[k] == null) delete process.env[k]; else process.env[k] = saved[k]; } };
  return Promise.resolve().then(fn).finally(restore);
}

async function callWith(h, { method = "GET", query = {}, headers = {}, body } = {}) {
  const out = { statusCode: 200, body: undefined, headers: {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
  await h({ method, query, headers, body }, out);
  return out;
}

test("endpoint: cron refuses without the secret, with a wrong one, and for other methods", async () => {
  await withEnv({ CRON_SECRET: undefined }, async () => {
    const h = loadHandler("email.js", { db: () => ({ data: [], error: null }) });
    assert.equal((await callWith(h, { query: { action: "cron" } })).statusCode, 500);
  });
  await withEnv({ CRON_SECRET: "s3cret" }, async () => {
    const h = loadHandler("email.js", { db: () => ({ data: [], error: null }) });
    assert.equal((await callWith(h, { query: { action: "cron" } })).statusCode, 401, "no header");
    assert.equal((await callWith(h, { query: { action: "cron" }, headers: { authorization: "Bearer wrong" } })).statusCode, 401, "wrong secret");
    assert.equal((await callWith(h, { method: "DELETE", query: { action: "cron" }, headers: { authorization: "Bearer s3cret" } })).statusCode, 405);
    assert.equal((await callWith(h, { query: { action: "cron" }, headers: { authorization: "Bearer s3cret" } })).statusCode, 200);
  });
});

test("endpoint: cron stays a dry run until sending is switched on and every setting is present", async () => {
  await withEnv({ CRON_SECRET: "s3cret", EMAIL_LIVE: "true", RESEND_API_KEY: undefined, EMAIL_POSTAL_ADDRESS: undefined }, async () => {
    const h = loadHandler("email.js", { db: () => ({ data: [], error: null }) });
    const out = await callWith(h, { query: { action: "cron" }, headers: { authorization: "Bearer s3cret" } });
    assert.equal(out.statusCode, 200);
    assert.equal(out.body.mode, "dry-run");
    assert.deepEqual(out.body.missingSettings, ["RESEND_API_KEY", "EMAIL_POSTAL_ADDRESS"]);
  });
  await withEnv({ CRON_SECRET: "s3cret", EMAIL_LIVE: undefined, RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: "1 St" }, async () => {
    const h = loadHandler("email.js", { db: () => ({ data: [], error: null }) });
    const out = await callWith(h, { query: { action: "cron" }, headers: { authorization: "Bearer s3cret" } });
    assert.equal(out.body.mode, "dry-run", "the on-switch is separate from having the settings");
  });
  await withEnv({ CRON_SECRET: "s3cret", EMAIL_LIVE: "true", RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: "1 St" }, async () => {
    const h = loadHandler("email.js", { db: () => ({ data: [], error: null }) });
    const out = await callWith(h, { query: { action: "cron" }, headers: { authorization: "Bearer s3cret" } });
    assert.equal(out.body.mode, "live");
    const forced = await callWith(h, { query: { action: "cron", dry: "1" }, headers: { authorization: "Bearer s3cret" } });
    assert.equal(forced.body.mode, "dry-run", "?dry=1 always forces a dry run");
  });
});

const UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

test("endpoint: unsubscribe needs a valid token, and works with a POST (including the inbox's one-click)", async () => {
  const updates = [];
  const h = loadHandler("email.js", { db: (q) => { if (q.table === "email_preferences") { updates.push(q.ops.find(([n]) => n === "update")[1]); return { data: [{ profile_id: "p1" }], error: null }; } return { data: null }; } });
  assert.equal((await call(h, { method: "GET", query: { action: "unsubscribe", t: UUID } })).statusCode, 405);
  assert.equal((await call(h, { method: "POST", query: { action: "unsubscribe", t: "not-a-uuid" } })).statusCode, 400);
  const ok = await call(h, { method: "POST", query: { action: "unsubscribe", t: UUID }, body: "List-Unsubscribe=One-Click" });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.unsubscribed, true);
  assert.equal(updates[0].marketing_opt_out, true);
  const back = await call(h, { method: "POST", query: { action: "unsubscribe", t: UUID }, body: { resubscribe: true } });
  assert.equal(back.body.unsubscribed, false);
  assert.equal(updates[1].marketing_opt_out, false);
});

test("endpoint: an unknown unsubscribe token is a 404, not a silent success", async () => {
  const h = loadHandler("email.js", { db: () => ({ data: [], error: null }) });
  assert.equal((await call(h, { method: "POST", query: { action: "unsubscribe", t: UUID }, body: {} })).statusCode, 404);
});

function feedbackDb({ inserted = [], profileId = "p1", recent = 0 } = {}) {
  return (q) => {
    if (q.table === "email_preferences") return { data: profileId ? { profile_id: profileId } : null, error: null };
    if (q.table === "profiles") return { data: { email: "parent@example.com" }, error: null };
    if (q.table === "feedback" && q.ops.some(([n]) => n === "insert")) { inserted.push(q.ops.find(([n]) => n === "insert")[1]); return { data: null, error: null }; }
    if (q.table === "feedback") return { data: null, count: recent, error: null };
    return { data: null, error: null };
  };
}

test("endpoint: feedback is saved to the backlog, attributed to the parent by their link token", async () => {
  await withEnv({ RESEND_API_KEY: undefined }, async () => {
    const inserted = [];
    const h = loadHandler("email.js", { db: feedbackDb({ inserted }) });
    const res = await call(h, { method: "POST", query: { action: "feedback" }, body: { token: UUID, emailKey: "free-limit", rating: "down", category: "idea", message: "  Add a spelling game  ", contactOk: true } });
    assert.equal(res.statusCode, 200);
    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].profile_id, "p1");
    assert.equal(inserted[0].email_key, "free-limit");
    assert.equal(inserted[0].rating, "down");
    assert.equal(inserted[0].category, "idea");
    assert.equal(inserted[0].message, "Add a spelling game");
    assert.equal(inserted[0].contact_ok, true);
    assert.ok(inserted[0].ip_hash && inserted[0].ip_hash.length === 32 && !/\./.test(inserted[0].ip_hash), "a hash, never the raw address");
  });
});

test("endpoint: anonymous feedback is allowed, an unknown token is treated as anonymous, and junk is refused", async () => {
  await withEnv({ RESEND_API_KEY: undefined }, async () => {
    const inserted = [];
    const h = loadHandler("email.js", { db: feedbackDb({ inserted, profileId: null }) });
    assert.equal((await call(h, { method: "POST", query: { action: "feedback" }, body: { message: "Love it", category: "praise" } })).statusCode, 200);
    assert.equal((await call(h, { method: "POST", query: { action: "feedback" }, body: { token: UUID, message: "Hi" } })).statusCode, 200);
    assert.equal(inserted[0].profile_id, null);
    assert.equal(inserted[1].profile_id, null);
    assert.equal(inserted[0].category, "praise");
    assert.equal((await call(h, { method: "POST", query: { action: "feedback" }, body: {} })).statusCode, 400, "nothing to save");
    assert.equal((await call(h, { method: "POST", query: { action: "feedback" }, body: { message: "x".repeat(2001) } })).statusCode, 400);
    assert.equal((await call(h, { method: "GET", query: { action: "feedback" } })).statusCode, 405);
    const bad = await call(h, { method: "POST", query: { action: "feedback" }, body: { message: "hi", category: "<script>" } });
    assert.equal(inserted.at(-1).category, "other", "an unknown category falls back safely");
    assert.equal(bad.statusCode, 200);
  });
});

test("endpoint: a one-click thumbs from an email is saved without a message", async () => {
  await withEnv({ RESEND_API_KEY: undefined }, async () => {
    const inserted = [];
    const h = loadHandler("email.js", { db: feedbackDb({ inserted }) });
    const res = await call(h, { method: "POST", query: { action: "feedback" }, body: { token: UUID, emailKey: "free-welcome", rating: "up" } });
    assert.equal(res.statusCode, 200);
    assert.equal(inserted[0].rating, "up");
    assert.equal(inserted[0].message, null);
  });
});

test("endpoint: more than 5 anonymous posts an hour from one address is refused", async () => {
  await withEnv({ RESEND_API_KEY: undefined }, async () => {
    const inserted = [];
    const h = loadHandler("email.js", { db: feedbackDb({ inserted, recent: 5 }) });
    const res = await call(h, { method: "POST", query: { action: "feedback" }, body: { message: "spam" } });
    assert.equal(res.statusCode, 429);
    assert.equal(inserted.length, 0);
  });
});

test("endpoint: the owner gets a copy of new feedback, and a failing copy never loses the feedback", async () => {
  const realFetch = globalThis.fetch;
  try {
    const sent = [];
    globalThis.fetch = async (url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ id: "re_1" }) }; };
    await withEnv({ RESEND_API_KEY: "key" }, async () => {
      const inserted = [];
      const h = loadHandler("email.js", { db: feedbackDb({ inserted }) });
      const res = await call(h, { method: "POST", query: { action: "feedback" }, body: { token: UUID, emailKey: "free-limit", message: "Please add X", category: "idea", contactOk: true } });
      assert.equal(res.statusCode, 200);
      assert.equal(sent.length, 1);
      assert.deepEqual(sent[0].to, ["support@literacylabai.com"]);
      assert.equal(sent[0].reply_to, "parent@example.com", "replying reaches the customer, because they said yes");
      assert.match(sent[0].subject, /New feedback: idea/);
      assert.match(sent[0].text, /Please add X/);

      globalThis.fetch = async () => { throw new Error("network down"); };
      const res2 = await call(h, { method: "POST", query: { action: "feedback" }, body: { message: "Still saved", category: "bug" } });
      assert.equal(res2.statusCode, 200);
      assert.equal(inserted.at(-1).message, "Still saved");
    });
  } finally { globalThis.fetch = realFetch; }
});

test("endpoint: without contact permission the customer's address is never put in the owner's copy", async () => {
  const realFetch = globalThis.fetch;
  try {
    const sent = [];
    globalThis.fetch = async (url, opts) => { sent.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ id: "re_1" }) }; };
    await withEnv({ RESEND_API_KEY: "key" }, async () => {
      const h = loadHandler("email.js", { db: feedbackDb() });
      await call(h, { method: "POST", query: { action: "feedback" }, body: { token: UUID, message: "Private thought", contactOk: false } });
      assert.ok(!sent[0].text.includes("parent@example.com"));
      assert.ok(!sent[0].html.includes("parent@example.com"));
      assert.equal(sent[0].reply_to, "support@literacylabai.com");
    });
  } finally { globalThis.fetch = realFetch; }
});

test("endpoint: an unknown action is refused", async () => {
  const h = loadHandler("email.js", {});
  assert.equal((await call(h, { method: "POST", query: { action: "nope" } })).statusCode, 400);
  assert.equal((await call(h, { method: "POST" })).statusCode, 400);
});

// ------------------------------------------------------------------ deployment and policy guards

const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");

test("the project stays within the host's 12-function limit (a 13th endpoint breaks the deploy)", () => {
  const fns = fs.readdirSync(path.join(ROOT, "api")).filter((f) => f.endsWith(".js"));
  assert.ok(fns.length <= 12, `${fns.length} functions: ${fns.join(", ")}`);
});

test("vercel.json serves the unsubscribe and feedback pages and runs the daily job once a day", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const dest = Object.fromEntries(cfg.rewrites.map((r) => [r.source, r.destination]));
  assert.equal(dest["/unsubscribe"], "/unsubscribe.html");
  assert.equal(dest["/feedback"], "/feedback.html");
  for (const p of ["unsubscribe.html", "feedback.html"]) assert.ok(fs.existsSync(path.join(ROOT, p)), p);
  // Two scheduled jobs: the daily email run and the weekly marking-quality check
  // (the free hosting plan allows two, each at most once a day).
  assert.equal(cfg.crons.length, 2);
  const daily = cfg.crons.find((c) => c.path === "/api/email?action=cron");
  assert.ok(daily, "the daily email run is scheduled");
  assert.match(daily.schedule, /^\d+ \d+ \* \* \*$/, "once a day, which is all the free hosting plan allows");
  const weekly = cfg.crons.find((c) => c.path === "/api/email?action=qa");
  assert.ok(weekly, "the weekly quality check is scheduled");
  assert.match(weekly.schedule, /^\d+ \d+ \* \* \d$/, "once a week");
});

test("the new email tables exist in the schema file with row-level security and no policies", () => {
  const sql = fs.readFileSync(path.join(ROOT, "supabase", "schema.sql"), "utf8");
  for (const table of ["email_preferences", "email_log", "feedback"]) {
    assert.ok(sql.includes(`create table if not exists public.${table} (`), `${table} is created`);
    assert.ok(sql.includes(`alter table public.${table} enable row level security`), `${table} has row-level security on`);
    const policies = sql.match(/create policy[^;]*/gi) || [];
    assert.ok(!policies.some((p) => p.includes(`public.${table}`)), `${table} must have no policy`);
  }
  assert.match(sql, /unique \(profile_id, dedupe_key\)/, "send-once is a database guarantee");
});

test("the privacy policy describes the emails we send, the unsubscribe, feedback, and its deletion", () => {
  const p = fs.readFileSync(path.join(ROOT, "privacy.html"), "utf8");
  assert.match(p, /<td>Email and feedback<\/td>/);
  assert.match(p, /Emails and feedback\./);
  assert.match(p, /Account Holder only, never to a Child User/);
  assert.match(p, /Every one of them has an unsubscribe link/);
  assert.match(p, /Feedback tied to your account is deleted when you delete your account/);
});

test("the feedback and unsubscribe pages carry the brand and the analytics banner", () => {
  for (const f of ["feedback.html", "unsubscribe.html"]) {
    const h = fs.readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(h.includes("#7A3B45") && h.includes("Lexend"), `${f} brand`);
    assert.ok(h.includes('<script src="analytics.js"></script>'), `${f} analytics`);
    assert.ok(h.includes('name="robots" content="noindex"'), `${f} stays out of search results`);
  }
});

// ------------------------------------------------------------------ test copies to the owner

test("test copies: need the secret, and only ever go to an admin address", async () => {
  await withEnv({ CRON_SECRET: "s3cret", ADMIN_EMAILS: "owner@example.com", RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: "1 St" }, async () => {
    const h = loadHandler("email.js", { db: () => ({ data: null, error: null }) });
    const auth = { authorization: "Bearer s3cret" };
    assert.equal((await callWith(h, { query: { action: "test", to: "owner@example.com" } })).statusCode, 401, "no secret");
    assert.equal((await callWith(h, { query: { action: "test", to: "stranger@example.com" }, headers: auth })).statusCode, 403, "not an admin address");
    assert.equal((await callWith(h, { query: { action: "test" }, headers: auth })).statusCode, 403, "no address given");
  });
});

test("test copies: refuse to run when the key or postal address is missing", async () => {
  await withEnv({ CRON_SECRET: "s3cret", ADMIN_EMAILS: "owner@example.com", RESEND_API_KEY: undefined, EMAIL_POSTAL_ADDRESS: undefined }, async () => {
    const h = loadHandler("email.js", { db: () => ({ data: null, error: null }) });
    const res = await callWith(h, { query: { action: "test", to: "owner@example.com" }, headers: { authorization: "Bearer s3cret" } });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body.missingSettings, ["RESEND_API_KEY", "EMAIL_POSTAL_ADDRESS"]);
  });
});

test("test copies: every email (Free, Core, Premium and billing) is sent to the admin, marked TEST, with working links", async () => {
  const { ALL_EMAIL_KEYS } = require("../api/_lib/emailAny");
  const { isTransactional } = require("../api/_lib/paidEmails");
  const N = ALL_EMAIL_KEYS.length;
  const realFetch = globalThis.fetch;
  try {
    const calls = [];
    globalThis.fetch = async (url, opts) => { calls.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ id: "re_" + calls.length }) }; };
    await withEnv({ CRON_SECRET: "s3cret", ADMIN_EMAILS: "owner@example.com", RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: "PO Box 1, Town", EMAIL_TEST_PAUSE_MS: "0" }, async () => {
      const h = loadHandler("email.js", { db: (q) => {
        if (q.table === "profiles") return { data: { id: "p1" }, error: null };
        if (q.table === "email_preferences") return { data: { unsubscribe_token: UUID }, error: null };
        return { data: null, error: null };
      } });
      const res = await callWith(h, { query: { action: "test", to: "Owner@Example.com" }, headers: { authorization: "Bearer s3cret" } });
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.equal(res.body.sent.length, N);
      assert.equal(calls.length, N);
      assert.ok(N >= 19, `expected every email to be covered, got ${N}`);
      calls.forEach((c, i) => {
        assert.deepEqual(c.to, ["owner@example.com"]);
        assert.ok(c.subject.startsWith(`[TEST ${i + 1}/${N}] `), c.subject);
        assert.ok(c.html.includes("PO Box 1, Town"), "postal address in the footer");
        if (isTransactional(ALL_EMAIL_KEYS[i])) {
          assert.ok(!c.html.includes("/unsubscribe?t="), `${ALL_EMAIL_KEYS[i]} is an account email, so no unsubscribe link`);
          assert.equal(c.headers["List-Unsubscribe"], undefined);
        } else {
          assert.ok(c.html.includes(`${SITE}/unsubscribe?t=${UUID}`), "the admin's own unsubscribe token");
          assert.match(c.headers["List-Unsubscribe"], new RegExp(UUID));
        }
        assert.equal(c.bcc, undefined, "test copies never BCC anyone");
      });
    });
  } finally { globalThis.fetch = realFetch; }
});

test("the email function is allowed to run long enough for a paced batch, and the job paces itself", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.equal(cfg.functions["api/email.js"].maxDuration, 60, "the default 10 seconds would cut a run of 40 paced emails short");
  const src = fs.readFileSync(path.join(ROOT, "api", "email.js"), "utf8");
  assert.match(src, /pauseMs: 550/);
  assert.match(src, /EMAIL_MAX_PER_RUN\) \|\| 40/);
});

test("job: a pause between sends is applied only when asked for", async () => {
  const profiles = Array.from({ length: 3 }, (_, i) => ({ id: `q${i}`, email: `q${i}@example.com`, plan: "free", created_at: ago(0.5).toISOString() }));
  const tables = { profiles, email_preferences: [], email_log: [], submissions: [] };
  const r = recorder();
  const t0 = Date.now();
  await runFreeEmailJob({ supabase: fakeDb(tables), now: MON, send: r.send, address: "x", dryRun: false, pauseMs: 60 });
  assert.ok(Date.now() - t0 >= 150, "three sends with a 60ms pause take at least ~180ms");
  assert.equal(r.sent.length, 3);
});

// ------------------------------------------------------------------ the weekly summary names the week's focus skills

test("weekly summary: names the skill that went well and the next one to work on, when known", () => {
  const e = buildFreeEmail("free-weekly-lite", { token: TOKEN, address: "x", stats: { pieces: 3, words: 420, glow: "Fronted Adverbials", grow: "Modal Verbs" } });
  assert.match(e.html, /What went well: Fronted Adverbials\./);
  assert.match(e.html, /Next skill to work on: Modal Verbs\./);
  assert.match(e.text, /What went well: Fronted Adverbials\./);
  const bare = buildFreeEmail("free-weekly-lite", { token: TOKEN, address: "x", stats: { pieces: 1, words: 50 } });
  assert.ok(!/What went well|Next skill to work on/.test(bare.html), "no focus lines when the skills are unknown");
});

test("job: the weekly summary is filled from the week's own feedback (the most common skills)", async () => {
  // A Monday at the very start of a month, so the week's pieces do not also count against this month's 3 free pieces.
  const NOV2 = new Date("2026-11-02T22:00:00Z");
  const rows = (glow, grow, days) => ({ profile_id: "p-act", created_at: ago(days, NOV2).toISOString(), word_count: 100, feedback: {}, glow, grow });
  const tables = {
    profiles: [{ id: "p-act", email: "act@example.com", plan: "free", created_at: ago(40, NOV2).toISOString() }],
    email_preferences: [], email_log: [],
    submissions: [
      rows("Old Skill", "Old Next", 20), // before this week: ignored for the focus
      rows("Fronted Adverbials", "Modal Verbs", 6),
      rows("Fronted Adverbials", "Commas", 4),
      rows("Similes", "Modal Verbs", 1),
    ],
  };
  const r = recorder();
  const s = await runFreeEmailJob({ supabase: fakeDb(tables), now: NOV2, send: r.send, address: "x", dryRun: false });
  assert.equal(s.sent, 1);
  assert.match(r.sent[0].subject, /This week on LiteracyLab AI/);
  assert.match(r.sent[0].html, /This week: 3 pieces completed, 300 words written\./);
  assert.match(r.sent[0].html, /What went well: Fronted Adverbials\./, "the skill that went well most often");
  assert.match(r.sent[0].html, /Next skill to work on: Modal Verbs\./, "the next skill that came up most often");
  assert.ok(!r.sent[0].html.includes("Old Skill"), "last month's feedback is not reported as this week's");
  assert.deepEqual(r.sent[0].bcc, ["support@literacylabai.com"]);
});

test("cron: addresses in EMAIL_SKIP are left out of the run, without gaining admin powers", async () => {
  const rows = [
    { id: "p1", email: "Skip.Me@Example.com", plan: "free", created_at: new Date(Date.now() - 4 * 86400000).toISOString() },
    { id: "p2", email: "keep@example.com", plan: "free", created_at: new Date(Date.now() - 4 * 86400000).toISOString() },
  ];
  await withEnv({ CRON_SECRET: "s3cret", EMAIL_LIVE: undefined, RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: "1 St", ADMIN_EMAILS: "owner@example.com", EMAIL_SKIP: "skip.me@example.com" }, async () => {
    const h = loadHandler("email.js", { db: (q) => (q.table === "profiles" ? { data: rows, error: null } : { data: [], error: null }) });
    const out = await callWith(h, { query: { action: "cron" }, headers: { authorization: "Bearer s3cret" } });
    assert.equal(out.statusCode, 200);
    assert.equal(out.body.considered, 1, "only the address not on the skip list is considered");
    // and being on the skip list does not make an address a valid target for test copies
    const t = await callWith(h, { query: { action: "test", to: "skip.me@example.com" }, headers: { authorization: "Bearer s3cret" } });
    assert.equal(t.statusCode, 403);
  });
});
