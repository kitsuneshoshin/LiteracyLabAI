const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getMonthlyUsage } = require("./_lib/usage");
const { generateFeedbackJSON } = require("./_lib/openai");
const { buildWritingPrompt, buildReadingPrompt, correctiveAddendum, examTechniqueSupported } = require("./_lib/prompt");
const { standardsFor } = require("./_lib/curriculum");
const { targetsForGrade } = require("./_lib/masteryTargets");
const { validateFeedback, resolveTarget } = require("./_lib/validate");
const { checkRateLimit } = require("./_lib/rateLimit");
const { writingLimitsForGrade } = require("./_lib/writingLimits");

// Server-side character caps, derived per country+grade from real syllabus
// word-count guidance - mirrors GRADE_WORD_TARGETS in app.html. Enforced
// here too since a client-side maxLength is trivially bypassed.

// Generates feedback, validates it against the deterministic checks, and
// retries with a corrective note before giving up. Generation is
// non-deterministic — the same input can pass or fail these checks between
// runs — so a few attempts absorb that variance before we ever show a
// child an error instead of feedback.
const MAX_ATTEMPTS = 3;

async function generateAndValidate(prompt, tier, country, gradeLabel, submittedText, readingScore, capabilities) {
  const standardsList = standardsFor(country, tier, gradeLabel);
  const targetNames = targetsForGrade(country, gradeLabel, tier).targets.map((t) => t.name);
  let nextPrompt = prompt;
  let lastIssues = [];

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const attempt = await generateFeedbackJSON(nextPrompt);
    const check = validateFeedback(attempt.parsed, { tier, standardsList, targetNames, submittedText, readingScore, capabilities });
    if (check.ok) {
      // Snap glowTarget/growTarget to the exact canonical string so
      // api/progress.js's exact-key Map lookup actually finds them.
      attempt.parsed.glowTarget = resolveTarget(attempt.parsed.glowTarget, targetNames) || attempt.parsed.glowTarget;
      attempt.parsed.growTarget = resolveTarget(attempt.parsed.growTarget, targetNames) || attempt.parsed.growTarget;
      return attempt;
    }
    console.warn(`Feedback validation failed on attempt ${i}:`, check.issues);
    lastIssues = check.issues;
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

// Looks up the most recent "what will you try next time?" commitment this
// CHILD made for this exercise kind, excluding the submission being graded
// right now — used so feedback can genuinely check in on it. Scoped by
// child_id, not just profile_id, now that an account can have more than one
// learner (see api/child-profile.js) - without that, one sibling's
// commitment could wrongly surface in another sibling's "checking in on
// last time" feedback. Returns null if there isn't one (first submission of
// this kind for this child, or they never tapped one).
async function getPreviousCommitment(supabase, profileId, childId, kind, excludeSubmissionId) {
  const { data } = await supabase
    .from("commitments")
    .select("chosen_action, submission_id, submissions!inner(kind, child_id)")
    .eq("profile_id", profileId)
    .eq("submissions.kind", kind)
    .eq("submissions.child_id", childId)
    .neq("submission_id", excludeSubmissionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? data.chosen_action : null;
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

      const previousCommitment = await getPreviousCommitment(supabase, user.id, existing.child_id, "writing", submissionId);
      const targets = targetsForGrade(existing.country, existing.grade_label, existing.tier).targets;
      // Banded assessment objectives are only a real thing for middle/high,
      // so the plan's grant is narrowed by tier here, once, and the same
      // resolved value drives both the prompt and the validator.
      const caps = { ...planCaps, examTechnique: planCaps.examTechnique && examTechniqueSupported(existing.tier) };
      let result;
      try {
        const llmPrompt = buildWritingPrompt({
          tier: existing.tier, country: existing.country, gradeLabel: existing.grade_label, interest: existing.interest,
          confidenceWriting: body.confidenceWriting, motivation: body.motivation,
          prompt: generated.prompt, text, previousCommitment, capabilities: caps, targets,
          targetNames: targets.map((t) => t.name),
        });
        result = await generateAndValidate(llmPrompt, existing.tier, existing.country, existing.grade_label, text, undefined, caps);
      } catch (genErr) {
        await releaseClaim(supabase, submissionId);
        throw genErr;
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

      const previousCommitment = await getPreviousCommitment(supabase, user.id, existing.child_id, "reading", submissionId);
      const targets = targetsForGrade(existing.country, existing.grade_label, existing.tier).targets;
      const caps = { ...planCaps, examTechnique: planCaps.examTechnique && examTechniqueSupported(existing.tier) };
      let result;
      try {
        const llmPrompt = buildReadingPrompt({
          tier: existing.tier, country: existing.country, gradeLabel: existing.grade_label, interest: existing.interest,
          confidenceReading: body.confidenceReading, motivation: body.motivation,
          passageTitle: bank.title, passage: bank.passage, questions: bank.questions,
          answers, score, totalQuestions, previousCommitment, capabilities: caps, targets,
          targetNames: targets.map((t) => t.name),
        });
        result = await generateAndValidate(llmPrompt, existing.tier, existing.country, existing.grade_label, undefined, score, caps);
      } catch (genErr) {
        await releaseClaim(supabase, submissionId);
        throw genErr;
      }

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
