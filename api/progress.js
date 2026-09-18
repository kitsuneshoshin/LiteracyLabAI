const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { targetsFor, isMappedCountry, curriculumLabel } = require("./_lib/masteryTargets");

// Real per-skill mastery, computed from this student's own submission
// history rather than the static placeholder numbers the dashboard used to
// show. Each submission's feedback carries a glowTarget (a skill it was a
// strength in) and a growTarget (a skill it's still building towards) —
// see api/_lib/prompt.js. This aggregates those tags per curriculum target:
//   pct = strength mentions / (strength + growth mentions) for that target
// A target with zero mentions yet is "Not Yet Assessed" rather than a
// fabricated percentage.
function scoreTargets(targets, submissions) {
  const counts = new Map(targets.map((t) => [t.name, { strength: 0, growth: 0 }]));

  for (const sub of submissions) {
    const fb = sub.feedback || {};
    const glowTarget = counts.get(fb.glowTarget);
    if (glowTarget) glowTarget.strength += 1;
    const growTarget = counts.get(fb.growTarget);
    if (growTarget) growTarget.growth += 1;
  }

  return targets.map((t) => {
    const c = counts.get(t.name);
    const total = c.strength + c.growth;
    if (total === 0) {
      return { name: t.name, standard: t.standard, pct: null, status: "Not Yet Assessed", assessedCount: 0 };
    }
    const pct = Math.round((c.strength / total) * 100);
    const status = pct >= 80 ? "Mastered" : pct >= 50 ? "In Progress" : "Needs Attention";
    return { name: t.name, standard: t.standard, pct, status, assessedCount: total };
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed." });
    }
    const user = await requireUser(req);
    const { tier, country } = req.query;
    if (!tier || !country) return res.status(400).json({ error: "tier and country query params are required." });

    const supabase = getSupabaseAdmin();
    const { data: submissions, error } = await supabase
      .from("submissions")
      .select("feedback")
      .eq("profile_id", user.id)
      .eq("tier", tier)
      .eq("country", country)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const targets = targetsFor(country, tier);
    return res.status(200).json({
      isMapped: isMappedCountry(country),
      curriculumLabel: curriculumLabel(country),
      targets: scoreTargets(targets, submissions),
    });
  } catch (err) {
    sendError(res, err);
  }
};
