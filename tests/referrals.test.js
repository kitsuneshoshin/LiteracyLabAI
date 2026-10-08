const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../api/_lib/referrals");
const { getMonthlyUsage } = require("../api/_lib/usage");

// A small in-memory stand-in for the tables the referral code reads and writes.
function fakeDb(seed = {}) {
  const t = { profiles: [], referrals: [], submissions: [], ...seed };
  let seq = 0;
  function from(table) {
    const q = { op: "select", filters: [], payload: null, single: false, maybe: false, head: false, notNull: [] };
    const api = {
      select(_c, o) { if (o && o.head) q.head = true; return api; },
      insert(p) { q.op = "insert"; q.payload = p; return api; },
      update(p) { q.op = "update"; q.payload = p; return api; },
      eq(c, v) { q.filters.push((r) => r[c] === v); return api; },
      neq(c, v) { q.filters.push((r) => r[c] !== v); return api; },
      is(c, v) { q.filters.push((r) => (r[c] ?? null) === v); return api; },
      not(c, op, v) { if (op === "is" && v === null) q.filters.push((r) => r[c] != null); return api; },
      gte(c, v) { q.filters.push((r) => String(r[c]) >= String(v)); return api; },
      or() { return api; }, order() { return api; }, limit() { return api; },
      single() { q.single = true; return api; },
      maybeSingle() { q.single = true; q.maybe = true; return api; },
      then(ok, bad) { try { ok(run()); } catch (e) { bad(e); } },
    };
    function run() {
      const rows = t[table];
      const match = rows.filter((r) => q.filters.every((f) => f(r)));
      if (q.op === "insert") {
        if (table === "referrals" && rows.some((r) => r.referred_id === q.payload.referred_id)) return { data: null, error: { code: "23505" } };
        rows.push({ id: `r${++seq}`, created_at: new Date().toISOString(), ...q.payload });
        return { data: null, error: null };
      }
      if (q.op === "update") { match.forEach((r) => Object.assign(r, q.payload)); return { data: match.map((r) => ({ id: r.id })), error: null }; }
      if (q.head) return { count: match.length, error: null };
      if (q.single) return match[0] ? { data: { ...match[0] }, error: null } : q.maybe ? { data: null, error: null } : { data: null, error: { message: "no rows" } };
      return { data: match.map((r) => ({ ...r })), error: null };
    }
    return api;
  }
  return { tables: t, from, auth: { admin: { getUserById: async (id) => ({ data: { user: { email_confirmed_at: t.confirmed && t.confirmed.includes(id) ? "2026-10-01" : null } } }) } } };
}
const NOW = new Date("2026-10-15T10:00:00Z");
const referrer = { id: "ref-1", email: "mum@example.com", plan: "free", referral_code: "ABCD2345" };
const friend = (extra = {}) => ({ id: "fri-1", email: "friend@example.org", created_at: "2026-10-14T00:00:00Z", email_confirmed_at: "2026-10-14T00:05:00Z", user_metadata: { referral_code: "ABCD2345" }, ...extra });
const piece = (profile_id) => ({ id: `s-${profile_id}`, profile_id, feedback: { glowTarget: "x" } });

test("addresses are compared as one mailbox: +tags, Gmail dots and case do not make a new person", () => {
  assert.equal(R.normaliseEmail("Me.Name+kids@Gmail.com"), "mename@gmail.com");
  assert.equal(R.normaliseEmail("me.name@googlemail.com"), "mename@gmail.com");
  assert.equal(R.normaliseEmail("a.b+x@school.org"), "a.b@school.org", "dots only ignored for Gmail");
  assert.equal(R.normaliseEmail("nonsense"), "nonsense");
  assert.equal(R.isDisposable("x@Mailinator.com"), true);
  assert.equal(R.isDisposable("x@gmail.com"), false);
});

test("a code is made once, is easy to read aloud, and is kept", async () => {
  const db = fakeDb({ profiles: [{ ...referrer, referral_code: null }] });
  const code = await R.ensureCode(db, "ref-1");
  assert.match(code, /^[2-9A-HJ-NP-Z]{8}$/);
  assert.equal(await R.ensureCode(db, "ref-1"), code, "the same code every time");
});

