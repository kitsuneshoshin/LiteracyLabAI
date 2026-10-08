// The daily lifecycle email run, for every plan. It gathers the facts about each
// parent, asks the pickers (freeEmails.js for Free, paidEmails.js for Core and
// Premium plus the emails that apply to everyone) what each should get today,
// and sends. Emails triggered by an EVENT (a purchase, a failed payment, a
// cancellation) are not sent here: the Stripe webhook sends those.
//
// Safety, in the order it matters:
//  - dryRun (the default) sends and records NOTHING: it only reports what it
//    would do. Real sending needs the caller to turn it on explicitly.
//  - "Send once" is enforced by the database: a row with a unique
//    (profile, dedupe_key) is claimed BEFORE the email goes out, so two
//    overlapping runs can never both send. If the send then fails, the claim
//    is released so tomorrow's run retries.
//  - Parents who unsubscribed are never emailed, and admin/test accounts are
//    skipped.
//  - At most maxPerRun emails per run (a provider's daily limit is real), paced
//    with pauseMs between sends to stay under the provider's rate limit.
//  - A run also stops at budgetMs, well before the host's time limit, so a slow run can never be cut off
//    mid-send. Anyone not reached has no claim recorded, so the next run picks them up.

const { pickEmail } = require("./freeEmails");
const { pickPaidEmail, pickSharedEmail } = require("./paidEmails");
const { buildAnyEmail } = require("./emailAny");
const { SITE } = require("./emailTemplate");
const { applyVariant } = require("./emailAb");

