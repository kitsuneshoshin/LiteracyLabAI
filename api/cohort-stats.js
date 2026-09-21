const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { targetsForGrade } = require("./_lib/masteryTargets");

// A cohort must have at least this many OTHER children with assessed data
// before a comparison is shown at all. Below this, an average/percentile
// would be computed from a handful of specific children rather than a real
// population - with 1-2 peers, "the average" and "your percentile" would
// effectively describe (and let a parent reverse-engineer) one particular
// other family's child, which this product must never expose. This is a
// hard privacy floor, not a UX nicety - it exists independently of, and in
// addition to, "no crossover" (never blending different countries/years).
const MIN_OTHER_PEERS = 4;

// Same algorithm as progress.js's scoreTargets, but this file groups
// submissions by child_id first (spanning every account, not just the
// caller's) before scoring, since the whole point here is comparing many
// children's mastery rather than showing one child's own breakdown. Kept
// as a separate small copy rather than a shared import so this file's
// cross-account query and progress.js's own-child-only query stay visibly
// independent - a bug in one must never risk leaking into the other.
function scoreTargets(targets, submissions) {
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

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed." });
    }
    const user = await requireUser(req);
    const { tier, country, gradeLabel, childId } = req.query;
    if (!tier || !country || !gradeLabel) return res.status(400).json({ error: "tier, country and gradeLabel query params are required." });
    if (!childId) return res.status(400).json({ error: "childId is required." });

    const supabase = getSupabaseAdmin();

    // Ownership check - never compute or reveal anything about a cohort on
    // behalf of a child this account doesn't own.
    const { data: child, error: childErr } = await supabase
      .from("child_profiles").select("id").eq("id", childId).eq("profile_id", user.id).single();
    if (childErr || !child) return res.status(404).json({ error: "Learner not found for this account." });

    const { targets: targetDefs } = targetsForGrade(country, gradeLabel, tier);

    // The one deliberately cross-account query in this codebase: every
    // submission matching this exact country + tier + grade, regardless of
    // which account it belongs to. "No crossover" means this filter is
    // exact-match on all three, never a tier-level or country-only fallback.
    // Only ever aggregated below - raw rows never leave this function.
    const { data: rows, error } = await supabase
      .from("submissions").select("child_id, feedback")
      .eq("country", country).eq("tier", tier).eq("grade_label", gradeLabel)
      .limit(5000);
    if (error) throw error;

    const byChild = new Map();
    for (const row of rows) {
      if (!byChild.has(row.child_id)) byChild.set(row.child_id, []);
      byChild.get(row.child_id).push(row);
    }

    const scoresByChild = new Map();
    for (const [id, subs] of byChild) {
      const pct = scoreTargets(targetDefs, subs);
      if (pct !== null) scoresByChild.set(id, pct);
    }

    const yourScore = scoresByChild.get(childId) ?? null;
    if (yourScore === null) {
      return res.status(200).json({ available: false, reason: "no_data_yet" });
    }

    const others = [...scoresByChild.entries()].filter(([id]) => id !== childId).map(([, pct]) => pct);
    if (others.length < MIN_OTHER_PEERS) {
      return res.status(200).json({ available: false, reason: "not_enough_peers", cohortSize: others.length });
    }

    const cohortAverage = Math.round(others.reduce((a, b) => a + b, 0) / others.length);
    const countBelow = others.filter((p) => p < yourScore).length;
    const countEqual = others.filter((p) => p === yourScore).length;
    const percentile = Math.round(((countBelow + countEqual / 2) / others.length) * 100);

    return res.status(200).json({
      available: true,
      yourScore,
      cohortAverage,
      percentile,
      cohortSize: others.length + 1,
    });
  } catch (err) {
    sendError(res, err);
  }
};
