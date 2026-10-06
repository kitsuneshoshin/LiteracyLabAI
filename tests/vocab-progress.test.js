const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeUpdates, readVocabProgress, writeVocabProgress, cleanTerm, MAX_UPDATES } = require("../api/_lib/vocabProgress");
const { fakeSupabase, loadHandler, call, did } = require("./harness");

// Vocabulary progress saved to the account, so a learner's flashcards follow them between devices: what the
// server accepts, that the newest change always wins, that it is per learner and per account, that it is a
// Core and Premium feature, and that the vocabulary page keeps working if the table is not there.

// A small in-memory stand-in for the vocab_progress table.
function table(initial = []) {
  const rows = initial.map((r) => ({ ...r }));
  const resolve = (q) => {
    const ops = q.ops;
    const filters = ops.filter(([n]) => n === "eq" || n === "in");
    const matching = () => rows.filter((r) => filters.every(([n, col, v]) => (n === "eq" ? r[col] === v : v.includes(r[col]))));
    const up = ops.find(([n]) => n === "upsert");
    if (up) {
      for (const r of up[1]) {
        const i = rows.findIndex((x) => x.child_id === r.child_id && x.term === r.term);
        if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push({ ...r });
      }
      return { data: null, error: null };
    }
    return { data: matching().map((r) => ({ ...r })), error: null };
  };
  return { rows, resolve };
}
const T0 = Date.parse("2026-10-05T10:00:00Z");
const iso = (ms) => new Date(ms).toISOString();

test("only well-formed changes are accepted: a word, a box from 0 to 3, a sensible time; repeats keep the newest", () => {
  const now = T0;
  const out = sanitizeUpdates([
    { term: "  Queue ", box: 2, at: now - 5000 },
    { term: "queue", box: 1, at: now - 1000 },          // same word, newer: wins
    { term: "stall", box: 4, at: now },                  // box out of range
    { term: "gate", box: 1.5, at: now },                 // not a whole number
    { term: "", box: 1, at: now },                        // no word
    { term: 42, box: 1, at: now },                        // not text
    { term: "jetty", box: 3 },                            // no time: now
    { term: "price", box: 0, at: now + 10 * 3600 * 1000 }, // far future: pulled back
    null, "x", { box: 1 },
  ], now);
  const by = Object.fromEntries(out.map((u) => [u.term, u]));
  assert.deepEqual(Object.keys(by).sort(), ["jetty", "price", "queue"]);
  assert.equal(by.queue.box, 1);
  assert.equal(by.jetty.at, now);
  assert.ok(by.price.at <= now + 60 * 1000, "a clock far in the future cannot win every later change");
  assert.deepEqual(sanitizeUpdates("nope"), []);
  assert.deepEqual(sanitizeUpdates(undefined), []);
  assert.equal(sanitizeUpdates(Array.from({ length: 500 }, (_, i) => ({ term: "w" + i, box: 1, at: 1 })), now).length, MAX_UPDATES, "never more than 100 in one go");
  assert.equal(cleanTerm("x".repeat(500)).length, 80);
});

test("a change is saved only if it is newer than what is stored; an old device cannot undo newer progress", async () => {
  const t = table([{ child_id: "c1", profile_id: "u1", term: "queue", box: 3, updated_at: iso(T0) }]);
  const sb = fakeSupabase(t.resolve);
  const wrote = await writeVocabProgress(sb, "u1", "c1", [
    { term: "queue", box: 0, at: T0 - 1000 },   // older than stored: ignored
    { term: "stall", box: 1, at: T0 },          // new word: saved
  ]);
  assert.equal(wrote, 1);
  assert.equal(t.rows.find((r) => r.term === "queue").box, 3, "the newer progress stands");
  assert.equal(t.rows.find((r) => r.term === "stall").box, 1);
  assert.equal(await writeVocabProgress(sb, "u1", "c1", [{ term: "queue", box: 2, at: T0 }]), 0, "equal time: nothing to change");
  assert.equal(await writeVocabProgress(sb, "u1", "c1", [{ term: "queue", box: 2, at: T0 + 1 }]), 1);
  assert.equal(t.rows.find((r) => r.term === "queue").box, 2);
  assert.equal(await writeVocabProgress(sb, "u1", "c1", []), 0);
  assert.equal(await writeVocabProgress(sb, "u1", "c1", [{ term: "x", box: 9 }]), 0, "nothing valid, nothing written");
});

test("progress is read per learner and per account, never someone else's", async () => {
  const t = table([
    { child_id: "c1", profile_id: "u1", term: "queue", box: 2, updated_at: iso(T0) },
    { child_id: "c2", profile_id: "u1", term: "queue", box: 0, updated_at: iso(T0) },   // a sibling
    { child_id: "c1", profile_id: "u2", term: "gate", box: 3, updated_at: iso(T0) },    // not this account
    { child_id: "c1", profile_id: "u1", term: "bad", box: 9, updated_at: iso(T0) },     // garbage in the table
  ]);
  const sb = fakeSupabase(t.resolve);
  assert.deepEqual(await readVocabProgress(sb, "u1", "c1"), { queue: { box: 2, at: T0 } });
});

