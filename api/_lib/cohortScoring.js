// Pure scoring/ranking logic for api/cohort-stats.js, split out from the
// handler so it can be unit tested without a live Supabase connection - the
// handler's own job is just DB I/O plus calling these functions.

// A cohort must have at least this many OTHER children with assessed data
// before a comparison is shown at all. Below this, an average/percentile
// would be computed from a handful of specific children rather than a real
// population - with 1-2 peers, "the average" and "your percentile" would
// effectively describe (and let a parent reverse-engineer) one particular
// other family's child, which this product must never expose. This is a
// hard privacy floor, not a UX nicety - it exists independently of, and in
// addition to, "no crossover" (never blending different countries/years).
const MIN_OTHER_PEERS = 4;

// Ladder responses are capped at this many ranked rows (plus the caller's
// own row appended if they'd otherwise fall outside it), so the response
// can never be used to enumerate an entire cohort.
const LADDER_SIZE = 20;

// Same algorithm as progress.js's scoreTargets, but scores one child's
// submissions in isolation - the caller groups by child_id first, since the
// whole point of this file is comparing many children rather than showing
// one child's own breakdown. Kept as a separate copy rather than a shared
// import so this cross-account code path and progress.js's own-child-only
// path stay visibly independent - a bug in one must never risk leaking into
// the other.
function scoreChildTargets(targets, submissions) {
  const counts = new Map(targets.map((t) => [t.name, { strength: 0, growth: 0 }]));
  for (const sub of submissions) {
    const fb = sub.feedback || {};
    const glowTarget = counts.get(fb.glowTarget);
    if (glowTarget) glowTarget.strength += 1;
    const growTarget = counts.get(fb.growTarget);
    if (growTarget) growTarget.growth += 1;
  }
  const scored = targets.map((t) => {
    const c = counts.get(t.name);
    const total = c.strength + c.growth;
    return total === 0 ? null : Math.round((c.strength / total) * 100);
  }).filter((pct) => pct !== null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}

// Given every child's score in a cohort (Map<childId, pct>) and which one is
// the caller, returns the full comparison payload, or an availability
// failure reason. This is the piece that enforces MIN_OTHER_PEERS and
// anonymizes every row but the caller's - it's deliberately the single
// choke point both the handler and tests exercise, so a future change here
// can't accidentally bypass the privacy floor in one path but not the other.
function buildCohortResult(scoresByChild, childId) {
  const yourScore = scoresByChild.get(childId) ?? null;
  if (yourScore === null) {
    return { available: false, reason: "no_data_yet" };
  }

  const others = [...scoresByChild.entries()].filter(([id]) => id !== childId).map(([, pct]) => pct);
  if (others.length < MIN_OTHER_PEERS) {
    return { available: false, reason: "not_enough_peers", cohortSize: others.length };
  }

  const cohortAverage = Math.round(others.reduce((a, b) => a + b, 0) / others.length);
  const countBelow = others.filter((p) => p < yourScore).length;
  const countEqual = others.filter((p) => p === yourScore).length;
  const percentile = Math.round(((countBelow + countEqual / 2) / others.length) * 100);

  const ranked = [...scoresByChild.entries()].sort((a, b) => b[1] - a[1]);
  const yourRank = ranked.findIndex(([id]) => id === childId) + 1;
  const ladder = ranked.slice(0, LADDER_SIZE).map(([id, pct], i) => ({
    rank: i + 1, score: pct, isYou: id === childId,
  }));
  if (yourRank > LADDER_SIZE) {
    ladder.push({ rank: yourRank, score: yourScore, isYou: true });
  }

  return {
    available: true,
    yourScore,
    cohortAverage,
    percentile,
    cohortSize: others.length + 1,
    yourRank,
    ladder,
  };
}

module.exports = { MIN_OTHER_PEERS, LADDER_SIZE, scoreChildTargets, buildCohortResult };
