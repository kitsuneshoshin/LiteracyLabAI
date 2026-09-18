const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getMonthlyUsage } = require("./_lib/usage");
const { generateFeedbackJSON } = require("./_lib/openai");
const { buildWritingPrompt, buildReadingPrompt, correctiveAddendum } = require("./_lib/prompt");
const { standardsFor } = require("./_lib/curriculum");
const { targetsForGrade } = require("./_lib/masteryTargets");
const { validateFeedback } = require("./_lib/validate");

// Server-side character caps, mirroring PROMPTS[tier].maxChars in app.html.
// Enforced here too since a client-side maxLength is trivially bypassed.
const MAX_CHARS = { early: 800, elementary: 1500, middle: 3000, high: 6000 };
const VALID_TIERS = ["early", "elementary", "middle", "high"];

// Generates feedback, validates it against the deterministic checks, and
// retries once with a corrective note before giving up. A submission that
// fails both attempts throws rather than ever reaching the student — better
// to show an error than to hand a child bad feedback.
async function generateAndValidate(prompt, tier, country, gradeLabel) {
  const standardsList = standardsFor(country, tier, gradeLabel);
  const targetNames = targetsForGrade(country, gradeLabel, tier).targets.map((t) => t.name);
  let attempt = await generateFeedbackJSON(prompt);
  let check = validateFeedback(attempt.parsed, { tier, standardsList, targetNames });
  if (check.ok) return attempt;

  console.warn("Feedback validation failed on attempt 1:", check.issues);
  attempt = await generateFeedbackJSON(prompt + correctiveAddendum(check.issues));
  check = validateFeedback(attempt.parsed, { tier, standardsList, targetNames });
  if (check.ok) return attempt;

  console.warn("Feedback validation failed on attempt 2:", check.issues);
  const err = new Error("The AI response didn't meet our quality checks after two attempts. Please try submitting again.");
  err.statusCode = 502;
  throw err;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed." });
    }

    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { kind } = body;

    if (kind === "writing") {
      // Writing is the "new billable unit" path — usage is only checked and
      // consumed here, at the point a submissions row is actually created.
      const usage = await getMonthlyUsage(supabase, user.id);
      if (usage.used >= usage.cap) {
        return res.status(402).json({ error: "Free monthly submission limit reached.", usage });
      }

      const { tier, country, gradeLabel, interest, prompt, text } = body;
      if (!VALID_TIERS.includes(tier)) return res.status(400).json({ error: `Invalid tier: ${tier}` });
      if (!country || !gradeLabel) return res.status(400).json({ error: "country and gradeLabel are required." });
      if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required for a writing submission." });
      if (text.length > MAX_CHARS[tier]) {
        return res.status(400).json({ error: `Submission exceeds the ${MAX_CHARS[tier]}-character limit for this tier.` });
      }

      const { data: childProfile, error: childErr } = await supabase
        .from("child_profiles").select("id").eq("profile_id", user.id).limit(1).single();
      if (childErr) throw childErr;

      const llmPrompt = buildWritingPrompt({
        tier, country, gradeLabel, interest,
        confidenceWriting: body.confidenceWriting, motivation: body.motivation,
        prompt, text,
        targetNames: targetsForGrade(country, gradeLabel, tier).targets.map((t) => t.name),
      });
      const result = await generateAndValidate(llmPrompt, tier, country, gradeLabel);

      const submissionRow = {
        profile_id: user.id, child_id: childProfile.id, kind: "writing", tier, country, grade_label: gradeLabel, interest,
        content: { prompt, text },
        word_count: text.trim().split(/\s+/).filter(Boolean).length,
        char_count: text.length,
        feedback: result.parsed, model_used: result.modelUsed,
      };
      const { data: saved, error: insertErr } = await supabase
        .from("submissions").insert(submissionRow).select("id, created_at").single();
      if (insertErr) throw insertErr;

      const updatedUsage = await getMonthlyUsage(supabase, user.id);
      return res.status(200).json({
        submissionId: saved.id, createdAt: saved.created_at,
        feedback: result.parsed, usage: updatedUsage,
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
        .select("id, tier, country, grade_label, interest, content, feedback")
        .eq("id", submissionId)
        .eq("profile_id", user.id)
        .single();
      if (fetchErr || !existing) return res.status(404).json({ error: "Reading passage not found for this account." });
      if (existing.feedback) return res.status(409).json({ error: "This reading passage has already been submitted." });

      const bank = existing.content && existing.content.generatedPassage;
      if (!bank) return res.status(500).json({ error: "This reading passage is missing its answer key." });

      let score = 0;
      bank.questions.forEach((q, i) => { if (answers[i] === q.correct) score += 1; });
      const totalQuestions = bank.questions.length;

      const llmPrompt = buildReadingPrompt({
        tier: existing.tier, country: existing.country, gradeLabel: existing.grade_label, interest: existing.interest,
        confidenceReading: body.confidenceReading, motivation: body.motivation,
        passageTitle: bank.title, passage: bank.passage, questions: bank.questions,
        answers, score, totalQuestions,
        targetNames: targetsForGrade(existing.country, existing.grade_label, existing.tier).targets.map((t) => t.name),
      });
      const result = await generateAndValidate(llmPrompt, existing.tier, existing.country, existing.grade_label);

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
    sendError(res, err);
  }
};
