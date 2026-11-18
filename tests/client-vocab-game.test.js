const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Word Dash (the vocabulary game) keeps its rules in app.html, so they are copied out of the source and run here:
// how a round is planned from the learner's own words, how coins, streaks, freezes and hatching add up, and that a
// corrupted saved game never breaks anything.
const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const a0 = APP.indexOf("const VOCAB_BOXES = "), a1 = APP.indexOf("// The Frayer card for a word");
const b0 = APP.indexOf("// ---- Word Dash rules (start)"), b1 = APP.indexOf("// ---- Word Dash rules (end)");
assert.ok(a0 > 0 && a1 > a0 && b0 > 0 && b1 > b0, "the vocabulary helpers and the game rules are in app.html");
const G = new Function("localStorage", APP.slice(a0, a1) + "\n" + APP.slice(b0, b1) + `
return { DASH_ROUND, DASH_EGG, DASH_PALS, dashState, dashLoad, dashSave, dashStreakShown, dashMult, dashCoins, dashStars, dashRoundResult, dashApplyRound, dashBlank, dashQuestion, dashPlan, dashRetry, dashDay, dashMerge, dashSame };`)(
  (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; })()
);

// A repeatable "random" so the tests do not flake.
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const WORDS = [
  ["queue", "a line of people waiting", "We stood in a queue for ice cream."],
  ["stall", "a small stand where things are sold", "She sold apples at her stall."],
  ["gate", "a door in a fence", "Close the gate behind you."],
  ["brave", "ready to face danger", "The brave girl climbed the tree."],
  ["whisper", "to speak very quietly", "He had to whisper in the library."],
  ["enormous", "extremely big", "An enormous whale swam past."],
  ["gentle", "soft and kind", "Be gentle with the kitten."],
  ["curious", "eager to find things out", ""],
].map(([term, definition, example]) => ({ term, definition, example }));

test("a round is ten questions (or one per word in a smaller bank), each about a word, with a right answer among distinct options", () => {
  assert.equal(G.dashPlan(WORDS, {}, seeded()).length, 8, "eight words: each asked once");
  const bigger = [...WORDS, { term: "swift", definition: "very fast", example: "A swift horse." }, { term: "pale", definition: "light in colour", example: "" }, { term: "glow", definition: "to shine softly", example: "" }];
  const plan = G.dashPlan(bigger, {}, seeded());
  assert.equal(plan.length, G.DASH_ROUND);
  for (const q of plan) {
    assert.ok(bigger.some((w) => w.term === q.term));
    if (q.kind === "spell") { assert.equal(q.letters.slice().sort().join(""), q.answer.split("").sort().join("")); assert.notEqual(q.letters.join(""), q.answer); continue; }
    assert.ok(q.options.length >= 3 && q.options.length <= 4);
    assert.equal(new Set(q.options.map((o) => o.toLowerCase())).size, q.options.length, "no repeated options");
    const w = bigger.find((x) => x.term === q.term);
    assert.equal(q.options[q.correctIndex], q.kind === "meaning" ? w.definition : w.term);
  }
});

test("words that need the most work come first, and known words are left until last", () => {
  const boxes = {};
  WORDS.slice(0, 5).forEach((w) => { boxes[w.term] = { box: 3, at: 1 }; });
  const plan = G.dashPlan(WORDS, boxes, seeded(3), 3);
  assert.deepEqual(plan.map((q) => q.term).sort(), ["curious", "enormous", "gentle"].sort());
});

test("the question styles vary, and a new word (step 0) only gets the easy recognise-it styles", () => {
  const fresh = G.dashPlan(WORDS, {}, seeded(5));
  assert.ok(fresh.every((q) => q.kind === "meaning" || q.kind === "word"));
  const boxes = {}; WORDS.forEach((w) => { boxes[w.term] = { box: 1, at: 1 }; });
  const kinds = new Set(G.dashPlan(WORDS, boxes, seeded(5)).map((q) => q.kind));
  assert.ok(kinds.size >= 3, "a learner who has met the words gets a mix: " + [...kinds]);
});

test("a gap question hides the word in its example and is only made when the example really contains it", () => {
  assert.equal(G.dashBlank("We stood in a queue for ice cream.", "queue"), "We stood in a _____ for ice cream.");
  assert.equal(G.dashBlank("Queues are long.", "queue"), "", "a different form of the word is not blanked");
  assert.equal(G.dashBlank("", "queue"), "");
  assert.equal(G.dashBlank("It costs $5 (cheap).", "$5"), "It costs _____ (cheap).", "odd characters never break the pattern");
  assert.equal(G.dashBlank("Use (a|b) here.", "(a|b)"), "Use _____ here.");
  const boxes = {}; WORDS.forEach((w) => { boxes[w.term] = { box: 2, at: 1 }; });
  for (const q of G.dashPlan(WORDS, boxes, seeded(9))) if (q.kind === "gap") { assert.match(q.prompt, /_____/); assert.ok(!q.prompt.toLowerCase().includes(q.term)); }
});

test("a small bank still makes a full-length round, asking a repeated word a new way; fewer than 4 words makes none", () => {
  const four = WORDS.slice(0, 4);
  const plan = G.dashPlan(four, {}, seeded());
  assert.equal(plan.length, 6);
  assert.equal(G.dashPlan(WORDS.slice(0, 3), {}, seeded()).length, 0);
  assert.equal(G.dashPlan([], {}, seeded()).length, 0);
  assert.equal(G.dashPlan(undefined, {}, seeded()).length, 0);
});

