const crypto = require("node:crypto");
const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { sendEmail, REPLY_TO } = require("./_lib/emailSend");
const { runFreeEmailJob } = require("./_lib/emailJob");
const { buildEmail } = require("./_lib/emailTemplate");

// One function for everything email- and feedback-related, because the host
// caps a project at 12 serverless functions (api/account.js is merged
// for the same reason). The action is chosen with ?action=:
//   cron         GET   the daily Free-plan email run (called by Vercel Cron)
//   unsubscribe  POST  stop (or, with resubscribe:true, restart) lifecycle emails
//   feedback     POST  save what a customer tells us: the product backlog
//   rating       POST  a thumbs up/down on a piece of feedback (was api/commit.js)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = ["bug", "idea", "praise", "question", "other"];

// A body is normally JSON, but an inbox's one-click unsubscribe posts a plain
// form string; anything unreadable is treated as empty rather than an error.
function parseBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; }
  }
  return req.body || {};
}
function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}
function clientIp(req) {
  const fwd = String((req.headers && req.headers["x-forwarded-for"]) || "");
  return fwd.split(",")[0].trim() || "unknown";
}
function hashIp(ip) {
  return crypto.createHash("sha256").update(`${process.env.EMAIL_HASH_SALT || "literacylab"}:${ip}`).digest("hex").slice(0, 32);
}

// ------------------------------------------------------------------ cron
async function handleCron(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: "CRON_SECRET is not set." });
  if ((req.headers && req.headers.authorization) !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized." });

  // Real sending needs every one of these; anything missing means a dry run.
  const missing = ["RESEND_API_KEY", "EMAIL_POSTAL_ADDRESS"].filter((k) => !process.env[k]);
  const live = process.env.EMAIL_LIVE === "true" && missing.length === 0 && !(req.query && req.query.dry === "1");
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  const summary = await runFreeEmailJob({
    supabase: getSupabaseAdmin(),
    send: sendEmail,
    address: process.env.EMAIL_POSTAL_ADDRESS || "",
    dryRun: !live,
    maxPerRun: Number(process.env.EMAIL_MAX_PER_RUN) || 50,
    adminEmails,
  });
  return res.status(200).json({ mode: live ? "live" : "dry-run", missingSettings: missing, emailLiveFlag: process.env.EMAIL_LIVE === "true", ...summary });
}

// ------------------------------------------------------------------ unsubscribe
async function handleUnsubscribe(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const body = parseBody(req);
  const token = String((req.query && req.query.t) || body.token || "");
  if (!UUID.test(token)) return res.status(400).json({ error: "This link isn't valid." });

  const supabase = getSupabaseAdmin();
  const optOut = body.resubscribe !== true;
  const { data, error } = await supabase
    .from("email_preferences")
    .update({ marketing_opt_out: optOut, unsubscribed_at: optOut ? new Date().toISOString() : null })
    .eq("unsubscribe_token", token)
    .select("profile_id");
  if (error) throw error;
  if (!data || data.length === 0) return res.status(404).json({ error: "This link isn't valid." });
  return res.status(200).json({ ok: true, unsubscribed: optOut });
}

