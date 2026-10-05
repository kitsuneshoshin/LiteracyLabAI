const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getMonthlyUsage } = require("./_lib/usage");
const { generateFeedbackJSON } = require("./_lib/openai");
const { buildWritingPrompt, buildReadingPrompt, correctiveAddendum, examTechniqueSupported } = require("./_lib/prompt");
const { standardsFor } = require("./_lib/curriculum");
const { targetsForGrade, examTargetsFor } = require("./_lib/masteryTargets");
const RESP = require("./_lib/responses");
const TECH = require("./_lib/techniques");
const { frameworkFor } = require("./_lib/writingFrameworks");
const { dropRestatingHighlights, repairResponses, dropGlowsQuotingMisspellings, validateFeedback, resolveTarget, dropInvalidSpellingGrammar, sanitizeQuestionReview, repairZeroScoreGlow, repairReadingExamEvidence, stripUngrantedSections } = require("./_lib/validate");
const { checkRateLimit } = require("./_lib/rateLimit");
const { writingLimitsForGrade } = require("./_lib/writingLimits");
const { assessLength, calibrateWriting, applyCorrections, repairExamEvidence } = require("./_lib/calibrate");

// Server-side character caps, derived per country+grade from real syllabus
// word-count guidance - mirrors GRADE_WORD_TARGETS in app.html. Enforced
// here too since a client-side maxLength is trivially bypassed.

// Generates feedback, validates it against the deterministic checks, and
// retries with a corrective note before giving up. Generation is
// non-deterministic — the same input can pass or fail these checks between
// runs — so a few attempts absorb that variance before we ever show a
// child an error instead of feedback.
const MAX_ATTEMPTS = 3;
// The function is limited to 60s (vercel.json). A Premium answer is long, so if another full
// attempt could not finish in time, the current one is treated as the last: bonus sections are
// dropped as on a normal last attempt, otherwise the student gets the plain error, not a timeout.
const TIME_BUDGET_MS = 50000;

// Plain notes the exam panel shows: which objectives were left out because this kind of
// task cannot show them, and (for years with no national objectives) which year's were used.
function examNotes(country, gradeLabel, tier, kind) {
  const info = targetsForGrade(country, gradeLabel, tier);
  const banded = examTargetsFor(info.targets, kind).map((t) => t.name);
  const left = info.targets.filter((t) => !banded.includes(t.name));
  const out = {};
  if (left.length) {
    out.examNotBanded = left.map((t) => t.name);
    out.examNotBandedWhy = kind === "reading"
      ? "writing skills, banded when you submit a piece of writing"
      : "reading skills, banded in reading practice";
  }
  if (info.approximatedFrom) {
    out.examBasis = gradeLabel + " does not have its own published objectives, so these use the " + info.approximatedFrom + " objectives.";
  }
  return out;
}

