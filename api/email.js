const crypto = require("node:crypto");
const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { sendEmail, REPLY_TO } = require("./_lib/emailSend");
const { runFreeEmailJob } = require("./_lib/emailJob");
const { buildEmail, SITE } = require("./_lib/emailTemplate");
const { buildAnyEmail, ALL_EMAIL_KEYS, sampleContext } = require("./_lib/emailAny");

// One function for everything email- and feedback-related, because the host
// caps a project at 12 serverless functions (api/account.js is merged
// for the same reason). The action is chosen with ?action=:
//   cron         GET   the daily Free-plan email run (called by Vercel Cron)
//   test         GET   send one copy of every Free email to an admin address
//   unsubscribe  POST  stop (or, with resubscribe:true, restart) lifecycle emails
//   feedback     POST  save what a customer tells us: the product backlog
//   rating       POST  a thumbs up/down on a piece of feedback (was api/commit.js)
//   qa           GET   the weekly marking-quality check (called by Vercel Cron)

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
  // Admin addresses are never emailed. EMAIL_SKIP is a second list of addresses to
  // leave out (test accounts, anyone who asked not to be emailed) that does NOT
  // carry admin powers, unlike ADMIN_EMAILS.
  const adminEmails = [process.env.ADMIN_EMAILS || "", process.env.EMAIL_SKIP || ""].join(",").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

  const summary = await runFreeEmailJob({
    supabase: getSupabaseAdmin(),
    send: sendEmail,
    address: process.env.EMAIL_POSTAL_ADDRESS || "",
    dryRun: !live,
    maxPerRun: Number(process.env.EMAIL_MAX_PER_RUN) || 40,
    pauseMs: 550,
    adminEmails,
  });
  const report = { mode: live ? "live" : "dry-run", missingSettings: missing, emailLiveFlag: process.env.EMAIL_LIVE === "true", ...summary };
  // In the deployment logs too, so a dry run can be checked without calling the endpoint.
  console.log("free-email-run", JSON.stringify(report));
  return res.status(200).json(report);
}

// ------------------------------------------------------------------ weekly marking-quality check
// Runs a fixed set of sample pieces through the real prompt and validator (see
// api/_lib/qaRun.js) and saves one summary row in qa_runs. Called weekly by
// Vercel Cron, which sends the CRON_SECRET; ?save=0 runs it without saving.
async function handleQa(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const secret = process.env.CRON_SECRET;
  const bearer = (req.headers && req.headers.authorization) || "";
  // Vercel Cron sends the secret. A signed-in ADMIN (ADMIN_EMAILS) may also run it by hand,
  // so the owner can compare models without ever handling the secret.
  let allowed = Boolean(secret) && bearer === `Bearer ${secret}`;
  if (!allowed && bearer.startsWith("Bearer ")) {
    try {
      const user = await require("./_lib/auth").requireUser(req);
      const admins = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
      allowed = admins.includes(String(user.email || "").toLowerCase());
    } catch (e) { allowed = false; }
  }
  if (!allowed && !secret) return res.status(500).json({ error: "CRON_SECRET is not set." });
  if (!allowed) return res.status(401).json({ error: "Unauthorized." });

  const { runQa } = require("./_lib/qaRun");
  const { generateFeedbackJSON } = require("./_lib/openai");
  // ?models=1 lists the models this key can use. ?model=<id> runs the same check on another
  // model (and, like ?save=0, nothing is changed in production), to compare quality and cost.
  if (req.query && req.query.models === "1") return res.status(200).json({ models: await require("./_lib/openai").listModels() });
  const model = req.query && /^[a-z0-9][a-z0-9.\-]{2,40}$/.test(String(req.query.model || "")) ? String(req.query.model) : undefined;
  const summary = await runQa({ generate: (prompt) => generateFeedbackJSON(prompt, { model, maxTokens: 3800 }) });
  if (model) summary.model = model;
  let saved = false;
  if (!(req.query && req.query.save === "0") && !model) {
    const { error } = await getSupabaseAdmin().from("qa_runs").insert({ passed: summary.passed, total: summary.total, summary });
    if (error) console.error("Saving the quality run failed:", error.message);
    else saved = true;
  }
  console.log("qa-run", JSON.stringify({ passed: summary.passed, delivered: summary.delivered, total: summary.total, avgMs: summary.avgMs, saved }));
  return res.status(200).json({ saved, passedFirstTry: summary.passed, delivered: summary.delivered, total: summary.total, passRate: summary.passRate, deliveredRate: summary.deliveredRate, timedOut: summary.timedOut, avgAttempts: summary.avgAttempts, avgMs: summary.avgMs, results: summary.results.map((r) => ({ name: r.name, firstTry: r.firstTry, outcome: r.outcome, attempts: r.attempts, ms: r.ms, issues: r.issues })) });
}

