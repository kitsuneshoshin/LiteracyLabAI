const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");

// Logs a "what will you try next time?" tap and/or a thumbs up/down rating
// against a specific submission. Kept separate from submissions so we can
// later measure follow-through (did the NEXT submission use the committed action).
module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed." });
    }
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { submissionId, chosenAction, helpfulRating } = body;

    if (!submissionId) return res.status(400).json({ error: "submissionId is required." });
    if (helpfulRating && !["up", "down"].includes(helpfulRating)) {
      return res.status(400).json({ error: 'helpfulRating must be "up" or "down".' });
    }

    // Confirm the submission actually belongs to this user before attaching a commitment to it.
    const { data: submission, error: subErr } = await supabase
      .from("submissions").select("id").eq("id", submissionId).eq("profile_id", user.id).single();
    if (subErr || !submission) return res.status(404).json({ error: "Submission not found." });

    const { data, error } = await supabase
      .from("commitments")
      .insert({ submission_id: submissionId, profile_id: user.id, chosen_action: chosenAction || null, helpful_rating: helpfulRating || null })
      .select("*").single();
    if (error) throw error;

    return res.status(200).json({ commitment: data });
  } catch (err) {
    sendError(res, err);
  }
};