test("a missed word comes back as a second-chance meaning question", () => {
  const q = G.dashPlan(WORDS, {}, seeded())[0];
  const again = G.dashRetry(q, WORDS, seeded(2));
  assert.equal(again.retry, true);
  assert.equal(again.term, q.term);
  assert.equal(again.options[again.correctIndex], WORDS.find((w) => w.term === q.term).definition);
});

test("the combo multiplier climbs every two right answers to x5, and a perfect round earns a bonus", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 9, 20].map(G.dashMult), [1, 1, 2, 2, 3, 3, 4, 5, 5]);
  assert.equal(G.dashCoins(3), 20);
  const r = G.dashRoundResult({ right: 10, outOf: 10, coins: 300, bestCombo: 10 });
  assert.equal(r.coins, 325); assert.equal(r.stars, 3); assert.equal(r.perfect, true);
  const s = G.dashRoundResult({ right: 7, outOf: 10, coins: 100, bestCombo: 3 });
  assert.equal(s.coins, 100); assert.equal(s.stars, 2); assert.equal(s.perfect, false);
  assert.deepEqual([[10, 10], [9, 10], [7, 10], [5, 10], [3, 10], [0, 10], [0, 0]].map(([r2, o]) => G.dashStars(r2, o)), [3, 3, 2, 1, 0, 0, 0]);
});

test("the streak grows day by day, one missed day is covered by a freeze, and two missed days reset it", () => {
  const res = { coins: 10, right: 1, bestCombo: 1, perfect: false };
  const rng = seeded();
  let s = G.dashApplyRound(G.dashState(), res, 100, rng);
  assert.equal(s.state.streak, 1);
  s = G.dashApplyRound(s.state, res, 100, rng);
  assert.equal(s.state.streak, 1, "a second round on the same day does not add to the streak");
  s = G.dashApplyRound(s.state, res, 101, rng);
  assert.equal(s.state.streak, 2);
  // two days later with no freeze: back to 1
  assert.equal(G.dashApplyRound(s.state, res, 103, rng).state.streak, 1);
  // two days later WITH a freeze: kept, and the freeze is used
  const withFreeze = G.dashApplyRound({ ...s.state, freezes: 1 }, res, 103, rng);
  assert.equal(withFreeze.state.streak, 3); assert.equal(withFreeze.state.freezes, 0); assert.equal(withFreeze.usedFreeze, true);
  // every fifth day earns a freeze, up to two
  let t = G.dashState();
  for (let d = 1; d <= 5; d++) t = G.dashApplyRound(t, res, d, rng).state;
  assert.equal(t.streak, 5); assert.equal(t.freezes, 1);
  for (let d = 6; d <= 15; d++) t = G.dashApplyRound(t, res, d, rng).state;
  assert.equal(t.freezes, 2, "never more than two");
});

test("what the flame shows: alive today, at risk yesterday, saved by a freeze, or gone", () => {
  const base = { streak: 4, lastDay: 50, freezes: 0 };
  assert.deepEqual(G.dashStreakShown(base, 50), { days: 4, atRisk: false, saved: false });
  assert.deepEqual(G.dashStreakShown(base, 51), { days: 4, atRisk: true, saved: false });
  assert.equal(G.dashStreakShown(base, 52).days, 0);
  assert.deepEqual(G.dashStreakShown({ ...base, freezes: 1 }, 52), { days: 4, atRisk: true, saved: true });
  assert.equal(G.dashStreakShown({ ...base, freezes: 1 }, 53).days, 0);
  assert.equal(G.dashStreakShown(G.dashState(), 10).days, 0);
});

test("coins fill an egg; at the cost a new, different pal hatches and the leftover carries over; a full collection stops hatching", () => {
  const rng = seeded(11);
  const r1 = G.dashApplyRound(G.dashState(), { coins: 100, right: 5, bestCombo: 3 }, 1, rng);
  assert.equal(r1.hatched.length, 0); assert.equal(r1.state.egg, 100);
  const r2 = G.dashApplyRound(r1.state, { coins: 70, right: 5, bestCombo: 3 }, 1, rng);
  assert.equal(r2.hatched.length, 1); assert.equal(r2.state.egg, 20); assert.equal(r2.state.pals.length, 1);
  const big = G.dashApplyRound(G.dashState(), { coins: G.DASH_EGG * 3 + 5, right: 10, bestCombo: 10, perfect: true }, 1, rng);
  assert.equal(big.hatched.length, 3); assert.equal(new Set(big.state.pals).size, 3, "never a repeat"); assert.equal(big.state.egg, 5);
  const all = { ...G.dashState(), pals: G.DASH_PALS.map((p) => p.id) };
  const done = G.dashApplyRound(all, { coins: 999, right: 10, bestCombo: 10 }, 1, rng);
  assert.equal(done.hatched.length, 0); assert.equal(done.state.egg, 0); assert.equal(done.state.coins, 999);
});

test("a corrupted or blocked saved game falls back to a clean start", () => {
  assert.deepEqual(G.dashState(null), G.dashState());
  assert.deepEqual(G.dashState([1, 2]), G.dashState());
  const s = G.dashState({ coins: -5, egg: 99999, pals: ["fox", "fox", "nope", 7], streak: "x", lastDay: 3.9, freezes: 50 });
  assert.equal(s.coins, 0); assert.equal(s.egg, G.DASH_EGG - 1); assert.deepEqual(s.pals, ["fox"]); assert.equal(s.streak, 0); assert.equal(s.lastDay, 3); assert.equal(s.freezes, 2);
  G.dashSave("kid", { ...G.dashState(), coins: 40 });
  assert.equal(G.dashLoad("kid").coins, 40);
  assert.deepEqual(G.dashLoad("other"), G.dashState());
});
