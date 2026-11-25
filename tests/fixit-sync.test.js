const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { FIXIT_SKILL_IDS, sanitizeGame, sanitizeFixit, mergeFixit, readVocabGame, writeVocabGame } = require("../api/_lib/vocabGame");

// How each Fix It skill is going is saved on the account inside the same row as the game (no new table), so it follows a
// learner between devices. The server and the page join two copies with the same rules (the page's are copied out of
// app.html and run here), two devices never undo each other, and a save from Word Dash or Boss Battle (which carry no skill
// record) never erases what is stored.
const ROOT = path.join(__dirname, "..");
const APP = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
const a0 = APP.indexOf("const VOCAB_BOXES = "), a1 = APP.indexOf("// The Frayer card for a word");
const b0 = APP.indexOf("// ---- Word Dash rules (start)"), b1 = APP.indexOf("// ---- Word Dash rules (end)");
const c0 = APP.indexOf("// ---- Fix It rules (start)"), c1 = APP.indexOf("// ---- Fix It rules (end)");
const P = new Function("localStorage", APP.slice(a0, a1) + "\n" + APP.slice(b0, b1) + "\n" + APP.slice(c0, c1) + "\nreturn { FIXIT_SKILLS, fixitState, fixitMerge, fixitSame };")({ getItem: () => null, setItem: () => {} });

const F = (stats = {}, recent = []) => ({ stats, recent });
const sorted = (a) => a.slice().sort();

test("the server and the page agree on which skills there are", () => {
  assert.deepEqual(FIXIT_SKILL_IDS, Object.keys(P.FIXIT_SKILLS));
});

test("whatever arrives is cleaned into the one shape, and the page and the server clean it the same way", () => {
  const messy = [null, undefined, [1], "x", {}, { stats: "no", recent: 5 },
    { stats: { caps: { n: 4, r: 99 }, nonsense: { n: 3, r: 1 }, comma: "x", stop: { n: -5, r: 2 }, spell: { n: 1e9, r: 1e9 } }, recent: ["abc", 5, "x".repeat(40), "ok"] },
    { stats: { tone: { n: 3.9, r: 2.2 } }, recent: Array.from({ length: 120 }, (_, i) => "id" + i) }];
  for (const m of messy) assert.deepEqual(sanitizeFixit(m), P.fixitState(m), "same result for " + String(JSON.stringify(m)).slice(0, 80));
  const s = sanitizeFixit(messy[6]);
  assert.deepEqual(s.stats, { caps: { n: 4, r: 4 }, spell: { n: 1000, r: 1000 } }, "known skills only, right never above answered, counts capped");
  assert.deepEqual(s.recent, ["abc", "ok"]);
  assert.equal(sanitizeFixit(messy[7]).recent.length, 80);
  assert.equal(sanitizeFixit(messy[7]).recent[79], "id119", "the newest eighty are kept");
  assert.deepEqual(sanitizeFixit(null), F());
});

test("joining two copies keeps the skill with more answers behind it and never loses what a device has learned", () => {
  const phone = F({ caps: { n: 12, r: 10 }, comma: { n: 3, r: 1 }, spell: { n: 8, r: 6 } }, ["a", "b", "c"]);
  const laptop = F({ caps: { n: 20, r: 12 }, comma: { n: 3, r: 2 }, tone: { n: 5, r: 5 } }, ["c", "d"]);
  const m = mergeFixit(phone, laptop);
  assert.deepEqual(m.stats.caps, { n: 20, r: 12 }, "more answers wins");
  assert.deepEqual(m.stats.comma, { n: 3, r: 2 }, "the same number of answers: the larger right count");
  assert.deepEqual(m.stats.spell, { n: 8, r: 6 }, "a skill only one device has is kept");
  assert.deepEqual(m.stats.tone, { n: 5, r: 5 });
  assert.deepEqual(m.recent, ["a", "b", "c", "d"], "lately seen questions are put together, once each");
  const back = mergeFixit(laptop, phone);
  assert.deepEqual(back.stats, m.stats, "the order of the two copies does not matter for the skills");
  assert.deepEqual(sorted(back.recent), sorted(m.recent));
  assert.deepEqual(mergeFixit(m, m), m, "joining a copy with itself changes nothing");
  assert.deepEqual(mergeFixit(null, phone), sanitizeFixit(phone), "a blank device simply takes the account's record");
  assert.deepEqual(mergeFixit(phone, undefined), sanitizeFixit(phone));
  assert.deepEqual(mergeFixit(undefined, undefined), F());
  const many = mergeFixit(F({}, Array.from({ length: 70 }, (_, i) => "a" + i)), F({}, Array.from({ length: 70 }, (_, i) => "b" + i)));
  assert.equal(many.recent.length, 80);
  assert.equal(many.recent[79], "b69");
});

test("the page's join gives exactly what the server's does", () => {
  const cases = [
    [F({ caps: { n: 12, r: 10 }, comma: { n: 3, r: 1 } }, ["a", "b"]), F({ caps: { n: 20, r: 12 }, tone: { n: 5, r: 5 } }, ["b", "c"])],
    [F(), F({ spell: { n: 2, r: 1 } }, ["x"])], [null, { stats: { agree: { n: 9, r: 9 } } }],
    [F({ stop: { n: 6, r: 3 } }), F({ stop: { n: 6, r: 4 } })], [{ stats: { caps: { n: 1, r: 5 } } }, "junk"],
    [F({}, Array.from({ length: 70 }, (_, i) => "a" + i)), F({}, Array.from({ length: 70 }, (_, i) => "b" + i))],
  ];
  for (const [x, y] of cases) assert.deepEqual(P.fixitMerge(x, y), mergeFixit(x, y));
  assert.ok(P.fixitSame(F({ caps: { n: 2, r: 1 } }, ["a"]), { stats: { caps: { n: 2, r: 1 }, bogus: { n: 1, r: 1 } }, recent: ["a"] }));
  assert.ok(!P.fixitSame(F({ caps: { n: 2, r: 1 } }), F({ caps: { n: 3, r: 1 } })));
});