// ------------------------------------------------------------------ feedback
async function handleFeedback(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const body = parseBody(req);
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const rating = body.rating === "up" || body.rating === "down" ? body.rating : null;
  const category = CATEGORIES.includes(body.category) ? body.category : "other";
  if (message.length > 2000) return res.status(400).json({ error: "Please keep feedback under 2000 characters." });
  if (!message && !rating) return res.status(400).json({ error: "Please add a rating or a message." });
  const emailKey = typeof body.emailKey === "string" ? body.emailKey.slice(0, 60) : null;
  const contactOk = body.contactOk === true;

  const supabase = getSupabaseAdmin();

  // Attribute to a parent only when the link carried a valid token; anyone
  // else can still leave feedback, anonymously.
  let profileId = null;
  if (typeof body.token === "string" && UUID.test(body.token)) {
    const { data } = await supabase.from("email_preferences").select("profile_id").eq("unsubscribe_token", body.token).maybeSingle();
    if (data) profileId = data.profile_id;
  }

  // Basic abuse limit for a form that needs no login: 5 an hour per address.
  const ipHash = hashIp(clientIp(req));
  const since = new Date(Date.now() - 3600000).toISOString();
  const { count, error: cErr } = await supabase
    .from("feedback").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if (cErr) throw cErr;
  if ((count || 0) >= 5) return res.status(429).json({ error: "Thanks, we've got plenty from you for now. Please try again later." });

  const { error } = await supabase.from("feedback").insert({
    profile_id: profileId, source: "email", email_key: emailKey, rating, category,
    message: message || null, contact_ok: contactOk, ip_hash: ipHash,
  });
  if (error) throw error;

  // A copy to the owner, so feedback is seen the day it arrives. Never allowed
  // to fail the request: the row above is what matters.
  try {
    if (process.env.RESEND_API_KEY) {
      let customerEmail = null;
      if (contactOk && profileId) {
        const { data } = await supabase.from("profiles").select("email").eq("id", profileId).maybeSingle();
        customerEmail = data && data.email;
      }
      const note = buildEmail({
        subject: `New feedback: ${category}${rating ? ` (${rating === "up" ? "thumbs up" : "thumbs down"})` : ""}`,
        preheader: message ? message.slice(0, 90) : "A customer left a rating.",
        heading: "New customer feedback",
        paragraphs: [
          `Type: ${category}`,
          `Rating: ${rating || "none"}`,
          `From email: ${emailKey || "not from an email"}`,
          `Message: ${message || "(none)"}`,
          customerEmail ? `The customer is happy to be contacted: ${customerEmail}. Reply to this email to reach them.` : "No permission to contact this customer.",
        ],
        reason: "An internal copy of feedback left on the LiteracyLab AI feedback page. It is also saved in the feedback table.",
      });
      await sendEmail({ to: REPLY_TO, subject: note.subject, html: note.html, text: note.text, replyTo: customerEmail || undefined });
    }
  } catch (err) {
    console.error("Feedback copy failed:", err.message);
  }
  return res.status(200).json({ ok: true });
}

// ------------------------------------------------------------------ rating (thumbs on a piece of feedback)
// Logs a thumbs up/down rating (plus optional comment) against a specific
// submission. Kept separate from submissions so ratings can be queried on
// their own without touching the feedback payload itself.
async function handleRating(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const user = await requireUser(req);
  const supabase = getSupabaseAdmin();
  const body = parseBody(req);
  const { submissionId, helpfulRating, feedbackText } = body;

  if (!submissionId) return res.status(400).json({ error: "submissionId is required." });
  if (helpfulRating && !["up", "down"].includes(helpfulRating)) {
    return res.status(400).json({ error: 'helpfulRating must be "up" or "down".' });
  }
  if (feedbackText != null && (typeof feedbackText !== "string" || feedbackText.length > 1000)) {
    return res.status(400).json({ error: "feedbackText must be a string under 1000 characters." });
  }

  // Confirm the submission actually belongs to this user before attaching a rating to it.
  const { data: submission, error: subErr } = await supabase
    .from("submissions").select("id").eq("id", submissionId).eq("profile_id", user.id).single();
  if (subErr || !submission) return res.status(404).json({ error: "Submission not found." });

  const { data, error } = await supabase
    .from("commitments")
    .insert({ submission_id: submissionId, profile_id: user.id, helpful_rating: helpfulRating || null, feedback_text: feedbackText || null })
    .select("*").single();
  if (error) throw error;

  return res.status(200).json({ commitment: data });
}

module.exports = async function handler(req, res) {
  try {
    const action = String((req.query && req.query.action) || "");
    if (action === "cron") return await handleCron(req, res);
    if (action === "unsubscribe") return await handleUnsubscribe(req, res);
    if (action === "feedback") return await handleFeedback(req, res);
    if (action === "rating") return await handleRating(req, res);
    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    await sendError(res, err);
  }
};
