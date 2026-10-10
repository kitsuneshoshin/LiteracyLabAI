const test = require("node:test");
const assert = require("node:assert/strict");
const { conventionsTarget, conventionsOutcome } = require("../api/_lib/conventions");
const { targetsForGrade } = require("../api/_lib/masteryTargets");
const { loadHandler, call } = require("./harness");

// The spelling, punctuation and grammar target also fills in from Premium's spelling check, not only when the AI picks it.
const SG = "🇸🇬 Singapore & SE Asia";
const IG = targetsForGrade(SG, "O-Level / IGCSE Yr 4", "high").targets;
const CONV = "Accurate Spelling, Punctuation & Grammar";

test("the conventions target is found by name, and only when there is exactly one", () => {
  assert.equal(conventionsTarget(IG), CONV);
  assert.equal(conventionsTarget([{ name: "Planning" }, { name: "Inference" }]), null);
  assert.equal(conventionsTarget([{ name: "Spelling" }, { name: "Grammar" }]), null, "ambiguous: do nothing");
  assert.equal(conventionsTarget(undefined), null);
});

test("few errors for the length is a strength, many is a next step, in between says nothing", () => {
  const sub = (total, words) => ({ feedback: { spellingGrammarTotal: total }, word_count: words });
  assert.equal(conventionsOutcome(sub(1, 100)), "g");
  assert.equal(conventionsOutcome(sub(2, 100)), "g");
  assert.equal(conventionsOutcome(sub(10, 100)), "n");
  assert.equal(conventionsOutcome(sub(3, 100)), null);
  assert.equal(conventionsOutcome(sub(0, 10)), null, "too short to judge");
  assert.equal(conventionsOutcome({ feedback: {}, word_count: 100 }), null, "no spelling check on this piece (Free and Core)");
  assert.equal(conventionsOutcome(sub(5, null)), null);
});

async function progress(rows) {
  const h = loadHandler("progress.js", { plan: "premium", db: (q) => (q.table === "submissions" ? { data: rows, error: null } : { data: null, error: null }) });
  const res = await call(h, { method: "GET", query: { tier: "high", country: SG, gradeLabel: "O-Level / IGCSE Yr 4", childId: "c1" } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  return Object.fromEntries(res.body.targets.map((t) => [t.name, t]));
}

test("a Premium piece with few errors fills the conventions bar even though the AI praised something else", async () => {
  const other = IG.find((t) => t.name !== CONV).name;
  const t = await progress([{ feedback: { glowTarget: other, growTarget: other, spellingGrammarTotal: 1 }, word_count: 200 }]);
  assert.equal(t[CONV].status, "Mastered"); assert.equal(t[CONV].strengths, 1); assert.equal(t[CONV].pct, 100);
});

test("many errors make it a next step, and a piece the AI already tagged to this target is not counted twice", async () => {
  const other = IG.find((t) => t.name !== CONV).name;
  const messy = await progress([{ feedback: { glowTarget: other, growTarget: other, spellingGrammarTotal: 20 }, word_count: 200 }]);
  assert.equal(messy[CONV].nextSteps, 1); assert.equal(messy[CONV].pct, 0);
  const tagged = await progress([{ feedback: { glowTarget: CONV, growTarget: other, spellingGrammarTotal: 0 }, word_count: 200 }]);
  assert.equal(tagged[CONV].strengths, 1, "counted once, from the AI's own choice");
  assert.equal(tagged[CONV].assessedCount, 1);
});

test("without a spelling check the target stays not assessed, as before", async () => {
  const other = IG.find((t) => t.name !== CONV).name;
  const t = await progress([{ feedback: { glowTarget: other, growTarget: other }, word_count: 200 }]);
  assert.equal(t[CONV].status, "Not Yet Assessed");
});
