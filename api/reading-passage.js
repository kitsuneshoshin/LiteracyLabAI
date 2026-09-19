const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getMonthlyUsage } = require("./_lib/usage");
const { generateFeedbackJSON } = require("./_lib/openai");
const { buildReadingPassagePrompt, correctiveAddendum } = require("./_lib/prompt");
const { validatePassage } = require("./_lib/validate");

const VALID_TIERS = ["early", "elementary", "middle", "high"];

// Generates a brand-new, original reading passage + comprehension questions
// instead of picking from a small fixed bank, so no student sees the same
// text twice. This is its own AI call (separate from the feedback one that
// happens later in api/submit.js), so it consumes this account's monthly
// usage credit up front by inserting the submissions row now, with the
// score/feedback filled in later once the student actually answers -
// exactly one credit per reading attempt, matching what a writing
// submission costs, whether or not the student finishes it.
async function generateAndValidate(prompt, tier) {
  let attempt = await generateFeedbackJSON(prompt);
  let check = validatePassage(attempt.parsed, { tier });
  if (check.ok) return attempt;

  console.warn("Passage validation failed on attempt 1:", check.issues);
  attempt = await generateFeedbackJSON(prompt + correctiveAddendum(check.issues));
  check = validatePassage(attempt.parsed, { tier });
  if (check.ok) return attempt;

  console.warn("Passage validation failed on attempt 2:", check.issues);
  const err = new Error("We couldn't generate a reading passage right now. Please try again.");
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

    const llmPrompt = buildReadingPassagePrompt({ tier, country, gradeLabel, interest });
    const { parsed } = await generateAndValidate(llmPrompt, tier);

    const { data: saved, error: insertErr } = await supabase
      .from("submissions")
      .insert({
        profile_id: user.id, child_id: childProfile.id, kind: "reading", tier, country, grade_label: gradeLabel, interest,
        content: { generatedPassage: parsed },
        total_questions: parsed.questions.length,
      })
      .select("id, created_at")
      .single();
    if (insertErr) throw insertErr;

    const updatedUsage = await getMonthlyUsage(supabase, user.id);
    return res.status(200).json({
      submissionId: saved.id,
      title: parsed.title,
      skill: parsed.skill,
      passage: parsed.passage,
      // Strip the answer key before it ever reaches the browser — grading
      // happens server-side in api/submit.js against the stored row.
      questions: parsed.questions.map((q) => ({ q: q.q, options: q.options })),
      usage: updatedUsage,
    });
  } catch (err) {
    sendError(res, err);
  }
};