async function generateAndValidate(prompt, tier, country, gradeLabel, submittedText, readingScore, capabilities, genre, readingContext) {
  const standardsList = standardsFor(country, tier, gradeLabel);
  const targetNames = targetsForGrade(country, gradeLabel, tier).targets.map((t) => t.name);
  // Exam bands are given only on the objectives this kind of task can show: writing
  // objectives for a piece of writing, reading objectives for a reading task.
  const examTargetNames = examTargetsFor(targetsForGrade(country, gradeLabel, tier).targets, readingContext ? "reading" : "writing").map((t) => t.name);
  let nextPrompt = prompt;
  let lastIssues = [];
  const startedAt = Date.now();
  const lengthInfo = submittedText ? assessLength({ text: submittedText, tier, country, gradeLabel }) : undefined;

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const attemptStarted = Date.now();
    // A Premium writing answer carries the model response and its labels, so it needs more room.
    const attempt = await generateFeedbackJSON(nextPrompt, { maxTokens: capabilities?.deepFeedback && submittedText ? 3800 : 2048 });
    const lastAttempt = i === MAX_ATTEMPTS || (Date.now() - startedAt) + (Date.now() - attemptStarted) * 1.2 > TIME_BUDGET_MS;
    if (capabilities?.spellingGrammar !== false) dropInvalidSpellingGrammar(attempt.parsed, submittedText);
    if (capabilities?.spellingGrammar !== false) dropGlowsQuotingMisspellings(attempt.parsed);
    TECH.repairVocabTricks(attempt.parsed);
    if (submittedText) dropRestatingHighlights(attempt.parsed, submittedText);
    if (submittedText && capabilities?.deepFeedback) repairResponses(attempt.parsed, genre, tier);
    if (submittedText) repairExamEvidence(attempt.parsed);
    if (readingScore === 0) repairZeroScoreGlow(attempt.parsed);
    if (readingContext) repairReadingExamEvidence(attempt.parsed, readingContext.questions, readingContext.answers);
    if (readingContext) sanitizeQuestionReview(attempt.parsed, readingContext.passage, readingContext.questionCount);
    const check = validateFeedback(attempt.parsed, { tier, standardsList, targetNames, submittedText, readingScore, capabilities, genre, lengthInfo, examTargetNames });
    if (check.ok) {
      // Snap glowTarget/growTarget to the exact canonical string so
      // api/progress.js's exact-key Map lookup actually finds them.
      attempt.parsed.glowTarget = resolveTarget(attempt.parsed.glowTarget, targetNames) || attempt.parsed.glowTarget;
      attempt.parsed.growTarget = resolveTarget(attempt.parsed.growTarget, targetNames) || attempt.parsed.growTarget;
      return attempt;
    }
    console.warn(`Feedback validation failed on attempt ${i}:`, check.issues);
    // The Premium "second step" is a bonus. If it is the ONLY thing still wrong
    // on the last attempt, drop just that section rather than failing a whole,
    // otherwise good piece of feedback (the app simply doesn't show it).
    // The same goes for the Premium full rewrite ("revisedStory"): the app falls
    // back to the fragment-by-fragment revision when it is absent.
    const bonusOnly = check.issues.length > 0 && check.issues.every((issue) => /^(growNext|revisedStory|modelResponse|modelFramework|revisedFramework|readingStrategy|sentences are too long)/.test(issue));
    const growNextBad = check.issues.some((issue) => /^growNext\b/.test(issue));
    if (lastAttempt && attempt.parsed && bonusOnly && (!growNextBad || attempt.parsed.growNext)) {
      if (growNextBad) delete attempt.parsed.growNext;
      if (check.issues.some((issue) => /^(modelResponse|modelFramework)\b/.test(issue))) { delete attempt.parsed.modelResponse; delete attempt.parsed.modelFramework; }
      if (check.issues.some((issue) => /^revisedFramework\b/.test(issue))) delete attempt.parsed.revisedFramework;
      if (check.issues.some((issue) => /^readingStrategy\b/.test(issue))) delete attempt.parsed.readingStrategy;
      if (check.issues.some((issue) => /^revisedStory\b/.test(issue))) {
        delete attempt.parsed.revisedFramework; // its quotes belong to the rewrite that is being replaced
        // Keep a faithful corrected copy (the student's own words with the listed fixes
        // applied) rather than nothing, when the model's rewrite wandered from the original.
        const fixed = applyCorrections(submittedText, attempt.parsed.spellingGrammar);
        if (fixed && fixed.trim() !== String(submittedText).trim()) attempt.parsed.revisedStory = fixed;
        else delete attempt.parsed.revisedStory;
      }
      attempt.parsed.glowTarget = resolveTarget(attempt.parsed.glowTarget, targetNames) || attempt.parsed.glowTarget;
      attempt.parsed.growTarget = resolveTarget(attempt.parsed.growTarget, targetNames) || attempt.parsed.growTarget;
      return attempt;
    }
    lastIssues = check.issues;
    if (lastAttempt) break;
    nextPrompt = prompt + correctiveAddendum(check.issues);
  }

  const err = new Error(
    `The AI response didn't meet our quality checks after ${MAX_ATTEMPTS} attempts. Please try submitting again.` +
      (lastIssues.length ? ` (${lastIssues.join("; ")})` : "")
  );
  err.statusCode = 502;
  throw err;
}