const DAY = 86400000;
const PLANS = ["free", "core", "premium", "pro"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The value that appears most often; on a tie, the one seen last (the most
// recent piece). Empty values are ignored. Used to name the week's focus skill.
function mostCommon(values) {
  const counts = new Map();
  values.forEach((v) => { if (v) counts.set(v, (counts.get(v) || 0) + 1); });
  let best = null;
  let bestN = 0;
  counts.forEach((n, v) => { if (n >= bestN) { best = v; bestN = n; } });
  return best;
}

const tierOf = (plan) => (plan === "free" ? "free" : plan === "core" ? "core" : "premium");
const PLAN_LABEL = { free: "Free", core: "Core", premium: "Premium" };

async function runFreeEmailJob({ supabase, now = new Date(), send, address, dryRun = true, maxPerRun = 40, adminEmails = [], pauseMs = 0, budgetMs = 0, clock = Date.now }) {
  const summary = { dryRun, considered: 0, optedOut: 0, eligible: 0, sent: 0, errors: 0, plan: [], stoppedEarly: null };
  const started = clock();

  const { data: profiles, error: pErr } = await supabase.from("profiles").select("id, email, plan, created_at").in("plan", PLANS).limit(1000);
  if (pErr) throw pErr;
  const people = (profiles || []).filter((p) => p.email && !adminEmails.includes(p.email.toLowerCase()));
  summary.considered = people.length;
  if (!people.length) return summary;
  const ids = people.map((p) => p.id);

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [prefsRes, logRes, doneRes, usedRes, kidsRes] = await Promise.all([
    supabase.from("email_preferences").select("profile_id, marketing_opt_out, unsubscribe_token").in("profile_id", ids),
    supabase.from("email_log").select("profile_id, dedupe_key, sent_at").in("profile_id", ids),
    // Completed pieces only: a row is created (and a free credit spent) when a
    // prompt is generated, but feedback is null (or _pending) until it is graded.
    supabase.from("submissions")
      .select("profile_id, child_id, created_at, kind, tier, score, total_questions, word_count, pending:feedback->>_pending, glow:feedback->>glowTarget, grow:feedback->>growTarget")
      .in("profile_id", ids).not("feedback", "is", null).order("created_at", { ascending: true }).limit(5000),
    supabase.from("submissions").select("profile_id, created_at").in("profile_id", ids).gte("created_at", monthStart),
    supabase.from("child_profiles").select("id, profile_id, display_name").in("profile_id", ids),
  ]);
  for (const r of [prefsRes, logRes, doneRes, usedRes, kidsRes]) if (r.error) throw r.error;

  const prefs = new Map((prefsRes.data || []).map((r) => [r.profile_id, r]));
  const sentBy = new Map();
  for (const r of logRes.data || []) {
    if (!sentBy.has(r.profile_id)) sentBy.set(r.profile_id, {});
    sentBy.get(r.profile_id)[r.dedupe_key] = new Date(r.sent_at);
  }
  const doneBy = new Map();
  for (const r of doneRes.data || []) {
    if (r.pending) continue;
    if (!doneBy.has(r.profile_id)) doneBy.set(r.profile_id, []);
    doneBy.get(r.profile_id).push({
      at: new Date(r.created_at), words: r.word_count || 0, child: r.child_id, kind: r.kind, tier: r.tier,
      score: r.score, total: r.total_questions, glow: r.glow || null, grow: r.grow || null,
    });
  }
  const usedBy = new Map();
  for (const r of usedRes.data || []) usedBy.set(r.profile_id, (usedBy.get(r.profile_id) || 0) + 1);
  const kidName = new Map((kidsRes.data || []).map((k) => [k.id, k.display_name || "Your learner"]));

  for (const p of people) {
    if (prefs.get(p.id)?.marketing_opt_out) { summary.optedOut++; continue; }

    const tier = tierOf(p.plan);
    const done = doneBy.get(p.id) || [];
    const week = done.filter((d) => now - d.at <= 7 * DAY);
    const sent = sentBy.get(p.id) || {};
    const createdAt = new Date(p.created_at);
    const lastActivityAt = done.length ? done[done.length - 1].at : null;
    const base = { createdAt, completedTotal: done.length, completedLast7d: week.length, sent, lastActivityAt };

    const pick = tier === "free"
      ? (pickEmail({ ...base, usedThisMonth: usedBy.get(p.id) || 0, firstCompletedAt: done.length ? done[0].at : null }, now)
        || pickSharedEmail({ ...base, plan: "free" }, now))
      : (pickPaidEmail({ ...base, tier, examAgeLast14d: done.some((d) => now - d.at <= 14 * DAY && (d.tier === "middle" || d.tier === "high")) }, now)
        || pickSharedEmail({ ...base, plan: tier }, now));
    if (!pick) continue;
    summary.eligible++;
    summary.plan.push({ email: pick.key, account: String(p.id).slice(-6) });
    if (dryRun) continue;
    if (summary.sent >= maxPerRun) { summary.stoppedEarly = "limit"; break; }
    if (budgetMs && clock() - started >= budgetMs) { summary.stoppedEarly = "time"; break; }

    // A token the unsubscribe and feedback links carry (created on first email).
    let token = prefs.get(p.id)?.unsubscribe_token;
    if (!token) {
      await supabase.from("email_preferences").upsert({ profile_id: p.id }, { onConflict: "profile_id", ignoreDuplicates: true });
      const { data: row, error: tErr } = await supabase.from("email_preferences").select("unsubscribe_token").eq("profile_id", p.id).single();
      if (tErr || !row) { summary.errors++; continue; }
      token = row.unsubscribe_token;
    }

    const claim = await supabase.from("email_log").insert({ profile_id: p.id, email_key: pick.key, dedupe_key: pick.dedupeKey }).select("id").single();
    if (claim.error) {
      if (claim.error.code !== "23505") summary.errors++; // 23505 = someone else already sent it
      continue;
    }
    try {
      const readings = week.filter((d) => d.kind === "reading" && d.total > 0 && d.score != null);
      const perLearner = new Map();
      week.forEach((d) => {
        const l = perLearner.get(d.child) || { name: kidName.get(d.child) || "Your learner", pieces: 0, words: 0 };
        l.pieces += 1; l.words += d.words;
        perLearner.set(d.child, l);
      });
      const ctx = {
        token, address,
        // fields used by the different emails
        pieces: week.length,
        // A milestone celebrates everything so far; every other email reports the week.
        words: (pick.key.startsWith("milestone-") ? done : week).reduce((n, d) => n + d.words, 0),
        days: new Set(week.map((d) => d.at.toISOString().slice(0, 10))).size,
        readingAvg: readings.length ? Math.round((readings.reduce((n, d) => n + d.score / d.total, 0) / readings.length) * 100) : null,
        glow: mostCommon(week.map((d) => d.glow)),
        grow: mostCommon(week.map((d) => d.grow)),
        learners: [...perLearner.values()],
        total: done.length,
        planLabel: PLAN_LABEL[tier],
      };
      // The Free summary reads stats.pieces / stats.words / stats.glow / stats.grow
      const built = applyVariant(pick.key, p.id, buildAnyEmail(pick.key, { ...ctx, stats: { pieces: ctx.pieces, words: ctx.words, glow: ctx.glow, grow: ctx.grow, days: ctx.days } }));
      const r = await send({
        to: p.email, subject: built.subject, html: built.html, text: built.text, bcc: built.bcc,
        oneClickUrl: built.transactional ? undefined : `${SITE}/api/email?action=unsubscribe&t=${token}`,
        idempotencyKey: `${p.id}:${pick.dedupeKey}`,
      });
      await supabase.from("email_log").update({ resend_id: r && r.id }).eq("id", claim.data.id);
      summary.sent++;
      // Resend accepts about 2 requests a second; a short pause keeps a bigger run under that.
      if (pauseMs) await sleep(pauseMs);
    } catch (err) {
      await supabase.from("email_log").delete().eq("id", claim.data.id);
      summary.errors++;
      console.error("Email failed:", pick.key, err.message);
    }
  }
  return summary;
}

module.exports = { runFreeEmailJob };