// ------------------------------------------------------------------ test copies
// Sends one copy of every Free email to an ADMIN address, so the owner can see
// exactly what customers will get in a real inbox, through the real sending
// route. Protected by the cron secret and limited to ADMIN_EMAILS, so it can
// never be used to email anyone else.
async function handleTest(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: "CRON_SECRET is not set." });
  if ((req.headers && req.headers.authorization) !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized." });

  const to = String((req.query && req.query.to) || "").trim().toLowerCase();
  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!to || !adminEmails.includes(to)) return res.status(403).json({ error: "Test emails can only be sent to an admin address." });
  const missing = ["RESEND_API_KEY", "EMAIL_POSTAL_ADDRESS"].filter((k) => !process.env[k]);
  if (missing.length) return res.status(400).json({ error: "Missing settings.", missingSettings: missing });

  // Use this admin's own token when they have an account, so the unsubscribe
  // and feedback links in the test copies really work.
  const supabase = getSupabaseAdmin();
  let token = "00000000-0000-0000-0000-000000000000";
  const { data: profile } = await supabase.from("profiles").select("id").eq("email", to).maybeSingle();
  if (profile) {
    await supabase.from("email_preferences").upsert({ profile_id: profile.id }, { onConflict: "profile_id", ignoreDuplicates: true });
    const { data: pref } = await supabase.from("email_preferences").select("unsubscribe_token").eq("profile_id", profile.id).maybeSingle();
    if (pref && pref.unsubscribe_token) token = pref.unsubscribe_token;
  }

  const pauseMs = process.env.EMAIL_TEST_PAUSE_MS === undefined ? 550 : Number(process.env.EMAIL_TEST_PAUSE_MS);
  const sent = [];
  for (let i = 0; i < ALL_EMAIL_KEYS.length; i++) {
    const key = ALL_EMAIL_KEYS[i];
    const e = buildAnyEmail(key, { token, address: process.env.EMAIL_POSTAL_ADDRESS, ...sampleContext(key) });
    const r = await sendEmail({
      to, subject: `[TEST ${i + 1}/${ALL_EMAIL_KEYS.length}] ${e.subject}`, html: e.html, text: e.text,
      // Account emails have no unsubscribe link, so no one-click header either.
      oneClickUrl: e.transactional ? undefined : `${SITE}/api/email?action=unsubscribe&t=${token}`,
    });
    sent.push({ email: key, id: r.id });
    await new Promise((resolve) => setTimeout(resolve, pauseMs)); // stay under the sender's rate limit
  }
  return res.status(200).json({ sent });
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
    .from("submissions").select("id, kind").eq("id", submissionId).eq("profile_id", user.id).single();
  if (subErr || !submission) return res.status(404).json({ error: "Submission not found." });

  const { data, error } = await supabase
    .from("commitments")
    .insert({ submission_id: submissionId, profile_id: user.id, helpful_rating: helpfulRating || null, feedback_text: feedbackText || null })
    .select("*").single();
  if (error) throw error;

  // A worded comment (or any thumbs-down) is also a piece of product feedback, so
  // it goes into the same backlog table as the email feedback page, where it is
  // triaged and shows up in the owner's Backlog. Never allowed to fail the
  // rating itself: the commitment row above is what the app relies on.
  const text = typeof feedbackText === "string" ? feedbackText.trim() : "";
  if (text || helpfulRating === "down") {
    try {
      const { error: fbErr } = await supabase.from("feedback").insert({
        profile_id: user.id, source: "app", email_key: `app-${submission.kind === "reading" ? "reading" : "writing"}`,
        rating: helpfulRating || null, category: "other", message: text || null, contact_ok: false,
      });
      if (fbErr) console.error("Saving in-app feedback to the backlog failed:", fbErr.message);
    } catch (err) {
      console.error("Saving in-app feedback to the backlog failed:", err.message);
    }
  }

  return res.status(200).json({ commitment: data });
}

module.exports = async function handler(req, res) {
  try {
    const action = String((req.query && req.query.action) || "");
    if (action === "cron") return await handleCron(req, res);
    if (action === "qa") return await handleQa(req, res);
    if (action === "test") return await handleTest(req, res);
    if (action === "unsubscribe") return await handleUnsubscribe(req, res);
    if (action === "feedback") return await handleFeedback(req, res);
    if (action === "rating") return await handleRating(req, res);
    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    await sendError(res, err);
  }
};
