const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../api/_lib/shareCards");
const { loadHandler, call } = require("./harness");

const ROOT = path.join(__dirname, "..");
const USER = { id: "u1", email: "mum@example.com" };

// An in-memory stand-in for the tables the share-card code reads and writes.
function fakeDb(seed = {}) {
  const t = { profiles: [{ id: "u1", referral_code: "ABCD2345" }], submissions: [], share_cards: [], ...seed };
  let seq = 0;
  function from(table) {
    const q = { op: "select", filters: [], payload: null, single: false, head: false };
    const api = {
      select(_c, o) { if (o && o.head) q.head = true; return api; },
      insert(p) { q.op = "insert"; q.payload = p; return api; },
      update(p) { q.op = "update"; q.payload = p; return api; },
      eq(c, v) { q.filters.push((r) => r[c] === v); return api; },
      is(c, v) { q.filters.push((r) => (r[c] ?? null) === v); return api; },
      order() { return api; }, limit() { return api; },
      maybeSingle() { q.single = true; return api; },
      single() { q.single = true; return api; },
      then(ok, bad) { try { ok(run()); } catch (e) { bad(e); } },
    };
    function run() {
      const rows = t[table];
      const match = rows.filter((r) => q.filters.every((f) => f(r)));
      if (q.op === "insert") {
        if (table === "share_cards" && rows.some((r) => r.token === q.payload.token)) return { data: null, error: { code: "23505" } };
        rows.push({ id: `r${++seq}`, created_at: new Date(Date.now() + seq).toISOString(), revoked_at: null, ...q.payload });
        return { data: null, error: null };
      }
      if (q.op === "update") { match.forEach((r) => Object.assign(r, q.payload)); return { data: null, error: null }; }
      if (q.head) return { count: match.length, error: null };
      if (q.single) return { data: match[0] ? { ...match[0] } : null, error: null };
      return { data: match.map((r) => ({ ...r })), error: null };
    }
    return api;
  }
  return { tables: t, from };
}
const piece = (extra = {}) => ({ id: "s1", profile_id: "u1", kind: "writing", grade_label: "Year 5", score: null, total_questions: null, feedback: { glowTarget: "Fronted adverbials", glow: "Maya wrote 'The old oak creaked' which was lovely." }, ...extra });

// ---------------------------------------------------------------- the name
test("the name must be a first name or nickname made of letters; blank means 'My child'", () => {
  assert.equal(S.cleanName("  Maya "), "Maya");
  assert.equal(S.cleanName("Mary-Jane"), "Mary-Jane");
  assert.equal(S.cleanName("D'Arcy"), "D'Arcy");
  assert.equal(S.cleanName("Zoë"), "Zoë");
  assert.equal(S.cleanName(""), "My child");
  assert.equal(S.cleanName(null), "My child");
  for (const bad of ["<b>Maya</b>", "Maya 5", "http://x.co", "Maya\nSmith!", "a".repeat(30), "1234", "Maya@school"]) {
    assert.throws(() => S.cleanName(bad), /letters only/, bad);
  }
});

// ---------------------------------------------------------------- what a card holds
test("a card holds only the kind, year, skill and (reading) the score: never writing or feedback sentences", async () => {
  const db = fakeDb({ submissions: [piece()] });
  const out = await S.createCard(db, USER, { submissionId: "s1", name: "Maya" });
  assert.match(out.token, /^[a-hj-km-np-z2-9]{12}$/);
  assert.equal(out.url, `https://www.literacylabai.com/c/${out.token}`);
  const row = db.tables.share_cards[0];
  assert.equal(row.display_name, "Maya"); assert.equal(row.kind, "writing"); assert.equal(row.grade_label, "Year 5"); assert.equal(row.skill, "Fronted adverbials");
  assert.equal(row.score, null);
  assert.ok(!JSON.stringify(row).includes("oak creaked"), "no sentence from the feedback or the writing is stored");
  assert.ok(!("content" in row) && !("feedback" in row) && !("text" in row));
  const reading = fakeDb({ submissions: [piece({ id: "s2", kind: "reading", score: 4, total_questions: 5 })] });
  await S.createCard(reading, USER, { submissionId: "s2", name: "" });
  assert.deepEqual([reading.tables.share_cards[0].score, reading.tables.share_cards[0].total, reading.tables.share_cards[0].display_name], [4, 5, "My child"]);
});

test("the stored learner name is never used: the card shows only what the parent typed", async () => {
  const db = fakeDb({ submissions: [piece({ child_name: "Maya Smith", display_name: "Maya Smith" })] });
  await S.createCard(db, USER, { submissionId: "s1", name: "" });
  assert.equal(db.tables.share_cards[0].display_name, "My child");
});

test("only a finished piece belonging to this parent can be shared", async () => {
  await assert.rejects(() => S.createCard(fakeDb(), USER, { submissionId: "nope", name: "" }), /not found/);
  await assert.rejects(() => S.createCard(fakeDb({ submissions: [piece({ profile_id: "someone-else" })] }), USER, { submissionId: "s1", name: "" }), /not found/);
  await assert.rejects(() => S.createCard(fakeDb({ submissions: [piece({ feedback: null })] }), USER, { submissionId: "s1", name: "" }), /Finish the piece/);
  await assert.rejects(() => S.createCard(fakeDb({ submissions: [piece({ feedback: { _pending: true } })] }), USER, { submissionId: "s1", name: "" }), /Finish the piece/);
  await assert.rejects(() => S.createCard(fakeDb({ submissions: [piece()] }), USER, { name: "" }), /submissionId is required/);
});

