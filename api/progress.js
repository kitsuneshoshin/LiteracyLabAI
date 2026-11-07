const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { targetsForGrade, isMappedCountry } = require("./_lib/masteryTargets");
const { curriculumLabel } = require("./_lib/curriculum");
const { MASTERY_WINDOW } = require("./_lib/mastery");
const { scoreTargets } = require("./_lib/targetScoring");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed." });
    }
    const user = await requireUser(req);
    const { tier, country, gradeLabel, childId } = req.query;
    if (!tier || !country) return res.status(400).json({ error: "tier and country query params are required." });
    if (!childId) return res.status(400).json({ error: "childId is required." });

    const supabase = getSupabaseAdmin();
    // Filtering by the exact grade (when known) rather than just tier means
    // a Year 7 and a Year 9 student in the same "middle" tier bucket each
    // see mastery scored against their own real year's targets, not a
    // blended one. Submissions saved before grade_label existed simply
    // won't match here and drop out of the count — not incorrect, just
    // not counted yet. Also scoped to one learner, same reasoning as
    // api/history.js - a sibling's submissions must never blend into this.
    let query = supabase.from("submissions").select("feedback, word_count").eq("profile_id", user.id).eq("child_id", childId).eq("tier", tier).eq("country", country);
    if (gradeLabel) query = query.eq("grade_label", gradeLabel);
    const { data: submissions, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (error) throw error;

    const { targets: targetDefs, grain, approximatedFrom } = targetsForGrade(country, gradeLabel, tier);
    return res.status(200).json({
      isMapped: isMappedCountry(country),
      curriculumLabel: curriculumLabel(country),
      grain,
      approximatedFrom,
      masteryWindow: MASTERY_WINDOW,
      targets: scoreTargets(targetDefs, submissions),
    });
  } catch (err) {
    await sendError(res, err);
  }
};
