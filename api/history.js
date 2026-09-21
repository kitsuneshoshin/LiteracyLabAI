const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");

// Real progress data for the dashboard — replaces the hardcoded "12 days" /
// "8,450 words" mock stats with numbers actually derived from submissions.
// Monday (UTC) of the week containing d, as "YYYY-MM-DD" - the bucket key
// for the progress timeline below. UTC avoids the bucket a submission lands
// in shifting with the server's local time zone.
function weekStartKey(d) {
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

// Weekly time series of this child's progress, oldest first, capped to the
// last 26 weeks (~6 months) so the chart stays readable and the payload
// stays small. masteryPct per week uses the same glow/grow-tag ratio as
// progress.js's scoreTargets, but pooled across all targets that week
// (rather than per named target) since a week can span a tier/grade change.
function computeTimeline(submissions) {
  const byWeek = new Map();
  for (const s of submissions) {
    const key = weekStartKey(new Date(s.created_at));
    if (!byWeek.has(key)) byWeek.set(key, { weekStart: key, submissions: 0, wordsWritten: 0, glow: 0, grow: 0, readingScoreSum: 0, readingCount: 0 });
    const bucket = byWeek.get(key);
    bucket.submissions += 1;
    if (s.kind === "writing" && s.word_count) bucket.wordsWritten += s.word_count;
    const fb = s.feedback || {};
    if (fb.glowTarget) bucket.glow += 1;
    if (fb.growTarget) bucket.grow += 1;
    if (s.kind === "reading" && s.total_questions && s.score != null) {
      bucket.readingScoreSum += s.score / s.total_questions;
      bucket.readingCount += 1;
    }
  }
  const weeks = [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return weeks.slice(-26).map((w) => ({
    weekStart: w.weekStart,
    submissions: w.submissions,
    wordsWritten: w.wordsWritten,
    masteryPct: (w.glow + w.grow) > 0 ? Math.round((w.glow / (w.glow + w.grow)) * 100) : null,
    avgReadingScore: w.readingCount > 0 ? Math.round((w.readingScoreSum / w.readingCount) * 100) : null,
  }));
}

function computeStreak(dates) {
  // dates: array of "YYYY-MM-DD" strings, most recent first, deduped.
  if (dates.length === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dates[0] !== today && dates[0] !== yesterday) return 0; // streak already broken

  let streak = 1;
  for (let i = 0; i < dates.length - 1; i++) {
    const cur = new Date(dates[i]);
    const next = new Date(dates[i + 1]);
    const diffDays = Math.round((cur - next) / 86400000);
    if (diffDays === 1) streak += 1;
    else break;
  }
  return streak;
}

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