test("if the table is missing or the read fails, the vocabulary page still gets an empty map and carries on", async () => {
  const broken = fakeSupabase(() => ({ data: null, error: { message: 'relation "vocab_progress" does not exist' } }));
  assert.deepEqual(await readVocabProgress(broken, "u1", "c1"), {});
});

// ---- through the endpoint

function endpointDb(t, { owner = true } = {}) {
  return (q) => {
    if (q.table === "child_profiles") return { data: owner ? { id: "c1" } : null, error: null };
    if (q.table === "vocab_progress") return t.resolve(q);
    if (q.table === "submissions") return { data: [], error: null };
    return { data: null, error: null };
  };
}

test("POST /api/history saves a learner's progress on Core and Premium", async () => {
  for (const plan of ["core", "premium"]) {
    const t = table();
    const h = loadHandler("history.js", { plan, db: endpointDb(t) });
    const res = await call(h, { method: "POST", body: { childId: "c1", updates: [{ term: "Queue", box: 2, at: T0 }] } });
    assert.equal(res.statusCode, 200, plan + JSON.stringify(res.body));
    assert.deepEqual(res.body, { saved: 1 });
    assert.deepEqual(t.rows.map((r) => [r.term, r.box, r.profile_id, r.child_id]), [["queue", 2, "user-1", "c1"]]);
  }
});

test("the free plan has no vocabulary bank, so nothing is saved for it", async () => {
  const t = table();
  const h = loadHandler("history.js", { plan: "free", db: endpointDb(t) });
  const res = await call(h, { method: "POST", body: { childId: "c1", updates: [{ term: "queue", box: 2, at: T0 }] } });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.vocabLocked, true);
  assert.equal(t.rows.length, 0);
});

test("only the account's own learner can be written to, and a learner is required", async () => {
  const t = table();
  const stranger = loadHandler("history.js", { plan: "premium", db: endpointDb(t, { owner: false }) });
  const res = await call(stranger, { method: "POST", body: { childId: "someone-elses", updates: [{ term: "queue", box: 2, at: T0 }] } });
  assert.equal(res.statusCode, 404);
  assert.equal(t.rows.length, 0);
  const h = loadHandler("history.js", { plan: "premium", db: endpointDb(t) });
  assert.equal((await call(h, { method: "POST", body: { updates: [] } })).statusCode, 400);
});

test("garbage and oversized bodies are handled: junk entries are ignored and no more than 100 are taken", async () => {
  const t = table();
  const h = loadHandler("history.js", { plan: "premium", db: endpointDb(t) });
  const many = Array.from({ length: 250 }, (_, i) => ({ term: "w" + i, box: i % 4, at: T0 }));
  const res = await call(h, { method: "POST", body: { childId: "c1", updates: [...many, { term: "x", box: 77 }, null, 3] } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.saved, 100);
  assert.equal(t.rows.length, 100);
  const junk = await call(h, { method: "POST", body: { childId: "c1", updates: "not a list" } });
  assert.equal(junk.statusCode, 200);
  assert.deepEqual(junk.body, { saved: 0 });
});

test("the history GET carries the learner's progress on paid plans, and an empty map on Free", async () => {
  const t = table([{ child_id: "c1", profile_id: "user-1", term: "queue", box: 2, updated_at: iso(T0) }]);
  const paid = await call(loadHandler("history.js", { plan: "core", db: endpointDb(t) }), { method: "GET", query: { childId: "c1" } });
  assert.equal(paid.statusCode, 200, JSON.stringify(paid.body));
  assert.deepEqual(paid.body.vocabProgress, { queue: { box: 2, at: T0 } });
  const free = await call(loadHandler("history.js", { plan: "free", db: endpointDb(t) }), { method: "GET", query: { childId: "c1" } });
  assert.deepEqual(free.body.vocabProgress, {});
  assert.equal(free.body.vocabLocked, true);
});

test("the history GET still works if the progress table does not exist yet", async () => {
  const db = (q) => (q.table === "vocab_progress" ? { data: null, error: { message: "relation does not exist" } } : q.table === "submissions" ? { data: [], error: null } : { data: null, error: null });
  const res = await call(loadHandler("history.js", { plan: "core", db }), { method: "GET", query: { childId: "c1" } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.vocabProgress, {});
});

test("the table is defined in the schema, locked to the server, one row per learner and word", () => {
  const sql = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "supabase", "schema.sql"), "utf8");
  const part = sql.slice(sql.indexOf("create table if not exists public.vocab_progress"));
  assert.match(part, /primary key \(child_id, term\)/);
  assert.match(part, /check \(box between 0 and 3\)/);
  assert.match(part, /alter table public\.vocab_progress enable row level security/);
  assert.match(part, /references public\.child_profiles\(id\) on delete cascade/);
});

test("no new serverless function was added for this (the host caps how many there can be)", () => {
  const fs = require("node:fs"), path = require("node:path");
  const files = fs.readdirSync(path.join(__dirname, "..", "api")).filter((f) => f.endsWith(".js"));
  assert.ok(files.length <= 12, `api/ holds ${files.length} functions; the Hobby plan allows 12`);
  assert.ok(!files.includes("vocab-progress.js"));
});
