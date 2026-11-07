// What one learner's parent sees on the Dashboard (Snapshot, Target mastery, Progress over time, How they compare,
// Vocabulary bank), worked out the same way the live endpoints do (api/history.js, api/progress.js,
// api/cohort-stats.js), for the owner's /admin page. Pure: the caller supplies the rows.
const { targetsForGrade, isMappedCountry } = require("./masteryTargets");
const { curriculumLabel } = require("./curriculum");
const { MASTERY_WINDOW } = require("./mastery");
const { scoreTargets } = require("./targetScoring");
const { computeTimeline, computeStreak } = require("./progressHistory");
const { scoreChildTargets, buildCohortResult } = require("./cohortScoring");
const { dedupeByTerm } = require("./vocabQuiz");

// submissions: this learner's rows, newest first (id, kind, tier, country, grade_label, score, total_questions,
// word_count, feedback, created_at). cohortRows: every row for the same country + tier + grade, any account
// (child_id, feedback). capabilities: what this account's plan allows, so the report can say what the parent
// actually sees and what is locked for them.
function buildLearnerDashboard({ child, submissions = [], cohortRows = [], capabilities = {}, vocabProgress = {}, now = new Date() }) {
  const latest = submissions[0] || null;
  const ctx = latest ? { tier: latest.tier, country: latest.country, gradeLabel: latest.grade_label || null } : null;

  const wordsWritten = submissions.reduce((sum, s) => sum + (s.word_count || 0), 0);
  const writingPieces = submissions.filter((s) => s.kind === "writing" && s.word_count != null).length;
  const distinctDates = [...new Set(submissions.map((s) => String(s.created_at).slice(0, 10)))];
  const readingSubs = submissions.filter((s) => s.kind === "reading" && s.total_questions && s.score != null);
  const avgReadingScore = readingSubs.length
    ? Math.round((readingSubs.reduce((sum, s) => sum + s.score / s.total_questions, 0) / readingSubs.length) * 100)
    : null;
  const snapshot = {
    avgReadingScore, readingSubmissions: readingSubs.length,
    wordsWritten, writingPieces,
    activeStreak: computeStreak(distinctDates),
    totalSubmissions: submissions.length,
    // A prompt or passage that was made (and a credit used) but never answered.
    stopped: submissions.filter((s) => (s.kind === "writing" ? s.word_count == null : s.score == null)).length,
  };

  // Target mastery: this learner's own pieces in their current country, tier and year, against that year's targets.
  let mastery = null;
  if (ctx) {
    const { targets: defs, grain, approximatedFrom } = targetsForGrade(ctx.country, ctx.gradeLabel, ctx.tier);
    const mine = submissions.filter((s) => s.tier === ctx.tier && s.country === ctx.country && (!ctx.gradeLabel || s.grade_label === ctx.gradeLabel));
    mastery = {
      country: ctx.country, tier: ctx.tier, gradeLabel: ctx.gradeLabel,
      isMapped: isMappedCountry(ctx.country), curriculumLabel: curriculumLabel(ctx.country), grain, approximatedFrom,
      window: MASTERY_WINDOW, targets: scoreTargets(defs, mine),
    };
  }

  // Compared only with learners in the same country, tier and year, exactly as the parent's page does.
  let peers = null;
  if (ctx && ctx.gradeLabel && child) {
    const { targets: defs } = targetsForGrade(ctx.country, ctx.gradeLabel, ctx.tier);
    const byChild = new Map();
    for (const row of cohortRows) {
      if (!byChild.has(row.child_id)) byChild.set(row.child_id, []);
      byChild.get(row.child_id).push(row);
    }
    const scores = new Map();
    for (const [id, subs] of byChild) { const pct = scoreChildTargets(defs, subs); if (pct !== null) scores.set(id, pct); }
    peers = buildCohortResult(scores, child.id);
  }

  const vocab = dedupeByTerm(submissions.flatMap((s) => Array.isArray(s.feedback && s.feedback.vocab)
    ? s.feedback.vocab.filter((v) => v && v.term && v.definition).map((v) => ({ term: v.term, definition: v.definition, example: v.example, trick: v.trick, createdAt: s.created_at }))
    : []));

  return {
    child: child ? { id: child.id, name: child.display_name, country: child.country, interests: child.interests || [], confidenceWriting: child.confidence_writing, confidenceReading: child.confidence_reading, motivation: child.motivation, onboarded: child.onboarded, created: child.created_at } : null,
    snapshot, mastery,
    timeline: computeTimeline(submissions),
    peers,
    vocab: { total: vocab.length, words: vocab.map((v) => { const p = vocabProgress[String(v.term).trim().toLowerCase().replace(/\s+/g, " ")]; return { term: v.term, definition: v.definition, example: v.example || null, trick: v.trick || null, box: p ? p.box : null }; }) },
    // What this account's plan lets the parent see, so a free account's missing sections are explained, not mistaken for bugs.
    locked: {
      timeline: capabilities.progressTrend === false,
      peers: capabilities.peerComparison === false,
      vocab: capabilities.vocabBank === false,
      overallScore: capabilities.overallScore === false,
      historyLimit: capabilities.recentHistoryLimit == null ? null : capabilities.recentHistoryLimit,
    },
    generatedAt: now.toISOString(),
  };
}

module.exports = { buildLearnerDashboard };