test("sign-up through a valid link is recorded; links that cannot count are recorded as rejected with the reason", async () => {
  let db = fakeDb({ profiles: [referrer] });
  assert.equal(await R.claimReferral(db, friend(), NOW), "signed_up");
  assert.equal(await R.claimReferral(db, friend(), NOW), "signed_up", "claiming again changes nothing");
  assert.equal(db.tables.referrals.length, 1);

  const cases = [
    [friend({ id: "ref-1", email: "mum@example.com" }), "your own link"],
    [friend({ email: "Mum+kids@Example.com" }), "same email address"],
    [friend({ email: "x@mailinator.com" }), "throwaway email address"],
    [friend({ created_at: "2026-08-01T00:00:00Z" }), "not a new account"],
  ];
  for (const [u, reason] of cases) {
    db = fakeDb({ profiles: [referrer] });
    assert.equal(await R.claimReferral(db, u, NOW), "rejected", reason);
    assert.equal(db.tables.referrals[0].reason, reason);
  }
  db = fakeDb({ profiles: [referrer] });
  assert.equal(await R.claimReferral(db, friend({ user_metadata: { referral_code: "ZZZZZZZZ" } }), NOW), null, "unknown code: nothing recorded");
  assert.equal(await R.claimReferral(db, friend({ user_metadata: {} }), NOW), null, "no code: nothing recorded");
  assert.equal(await R.claimReferral(db, friend({ user_metadata: { referral_code: "no" } }), NOW), null, "malformed code");
  assert.equal(db.tables.referrals.length, 0);
});

test("the reward needs ALL of: signed up through the link, confirmed email, and a finished first piece", async () => {
  const db = fakeDb({ profiles: [referrer] });
  await R.claimReferral(db, friend(), NOW);
  assert.equal(await R.settleReferral(db, friend(), NOW), false, "no finished piece yet");
  db.tables.submissions.push({ id: "pending", profile_id: "fri-1", feedback: null });
  assert.equal(await R.settleReferral(db, friend(), NOW), false, "a started piece without feedback is not a finished piece");
  db.tables.submissions.push(piece("fri-1"));
  assert.equal(await R.settleReferral(db, friend({ email_confirmed_at: null }), NOW), false, "email not confirmed");
  assert.equal(db.tables.referrals[0].status, "signed_up");
  assert.equal(await R.settleReferral(db, friend(), NOW), true);
  assert.equal(db.tables.referrals[0].status, "rewarded");
  assert.equal(await R.settleReferral(db, friend(), NOW), false, "rewarded once only");
});

test("a rejected referral can never be rewarded, even after a piece is finished", async () => {
  const db = fakeDb({ profiles: [referrer], submissions: [piece("fri-1")] });
  await R.claimReferral(db, friend({ email: "x@mailinator.com" }), NOW);
  assert.equal(await R.settleReferral(db, friend({ email: "x@mailinator.com" }), NOW), false);
  assert.equal(db.tables.referrals[0].status, "rejected");
});

test("extra pieces: 3 for each rewarded friend this month (at most 5 friends) and 3 for the invited friend, nothing from other months", async () => {
  const mk = (n, status = "rewarded", at = "2026-10-05T00:00:00Z") => Array.from({ length: n }, (_, i) => ({ referrer_id: "ref-1", referred_id: `f${at}${status}${i}`, status, rewarded_at: at }));
  let db = fakeDb({ referrals: mk(2) });
  assert.equal((await R.bonusFor(db, "ref-1", NOW)).pieces, 6);
  db = fakeDb({ referrals: mk(8) });
  assert.equal((await R.bonusFor(db, "ref-1", NOW)).pieces, 15, "capped at 5 friends a month");
  db = fakeDb({ referrals: [...mk(1, "rewarded", "2026-09-20T00:00:00Z"), ...mk(1, "signed_up", null)] });
  assert.equal((await R.bonusFor(db, "ref-1", NOW)).pieces, 0, "last month and unfinished referrals give nothing");
  db = fakeDb({ referrals: [{ referrer_id: "ref-1", referred_id: "fri-1", status: "rewarded", rewarded_at: "2026-10-05T00:00:00Z" }] });
  assert.equal((await R.bonusFor(db, "fri-1", NOW)).pieces, 3, "the invited friend gets the same");
});

