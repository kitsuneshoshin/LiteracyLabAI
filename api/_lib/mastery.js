// How well a learner is doing on each curriculum target. Every piece of feedback names one target as a strength (the Glow)
// and one as the next step (the Grow). A target's mastery follows its RECENT mentions: the last 8 times it came up.
// Counting every mention since the account began (as it once did) made a skill that had been a next step a few times
// early on almost impossible to move, however much the learner improved since.
//
// The percentage is graded rather than a plain strengths / mentions share, which could only land on a few round numbers
// (0, 25, 33, 50, 67, 75, 100) while a learner has few mentions:
//   - newer mentions count a little more than older ones (RECENCY_DECAY per step back), so a learner on the way up
//     reads higher than one who has slipped, even with the same counts;
//   - a small neutral prior (PRIOR_WEIGHT at 50%) stops a single mention from swinging the bar to 0% or 100%; its pull
//     fades as evidence builds up;
//   - an outcome may also be a number from 0 to 1 (for example the spelling-and-grammar check's error rate) for a finer
//     reading than strength / next step.
const MASTERY_WINDOW = 8;
const RECENCY_DECAY = 0.9;
const PRIOR_WEIGHT = 1;

function outcomeValue(o) {
  if (o === "g") return 1;
  if (o === "n") return 0;
  const n = Number(o);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

// outcomes: "g" (a strength), "n" (a next step) or a number 0-1, oldest first.
// Returns { strengths, nextSteps, pct } over the last MASTERY_WINDOW; strengths/nextSteps are plain counts (a number
// counts as a strength from 0.5 up).
function recentMastery(outcomes) {
  const last = (outcomes || []).slice(-MASTERY_WINDOW);
  if (!last.length) return { strengths: 0, nextSteps: 0, pct: null };
  let weighted = 0, weights = 0, strengths = 0;
  last.forEach((o, i) => {
    const v = outcomeValue(o);
    const w = Math.pow(RECENCY_DECAY, last.length - 1 - i); // newest = 1
    weighted += w * v;
    weights += w;
    if (v >= 0.5) strengths += 1;
  });
  const pct = Math.round(((weighted + PRIOR_WEIGHT * 0.5) / (weights + PRIOR_WEIGHT)) * 100);
  return { strengths, nextSteps: last.length - strengths, pct };
}

module.exports = { MASTERY_WINDOW, RECENCY_DECAY, PRIOR_WEIGHT, recentMastery };
