const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { getStripe } = require("./_lib/stripe");
const { requireUser, sendError } = require("./_lib/auth");
const { statusFor } = require("./_lib/referrals");
const shareCards = require("./_lib/shareCards");

function bodyOf(req) {
  if (typeof req.body === "string") { try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; } }
  return req.body || {};
}

// Merged export-data.js and delete-account.js into one file - Vercel's
// Hobby plan caps a deployment at 12 serverless functions, and having both
// as separate files pushed the total over that limit. They're both
// account-lifecycle actions on the same resource, so GET = export and
// DELETE = delete account is a natural single-file split, and costs
// nothing functionally.
module.exports = async function handler(req, res) {
  try {
    const action = (req.query && req.query.action) || "";
    // The public face of a shared result card: no sign-in, only the fields listed in api/_lib/shareCards.js.
    if (req.method === "GET" && action === "share-view") {
      const card = await shareCards.viewCard(getSupabaseAdmin(), req.query.t);
      // Never cached: when a parent switches a card off, it must stop working at once.
      res.setHeader("Cache-Control", "no-store");
      if (!card) return res.status(404).json({ error: "This card is not available." });
      return res.status(200).json({ card });
    }

    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    // Share cards (api/_lib/shareCards.js). Chosen by ?action= so the account export and deletion below are untouched.
    if (req.method === "GET" && action === "share-mine") return res.status(200).json(await shareCards.mineFor(supabase, user, req.query.submissionId));
    if (req.method === "POST" && action === "share-create") return res.status(200).json(await shareCards.createCard(supabase, user, bodyOf(req)));
    if (req.method === "POST" && action === "share-revoke") return res.status(200).json(await shareCards.revokeCard(supabase, user, bodyOf(req).token));

    // GET ?action=referral: the refer-a-friend card (api/_lib/referrals.js). Here rather than in a new file
    // because the host allows only 12 serverless functions and api/ already holds 12.
    if (req.method === "GET" && req.query && req.query.action === "referral") {
      return res.status(200).json(await statusFor(supabase, user));
    }

    if (req.method === "GET") {
      // Returns every piece of personal data this account holds, as one
      // JSON file the browser downloads. privacy.html promises this as a
      // self-service right ("export a copy... in a portable format, on
      // request"); this is the endpoint that actually backs that promise.
      const [{ data: profile }, { data: children }, { data: submissions }, { data: commitments }, { data: referrals }, { data: sharedCards }] = await Promise.all([
        supabase.from("profiles").select("id, email, plan, created_at").eq("id", user.id).maybeSingle(),
        supabase.from("child_profiles").select("*").eq("profile_id", user.id),
        supabase.from("submissions").select("*").eq("profile_id", user.id),
        supabase.from("commitments").select("*").eq("profile_id", user.id),
        supabase.from("referrals").select("referrer_id, referred_id, status, created_at, rewarded_at").or(`referrer_id.eq.${user.id},referred_id.eq.${user.id}`),
        supabase.from("share_cards").select("token, display_name, kind, grade_label, skill, score, total, created_at, revoked_at").eq("profile_id", user.id),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        account: profile || null,
        children: children || [],
        submissions: submissions || [],
        commitments: commitments || [],
        referrals: referrals || [],
        sharedCards: sharedCards || [],
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="literacylab-data-export-${user.id}.json"`);
      return res.status(200).send(JSON.stringify(exportData, null, 2));
    }

    if (req.method === "DELETE") {
      // Permanently deletes the entire account - every child profile,
      // submission, and commitment, not just one learner. Deleting the
      // auth.users row is enough to cascade everything else: profiles
      // references auth.users(id) on delete cascade, and every other table
      // cascades from there (see supabase/schema.sql). The one thing that
      // FK cascade can't reach is the external Stripe subscription, so
      // that's cancelled explicitly first - otherwise a deleted account
      // could keep getting billed.
      const { data: profile } = await supabase
        .from("profiles").select("stripe_subscription_id").eq("id", user.id).maybeSingle();

      if (profile?.stripe_subscription_id) {
        try {
          const stripe = getStripe();
          await stripe.subscriptions.cancel(profile.stripe_subscription_id);
        } catch (err) {
          console.error("Non-fatal: failed to cancel Stripe subscription during account deletion:", err);
        }
      }

      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) throw error;

      return res.status(200).json({ deleted: true });
    }

    res.setHeader("Allow", "GET, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    await sendError(res, err);
  }
};
