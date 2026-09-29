const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { computeTimeline, computeStreak } = require("./_lib/progressHistory");
const { getMonthlyUsage } = require("./_lib/usage");
const { dedupeByTerm, buildQuiz } = require("./_lib/vocabQuiz");

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
    const { childId, quiz, count } = req.query;
    if (!childId) return res.status(400).json({ error: "childId is required." });

    // The headline stats (streak, words, average score) stay on every plan -
    // they're what makes the free tier worth returning to. The 26-week trend
    // chart and the long activity log are paid capabilities, so the payload
    // itself changes rather than the UI merely hiding them.
    const { capabilities } = await getMonthlyUsage(supabase, user.id);

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

    // Every vocab word ever taught to this learner - already sitting in
    // each submission's saved feedback (see api/_lib/prompt.js's "vocab"
    // field), so no separate table or write path is needed, just a scan
    // across what's already fetched above. Deduped newest-first so a term
    // retaught across several submissions only shows once, with its most
    // recent definition/example. Available on every plan, unlike the
    // history list above - it's a teaching feature, not a paywalled one, so
    // it's built from the FULL submissions fetch, not the plan-limited
    // "recent" slice.
    const vocabWords = dedupeByTerm(
      submissions.flatMap((s) => Array.isArray(s.feedback?.vocab)
        ? s.feedback.vocab.filter((v) => v?.term && v?.definition).map((v) => ({ term: v.term, definition: v.definition, example: v.example, createdAt: s.created_at }))
        : [])
    );

    // A separate response shape (not merged into the payload below) so the
    // quiz screen's fetch stays a single small round-trip rather than
    // pulling the whole history payload just to throw most of it away.
    if (quiz) {
      const n = Math.min(10, Math.max(1, parseInt(count, 10) || 5));
      return res.status(200).json(buildQuiz(vocabWords, n));
    }

    return res.status(200).json({
      vocabWords,
      totalSubmissions: submissions.length,
      wordsWritten,
      writingPieces,
      activeStreak,
      avgReadingScore,
      readingSubmissions: readingSubs.length,
      timeline: capabilities.progressTrend ? computeTimeline(submissions) : null,
      timelineLocked: !capabilities.progressTrend,
      historyLimit: capabilities.recentHistoryLimit,
      // The pricing table sells "Full history" on the paid tiers against
      // "Last 10" on free, so the paid slice has to actually BE the full
      // history. An earlier version capped this at 20 for everyone, which
      // would have made that row false the moment a learner passed 20
      // submissions.
      recent: submissions.slice(0, capabilities.recentHistoryLimit).map((s) => ({
        id: s.id, kind: s.kind, tier: s.tier, createdAt: s.created_at,
        score: s.score, totalQuestions: s.total_questions, wordCount: s.word_count,
        glowSnippet: s.feedback?.glow ? String(s.feedback.glow).slice(0, 140) : null,
        // Writing only (see api/_lib/prompt.js's overallScoreClause) - a
        // holistic 1-10 judged against the WHOLE piece, deliberately kept
        // separate from the mastery trend line above (computeTimeline),
        // which tracks per-skill glow/grow direction over time, not a
        // single quality score. Null for reading rows, for anything
        // submitted before this field existed, and - since the score became
        // Premium-only - for any plan without it: pieces written back when
        // every plan generated a score still have one stored, and must not
        // show it on a Free or Core account's activity list.
        overallScore: s.kind === "writing" && capabilities.overallScore !== false ? (s.feedback?.overallScore ?? null) : null,
      })),
    });
  } catch (err) {
    await sendError(res, err);
  }
};
