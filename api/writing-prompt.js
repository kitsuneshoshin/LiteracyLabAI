const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getMonthlyUsage } = require("./_lib/usage");
const { generateFeedbackJSON } = require("./_lib/openai");
const { buildWritingPromptGenerator, correctiveAddendum } = require("./_lib/prompt");
const { validateWritingPrompt } = require("./_lib/validate");

const VALID_TIERS = ["early", "elementary", "middle", "high"];

// Generates a brand-new, original writing prompt instead of reusing the one
// fixed prompt per tier, so a returning student never writes to the same
// prompt twice. Mirrors api/reading-passage.js: this is its own AI call, so
// it inserts the submissions row (and consumes this account's monthly
// credit) immediately - one credit per writing attempt, whether or not the
// student ends up submitting a finished piece.
async function generateAndValidate(prompt, tier) {
  let attempt = await generateFeedbackJSON(prompt);
  let check = validateWritingPrompt(attempt.parsed, { tier });
  if (check.ok) return attempt;

  console.warn("Writing prompt validation failed on attempt 1:", check.issues);
  attempt = await generateFeedbackJSON(prompt + correctiveAddendum(check.issues));
  check = validateWritingPrompt(attempt.parsed, { tier });
  if (check.ok) return attempt;

  console.warn("Writing prompt validation failed on attempt 2:", check.issues);
  const err = new Error("We couldn't generate a writing prompt right now. Please try again.");
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

    const usage = await getMonthlyUsage(supabase, user.id);
    if (usage.used >= usage.cap) {
      return res.status(402).json({ error: "Free monthly submission limit reached.", usage });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { tier, country, gradeLabel, interest } = body;
    if (!VALID_TIERS.includes(tier)) return res.status(400).json({ error: `Invalid tier: ${tier}` });
    if (!country || !gradeLabel) return res.status(400).json({ error: "country and gradeLabel are required." });

    // .maybeSingle() + create-if-missing rather than .single(): a request
    // reaching here before api/child-profile.js's GET ever ran (which is
    // what normally creates the default row) would otherwise throw a
    // confusing "no rows" DB error instead of just working.
    let { data: childProfile, error: childErr } = await supabase
      .from("child_profiles").select("id").eq("profile_id", user.id).limit(1).maybeSingle();
    if (childErr) throw childErr;
    if (!childProfile) {
      const { data: created, error: createErr } = await supabase
        .from("child_profiles").insert({ profile_id: user.id }).select("id").single();
      if (createErr) throw createErr;
      childProfile = created;
    }

    const llmPrompt = buildWritingPromptGenerator({ tier, country, gradeLabel, interest });
    const { parsed } = await generateAndValidate(llmPrompt, tier);

    const { data: saved, error: insertErr } = await supabase
      .from("submissions")
      .insert({
        profile_id: user.id, child_id: childProfile.id, kind: "writing", tier, country, grade_label: gradeLabel, interest,
        content: { generatedPrompt: parsed },
      })
      .select("id, created_at")
      .single();
    if (insertErr) throw insertErr;

    const updatedUsage = await getMonthlyUsage(supabase, user.id);
    return res.status(200).json({
      submissionId: saved.id,
      title: parsed.title,
      prompt: parsed.prompt,
      usage: updatedUsage,
    });
  } catch (err) {
    sendError(res, err);
  }
};
