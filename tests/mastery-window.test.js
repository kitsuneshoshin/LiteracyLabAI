const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MASTERY_WINDOW, recentMastery } = require("../api/_lib/mastery");
const { computeTimeline } = require("../api/_lib/progressHistory");
const { targetsForGrade } = require("../api/_lib/masteryTargets");
const { loadHandler, call } = require("./harness");

// A learner's mastery of a skill follows their RECENT feedback, so it moves as they improve, and the page shows the counts
// behind each percentage.

const AU = "🇦🇺 Australia";
const T = targetsForGrade(AU, "Year 11", "high").targets.map((t) => t.name);

test("mastery looks at the last 8 mentions of a skill, not everything since the account began", () => {
  assert.equal(MASTERY_WINDOW, 8);
  assert.deepEqual(recentMastery([]), { strengths: 0, nextSteps: 0, pct: null });
  assert.deepEqual(recentMastery(["n", "n", "n"]), { strengths: 0, nextSteps: 3, pct: 0 });
  assert.deepEqual(recentMastery(["g"]), { strengths: 1, nextSteps: 0, pct: 100 });
  // four early next steps, then eight strengths: the early ones have aged out
  const improved = ["n", "n", "n", "n", ...Array(8).fill("g")];
  assert.deepEqual(recentMastery(improved), { strengths: 8, nextSteps: 0, pct: 100 });
  // the reverse: eight strengths then a run of next steps drags it down
  const slipped = [...Array(8).fill("g"), "n", "n", "n", "n"];
  assert.deepEqual(recentMastery(slipped), { strengths: 4, nextSteps: 4, pct: 50 });
  assert.equal(recentMastery(undefined).pct, null);
});

