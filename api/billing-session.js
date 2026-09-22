const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getStripe } = require("./_lib/stripe");
const { PAID_PLANS, priceIdForPlan } = require("./_lib/plans");

// Merged from what used to be create-checkout-session.js and
// create-portal-session.js - Vercel's Hobby plan caps a deployment at 12
// serverless functions, and adding account.js (for account deletion/export)
// pushed the total over that limit. Both of these were single-purpose,
// low-traffic Stripe redirect endpoints, so combining them into one file
// keyed on the account's own plan (rather than trusting a client-chosen
// path) costs nothing functionally and buys back a function slot.
//
// Starts a Stripe-hosted Checkout flow for a free account, or opens the
// existing Stripe billing portal for a Pro account. We never touch card
// details ourselves in either case — both are a redirect to Stripe's own
// page, so no payment data passes through our servers or the browser.
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
      .from("profiles").select("plan, stripe_customer_id").eq("id", user.id).single();
    if (profileErr) throw profileErr;

    // An existing subscriber goes to Stripe's portal, where they can change
    // tier, update their card or cancel - we deliberately don't rebuild any
    // of that ourselves. Anyone on a paid plan qualifies, not just the
    // legacy "pro" value.
    const alreadySubscribed = profile.plan === "core" || profile.plan === "premium" || profile.plan === "pro";
    if (alreadySubscribed) {
      if (!profile.stripe_customer_id) {
        return res.status(404).json({ error: "No billing account found for this user yet." });
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${siteUrl}/app.html`,
      });
      return res.status(200).json({ url: session.url });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const tier = body.tier || "core";
    if (!PAID_PLANS.includes(tier)) {
      return res.status(400).json({ error: `Unknown plan: ${tier}` });
    }
    const priceId = priceIdForPlan(tier);
    if (!priceId) {
      const err = new Error(`No Stripe price configured for the ${tier} plan - set STRIPE_PRICE_ID_${tier.toUpperCase()} in Vercel project env vars.`);
      err.statusCode = 503;
      throw err;
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
