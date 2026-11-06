const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { computeTimeline, computeStreak } = require("./_lib/progressHistory");
const { getMonthlyUsage } = require("./_lib/usage");
const { dedupeByTerm, buildQuiz } = require("./_lib/vocabQuiz");
const { readVocabProgress, writeVocabProgress } = require("./_lib/vocabProgress");
const { checkRateLimit } = require("./_lib/rateLimit");
const { translatableLanguage } = require("./_lib/languages");
const { translateFeedback } = require("./_lib/translateFeedback");
const { generateFeedbackJSON } = require("./_lib/openai");

// Real progress data for the dashboard — replaces the hardcoded "12 days" /
// "8,450 words" mock stats with numbers actually derived from submissions.

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed." });
    }
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    // POST saves how well a learner knows their vocabulary words, so it follows them between devices.
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

      // Reads a finished piece of feedback in the family's home language. The English feedback is never changed; the
      // translation is stored beside the piece (content.translations) so each language is paid for once per piece.
      // Lives here, not in its own file, because the Hobby plan caps a deployment at 12 functions.
      if (body.action === "translate") {
        const language = translatableLanguage(body.language);
        if (!language) return res.status(400).json({ error: "That language isn't available yet." });
        if (!body.submissionId) return res.status(400).json({ error: "submissionId is required." });
        const { data: row, error: rowErr } = await supabase
          .from("submissions")
          .select("id, content, feedback")
          .eq("id", body.submissionId)
          .eq("profile_id", user.id)
          .maybeSingle();
        if (rowErr) throw rowErr;
        if (!row || !row.feedback || row.feedback._pending) return res.status(404).json({ error: "That feedback wasn't found." });
        const saved = row.content && row.content.translations && row.content.translations[language.code];
        if (saved) return res.status(200).json({ language: language.code, translations: saved });
        await checkRateLimit(supabase, user.id, "translate", { limit: 20, windowSeconds: 300 });
        const { translations } = await translateFeedback(row.feedback, language.code, generateFeedbackJSON);
        // Only a complete-enough translation is kept for next time; a thin one is shown now but retried on the next ask.
        if (Object.keys(translations).length > 0) {
          const content = { ...(row.content || {}), translations: { ...((row.content && row.content.translations) || {}), [language.code]: translations } };
          const { error: saveErr } = await supabase.from("submissions").update({ content }).eq("id", row.id).eq("profile_id", user.id);
          if (saveErr) console.error("Could not save translation:", saveErr);
        }
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ language: language.code, translations });
      }

      if (!body.childId) return res.status(400).json({ error: "childId is required." });
      const { capabilities: planCaps } = await getMonthlyUsage(supabase, user.id);
      if (planCaps.vocabBank === false) return res.status(403).json({ error: "The vocabulary bank is part of Core and Premium.", vocabLocked: true });
      const { data: child, error: childErr } = await supabase.from("child_profiles").select("id").eq("id", body.childId).eq("profile_id", user.id).maybeSingle();
      if (childErr) throw childErr;
      if (!child) return res.status(404).json({ error: "Learner not found for this account." });
      await checkRateLimit(supabase, user.id, "vocab_progress", { limit: 120, windowSeconds: 300 });
      const saved = await writeVocabProgress(supabase, user.id, child.id, body.updates);
      return res.status(200).json({ saved });
    }
    const { childId, quiz, count, submissionId } = req.query;
    if (!childId) return res.status(400).json({ error: "childId is required." });

    // One past piece in full - what the learner wrote (or read and answered) and the feedback they were given - so the
    // activity list can be opened rather than only skimmed. Kept to the pieces the activity list itself shows: a free
    // plan's list is its last 10, so only those can be opened.
    if (submissionId) {
      const { capabilities: caps } = await getMonthlyUsage(supabase, user.id);
      const { data: visible, error: visErr } = await supabase
        .from("submissions")
        .select("id")
        .eq("profile_id", user.id)
        .eq("child_id", childId)
        .order("created_at", { ascending: false })
        .limit(caps.recentHistoryLimit);
      if (visErr) throw visErr;
      if (!(visible || []).some((s) => s.id === submissionId)) return res.status(404).json({ error: "That piece wasn't found in this learner's history." });
      const { data: row, error: rowErr } = await supabase
        .from("submissions")
        .select("id, kind, tier, country, grade_label, interest, content, score, total_questions, word_count, feedback, created_at")
        .eq("id", submissionId)
        .eq("profile_id", user.id)
        .eq("child_id", childId)
        .maybeSingle();
      if (rowErr) throw rowErr;
      if (!row) return res.status(404).json({ error: "That piece wasn't found in this learner's history." });
      let feedback = row.feedback && !row.feedback._pending ? row.feedback : null;
      // Same rule as the activity list: a plan without the whole-piece score doesn't see one on older pieces either.
      if (feedback && caps.overallScore === false) feedback = { ...feedback, overallScore: null };
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        id: row.id, kind: row.kind, tier: row.tier, country: row.country, gradeLabel: row.grade_label, interest: row.interest,
        createdAt: row.created_at, score: row.score, totalQuestions: row.total_questions, wordCount: row.word_count,
        prompt: row.content?.generatedPrompt || null,
        text: typeof row.content?.text === "string" ? row.content.text : null,
        passage: row.content?.generatedPassage || null,
        answers: row.content?.answers || null,
        feedback,
      });
    }

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
        ? s.feedback.vocab.filter((v) => v?.term && v?.definition).map((v) => ({ term: v.term, definition: v.definition, example: v.example, trick: v.trick, characteristics: v.characteristics, nonExample: v.nonExample, createdAt: s.created_at }))
        : [])
    );

    // The vocabulary bank and its self-test quiz are a Core/Premium feature.
    // Free still gets new vocabulary in each piece's feedback; only the
    // collected bank is paid, so the payload itself changes rather than the
    // UI merely hiding it.
    const vocabLocked = capabilities.vocabBank === false;

    // A separate response shape (not merged into the payload below) so the
    // quiz screen's fetch stays a single small round-trip rather than
    // pulling the whole history payload just to throw most of it away.
    if (quiz) {
      if (vocabLocked) return res.status(403).json({ error: "The vocabulary bank is part of Core and Premium.", vocabLocked: true });
      const n = Math.min(10, Math.max(1, parseInt(count, 10) || 5));
      // Every quiz is a fresh draw, so it must never be served from a cache.
      res.setHeader("Cache-Control", "no-store");
      const exclude = String(req.query.exclude || "").split("|").map((t) => t.trim()).filter(Boolean).slice(0, 30);
      return res.status(200).json(buildQuiz(vocabWords, n, Math.random, exclude));
    }

    return res.status(200).json({
      vocabWords: vocabLocked ? [] : vocabWords,
      // How well each word is known, so a second device starts where the first left off ({} until saved, or on a plan without the bank).
      vocabProgress: vocabLocked ? {} : await readVocabProgress(supabase, user.id, childId),
      vocabLocked,
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
