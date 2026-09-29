// The daily Free-plan email run. It gathers the facts about every Free
// parent, asks pickEmail (freeEmails.js) what each should get today, and sends.
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
//  - At most maxPerRun emails per run (a provider's daily limit is real).

const { pickEmail, buildFreeEmail } = require("./freeEmails");
const { SITE } = require("./emailTemplate");

const DAY = 86400000;

async function runFreeEmailJob({ supabase, now = new Date(), send, address, dryRun = true, maxPerRun = 50, adminEmails = [] }) {
  const summary = { dryRun, considered: 0, optedOut: 0, eligible: 0, sent: 0, errors: 0, plan: [] };

  const { data: profiles, error: pErr } = await supabase.from("profiles").select("id, email, created_at").eq("plan", "free").limit(1000);
  if (pErr) throw pErr;
  const people = (profiles || []).filter((p) => p.email && !adminEmails.includes(p.email.toLowerCase()));
  summary.considered = people.length;
  if (!people.length) return summary;
  const ids = people.map((p) => p.id);

  const [prefsRes, logRes, doneRes, usedRes] = await Promise.all([
    supabase.from("email_preferences").select("profile_id, marketing_opt_out, unsubscribe_token").in("profile_id", ids),
    supabase.from("email_log").select("profile_id, dedupe_key, sent_at").in("profile_id", ids),
    // Completed pieces only: a row is created (and a free credit spent) when a
    // prompt is generated, but feedback is null (or _pending) until it is graded.
    supabase.from("submissions").select("profile_id, created_at, word_count, pending:feedback->>_pending").in("profile_id", ids).not("feedback", "is", null).order("created_at", { ascending: true }).limit(5000),
    supabase.from("submissions").select("profile_id, created_at").in("profile_id", ids).gte("created_at", new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()),
  ]);
  for (const r of [prefsRes, logRes, doneRes, usedRes]) if (r.error) throw r.error;

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
    doneBy.get(r.profile_id).push({ at: new Date(r.created_at), words: r.word_count || 0 });
  }
  const usedBy = new Map();
  for (const r of usedRes.data || []) usedBy.set(r.profile_id, (usedBy.get(r.profile_id) || 0) + 1);

  for (const p of people) {
    if (prefs.get(p.id)?.marketing_opt_out) { summary.optedOut++; continue; }

    const done = doneBy.get(p.id) || [];
    const week = done.filter((d) => now - d.at <= 7 * DAY);
    const facts = {
      createdAt: new Date(p.created_at),
      usedThisMonth: usedBy.get(p.id) || 0,
      completedTotal: done.length,
      firstCompletedAt: done.length ? done[0].at : null,
      completedLast7d: week.length,
      sent: sentBy.get(p.id) || {},
    };
    const pick = pickEmail(facts, now);
    if (!pick) continue;
    summary.eligible++;
    summary.plan.push({ email: pick.key, account: String(p.id).slice(-6) });
    if (dryRun) continue;
    if (summary.sent >= maxPerRun) break;

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
      const built = buildFreeEmail(pick.key, { token, address, stats: { pieces: week.length, words: week.reduce((n, d) => n + d.words, 0) } });
      const r = await send({
        to: p.email, subject: built.subject, html: built.html, text: built.text, bcc: built.bcc,
        oneClickUrl: `${SITE}/api/email?action=unsubscribe&t=${token}`,
        idempotencyKey: `${p.id}:${pick.dedupeKey}`,
      });
      await supabase.from("email_log").update({ resend_id: r && r.id }).eq("id", claim.data.id);
      summary.sent++;
    } catch (err) {
      await supabase.from("email_log").delete().eq("id", claim.data.id);
      summary.errors++;
      console.error("Free email failed:", pick.key, err.message);
    }
  }
  return summary;
}

module.exports = { runFreeEmailJob };
