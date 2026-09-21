const test = require("node:test");
const assert = require("node:assert/strict");
const { MIN_OTHER_PEERS, LADDER_SIZE, scoreChildTargets, buildCohortResult } = require("../api/_lib/cohortScoring");

const TARGETS = [{ name: "A" }, { name: "B" }];

test("scoreChildTargets: no submissions -> null (excluded from cohort, not scored as 0)", () => {
  assert.equal(scoreChildTargets(TARGETS, []), null);
});

test("scoreChildTargets: averages per-target pct across assessed targets only", () => {
  // Target A: 3 glow, 1 grow -> 75%. Target B: never mentioned -> excluded.
  const subs = [
    { feedback: { glowTarget: "A" } },
    { feedback: { glowTarget: "A" } },
    { feedback: { glowTarget: "A" } },
    { feedback: { growTarget: "A" } },
  ];
  assert.equal(scoreChildTargets(TARGETS, subs), 75);
});

test("scoreChildTargets: a target mentioned only as growth scores 0%, not excluded", () => {
  const subs = [{ feedback: { growTarget: "A" } }];
  assert.equal(scoreChildTargets(TARGETS, subs), 0);
});

test("buildCohortResult: caller with no assessed data -> no_data_yet, regardless of peers", () => {
  const scores = new Map([["you", null], ["p1", 80], ["p2", 80], ["p3", 80], ["p4", 80]]);
  // simulate a caller genuinely absent from the map (as the real caller would be if scoreChildTargets returned null)
  scores.delete("you");
  const result = buildCohortResult(scores, "you");
  assert.deepEqual(result, { available: false, reason: "no_data_yet" });
});

test("buildCohortResult: privacy floor blocks comparison below MIN_OTHER_PEERS", () => {
  const scores = new Map([["you", 60], ["p1", 50], ["p2", 70], ["p3", 40]]); // 3 others
  assert.ok(3 < MIN_OTHER_PEERS, "test assumes MIN_OTHER_PEERS > 3");
  const result = buildCohortResult(scores, "you");
  assert.equal(result.available, false);
  assert.equal(result.reason, "not_enough_peers");
  assert.equal(result.cohortSize, 3);
});

test("buildCohortResult: exactly MIN_OTHER_PEERS others unlocks the comparison", () => {
  const scores = new Map([["you", 60], ["p1", 50], ["p2", 70], ["p3", 40], ["p4", 60]]); // 4 others
  const result = buildCohortResult(scores, "you");
  assert.equal(result.available, true);
  assert.equal(result.cohortSize, 5);
});

test("buildCohortResult: average, percentile and rank math are correct on a known cohort", () => {
  // you=60; others = [40, 50, 60, 80, 90] -> avg 64, below-you=2 (40,50), equal-you=1 (60)
  const scores = new Map([["you", 60], ["p1", 40], ["p2", 50], ["p3", 60], ["p4", 80], ["p5", 90]]);
  const result = buildCohortResult(scores, "you");
  assert.equal(result.available, true);
  assert.equal(result.cohortAverage, Math.round((40 + 50 + 60 + 80 + 90) / 5)); // 64
  // percentile = (countBelow + countEqual/2) / others.length * 100 = (2 + 0.5)/5*100 = 50
  assert.equal(result.percentile, 50);
  // ranked desc: 90,80,60(you or p3 - tie),60,50,40 -> you is one of the two 60s
  assert.equal(result.yourScore, 60);
  assert.ok(result.yourRank === 3 || result.yourRank === 4, `expected rank 3 or 4 for a tied score, got ${result.yourRank}`);
});

test("league ladder: ranked descending by score", () => {
  const scores = new Map([["you", 30], ["p1", 90], ["p2", 10], ["p3", 50], ["p4", 70], ["p5", 20]]);
  const result = buildCohortResult(scores, "you");
  assert.equal(result.available, true);
  const ladderScores = result.ladder.map((r) => r.score);
  const sorted = [...ladderScores].sort((a, b) => b - a);
  assert.deepEqual(ladderScores, sorted, "ladder must be sorted highest score first");
  assert.deepEqual(result.ladder.map((r) => r.rank), ladderScores.map((_, i) => i + 1), "ranks must be sequential starting at 1");
});

test("league ladder: exactly one row is marked isYou, and it is the caller's own score", () => {
  const scores = new Map([["you", 55], ["p1", 90], ["p2", 10], ["p3", 50], ["p4", 70], ["p5", 20]]);
  const result = buildCohortResult(scores, "you");
  const youRows = result.ladder.filter((r) => r.isYou);
  assert.equal(youRows.length, 1);
  assert.equal(youRows[0].score, 55);
});

test("league ladder: every row is fully anonymous except the caller's - no identifying fields leak", () => {
  const scores = new Map([["you", 55], ["p1", 90], ["p2", 10], ["p3", 50], ["p4", 70], ["p5", 20]]);
  const result = buildCohortResult(scores, "you");
  for (const row of result.ladder) {
    const keys = Object.keys(row).sort();
    assert.deepEqual(keys, ["isYou", "rank", "score"], "a ladder row must only ever carry rank/score/isYou - never a child_id, display_name, or any other identifier");
  }
});

test("league ladder: capped at LADDER_SIZE, with the caller's own row appended if ranked below the cap", () => {
  const scores = new Map();
  scores.set("you", 1); // guaranteed last place
  for (let i = 0; i < LADDER_SIZE + 10; i++) scores.set(`p${i}`, 100 - i); // all rank above "you"
  const result = buildCohortResult(scores, "you");
  assert.equal(result.available, true);
  // top LADDER_SIZE ranked rows, plus one extra appended row for "you"
  assert.equal(result.ladder.length, LADDER_SIZE + 1);
  const last = result.ladder[result.ladder.length - 1];
  assert.equal(last.isYou, true);
  assert.equal(last.score, 1);
  assert.equal(last.rank, result.yourRank);
  assert.equal(last.rank, LADDER_SIZE + 11); // "you" is ranked last among LADDER_SIZE+11 total entrants
});

test("league ladder: caller inside the top LADDER_SIZE is not duplicated", () => {
  const scores = new Map();
  scores.set("you", 100); // guaranteed first place
  for (let i = 0; i < 10; i++) scores.set(`p${i}`, 50 - i);
  const result = buildCohortResult(scores, "you");
  const youRows = result.ladder.filter((r) => r.isYou);
  assert.equal(youRows.length, 1, "the caller must appear exactly once, not duplicated by the append-if-outside-cap logic");
  assert.equal(result.ladder[0].isYou, true);
  assert.equal(result.ladder[0].rank, 1);
});
