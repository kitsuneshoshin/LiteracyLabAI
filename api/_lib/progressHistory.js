// Pure computations for api/history.js, split out so they can be unit
// tested without a live Supabase connection.

// Monday (UTC) of the week containing d, as "YYYY-MM-DD" - the bucket key
// for the progress timeline below. UTC avoids the bucket a submission lands
// in shifting with the server's local time zone.
function weekStartKey(d) {
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

// Weekly time series of a child's progress, oldest first, capped to the
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

// dates: array of "YYYY-MM-DD" strings, most recent first, deduped.
function computeStreak(dates) {
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

module.exports = { weekStartKey, computeTimeline, computeStreak };
