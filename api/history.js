const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { computeTimeline, computeStreak } = require("./_lib/progressHistory");

// Real progress data for the dashboard — replaces the hardcoded "12 days" /
// "8,450 words" mock stats with numbers actually derived from submissions.

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed." });
    }
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();
    const { childId } = req.query;
    if (!childId) return res.status(400).json({ error: "childId is required." });

    // Scoped to one learner - a household with more than one child (see
    // api/child-profile.js) shouldn't have one kid's history blended into
    // another's stats. profile_id is still checked too, as a defense-in-depth
    // ownership check even though child_id alone would already scope this
    // correctly for a child that really belongs to this account.
    const { data: submissions, error } = await supabase
      .from("submissions")
      .select("id, kind, tier, country, score, total_questions, word_count, feedback, created_at")
      .eq("profile_id", user.id)
      .eq("child_id", childId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const wordsWritten = submissions.reduce((sum, s) => sum + (s.word_count || 0), 0);
    // Counted separately from totalSubmissions (which includes reading rows
    // too) since the dashboard's "Words Written" stat says "Across N
    // pieces" - that N needs to mean actual completed writing pieces, not
    // total writing+reading activity, or the two numbers don't line up.
    const writingPieces = submissions.filter((s) => s.kind === "writing" && s.word_count != null).length;
    const distinctDates = [...new Set(submissions.map((s) => s.created_at.slice(0, 10)))];
    const activeStreak = computeStreak(distinctDates);

    // A reading row is created (and its usage credit spent) as soon as its
    // passage is generated, before the student answers anything - so
    // total_questions alone isn't enough to know it was actually graded.
    // score is only set once api/submit.js completes it.
    const readingSubs = submissions.filter((s) => s.kind === "reading" && s.total_questions && s.score != null);
    const avgReadingScore = readingSubs.length
      ? Math.round((readingSubs.reduce((sum, s) => sum + s.score / s.total_questions, 0) / readingSubs.length) * 100)
      : null;

    return res.status(200).json({
      totalSubmissions: submissions.length,
      wordsWritten,
      writingPieces,
      activeStreak,
      avgReadingScore,
      readingSubmissions: readingSubs.length,
      timeline: computeTimeline(submissions),
      recent: submissions.slice(0, 20).map((s) => ({
        id: s.id, kind: s.kind, tier: s.tier, createdAt: s.created_at,
        score: s.score, totalQuestions: s.total_questions, wordCount: s.word_count,
        glowSnippet: s.feedback?.glow ? String(s.feedback.glow).slice(0, 140) : null,
      })),
    });
  } catch (err) {
    sendError(res, err);
  }
};
