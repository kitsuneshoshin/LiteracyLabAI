// How well a learner is doing on each curriculum target. Every piece of feedback names one target as a strength (the Glow)
// and one as the next step (the Grow). A target's mastery is the share of its RECENT mentions that were strengths: the
// last 8 times it came up. Counting every mention since the account began (as it once did) made a skill that had been a
// next step a few times early on almost impossible to move, however much the learner improved since.
const MASTERY_WINDOW = 8;

// outcomes: "g" (a strength) or "n" (a next step), oldest first. Returns { strengths, nextSteps, pct } over the last MASTERY_WINDOW.
function recentMastery(outcomes) {
  const last = (outcomes || []).slice(-MASTERY_WINDOW);
  const strengths = last.filter((o) => o === "g").length;
  const nextSteps = last.length - strengths;
  return { strengths, nextSteps, pct: last.length ? Math.round((strengths / last.length) * 100) : null };
}

module.exports = { MASTERY_WINDOW, recentMastery };
