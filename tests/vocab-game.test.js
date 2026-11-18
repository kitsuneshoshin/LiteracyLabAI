const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PAL_IDS, DASH_EGG, sanitizeGame, mergeGame, readVocabGame, writeVocabGame } = require("../api/_lib/vocabGame");

// The game's saved progress on the account: cleaned on the way in, joined with the device's copy without ever losing a
// pal, and never able to break the vocabulary page when the table is missing.

// The page's own copy of the same rules (app.html is one in-browser script, so it is copied out and run here).
const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const a0 = APP.indexOf("const VOCAB_BOXES = "), a1 = APP.indexOf("// The Frayer card for a word");
const b0 = APP.indexOf("// ---- Word Dash rules (start)"), b1 = APP.indexOf("// ---- Word Dash rules (end)");
const C = new Function("localStorage", APP.slice(a0, a1) + "\n" + APP.slice(b0, b1) + "\nreturn { DASH_PALS, DASH_EGG, dashState, dashMerge };")({ getItem: () => null, setItem: () => {} });

const G = (o = {}) => ({ coins: 0, egg: 0, pals: [], streak: 0, lastDay: -1, freezes: 0, rounds: 0, right: 0, bestCombo: 0, perfect: 0, ...o });

test("the server and the page agree on the Word Pals and the egg size", () => {
  assert.deepEqual(PAL_IDS, C.DASH_PALS.map((p) => p.id));
  assert.equal(DASH_EGG, C.DASH_EGG);
});

test("whatever arrives is cleaned into the one shape, and the page and the server clean it the same way", () => {
  const messy = [null, undefined, [1], "x", {}, { coins: -5, egg: 99999, pals: ["owl", "fox", "fox", "nope", 7], streak: "x", lastDay: 3.9, freezes: 50, rounds: 1e12, right: NaN, bestCombo: Infinity },
    { coins: 12.7, pals: "owl", lastDay: -9 }, { pals: PAL_IDS, egg: 10 }];
  for (const m of messy) assert.deepEqual(sanitizeGame(m), C.dashState(m), "same result for " + JSON.stringify(m));
  const s = sanitizeGame(messy[5]);
  assert.equal(s.coins, 0); assert.equal(s.egg, DASH_EGG - 1); assert.deepEqual(s.pals, ["fox", "owl"], "known pals only, once each, in a fixed order");
  assert.equal(s.lastDay, 3); assert.equal(s.freezes, 2); assert.equal(s.rounds, 10000000);
  assert.deepEqual(sanitizeGame(null), G());
});

test("joining two copies never loses a pal, never lowers a count, and takes the streak from the device that played last", () => {
  const phone = G({ coins: 400, egg: 50, pals: ["fox", "owl"], streak: 6, lastDay: 100, freezes: 1, rounds: 12, right: 80, bestCombo: 7, perfect: 1 });
  const laptop = G({ coins: 520, egg: 20, pals: ["owl", "dragon"], streak: 2, lastDay: 99, freezes: 0, rounds: 15, right: 70, bestCombo: 9, perfect: 0 });
  const m = mergeGame(phone, laptop);
  assert.deepEqual(m.pals, ["fox", "owl", "dragon"]);
  assert.equal(m.coins, 520); assert.equal(m.rounds, 15); assert.equal(m.right, 80); assert.equal(m.bestCombo, 9); assert.equal(m.perfect, 1);
  assert.equal(m.egg, 20, "the egg comes from the copy with more rounds");
  assert.equal(m.streak, 6); assert.equal(m.lastDay, 100); assert.equal(m.freezes, 1, "the streak and its freezes come from the copy played most recently");
  assert.deepEqual(mergeGame(laptop, phone), m, "the order of the two copies does not matter");
  assert.deepEqual(mergeGame(m, m), m, "joining a copy with itself changes nothing");
  assert.deepEqual(mergeGame(G(), phone), sanitizeGame(phone), "a blank device simply takes the account's game");
  assert.deepEqual(mergeGame(undefined, undefined), G());
});

