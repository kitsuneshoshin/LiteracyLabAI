const { recentMastery } = require("./mastery");
const { LEVEL_VALUE } = require("./skillLevels");
const { conventionsTarget, conventionsScore } = require("./conventions");

// Real per-skill mastery, computed from this student's own submission
// history rather than the static placeholder numbers the dashboard used to
// show. Each submission's feedback carries a glowTarget (a skill it was a
// strength in) and a growTarget (a skill it's still building towards) —
// see api/_lib/prompt.js. This aggregates those tags per curriculum target:
//   pct = strength mentions / (strength + growth mentions) for that target
// The share is over the target's RECENT mentions (the last MASTERY_WINDOW, see _lib/mastery.js), so it moves as the
// learner improves. A target with zero mentions yet is "Not Yet Assessed" rather than a fabricated percentage.
// submissions arrive newest first.
//
// Premium pieces carry a band (1-4) for EVERY objective (fb.examTechnique). That is a much finer signal than the one
// strength and one next step, so where a piece has a band for a target it is used instead of the strength / next step:
// Emerging, Developing, Secure and Strong read as 10%, 40%, 70% and 95%. A band given with "Too little writing to judge"
// says nothing about the learner, so it is skipped and the strength / next step (if any) is used.
const BAND_VALUE = LEVEL_VALUE;

function bandsByTarget(fb, outcomes) {
  const bands = new Map();
  // Every plan but Premium's exam bands: a 1-4 level per skill (see _lib/skillLevels.js).
  if (fb.skillLevels && typeof fb.skillLevels === "object" && !Array.isArray(fb.skillLevels)) {
    for (const [name, level] of Object.entries(fb.skillLevels)) {
      if (outcomes.has(name) && LEVEL_VALUE[level] !== undefined) bands.set(name, LEVEL_VALUE[level]);
    }
  }
  if (!Array.isArray(fb.examTechnique)) return bands;
  for (const e of fb.examTechnique) {
    if (!e || !outcomes.has(e.criterion)) continue;
    const v = BAND_VALUE[Math.round(Number(e.band))];
    if (v === undefined || /too little writing/i.test(String(e.evidence || ""))) continue;
    bands.set(e.criterion, v);
  }
  return bands;
}

function scoreTargets(targets, submissions) {
  const outcomes = new Map(targets.map((t) => [t.name, []])); // oldest first, once reversed below
  const conv = conventionsTarget(targets);
  for (const sub of [...submissions].reverse()) {
    const fb = sub.feedback || {};
    const bands = bandsByTarget(fb, outcomes);
    for (const [name, v] of bands) outcomes.get(name).push(v);
    if (outcomes.has(fb.glowTarget) && !bands.has(fb.glowTarget)) outcomes.get(fb.glowTarget).push("g");
    if (outcomes.has(fb.growTarget) && !bands.has(fb.growTarget)) outcomes.get(fb.growTarget).push("n");
    // Premium's spelling and grammar check also speaks for the conventions target, unless the AI already chose it this time.
    if (conv && fb.glowTarget !== conv && fb.growTarget !== conv && !bands.has(conv)) {
      const o = conventionsScore(sub);
      if (o !== null) outcomes.get(conv).push(o);
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