// A tiny stand-in for the database: one table, one row per learner.
function fakeDb() {
  const rows = new Map();
  return {
    rows,
    from() {
      const q = { filters: {} };
      const api = {
        select() { return api; },
        eq(k, v) { q.filters[k] = v; return api; },
        maybeSingle: async () => { const r = rows.get(q.filters.child_id); return { data: r && r.profile_id === q.filters.profile_id ? { state: r.state } : null, error: null }; },
        upsert: async (row) => { rows.set(row.child_id, row); return { error: null }; },
      };
      return api;
    },
  };
}
const G = (o = {}) => ({ coins: 0, egg: 0, pals: [], streak: 0, lastDay: -1, freezes: 0, rounds: 0, right: 0, bestCombo: 0, perfect: 0, ...o });

test("the skill record is saved and joined with the game, and other saves never erase it", async () => {
  const db = fakeDb();
  const first = await writeVocabGame(db, "p1", "c1", { ...G({ coins: 50, rounds: 1, lastDay: 5, streak: 1 }), fixit: F({ caps: { n: 10, r: 8 } }, ["a"]) });
  assert.deepEqual(first.fixit, F({ caps: { n: 10, r: 8 } }, ["a"]));
  assert.equal(first.coins, 50);
  // Word Dash (or Boss Battle) saves the game with no skill record: what is stored stays exactly as it was.
  const dashOnly = await writeVocabGame(db, "p1", "c1", G({ coins: 90, rounds: 2, lastDay: 6, streak: 2 }));
  assert.deepEqual(dashOnly.fixit, F({ caps: { n: 10, r: 8 } }, ["a"]), "a save without a skill record keeps the stored one");
  assert.equal(dashOnly.coins, 90);
  // A second device with more evidence on one skill and a new skill.
  const second = await writeVocabGame(db, "p1", "c1", { ...G({ rounds: 1 }), fixit: F({ caps: { n: 14, r: 9 }, tone: { n: 4, r: 4 } }, ["b"]) });
  assert.deepEqual(second.fixit.stats, { caps: { n: 14, r: 9 }, tone: { n: 4, r: 4 } });
  assert.deepEqual(second.fixit.recent, ["a", "b"]);
  assert.deepEqual(await readVocabGame(db, "p1", "c1"), second, "reading gives back what was saved");
  assert.equal(await readVocabGame(db, "p2", "c1"), null, "another account sees nothing");
  assert.equal(await readVocabGame(db, "p1", "c2"), null, "another learner sees nothing");
});

test("a game saved before the skill record existed reads back as it always did, with no skill record added", async () => {
  const db = fakeDb();
  db.rows.set("c9", { child_id: "c9", profile_id: "p9", state: G({ coins: 7, pals: ["fox"], rounds: 1 }) });
  const read = await readVocabGame(db, "p9", "c9");
  assert.deepEqual(read, sanitizeGame(G({ coins: 7, pals: ["fox"], rounds: 1 })));
  assert.ok(!("fixit" in read));
  const saved = await writeVocabGame(db, "p9", "c9", G({ coins: 9, rounds: 2, lastDay: 3 }));
  assert.ok(!("fixit" in saved), "nothing invented");
  const junk = await writeVocabGame(db, "p9", "c9", { ...G({ rounds: 3 }), fixit: "not an object" });
  assert.ok(!("fixit" in junk), "a junk skill record is ignored");
});

test("wiring: the Games tab joins the account's skill record when it opens and sends it with every round", () => {
  const ui = APP.slice(APP.indexOf("function GamesHub("), APP.indexOf("// Tell us what you think: a short form"));
  assert.match(ui, /const remoteFx = d\.vocabGame && d\.vocabGame\.fixit;/);
  assert.match(ui, /const joinedFx = fixitMerge\(fixitLoad\(childId\), remoteFx\);/);
  assert.match(ui, /!fixitSame\(joinedFx, remoteFx\)/, "what the account lacks is sent up");
  assert.match(ui, /game: \{ \.\.\.joined, fixit: joinedFx \}/);
  assert.match(ui, /extra: \{ fixit: nextFx \}/, "every Fix It round carries the skill record");
  assert.match(ui, /game: \{ \.\.\.out\.state, \.\.\.\(extra \|\| \{\}\) \}/);
  assert.match(ui, /if \(g\.fixit\) setFx\(/, "a second device's record is joined into the page");
  assert.ok(!/extra:/.test(ui.slice(ui.indexOf("function BossBattle("))), "Boss Battle does not send a skill record");
  const history = fs.readFileSync(path.join(ROOT, "api", "history.js"), "utf8");
  assert.match(history, /vocabGame: vocabLocked \? null : await readVocabGame\(/, "the skill record comes back with the game on the same plan gate");
  assert.match(history, /body\.game[\s\S]{0,200}writeVocabGame\(/);
});
