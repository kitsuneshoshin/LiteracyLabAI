const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { getStripe } = require("./_lib/stripe");
const { captureIfUnexpected } = require("./_lib/sentry");

// Stripe signs the raw request body, so we must verify against the exact
// bytes Stripe sent — not Vercel's auto-parsed/re-serialized JSON, which
// would fail signature verification. This disables that auto-parsing for
// this one function only.
module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// This is the ONLY place profiles.plan actually changes for Pro - the
// Checkout/Portal endpoints just redirect to Stripe's own pages. Stripe is
// the source of truth for subscription state; we just mirror it here.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set in Vercel project env vars.");
    return res.status(500).json({ error: "Webhook secret not configured." });
  }

  let event;
  try {
    const stripe = getStripe();
    const rawBody = await getRawBody(req);
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature." });
  }

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      // Fires once, right after a successful Checkout - the fastest signal
      // that a new subscription should unlock Pro.
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const userId = session.client_reference_id || (session.metadata && session.metadata.supabase_user_id);
          if (userId) {
            const { error } = await supabase.from("profiles").update({
              plan: "pro",
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            }).eq("id", userId);
            if (error) throw error;
          }
        }
        break;
      }
      // Fires on every later change - renewal, plan change, payment
      // failure, or cancellation - so this is what keeps plan accurate
      // for the whole lifetime of the subscription, not just at signup.
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const active = subscription.status === "active" || subscription.status === "trialing";
        const { error } = await supabase.from("profiles").update({
          plan: active ? "pro" : "free",
          stripe_subscription_id: active ? subscription.id : null,
        }).eq("stripe_customer_id", subscription.customer);
        if (error) throw error;
        break;
      }
      default:
        break; // Every other event type is intentionally ignored.
    }
  } catch (err) {
    console.error("Error handling Stripe webhook event:", event.type, err);
    // A silently failing webhook means a paying customer's plan never
    // flips to Pro (or never flips back on cancellation) - worth alerting
    // on immediately rather than waiting for them to notice and complain.
    captureIfUnexpected(err);
    return res.status(500).json({ error: "Webhook handler failed." });
  }

  return res.status(200).json({ received: true });
};
