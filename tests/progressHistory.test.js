const test = require("node:test");
const assert = require("node:assert/strict");
const { weekStartKey, computeTimeline, computeStreak } = require("../api/_lib/progressHistory");

test("weekStartKey: always resolves to the Monday of that UTC week", () => {
  // 2026-09-21 is a Monday.
  assert.equal(weekStartKey(new Date("2026-09-21T00:00:00Z")), "2026-09-21");
  assert.equal(weekStartKey(new Date("2026-09-22T23:59:59Z")), "2026-09-21"); // Tuesday
  assert.equal(weekStartKey(new Date("2026-09-27T12:00:00Z")), "2026-09-21"); // Sunday, same week
  assert.equal(weekStartKey(new Date("2026-09-28T00:00:00Z")), "2026-09-28"); // next Monday
});

test("computeTimeline: buckets submissions by week and computes masteryPct from glow/grow tags", () => {
  const subs = [
    { created_at: "2026-09-21T10:00:00Z", kind: "writing", word_count: 100, feedback: { glowTarget: "A" } },
    { created_at: "2026-09-22T10:00:00Z", kind: "writing", word_count: 50, feedback: { growTarget: "A" } },
    { created_at: "2026-09-28T10:00:00Z", kind: "writing", word_count: 200, feedback: {} }, // no tags -> null week
  ];
  const timeline = computeTimeline(subs);
  assert.equal(timeline.length, 2);
  const [week1, week2] = timeline;
  assert.equal(week1.weekStart, "2026-09-21");
  assert.equal(week1.submissions, 2);
  assert.equal(week1.wordsWritten, 150);
  assert.equal(week1.masteryPct, 50); // 1 glow / (1 glow + 1 grow)
  assert.equal(week2.weekStart, "2026-09-28");
  assert.equal(week2.masteryPct, null, "a week with no glow/grow-tagged feedback must show a gap, not a fabricated 0%");
});

test("computeTimeline: reading score is averaged only over graded reading rows", () => {
  const subs = [
    { created_at: "2026-09-21T10:00:00Z", kind: "reading", score: 3, total_questions: 3, feedback: {} },
    { created_at: "2026-09-21T11:00:00Z", kind: "reading", score: 1, total_questions: 2, feedback: {} },
    { created_at: "2026-09-21T12:00:00Z", kind: "reading", score: null, total_questions: 3, feedback: {} }, // not yet graded
  ];
  const [week] = computeTimeline(subs);
  // (3/3 + 1/2) / 2 = 0.75 -> 75%
  assert.equal(week.avgReadingScore, 75);
});

test("computeTimeline: caps at the most recent 26 weeks", () => {
  const subs = [];
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.UTC(2026, 0, 1) + i * 7 * 86400000);
    subs.push({ created_at: d.toISOString(), kind: "writing", word_count: 10, feedback: { glowTarget: "A" } });
  }
  const timeline = computeTimeline(subs);
  assert.equal(timeline.length, 26);
  // Must be the LATEST 26 weeks, not the first 26.
  assert.equal(timeline[timeline.length - 1].weekStart, weekStartKey(new Date(Date.UTC(2026, 0, 1) + 39 * 7 * 86400000)));
});

test("computeStreak: no submissions -> 0", () => {
  assert.equal(computeStreak([]), 0);
});

test("computeStreak: broken streak (last activity before yesterday) -> 0", () => {
  assert.equal(computeStreak(["2020-01-01"]), 0);
});

test("computeStreak: consecutive days ending today counts correctly", () => {
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }
  assert.equal(computeStreak(dates), 5);
});

test("computeStreak: a gap stops the count instead of continuing past it", () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const longAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
  assert.equal(computeStreak([today, yesterday, longAgo]), 2);
});

// ------------------------------------------------------------------ the trend must be able to move

// Every piece of feedback names exactly one glow skill and one grow skill.
const fbk = (glowTarget, growTarget) => ({ glowTarget, growTarget });
const sub = (date, glow, grow) => ({ created_at: date, kind: "writing", word_count: 100, feedback: fbk(glow, grow) });

test("computeTimeline: a realistic learner does NOT get a flat 50% line", () => {
  // Week 1: weak on Spelling. Week 2: strong on Spelling, working on Structure. Week 3: strong on both.
  const subs = [
    sub("2026-09-14T10:00:00Z", "Structure", "Spelling"),
    sub("2026-09-21T10:00:00Z", "Spelling", "Structure"),
    sub("2026-09-21T11:00:00Z", "Spelling", "Ideas"),
    sub("2026-09-28T10:00:00Z", "Structure", "Ideas"),
    sub("2026-09-28T11:00:00Z", "Ideas", "Ideas"),
  ];
  const values = computeTimeline(subs).map((w) => w.masteryPct);
  assert.equal(new Set(values).size, values.length, `expected different values each week, got ${values.join(", ")}`);
});

test("computeTimeline: a learner whose weaker skill improves sees the line rise", () => {
  // Week 1: A strong, B weak (50%). Later weeks: B is now the glow more often.
  const subs = [
    sub("2026-09-07T10:00:00Z", "A", "B"),
    sub("2026-09-14T10:00:00Z", "B", "B"),
    sub("2026-09-21T10:00:00Z", "B", "B"),
  ];
  const v = computeTimeline(subs).map((w) => w.masteryPct);
  assert.deepEqual(v, [50, 67, 70]); // week 2: A 100%, B 1 of 3 = 33% -> 67. Week 3: B 2 of 5 = 40% -> 70
});

test("computeTimeline: the last week is the average of per-skill mastery, the same ratio as Target mastery", () => {
  const subs = [sub("2026-09-14T10:00:00Z", "A", "B"), sub("2026-09-21T10:00:00Z", "A", "B"), sub("2026-09-21T11:00:00Z", "B", "A")];
  // A: 2 glow, 1 grow = 67%. B: 1 glow, 2 grow = 33%. Average = 50%.
  assert.equal(computeTimeline(subs).at(-1).masteryPct, 50);
});

test("computeTimeline: input order does not matter (history is returned newest first)", () => {
  const subs = [sub("2026-09-14T10:00:00Z", "A", "B"), sub("2026-09-21T10:00:00Z", "A", "A"), sub("2026-09-28T10:00:00Z", "B", "A")];
  const forward = computeTimeline(subs).map((w) => w.masteryPct);
  const backward = computeTimeline([...subs].reverse()).map((w) => w.masteryPct);
  assert.deepEqual(forward, backward);
});
