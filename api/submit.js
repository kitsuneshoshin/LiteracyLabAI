const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getMonthlyUsage } = require("./_lib/usage");
const { generateFeedbackJSON } = require("./_lib/openai");
const { buildWritingPrompt, buildReadingPrompt, correctiveAddendum } = require("./_lib/prompt");
const { gradeReading } = require("./_lib/readingBank");
const { standardsFor } = require("./_lib/curriculum");
const { validateFeedback } = require("./_lib/validate");

// Server-side character caps, mirroring PROMPTS[tier].maxChars in app.html.
// Enforced here too since a client-side maxLength is trivially bypassed.
const MAX_CHARS = { early: 800, elementary: 1500, middle: 3000, high: 6000 };
const VALID_TIERS = ["early", "elementary", "middle", "high"];

// Generates feedback, validates it against the deterministic checks, and
// retries once with a corrective note before giving up. A submission that
// fails both attempts throws rather than ever reaching the student — better
// to show an error (which doesn't consume their free submission, since
// nothing gets saved) than to hand a child bad feedback.
async function generateAndValidate(prompt, tier, country) {
  const standardsList = standardsFor(country, tier);
  let attempt = await generateFeedbackJSON(prompt);
  let check = validateFeedback(attempt.parsed, { tier, standardsList });
  if (check.ok) return attempt;

  console.warn("Feedback validation failed on attempt 1:", check.issues);
  attempt = await generateFeedbackJSON(prompt + correctiveAddendum(check.issues));
  check = validateFeedback(attempt.parsed, { tier, standardsList });
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

    // 1. Enforce the usage cap server-side — this is the actual gate, not the
    //    client's copy of the count, which only mirrors what this returns.
    const usage = await getMonthlyUsage(supabase, user.id);
    if (usage.used >= usage.cap) {
      return res.status(402).json({ error: "Free monthly submission limit reached.", usage });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { kind, tier, country, gradeLabel, interest } = body;

    if (!VALID_TIERS.includes(tier)) return res.status(400).json({ error: `Invalid tier: ${tier}` });
    if (!country || !gradeLabel) return res.status(400).json({ error: "country and gradeLabel are required." });

    const { data: childProfile, error: childErr } = await supabase
      .from("child_profiles").select("id").eq("profile_id", user.id).limit(1).single();
    if (childErr) throw childErr;

    let feedback, modelUsed, submissionRow;

    if (kind === "writing") {
      const { prompt, text } = body;
      if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required for a writing submission." });
      if (text.length > MAX_CHARS[tier]) {
        return res.status(400).json({ error: `Submission exceeds the ${MAX_CHARS[tier]}-character limit for this tier.` });
      }

      const llmPrompt = buildWritingPrompt({
        tier, country, gradeLabel, interest,
        confidenceWriting: body.confidenceWriting, motivation: body.motivation,
        prompt, text,
      });
      const result = await generateAndValidate(llmPrompt, tier, country);
      feedback = result.parsed;
      modelUsed = result.modelUsed;

      submissionRow = {
        profile_id: user.id, child_id: childProfile.id, kind: "writing", tier, country, interest,
        content: { prompt, text },
        word_count: text.trim().split(/\s+/).filter(Boolean).length,
        char_count: text.length,
        feedback, model_used: modelUsed,
      };
    } else if (kind === "reading") {
      const { answers } = body;
      if (!Array.isArray(answers)) return res.status(400).json({ error: "answers array is required for a reading submission." });

      const { score, totalQuestions, bank } = gradeReading(tier, answers);
      const llmPrompt = buildReadingPrompt({
        tier, country, gradeLabel, interest,
        confidenceReading: body.confidenceReading, motivation: body.motivation,
        passageTitle: bank.title, passage: bank.passage, questions: bank.questions,
        answers, score, totalQuestions,
      });
      const result = await generateAndValidate(llmPrompt, tier, country);
      feedback = result.parsed;
      modelUsed = result.modelUsed;

      submissionRow = {
        profile_id: user.id, child_id: childProfile.id, kind: "reading", tier, country, interest,
        content: { answers },
        score, total_questions: totalQuestions,
        feedback, model_used: modelUsed,
      };
    } else {
      return res.status(400).json({ error: 'kind must be "writing" or "reading".' });
    }

    const { data: saved, error: insertErr } = await supabase
      .from("submissions").insert(submissionRow).select("id, created_at").single();
    if (insertErr) throw insertErr;

    const updatedUsage = await getMonthlyUsage(supabase, user.id);
    return res.status(200).json({
      submissionId: saved.id, createdAt: saved.created_at,
      feedback, score: submissionRow.score, totalQuestions: submissionRow.total_questions,
      usage: updatedUsage,
    });
  } catch (err) {
    sendError(res, err);
  }
};
