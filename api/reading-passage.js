const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getMonthlyUsage } = require("./_lib/usage");
const { checkRateLimit } = require("./_lib/rateLimit");
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

    // Separate from the monthly cap check below - see the matching comment
    // in api/writing-prompt.js. Shared bucket across both generation
    // endpoints and api/submit.js since all three trigger real OpenAI cost.
    await checkRateLimit(supabase, user.id, "ai_generate", { limit: 10, windowSeconds: 300 });

    const usage = await getMonthlyUsage(supabase, user.id);
    if (usage.used >= usage.cap) {
      return res.status(402).json({ error: "Free monthly submission limit reached.", usage });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { tier, country, gradeLabel, interest, childId } = body;
    if (!VALID_TIERS.includes(tier)) return res.status(400).json({ error: `Invalid tier: ${tier}` });
    if (!country || !gradeLabel) return res.status(400).json({ error: "country and gradeLabel are required." });
    if (!childId) return res.status(400).json({ error: "childId is required." });

    // A household can have more than one learner now (see
    // api/child-profile.js) - this must be the specific child the request
    // is for, not just "the" child, and ownership must be verified rather
    // than trusted from the client.
    const { data: childProfile, error: childErr } = await supabase
      .from("child_profiles").select("id").eq("id", childId).eq("profile_id", user.id).maybeSingle();
    if (childErr) throw childErr;
    if (!childProfile) return res.status(404).json({ error: "Learner not found for this account." });

    // Reserve the slot with a placeholder row BEFORE calling the AI, then
    // re-check the cap - see the matching comment in api/writing-prompt.js
    // for why: the plain check-then-insert above has a real race between
    // two concurrent requests that a live test actually reproduced (both
    // read "under cap" and both got billed). This shrinks that window and
    // avoids charging for a generation that turns out to lose the race.
    const { data: reserved, error: reserveErr } = await supabase
      .from("submissions")
      .insert({ profile_id: user.id, child_id: childProfile.id, kind: "reading", tier, country, grade_label: gradeLabel, interest, content: {} })
      .select("id")
      .single();
    if (reserveErr) throw reserveErr;

    const recheck = await getMonthlyUsage(supabase, user.id);
    if (recheck.used > recheck.cap) {
      await supabase.from("submissions").delete().eq("id", reserved.id);
      return res.status(402).json({ error: "Free monthly submission limit reached.", usage: { ...recheck, used: recheck.used - 1 } });
    }

    // If generation fails from here, the reserved row must not be left
    // behind - it would silently sit there as a permanent, uncorrectable
    // usage charge for a passage the student never actually received.
    let parsed;
    try {
      const llmPrompt = buildReadingPassagePrompt({ tier, country, gradeLabel, interest });
      ({ parsed } = await generateAndValidate(llmPrompt, tier));
    } catch (genErr) {
      await supabase.from("submissions").delete().eq("id", reserved.id);
      throw genErr;
    }

    const { error: updateErr } = await supabase
      .from("submissions")
      .update({ content: { generatedPassage: parsed }, total_questions: parsed.questions.length })
      .eq("id", reserved.id);
    if (updateErr) throw updateErr;

    const updatedUsage = await getMonthlyUsage(supabase, user.id);
    return res.status(200).json({
      submissionId: reserved.id,
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
