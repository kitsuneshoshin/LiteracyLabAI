const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getStripe } = require("./_lib/stripe");

// Opens Stripe's own hosted billing portal so a Pro user can update their
// card, view invoices, or cancel — we don't build any of that ourselves.
module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed." });
    }

    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) {
      const err = new Error("SITE_URL is not set in Vercel project env vars.");
      err.statusCode = 503;
      throw err;
    }

    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();
    const stripe = getStripe();

    const { data: profile, error: profileErr } = await supabase
      .from("profiles").select("stripe_customer_id").eq("id", user.id).single();
    if (profileErr) throw profileErr;
    if (!profile.stripe_customer_id) {
      return res.status(404).json({ error: "No billing account found for this user yet." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${siteUrl}/app.html`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    sendError(res, err);
  }
};
