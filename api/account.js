const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { getStripe } = require("./_lib/stripe");
const { requireUser, sendError } = require("./_lib/auth");

// Merged export-data.js and delete-account.js into one file - Vercel's
// Hobby plan caps a deployment at 12 serverless functions, and having both
// as separate files pushed the total over that limit. They're both
// account-lifecycle actions on the same resource, so GET = export and
// DELETE = delete account is a natural single-file split, and costs
// nothing functionally.
module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      // Returns every piece of personal data this account holds, as one
      // JSON file the browser downloads. privacy.html promises this as a
      // self-service right ("export a copy... in a portable format, on
      // request"); this is the endpoint that actually backs that promise.
      const [{ data: profile }, { data: children }, { data: submissions }, { data: commitments }] = await Promise.all([
        supabase.from("profiles").select("id, email, plan, created_at").eq("id", user.id).maybeSingle(),
        supabase.from("child_profiles").select("*").eq("profile_id", user.id),
        supabase.from("submissions").select("*").eq("profile_id", user.id),
        supabase.from("commitments").select("*").eq("profile_id", user.id),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        account: profile || null,
        children: children || [],
        submissions: submissions || [],
        commitments: commitments || [],
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
