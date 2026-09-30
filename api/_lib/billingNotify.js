// Emails that Stripe events trigger: the welcome to a paid plan, a failed
// payment, a cancellation, and learners being paused after a downgrade.
// Called from api/stripe-webhook.js AFTER the plan has been updated.
//
// Rules that keep billing safe:
//  - An email problem must never break plan updates. The webhook wraps every
//    call here in try/catch, and this file never throws for a send failure.
//  - Nothing is sent until emails are switched on (EMAIL_LIVE=true with the
//    sending key and postal address set), the same gate as the daily run.
//  - Each email is claimed in email_log first (unique per parent and key), so
//    Stripe retrying an event can never send the same email twice.
//  - These are about the customer's own purchase, so they go out even if the
//    parent unsubscribed from lifecycle emails, and carry no unsubscribe link.

const { buildAnyEmail } = require("./emailAny");
const { sendEmail } = require("./emailSend");
const { capabilitiesFor } = require("./plans");

function emailsLive() {
  return process.env.EMAIL_LIVE === "true" && !!process.env.RESEND_API_KEY && !!process.env.EMAIL_POSTAL_ADDRESS;
}

const dateText = (seconds) => new Date(seconds * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Sends one email to one parent, at most once per dedupeKey. Resolves to a short
// string describing what happened, for logs and tests; never throws.
async function sendBillingEmail({ supabase, profile, key, dedupeKey, ctx = {}, send = sendEmail }) {
  try {
    if (!emailsLive()) return "skipped: emails are not switched on";
    if (!profile || !profile.id || !profile.email) return "skipped: no parent to email";

    await supabase.from("email_preferences").upsert({ profile_id: profile.id }, { onConflict: "profile_id", ignoreDuplicates: true });
    const { data: pref } = await supabase.from("email_preferences").select("unsubscribe_token").eq("profile_id", profile.id).maybeSingle();
    const token = pref && pref.unsubscribe_token;
    if (!token) return "skipped: no token";

    const claim = await supabase.from("email_log").insert({ profile_id: profile.id, email_key: key, dedupe_key: dedupeKey }).select("id").single();
    if (claim.error) return claim.error.code === "23505" ? "skipped: already sent" : `error: ${claim.error.message}`;

    try {
      const built = buildAnyEmail(key, { token, address: process.env.EMAIL_POSTAL_ADDRESS, ...ctx });
      const r = await send({
        to: profile.email, subject: built.subject, html: built.html, text: built.text, bcc: built.bcc,
        idempotencyKey: `${profile.id}:${dedupeKey}`,
      });
      await supabase.from("email_log").update({ resend_id: r && r.id }).eq("id", claim.data.id);
      return "sent";
    } catch (err) {
      await supabase.from("email_log").delete().eq("id", claim.data.id);
      console.error("Billing email failed:", key, err.message);
      return `error: ${err.message}`;
    }
  } catch (err) {
    console.error("Billing email failed:", key, err.message);
    return `error: ${err.message}`;
  }
}

/**
 * event: the Stripe event. after: { profileId, plan } describing the profile
 * once the webhook has updated it. before: the profile row as it was before
 * ({ id, email, plan }) for subscription events, or null.
 */
async function notifyBillingEvent({ event, supabase, after, before, send }) {
  const out = [];
  const object = event.data.object;

  if (event.type === "checkout.session.completed") {
    const { data: profile } = await supabase.from("profiles").select("id, email").eq("id", after.profileId).maybeSingle();
    const key = after.plan === "core" ? "core-welcome" : "prem-welcome";
    out.push(await sendBillingEmail({ supabase, profile, key, dedupeKey: `${key}:${object.subscription}`, send }));
    return out;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const previous = (event.data && event.data.previous_attributes) || {};
    const profile = before;

    // Cancelled now, or scheduled to end at the period's close
    const scheduled = event.type === "customer.subscription.updated" && object.cancel_at_period_end === true && previous.cancel_at_period_end === false;
    if (scheduled || event.type === "customer.subscription.deleted") {
      out.push(await sendBillingEmail({
        supabase, profile, key: "bill-cancel", dedupeKey: `bill-cancel:${object.id}`,
        ctx: { endDate: scheduled && object.current_period_end ? dateText(object.current_period_end) : null }, send,
      }));
    }

    // A payment failed: the subscription has just moved from active to past due
    if (event.type === "customer.subscription.updated" && previous.status === "active" && ["past_due", "unpaid"].includes(object.status)) {
      out.push(await sendBillingEmail({ supabase, profile, key: "bill-failed", dedupeKey: `bill-failed:${object.id}:${object.current_period_end || ""}`, send }));
    }

    // A downgrade left more learners than the new plan covers
    if (profile && after && after.plan && after.plan !== profile.plan) {
      const max = capabilitiesFor(after.plan).maxLearners;
      const { count } = await supabase.from("child_profiles").select("id", { count: "exact", head: true }).eq("profile_id", profile.id);
      if (max && count > max) {
        out.push(await sendBillingEmail({
          supabase, profile, key: "prem-paused", dedupeKey: `prem-paused:${event.id}`,
          ctx: { maxLearners: max, paused: count - max }, send,
        }));
      }
    }
  }
  return out;
}

module.exports = { notifyBillingEvent, sendBillingEmail, emailsLive };
