const test = require("node:test");
const assert = require("node:assert/strict");
const { PLANS, PAID_PLANS, capabilitiesFor, planForPriceId, priceIdForPlan } = require("../api/_lib/plans");

// The whole point of plans.js is that a capability can never be granted in
// one place and denied in another, so these tests assert the shape of the
// ladder itself rather than any one endpoint's behaviour.

test("free is strictly the most limited tier", () => {
  assert.equal(PLANS.free.monthlyCap, 3);
  assert.equal(PLANS.free.maxLearners, 1);
  assert.equal(PLANS.free.peerComparison, false);
  assert.equal(PLANS.free.progressTrend, false);
  assert.equal(PLANS.free.examTechnique, false);
});

test("each tier up is a superset - no capability is ever lost by paying more", () => {
  const order = ["free", "core", "premium"];
  const flags = ["peerComparison", "progressTrend", "deepFeedback", "examTechnique"];
  for (let i = 1; i < order.length; i++) {
    const lower = PLANS[order[i - 1]];
    const higher = PLANS[order[i]];
    for (const flag of flags) {
      assert.ok(!lower[flag] || higher[flag], `${order[i]} lost ${flag} that ${order[i - 1]} had`);
    }
    assert.ok(higher.monthlyCap >= lower.monthlyCap, `${order[i]} has a smaller monthly cap than ${order[i - 1]}`);
    assert.ok(higher.maxLearners >= lower.maxLearners, `${order[i]} allows fewer learners than ${order[i - 1]}`);
    assert.ok(higher.recentHistoryLimit >= lower.recentHistoryLimit);
  }
});

test("only Premium grants exam technique and multiple learners", () => {
  assert.equal(PLANS.core.examTechnique, false);
  assert.equal(PLANS.core.maxLearners, 1);
  assert.equal(PLANS.premium.examTechnique, true);
  assert.equal(PLANS.premium.maxLearners, 6);
});

test("legacy 'pro' accounts keep everything they were sold", () => {
  const pro = capabilitiesFor("pro");
  assert.equal(pro.monthlyCap, Infinity);
  assert.equal(pro.examTechnique, true);
  assert.equal(pro.maxLearners, 6);
});

test("an unknown or missing plan falls back to free, never to a paid tier", () => {
  for (const value of [undefined, null, "", "enterprise", "PRO", 42]) {
    assert.equal(capabilitiesFor(value).monthlyCap, 3, `capabilitiesFor(${String(value)}) should be free`);
    assert.equal(capabilitiesFor(value).examTechnique, false);
  }
});

test("admin is a QA bypass and is not sellable", () => {
  assert.equal(capabilitiesFor("admin").monthlyCap, Infinity);
  assert.ok(!("admin" in PLANS));
  assert.ok(!PAID_PLANS.includes("admin"));
});

test("planForPriceId maps each configured price to its own tier and nothing else", () => {
  const saved = { ...process.env };
  process.env.STRIPE_PRICE_ID_CORE = "price_core_test";
  process.env.STRIPE_PRICE_ID_PREMIUM = "price_premium_test";
  delete process.env.STRIPE_PRICE_ID;
  try {
    assert.equal(planForPriceId("price_core_test"), "core");
    assert.equal(planForPriceId("price_premium_test"), "premium");
    // An unrecognised price must NOT resolve to a tier - the webhook treats
    // null as a configuration error rather than silently granting access.
    assert.equal(planForPriceId("price_something_else"), null);
    assert.equal(planForPriceId(undefined), null);
    assert.equal(planForPriceId(""), null);
  } finally {
    process.env = saved;
  }
});

test("the pre-split STRIPE_PRICE_ID still resolves, so existing subscribers don't lose access", () => {
  const saved = { ...process.env };
  process.env.STRIPE_PRICE_ID = "price_legacy";
  delete process.env.STRIPE_PRICE_ID_CORE;
  delete process.env.STRIPE_PRICE_ID_PREMIUM;
  try {
    assert.equal(planForPriceId("price_legacy"), "premium");
    // ...but a NEW checkout must never be charged at the legacy price. That
    // price is the old $14.99 single tier; selling Premium at it while the
    // page says $19.99 would charge a real customer a real, wrong amount.
    // Failing loudly is the correct outcome here.
    assert.equal(priceIdForPlan("premium"), undefined);
  } finally {
    process.env = saved;
  }
});

test("priceIdForPlan never returns a price for a non-purchasable plan", () => {
  assert.equal(priceIdForPlan("free"), null);
  assert.equal(priceIdForPlan("admin"), null);
  assert.equal(priceIdForPlan("nonsense"), null);
});