test("a complete collection leaves no egg; equal copies keep the larger egg", () => {
  assert.equal(mergeGame(G({ pals: PAL_IDS.slice(0, 8), egg: 30 }), G({ pals: PAL_IDS.slice(8), egg: 40 })).egg, 0);
  assert.equal(mergeGame(G({ egg: 30, rounds: 2, lastDay: 5 }), G({ egg: 40, rounds: 2, lastDay: 5 })).egg, 40);
});

test("the page's join gives exactly what the server's does", () => {
  const cases = [
    [G({ coins: 400, egg: 50, pals: ["fox", "owl"], streak: 6, lastDay: 100, freezes: 1, rounds: 12 }), G({ coins: 520, egg: 20, pals: ["owl", "dragon"], streak: 2, lastDay: 99, rounds: 15 })],
    [G(), G({ pals: ["frog"], rounds: 1, lastDay: 4, streak: 1 })],
    [G({ pals: PAL_IDS.slice(0, 8), egg: 30 }), G({ pals: PAL_IDS.slice(8), egg: 40 })],
    [null, { coins: 9 }], [{ pals: ["bee"], rounds: 3, lastDay: 7, streak: 2 }, { pals: ["bee"], rounds: 3, lastDay: 7, streak: 5, egg: 12 }],
  ];
  for (const [x, y] of cases) assert.deepEqual(C.dashMerge(x, y), mergeGame(x, y));
});

// A tiny stand-in for the database: one table, one row per learner.
function fakeDb({ failRead = false, failWrite = false } = {}) {
  const rows = new Map();
  return {
    rows,
    from() {
      const q = { filters: {} };
      const api = {
        select() { return api; },
        eq(k, v) { q.filters[k] = v; return api; },
        maybeSingle: async () => { if (failRead) return { data: null, error: { message: "relation does not exist" } }; const r = rows.get(q.filters.child_id); return { data: r && r.profile_id === q.filters.profile_id ? { state: r.state } : null, error: null }; },
        upsert: async (row) => { if (failWrite) return { error: { message: "nope" } }; rows.set(row.child_id, row); return { error: null }; },
      };
      return api;
    },
  };
}

test("saving joins with what is stored and returns the joined game; reading returns it for the right learner only", async () => {
  const db = fakeDb();
  assert.equal(await readVocabGame(db, "p1", "c1"), null, "nothing saved yet");
  const first = await writeVocabGame(db, "p1", "c1", G({ coins: 100, pals: ["fox"], rounds: 3, lastDay: 10, streak: 3 }));
  assert.deepEqual(first.pals, ["fox"]);
  const second = await writeVocabGame(db, "p1", "c1", G({ coins: 40, pals: ["owl"], rounds: 1, lastDay: 8, streak: 1 }));
  assert.deepEqual(second.pals, ["fox", "owl"], "an older device cannot remove a pal");
  assert.equal(second.coins, 100); assert.equal(second.rounds, 3); assert.equal(second.streak, 3);
  assert.deepEqual(await readVocabGame(db, "p1", "c1"), second);
  assert.equal(await readVocabGame(db, "p2", "c1"), null, "another account sees nothing");
  assert.equal(await readVocabGame(db, "p1", "c2"), null, "another learner sees nothing");
});

test("a missing table or a failed save never throws: the page keeps its own copy", async () => {
  const origWarn = console.warn; console.warn = () => {};
  try {
    assert.equal(await readVocabGame(fakeDb({ failRead: true }), "p", "c"), null);
    assert.equal(await writeVocabGame(fakeDb({ failRead: true, failWrite: true }), "p", "c", G({ coins: 1 })), null);
    assert.equal(await writeVocabGame(fakeDb({ failWrite: true }), "p", "c", G({ coins: 1 })), null);
  } finally { console.warn = origWarn; }
});

test("wiring: history reads and saves the game on the vocabulary-bank gate, and the table is in the schema", () => {
  const history = fs.readFileSync(path.join(__dirname, "..", "api", "history.js"), "utf8");
  assert.match(history, /vocabGame: vocabLocked \? null : await readVocabGame\(/);
  assert.match(history, /body\.game[\s\S]{0,200}writeVocabGame\(/);
  const schema = fs.readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8");
  assert.match(schema, /create table if not exists public\.vocab_game/);
  assert.match(schema, /alter table public\.vocab_game enable row level security/);
});
