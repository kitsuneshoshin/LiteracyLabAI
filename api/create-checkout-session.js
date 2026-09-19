const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getStripe } = require("./_lib/stripe");

// Starts a Stripe-hosted Checkout flow for the Pro subscription. We never
// touch card details ourselves — Stripe Checkout is a redirect to their
// page, so no payment data ever passes through our servers or the browser.
module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed." });
    }

    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      const err = new Error("STRIPE_PRICE_ID is not set in Vercel project env vars.");
      err.statusCode = 503;
      throw err;
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
      .from("profiles").select("plan, stripe_customer_id").eq("id", user.id).single();
    if (profileErr) throw profileErr;
    if (profile.plan === "pro") {
      return res.status(409).json({ error: "This account already has an active Pro subscription." });
    }

    // Reuse the existing Stripe customer if this account has one (e.g. a
    // past cancelled subscription) instead of creating a duplicate.
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      const { error: updateErr } = await supabase
        .from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
      if (updateErr) throw updateErr;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/app.html?upgraded=1`,
      cancel_url: `${siteUrl}/app.html`,
      client_reference_id: user.id,
      subscription_data: { metadata: { supabase_user_id: user.id } },
      allow_promotion_codes: true,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    sendError(res, err);
  }
};
