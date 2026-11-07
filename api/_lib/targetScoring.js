const { recentMastery } = require("./mastery");
const { conventionsTarget, conventionsOutcome } = require("./conventions");

// Real per-skill mastery, computed from this student's own submission
// history rather than the static placeholder numbers the dashboard used to
// show. Each submission's feedback carries a glowTarget (a skill it was a
// strength in) and a growTarget (a skill it's still building towards) —
// see api/_lib/prompt.js. This aggregates those tags per curriculum target:
//   pct = strength mentions / (strength + growth mentions) for that target
// The share is over the target's RECENT mentions (the last MASTERY_WINDOW, see _lib/mastery.js), so it moves as the
// learner improves. A target with zero mentions yet is "Not Yet Assessed" rather than a fabricated percentage.
// submissions arrive newest first.
function scoreTargets(targets, submissions) {
  const outcomes = new Map(targets.map((t) => [t.name, []])); // oldest first, once reversed below
  const conv = conventionsTarget(targets);
  for (const sub of [...submissions].reverse()) {
    const fb = sub.feedback || {};
    if (outcomes.has(fb.glowTarget)) outcomes.get(fb.glowTarget).push("g");
    if (outcomes.has(fb.growTarget)) outcomes.get(fb.growTarget).push("n");
    // Premium's spelling and grammar check also speaks for the conventions target, unless the AI already chose it this time.
    if (conv && fb.glowTarget !== conv && fb.growTarget !== conv) {
      const o = conventionsOutcome(sub);
      if (o) outcomes.get(conv).push(o);
    }
  }

  return targets.map((t) => {
    const all = outcomes.get(t.name);
    if (all.length === 0) {
      return { name: t.name, standard: t.standard, pct: null, status: "Not Yet Assessed", assessedCount: 0, strengths: 0, nextSteps: 0 };
    }
    const m = recentMastery(all);
    const status = m.pct >= 80 ? "Mastered" : m.pct >= 50 ? "In Progress" : "Needs Attention";
    return { name: t.name, standard: t.standard, pct: m.pct, status, assessedCount: all.length, strengths: m.strengths, nextSteps: m.nextSteps };
  });
}

module.exports = { scoreTargets };