// Atomically claims a submission for grading: the UPDATE only succeeds if
// feedback is still null, so of two concurrent requests for the same
// submission, only one gets rows back. A live test confirmed this race is
// real - two simultaneous submits for the same prompt both slipped past a
// plain "if (existing.feedback) return 409" read-then-write check, each
// firing its own full AI generation call, with the DB left holding
// whichever one happened to write last. Marking feedback with a _pending
// placeholder (rather than leaving it null) is what makes the update
// conditional and exclusive; releaseClaim below clears it back to null if
// generation then fails, so a failed attempt doesn't get permanently
// stuck looking "already submitted".
async function claimSubmission(supabase, submissionId, profileId) {
  const { data, error } = await supabase
    .from("submissions")
    .update({ feedback: { _pending: true } })
    .eq("id", submissionId)
    .eq("profile_id", profileId)
    .is("feedback", null)
    .select("id");
  if (error) throw error;
  return data && data.length > 0;
}
async function releaseClaim(supabase, submissionId) {
  await supabase.from("submissions").update({ feedback: null }).eq("id", submissionId);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed." });
    }

    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    // Grading a submission calls the AI too (see generateAndValidate below),
    // so it shares the same rate-limit bucket as the two generation
    // endpoints - see the matching comment in api/writing-prompt.js.
    await checkRateLimit(supabase, user.id, "ai_generate");

    // What this account's plan unlocks (deeper feedback, exam-technique
    // banding) changes the prompt AND the validation, so it's read once up
    // front rather than inferred client-side - the client never gets to ask
    // for a paid feedback section it isn't on the plan for.
    const { capabilities: planCaps } = await getMonthlyUsage(supabase, user.id);

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { kind } = body;

    if (kind === "writing") {
      // Writing's billable unit was already consumed when the prompt was
      // generated (see api/writing-prompt.js) — that's what inserted this
      // row in the first place. This step only completes it, so there's no
      // usage-cap check or new row here, just grading + feedback, mirroring
      // the reading branch below.
      const { submissionId, text } = body;
      if (!submissionId) return res.status(400).json({ error: "submissionId is required for a writing submission." });
      if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required for a writing submission." });

      const { data: existing, error: fetchErr } = await supabase
        .from("submissions")
        .select("id, child_id, tier, country, grade_label, interest, content, feedback")
        .eq("id", submissionId)
        .eq("profile_id", user.id)
        .single();
      if (fetchErr || !existing) return res.status(404).json({ error: "Writing prompt not found for this account." });
      if (existing.feedback) return res.status(409).json({ error: "This writing prompt has already been submitted." });

      const generated = existing.content && existing.content.generatedPrompt;
      if (!generated) return res.status(500).json({ error: "This writing prompt is missing its original text." });

      const { maxChars } = writingLimitsForGrade(existing.country, existing.grade_label, existing.tier);
      if (text.length > maxChars) {
        return res.status(400).json({ error: `Submission exceeds the ${maxChars}-character limit for this grade.` });
      }

      if (!(await claimSubmission(supabase, submissionId, user.id))) {
        return res.status(409).json({ error: "This writing prompt has already been submitted." });
      }

      const targets = targetsForGrade(existing.country, existing.grade_label, existing.tier).targets;
      // Banded assessment objectives are only a real thing for middle/high,
      // so the plan's grant is narrowed by tier here, once, and the same
      // resolved value drives both the prompt and the validator.
      const caps = { ...planCaps, examTechnique: planCaps.examTechnique && examTechniqueSupported(existing.tier) };
      // The genre this specific piece was actually written in (see
      // buildWritingPromptGenerator's "genre" field), not just an assumption
      // from the tier - drives which named framework gets taught below.
      // Falls back to the tier default inside resolveGenre() for a prompt
      // generated before this field existed.
      const genre = generated.genre;
      let result;
      try {
        const llmPrompt = buildWritingPrompt({
          tier: existing.tier, country: existing.country, gradeLabel: existing.grade_label, interest: existing.interest,
          confidenceWriting: body.confidenceWriting, motivation: body.motivation,
          prompt: generated.prompt, text, capabilities: caps, targets,
          targetNames: targets.map((t) => t.name), genre,
        });
        result = await generateAndValidate(llmPrompt, existing.tier, existing.country, existing.grade_label, text, undefined, caps, genre);
      } catch (genErr) {
        await releaseClaim(supabase, submissionId);
        throw genErr;
      }

      stripUngrantedSections(result.parsed, { capabilities: caps, kind: "writing" });
      // Score and band caps from the real length against this grade's expected length.
      calibrateWriting(result.parsed, { text, tier: existing.tier, country: existing.country, gradeLabel: existing.grade_label, capabilities: caps });
      if (Array.isArray(result.parsed.examTechnique)) Object.assign(result.parsed, examNotes(existing.country, existing.grade_label, existing.tier, "writing"));
      if (result.parsed.modelResponse || result.parsed.revisedFramework) {
        const fw = frameworkFor(genre, existing.tier);
        if (fw) result.parsed.frameworkInfo = RESP.frameworkInfo(fw);
      }

      // The model only writes frameworkTip.name/example (see prompt.js) -
      // its definition is fixed per genre, not left to the model to
      // re-explain, so it's attached here from the single source of truth
      // rather than trusted from validated-but-still-model-written text.
      if (result.parsed.frameworkTip) {
        const fw = frameworkFor(genre, existing.tier);
        if (fw) result.parsed.frameworkTip.description = fw.description;
      }

      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      const { error: updateErr } = await supabase
        .from("submissions")
        .update({
          content: { ...existing.content, text },
          word_count: wordCount, char_count: text.length,
          feedback: result.parsed, model_used: result.modelUsed,
        })
        .eq("id", submissionId);
      if (updateErr) throw updateErr;

      const updatedUsage = await getMonthlyUsage(supabase, user.id);
      return res.status(200).json({
        submissionId, feedback: result.parsed, usage: updatedUsage,
      });
    }

    if (kind === "reading") {
      // Reading's billable unit was already consumed when the passage was
      // generated (see api/reading-passage.js) — that's what inserted this
      // row in the first place. This step only completes it, so there's no
      // usage-cap check or new row here, just grading + feedback.
      const { submissionId, answers } = body;
      if (!submissionId) return res.status(400).json({ error: "submissionId is required for a reading submission." });
      if (!Array.isArray(answers)) return res.status(400).json({ error: "answers array is required for a reading submission." });

      const { data: existing, error: fetchErr } = await supabase
        .from("submissions")
        .select("id, child_id, tier, country, grade_label, interest, content, feedback")
        .eq("id", submissionId)
        .eq("profile_id", user.id)
        .single();
      if (fetchErr || !existing) return res.status(404).json({ error: "Reading passage not found for this account." });
      if (existing.feedback) return res.status(409).json({ error: "This reading passage has already been submitted." });

      const bank = existing.content && existing.content.generatedPassage;
      if (!bank) return res.status(500).json({ error: "This reading passage is missing its answer key." });

      if (!(await claimSubmission(supabase, submissionId, user.id))) {
        return res.status(409).json({ error: "This reading passage has already been submitted." });
      }

      let score = 0;
      bank.questions.forEach((q, i) => { if (answers[i] === q.correct) score += 1; });
      const totalQuestions = bank.questions.length;

      const targets = targetsForGrade(existing.country, existing.grade_label, existing.tier).targets;
      const caps = { ...planCaps, examTechnique: planCaps.examTechnique && examTechniqueSupported(existing.tier) };
      let result;
      try {
        const llmPrompt = buildReadingPrompt({
          tier: existing.tier, country: existing.country, gradeLabel: existing.grade_label, interest: existing.interest,
          confidenceReading: body.confidenceReading, motivation: body.motivation,
          passageTitle: bank.title, passage: bank.passage, questions: bank.questions,
          answers, score, totalQuestions, capabilities: caps, targets,
          targetNames: targets.map((t) => t.name),
        });
        result = await generateAndValidate(llmPrompt, existing.tier, existing.country, existing.grade_label, undefined, score, caps, undefined, { passage: bank.passage, questionCount: totalQuestions, questions: bank.questions, answers });
      } catch (genErr) {
        await releaseClaim(supabase, submissionId);
        throw genErr;
      }

      stripUngrantedSections(result.parsed, { capabilities: caps, kind: "reading" });
      TECH.attachReadingStrategy(result.parsed, existing.tier);
      if (Array.isArray(result.parsed.examTechnique)) Object.assign(result.parsed, examNotes(existing.country, existing.grade_label, existing.tier, "reading"));

      const { error: updateErr } = await supabase
        .from("submissions")
        .update({
          content: { ...existing.content, answers },
          score, total_questions: totalQuestions,
          feedback: result.parsed, model_used: result.modelUsed,
        })
        .eq("id", submissionId);
      if (updateErr) throw updateErr;

      const updatedUsage = await getMonthlyUsage(supabase, user.id);
      return res.status(200).json({
        submissionId, feedback: result.parsed, score, totalQuestions,
        // Reveals the answer key now that grading is done, so the UI can
        // highlight correct/incorrect choices — it was deliberately withheld
        // when the passage was first generated.
        questions: bank.questions,
        usage: updatedUsage,
      });
    }

    return res.status(400).json({ error: 'kind must be "writing" or "reading".' });
  } catch (err) {
    await sendError(res, err);
  }
};
