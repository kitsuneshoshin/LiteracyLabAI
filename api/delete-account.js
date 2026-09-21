const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { getStripe } = require("./_lib/stripe");
const { requireUser, sendError } = require("./_lib/auth");

// Permanently deletes an Account Holder's entire account and everything
// under it - every child profile, submission, and commitment - not just one
// learner. privacy.html promises this as a self-service right ("delete the
// entire account, at any time"); before this endpoint existed that promise
// had no supporting code, which is itself a real compliance problem (an
// unfulfillable privacy promise), not just a wording one.
//
// Deleting the auth.users row is enough to cascade everything else: profiles
// references auth.users(id) on delete cascade, and every other table
// (child_profiles, submissions, commitments, rate_limit_hits) cascades from
// there (see supabase/schema.sql). The one thing that FK cascade can't
// reach is the external Stripe subscription, so that's cancelled explicitly
// first - otherwise a deleted account could keep getting billed.
module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed." });
    }
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    const { data: profile } = await supabase
      .from("profiles").select("stripe_subscription_id").eq("id", user.id).maybeSingle();

    if (profile?.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      } catch (err) {
        // Already cancelled, already expired, or Stripe not configured in
        // this environment - none of that should block deleting the
        // account, which is the part the user actually asked for.
        console.error("Non-fatal: failed to cancel Stripe subscription during account deletion:", err);
      }
    }

    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return res.status(200).json({ deleted: true });
  } catch (err) {
    sendError(res, err);
  }
};
