const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { targetsForGrade } = require("./_lib/masteryTargets");
const { scoreChildTargets, buildCohortResult } = require("./_lib/cohortScoring");
const { getMonthlyUsage } = require("./_lib/usage");

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

    // Peer comparison is a paid capability. Gate it here rather than only in
    // the UI - the endpoint is directly reachable, so hiding the card client
    // side would not actually withhold the feature.
    const { capabilities } = await getMonthlyUsage(supabase, user.id);
    if (!capabilities.peerComparison) {
      return res.status(402).json({
        error: "Peer comparison is available on Core and Premium.",
        upgradeTo: "core",
      });
    }

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
      const pct = scoreChildTargets(targetDefs, subs);
      if (pct !== null) scoresByChild.set(id, pct);
    }

    return res.status(200).json(buildCohortResult(scoresByChild, childId));
  } catch (err) {
    sendError(res, err);
  }
};