test("sharing the same piece again keeps one link and just updates the name; there is a limit on active cards", async () => {
  const db = fakeDb({ submissions: [piece()] });
  const a = await S.createCard(db, USER, { submissionId: "s1", name: "Maya" });
  const b = await S.createCard(db, USER, { submissionId: "s1", name: "Sam" });
  assert.equal(a.token, b.token);
  assert.equal(db.tables.share_cards.length, 1);
  assert.equal(db.tables.share_cards[0].display_name, "Sam");
  const full = fakeDb({ submissions: [piece({ id: "new" })], share_cards: Array.from({ length: S.MAX_ACTIVE_PER_ACCOUNT }, (_, i) => ({ token: `tokenaaaaa${String(i).padStart(2, "0")}`, profile_id: "u1", submission_id: `x${i}`, revoked_at: null })) });
  await assert.rejects(() => S.createCard(full, USER, { submissionId: "new", name: "" }), /shared cards/);
});

// ---------------------------------------------------------------- the public page and switching it off
test("the public read returns only the listed fields, and nothing once it is switched off", async () => {
  const db = fakeDb({ submissions: [piece({ kind: "reading", score: 3, total_questions: 5 })] });
  const { token } = await S.createCard(db, USER, { submissionId: "s1", name: "Maya" });
  const card = await S.viewCard(db, token);
  assert.deepEqual(Object.keys(card).sort(), [...S.CARD_FIELDS].sort());
  assert.deepEqual(card, { name: "Maya", kind: "reading", year: "Year 5", skill: "Fronted adverbials", score: 3, total: 5, ref: "ABCD2345" });
  assert.equal(await S.viewCard(db, "nonexistent1"), null);
  assert.equal(await S.viewCard(db, "short"), null, "a malformed token is not even looked up");
  assert.equal(await S.viewCard(db, "../../etc/pa"), null);
  await S.revokeCard(db, USER, token);
  assert.equal(await S.viewCard(db, token), null, "stopped sharing");
});

test("only the owner can switch a card off, and the link shown for a piece comes back after a refresh", async () => {
  const db = fakeDb({ submissions: [piece()] });
  const { token } = await S.createCard(db, USER, { submissionId: "s1", name: "Maya" });
  await S.revokeCard(db, { id: "intruder" }, token);
  assert.ok(await S.viewCard(db, token), "someone else's request changed nothing");
  const mine = await S.mineFor(db, USER, "s1");
  assert.equal(mine.card.token, token); assert.equal(mine.card.name, "Maya");
  await S.revokeCard(db, USER, token);
  assert.equal((await S.mineFor(db, USER, "s1")).card, null, "a stopped card is no longer offered");
  await assert.rejects(() => S.revokeCard(db, USER, "not a token"), /not a valid link/);
});

// ---------------------------------------------------------------- wiring
test("the endpoint serves the public card without sign-in, never exposes the owner, and leaves export and delete alone", async () => {
  const card = { profile_id: "secret-profile", display_name: "Maya", kind: "reading", grade_label: "Year 5", skill: "Inference", score: 4, total: 5, revoked_at: null };
  const h = loadHandler("account.js", { db: (q) => (q.table === "share_cards" ? { data: card, error: null } : q.table === "profiles" ? { data: { referral_code: "ABCD2345" }, error: null } : { data: null, error: null }) });
  const res = await call(h, { method: "GET", query: { action: "share-view", t: "abcdefghjkmn" } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.card, { name: "Maya", kind: "reading", year: "Year 5", skill: "Inference", score: 4, total: 5, ref: "ABCD2345" });
  assert.ok(!JSON.stringify(res.body).includes("secret-profile"));
  assert.match(res.headers["Cache-Control"], /max-age=60/);
  const gone = loadHandler("account.js", { db: () => ({ data: null, error: null }) });
  assert.equal((await call(gone, { method: "GET", query: { action: "share-view", t: "abcdefghjkmn" } })).statusCode, 404);
  const src = fs.readFileSync(path.join(ROOT, "api", "account.js"), "utf8");
  assert.ok(src.indexOf('action === "share-view"') < src.indexOf("await requireUser(req)"), "the public read is handled before sign-in is required");
  assert.match(src, /req\.method === "POST" && action === "share-create"/);
  assert.match(src, /req\.method === "POST" && action === "share-revoke"/);
  assert.match(src, /req\.method === "DELETE"/, "account deletion is still there");
  assert.match(src, /sharedCards: sharedCards \|\| \[\]/, "included in the data export");
  assert.equal(fs.readdirSync(path.join(ROOT, "api")).filter((f) => f.endsWith(".js")).length, 12, "still 12 serverless functions");
});

test("the share page is private by design: noindex, built with text nodes, robots-blocked and routed", () => {
  const page = fs.readFileSync(path.join(ROOT, "share.html"), "utf8");
  assert.match(page, /<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(page, /innerHTML/, "card text is never inserted as HTML");
  assert.match(page, /It shows no writing/);
  assert.match(page, /"\/\?ref=" \+ encodeURIComponent\(c\.ref\)/, "the friend's link carries the invite code");
  assert.match(fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8"), /Disallow: \/c\//);
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(cfg.rewrites.some((r) => r.source === "/c/:token" && r.destination === "/share.html"));
  const schema = fs.readFileSync(path.join(ROOT, "supabase", "schema.sql"), "utf8");
  assert.match(schema, /create table if not exists public\.share_cards/);
  assert.match(schema, /alter table public\.share_cards enable row level security/);
  const app = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
  assert.equal((app.match(/<ShareResultCard session=\{session\}/g) || []).length, 2, "offered after both writing and reading feedback");
  assert.match(app, /It never shows any writing, and you can switch it off at any time/);
});