test("the monthly piece limit grows by the extra pieces, but only for a limited plan", async () => {
  const db = fakeDb({ profiles: [{ id: "u", plan: "free", email: "u@example.com" }], referrals: [{ referrer_id: "u", referred_id: "x", status: "rewarded", rewarded_at: new Date().toISOString() }] });
  const real = { ...db, from: (tb) => (tb === "submissions" ? { select: () => ({ eq: () => ({ gte: () => ({ lt: () => ({ is: () => ({ is: () => ({ is: async () => ({ count: 0, error: null }) }) }) }), then: (ok) => ok({ count: 2, error: null }) }) }) }) } : db.from(tb)) };
  const u = await getMonthlyUsage(real, "u");
  assert.equal(u.cap, 6, "3 plus 3 extra");
  assert.equal(u.referralBonus, 3);
  assert.equal(u.used, 2);
});

test("a problem reading rewards never blocks anyone from using the product", async () => {
  const broken = { from: (tb) => (tb === "profiles" ? { select: () => ({ eq: () => ({ single: async () => ({ data: { plan: "free", email: "u@example.com" }, error: null }) }) }) } : tb === "referrals" ? { select: () => { throw new Error("relation does not exist"); } } : { select: () => ({ eq: () => ({ gte: () => ({ lt: () => ({ is: () => ({ is: () => ({ is: async () => ({ count: 0, error: null }) }) }) }), then: (ok) => ok({ count: 1, error: null }) }) }) }) }) };
  const u = await getMonthlyUsage(broken, "u");
  assert.equal(u.cap, 3); assert.equal(u.used, 1);
});

test("the pages remember the link, send it with the sign-up, and show the card only to the right people", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const a = app.indexOf("const REF_KEY"), b = app.indexOf("captureReferral();");
  assert.ok(a > 0 && b > a);
  const store = {};
  const win = { location: { search: "?utm=x&ref=abcd2345" }, localStorage: { setItem: (k, v) => { store[k] = v; }, getItem: (k) => store[k] || null } };
  const { captureReferral, storedReferral } = new Function("window", "localStorage", app.slice(a, b) + "\nreturn { captureReferral, storedReferral };")(win, win.localStorage);
  captureReferral();
  assert.equal(store.ll_ref, "ABCD2345", "upper-cased and stored");
  assert.equal(storedReferral(), "ABCD2345");
  store.ll_ref = "bad code!";
  assert.equal(storedReferral(), "", "a malformed stored value is ignored");
  assert.match(app, /signUp\(ref \? \{ email, password, options: \{ data: \{ referral_code: ref \} \} \}/);
  assert.match(index, /localStorage\.setItem\("ll_ref"/);
  assert.match(app, /if \(!isFree && !invited\) return null;/);
  assert.match(app, /<InviteFriendCard session=\{session\} backendLive=\{backendLive\} plan=\{plan\} \/>/);
});

test("the schema, the account export and the completed-piece paths all know about referrals", () => {
  const root = path.join(__dirname, "..");
  const schema = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
  assert.match(schema, /create table if not exists public\.referrals/);
  assert.match(schema, /referred_id uuid not null unique/);
  assert.match(schema, /alter table public\.referrals enable row level security/);
  const account = fs.readFileSync(path.join(root, "api", "account.js"), "utf8");
  assert.match(account, /action === "referral"/);
  assert.match(account, /referrals: referrals \|\| \[\]/, "included in the data export");
  const submit = fs.readFileSync(path.join(root, "api", "submit.js"), "utf8");
  assert.equal((submit.match(/await settleReferralSafe\(supabase, user\)/g) || []).length, 2, "after both writing and reading feedback is saved");
  assert.equal(fs.readdirSync(path.join(root, "api")).filter((f) => f.endsWith(".js")).length, 12, "still 12 serverless functions");
});
