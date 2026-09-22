// The single source of truth for what each paid tier actually unlocks.
// Every gate in the API reads from here rather than testing plan strings
// inline, so a capability can never be granted in one endpoint and denied
// in another - the bug pattern that made "advanced exam-technique scoring"
// sellable on the pricing page while existing nowhere in the code.
//
// "pro" is the legacy single-tier plan name that predates this file. Any
// account still on it (including subscriptions created before the tier
// split) is treated as Premium, since that's what they were sold: unlimited
// submissions plus everything else that existed at the time.
const PLANS = {
  free: {
    label: "Free",
    monthlyCap: 3,
    maxLearners: 1,
    peerComparison: false,
    progressTrend: false,
    recentHistoryLimit: 10,
    deepFeedback: false,
    examTechnique: false,
  },
  core: {
    label: "Core",
    monthlyCap: Infinity,
    maxLearners: 1,
    peerComparison: true,
    progressTrend: true,
    recentHistoryLimit: 500,
    deepFeedback: false,
    examTechnique: false,
  },
  premium: {
    label: "Premium",
    monthlyCap: Infinity,
    maxLearners: 6,
    peerComparison: true,
    progressTrend: true,
    recentHistoryLimit: 500,
    deepFeedback: true,
    examTechnique: true,
  },
};

// Admin is a dev/QA bypass (see usage.js's ADMIN_EMAILS), not a sellable
// tier - it gets the most permissive capability set so internal testing
// never hits a gate, but it is deliberately not listed in PLANS so it can
// never be sold or assigned by the Stripe webhook.
function capabilitiesFor(plan) {
  if (plan === "admin") return { ...PLANS.premium, label: "Admin" };
  if (plan === "pro") return { ...PLANS.premium, label: "Pro (legacy)" };
  return PLANS[plan] || PLANS.free;
}

// Maps a Stripe Price ID back to the tier it sells. Returns null for an
// unrecognised price so the webhook can log rather than silently granting
// the wrong tier - a misconfigured env var should be loud, not generous.
function planForPriceId(priceId) {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_CORE) return "core";
  if (priceId === process.env.STRIPE_PRICE_ID_PREMIUM) return "premium";
  // The original single-tier env var, kept so an existing subscription
  // created against it keeps resolving after the tier split.
  if (priceId === process.env.STRIPE_PRICE_ID) return "premium";
  return null;
}

// Deliberately does NOT fall back to the legacy STRIPE_PRICE_ID the way
// planForPriceId does. That fallback is correct in the read direction (an
// old subscription must keep resolving to a tier), but wrong here: this
// picks the price a NEW checkout is charged at, and the legacy price is the
// old $14.99 single-tier one. Falling back would quietly sell Premium at
// $14.99 while the pricing page advertises $19.99 - a real customer charged
// a real, wrong amount. Returning null instead makes billing-session.js
// fail loudly with "set STRIPE_PRICE_ID_PREMIUM", which is a far better
// outcome than a silent mispricing nobody notices for weeks.
function priceIdForPlan(plan) {
  if (plan === "core") return process.env.STRIPE_PRICE_ID_CORE;
  if (plan === "premium") return process.env.STRIPE_PRICE_ID_PREMIUM;
  return null;
}

const PAID_PLANS = ["core", "premium"];

module.exports = { PLANS, PAID_PLANS, capabilitiesFor, planForPriceId, priceIdForPlan };