function subs(list) {
  // list oldest first: [glowTarget, growTarget]; the API receives them newest first
  return list.map(([glow, grow], i) => ({ feedback: { glowTarget: glow, growTarget: grow }, created_at: new Date(Date.UTC(2026, 8, 1 + i)).toISOString() })).reverse();
}
async function progress(list) {
  const h = loadHandler("progress.js", { plan: "premium", db: (q) => (q.table === "submissions" ? { data: subs(list), error: null } : { data: null, error: null }) });
  const res = await call(h, { method: "GET", query: { tier: "high", country: AU, gradeLabel: "Year 11", childId: "c1" } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  return res.body;
}
const byName = (body) => Object.fromEntries(body.targets.map((t) => [t.name, t]));

test("a skill the learner has improved at moves up, instead of being stuck behind its early history", async () => {
  const [A, B] = T;
  // A was a next step four times at the start, then a strength eight times; B is untouched
  const list = [...Array(4).fill([B, A]), ...Array(8).fill([A, B])];
  const body = await progress(list);
  const a = byName(body)[A];
  assert.equal(a.pct, 100);
  assert.equal(a.status, "Mastered");
  assert.equal(a.strengths, 8); assert.equal(a.nextSteps, 0);
  assert.equal(a.assessedCount, 12, "the total number of mentions is still reported");
  assert.equal(body.masteryWindow, 8);
});

test("a skill that is always the next step shows 0% with the evidence beside it, and one that is never mentioned is not assessed", async () => {
  const [A, B, C] = T;
  const body = await progress([[B, A], [B, A], [B, A], [B, B]]);
  const t = byName(body);
  assert.equal(t[A].pct, 0); assert.equal(t[A].status, "Needs Attention"); assert.equal(t[A].strengths, 0); assert.equal(t[A].nextSteps, 3);
  assert.equal(t[B].strengths, 4); assert.equal(t[B].nextSteps, 1); assert.equal(t[B].pct, 80); assert.equal(t[B].status, "Mastered");
  assert.equal(t[C].pct, null); assert.equal(t[C].status, "Not Yet Assessed"); assert.equal(t[C].assessedCount, 0); assert.equal(t[C].strengths, 0);
});

test("the first skill moves as soon as it is praised", async () => {
  const [A, B] = T;
  const before = byName(await progress([[B, A], [B, A], [B, A]]))[A];
  assert.equal(before.pct, 0);
  const after = byName(await progress([[B, A], [B, A], [B, A], [A, B]]))[A];
  assert.equal(after.pct, 25);
  assert.equal(after.status, "Needs Attention");
  const later = byName(await progress([[B, A], [B, A], [B, A], [A, B], [A, B], [A, B]]))[A];
  assert.equal(later.pct, 50); assert.equal(later.status, "In Progress");
});

test("the weekly trend uses the same recent window, so it can climb as the learner improves", () => {
  const d = (n) => new Date(Date.UTC(2026, 8, 1 + n * 7)).toISOString();
  const rows = [];
  for (let w = 0; w < 4; w++) rows.push({ kind: "writing", created_at: d(w), feedback: { glowTarget: "B", growTarget: "A" } }); // A is the next step four weeks running
  for (let w = 4; w < 12; w++) rows.push({ kind: "writing", created_at: d(w), feedback: { glowTarget: "A" } }); // then a strength for eight weeks
  const t = computeTimeline(rows);
  const last = t[t.length - 1].masteryPct;
  const mid = t[5].masteryPct;
  assert.ok(last > mid, `the line keeps climbing (${mid} then ${last})`);
  assert.equal(last, 100, "A has been a strength for its last 8 mentions, B always was");
});

const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");

test("the page shows the strengths and next steps behind each percentage, in plain words", () => {
  const a = APP.indexOf("function masteryEvidence"), b = APP.indexOf("const STATUS_TIP");
  assert.ok(a > 0 && b > a);
  const { masteryEvidence } = new Function(APP.slice(a, b) + "\nreturn { masteryEvidence };")();
  assert.equal(masteryEvidence({ strengths: 1, nextSteps: 3, assessedCount: 4 }, 8), "1 strength · 3 next steps so far");
  assert.equal(masteryEvidence({ strengths: 0, nextSteps: 1, assessedCount: 1 }, 8), "0 strengths · 1 next step so far");
  assert.equal(masteryEvidence({ strengths: 6, nextSteps: 2, assessedCount: 12 }, 8), "6 strengths · 2 next steps in the last 8 mentions");
  assert.match(APP, /reflects the last 8 times each skill came up/);
  assert.match(APP, /recent mentions in feedback \(the last 8\)/);
});

test("a year that borrows another year's targets says why, the way that country sets its senior years", () => {
  const a = APP.indexOf("function approximationNote"), b = APP.indexOf("// The line under a target");
  assert.ok(a > 0 && b > a);
  const { approximationNote } = new Function(APP.slice(a, b) + "\nreturn { approximationNote };")();
  assert.match(approximationNote(AU, "Year 11", "Year 10"), /set by each state or territory.*national Year 10 standards/);
  assert.match(approximationNote("🇬🇧 United Kingdom", "Year 12", "Year 11"), /A-level.*exam board.*Year 11 \(GCSE\)/);
  assert.match(approximationNote("🇦🇪 UAE & GCC Hubs", "AS Level (Yr 12)", "IGCSE Year 11"), /set by the exam board.*IGCSE Year 11/);
  assert.match(approximationNote("🇸🇬 Singapore & SE Asia", "IB Diploma Yr 1", "O-Level / IGCSE Yr 5"), /set by the exam board/);
  assert.match(approximationNote("🇨🇦 Canada", "Kindergarten", "Grade 1"), /start from Grade 1/);
  assert.match(approximationNote("🇺🇸 United States", "Grade 12", "Grade 11"), /closest year that is/);
});

test("the trend chart is drawn at the width of its card so it lines up with the heading", () => {
  assert.match(APP, /new ResizeObserver\(measure\)/);
  assert.match(APP, /const W = Math\.max\(300, Math\.min\(1400, boxW \|\| 640\)\)/);
  assert.doesNotMatch(APP, /className="w-full" style=\{\{ height: 200 \}\}/, "no fixed-height box that centres a narrow chart");
});
