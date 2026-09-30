const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const Stripe = require("stripe");
const { loadHandler, fakeRes, did } = require("./harness");
const { AUTH_EMAIL_ADDRESS } = require("../api/_lib/authEmails");

// One parent's whole billing life, start to finish, through the REAL sign-up-to-
// billing code: Free -> upgrade to Core -> switch to Premium -> card fails ->
// card fixed -> downgrade -> cancel. The outside world is stood in for (Stripe's
// servers, the database, the email sender) but every event is signed with a real
// Stripe signature and every step reads the state the previous step left behind.
// The steps the stand-ins cannot prove (a real card, Stripe's hosted pages) are
// listed in the backlog as the owner's own walkthrough.

const SECRET = "whsec_journey";
const SITE = "https://www.literacylabai.com";
const ENV = {
  SITE_URL: SITE, STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_ID_CORE: "price_core", STRIPE_PRICE_ID_PREMIUM: "price_premium",
  EMAIL_LIVE: "true", RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: AUTH_EMAIL_ADDRESS,
};

function withEnv(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; process.env[k] = vars[k]; }
  return Promise.resolve().then(fn).finally(() => { for (const k of Object.keys(vars)) { if (saved[k] == null) delete process.env[k]; else process.env[k] = saved[k]; } });
}

function signedReq(eventObj, secret = SECRET) {
  const payload = JSON.stringify(eventObj);
  const header = new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload, secret });
  const req = new EventEmitter();
  req.method = "POST";
  req.headers = { "stripe-signature": header };
  process.nextTick(() => { req.emit("data", Buffer.from(payload)); req.emit("end"); });
  return req;
}

// A parent's world: one profile row that every step reads and writes, a record of
// the Stripe calls made, and a record of the emails sent.
function newWorld() {
  const profile = { id: "user-1", email: "parent@example.com", plan: "free", stripe_customer_id: null, stripe_subscription_id: null };
  const stripeCalls = [];
  const mail = [];
  let subs = [];
  const db = (q) => {
    if (q.table === "profiles") {
      if (did(q, "update")) { Object.assign(profile, q.ops.find(([n]) => n === "update")[1]); return { data: null, error: null }; }
      return { data: { ...profile }, error: null };
    }
    if (q.table === "email_preferences" && !did(q, "upsert")) return { data: { unsubscribe_token: "11111111-2222-3333-4444-555555555555" }, error: null };
    if (q.table === "email_log" && did(q, "insert")) return { data: { id: "log" }, error: null };
    return { data: null, count: 0, error: null };
  };
  const stripe = {
    webhooks: new Stripe("sk_test_dummy").webhooks,
    customers: { create: async () => { stripeCalls.push("customer"); return { id: "cus_1" }; } },
    checkout: { sessions: { create: async (a) => { stripeCalls.push("checkout:" + a.line_items[0].price); return { url: "https://checkout.stripe.com/c/x" }; } } },
    billingPortal: { sessions: { create: async () => { stripeCalls.push("portal"); return { url: "https://billing.stripe.com/p/x" }; } } },
    subscriptions: {
      list: async () => ({ data: subs }),
      retrieve: async () => subs[0],
    },
  };
  return { profile, stripeCalls, mail, db, stripe, setSubs: (s) => { subs = s; } };
}

const sub = (status, price, extra = {}) => ({ id: "sub_1", customer: "cus_1", status, items: { data: [{ price: { id: price } }] }, ...extra });

async function clickUpgrade(w, tier) {
  const h = loadHandler("billing-session.js", { stripe: w.stripe, db: w.db });
  const res = fakeRes();
  await h({ method: "POST", query: {}, headers: {}, body: { tier } }, res);
  return res;
}

async function stripeSends(w, eventObj, secret = SECRET) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { w.mail.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ id: "re" }) }; };
  try {
    const h = loadHandler("stripe-webhook.js", { stripe: w.stripe, db: w.db });
    const res = fakeRes();
    await h(signedReq(eventObj, secret), res);
    return res;
  } finally { globalThis.fetch = realFetch; }
}

test("journey: sign up, upgrade, switch plan, fail a payment, recover, downgrade and cancel", async () => {
  await withEnv(ENV, async () => {
    const w = newWorld();

    // 1. A new parent is on Free, and clicking Upgrade to Core creates a customer and a Core checkout.
    assert.equal(w.profile.plan, "free");
    let res = await clickUpgrade(w, "core");
    assert.equal(res.statusCode, 200);
    assert.match(res.body.url, /checkout\.stripe\.com/);
    assert.deepEqual(w.stripeCalls, ["customer", "checkout:price_core"], "a Core checkout on the Core price, with one customer made");
    assert.equal(w.profile.stripe_customer_id, "cus_1", "the customer is remembered so a later checkout reuses it");

    // 2. Checkout completes: Stripe tells us, the plan becomes Core, and the welcome email goes.
    w.setSubs([sub("active", "price_core")]);
    res = await stripeSends(w, { id: "evt_1", type: "checkout.session.completed", data: { object: { mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: "user-1" } } });
    assert.equal(res.statusCode, 200);
    assert.equal(w.profile.plan, "core");
    assert.equal(w.profile.stripe_subscription_id, "sub_1");
    assert.equal(w.mail.length, 1, "one welcome email");

    // 3. A Core parent who clicks the billing button goes to the portal, never to a second checkout.
    w.stripeCalls.length = 0;
    res = await clickUpgrade(w, "premium");
    assert.match(res.body.url, /billing\.stripe\.com/);
    assert.deepEqual(w.stripeCalls, ["portal"]);

    // 4. They switch to Premium in the portal: the plan follows the price.
    w.setSubs([sub("active", "price_premium")]);
    res = await stripeSends(w, { id: "evt_2", type: "customer.subscription.updated", data: { object: sub("active", "price_premium"), previous_attributes: { items: {} } } });
    assert.equal(res.statusCode, 200);
    assert.equal(w.profile.plan, "premium");

    // 5. The card fails: no grace period, straight to Free, and they are told.
    const mailBefore = w.mail.length;
    w.setSubs([sub("past_due", "price_premium")]);
    res = await stripeSends(w, { id: "evt_3", type: "customer.subscription.updated", data: { object: sub("past_due", "price_premium", { current_period_end: 1790000000 }), previous_attributes: { status: "active" } } });
    assert.equal(w.profile.plan, "free");
    assert.equal(w.profile.stripe_subscription_id, null);
    assert.ok(w.mail.length > mailBefore && /payment/.test(w.mail[w.mail.length - 1].subject), "they get the payment email");

    // 6. On Free with a failing subscription, Upgrade sends them to fix the card, not to start a second subscription.
    w.stripeCalls.length = 0;
    res = await clickUpgrade(w, "premium");
    assert.match(res.body.url, /billing\.stripe\.com/);
    assert.deepEqual(w.stripeCalls, ["portal"], "no second checkout while one is past due");

    // 7. The card is fixed and the payment goes through: Premium comes back by itself, with no email.
    const mailMid = w.mail.length;
    w.setSubs([sub("active", "price_premium")]);
    res = await stripeSends(w, { id: "evt_4", type: "customer.subscription.updated", data: { object: sub("active", "price_premium"), previous_attributes: { status: "past_due" } } });
    assert.equal(w.profile.plan, "premium");
    assert.equal(w.profile.stripe_subscription_id, "sub_1");
    assert.equal(w.mail.length, mailMid, "a recovery sends nothing");

    // 8. They downgrade to Core, then cancel: Free at the end, and the cancellation email goes.
    w.setSubs([sub("active", "price_core")]);
    await stripeSends(w, { id: "evt_5", type: "customer.subscription.updated", data: { object: sub("active", "price_core") } });
    assert.equal(w.profile.plan, "core");
    const mailEnd = w.mail.length;
    w.setSubs([sub("canceled", "price_core")]);
    res = await stripeSends(w, { id: "evt_6", type: "customer.subscription.deleted", data: { object: sub("canceled", "price_core") } });
    assert.equal(res.statusCode, 200);
    assert.equal(w.profile.plan, "free");
    assert.equal(w.profile.stripe_subscription_id, null);
    assert.ok(w.mail.length > mailEnd, "cancellation is confirmed by email");

    // 9. After cancelling, Upgrade starts a fresh checkout on the SAME customer (no duplicate customer).
    w.setSubs([sub("canceled", "price_core")]);
    w.stripeCalls.length = 0;
    res = await clickUpgrade(w, "core");
    assert.match(res.body.url, /checkout\.stripe\.com/);
    assert.deepEqual(w.stripeCalls, ["checkout:price_core"], "the existing customer is reused");
  });
});

test("journey: a forged or wrongly-signed event never changes anyone's plan or sends an email", async () => {
  await withEnv(ENV, async () => {
    const w = newWorld();
    w.profile.plan = "core";
    w.profile.stripe_customer_id = "cus_1";
    w.profile.stripe_subscription_id = "sub_1";
    const res = await stripeSends(w, { id: "evt_x", type: "customer.subscription.deleted", data: { object: sub("canceled", "price_core") } }, "whsec_someone_else");
    assert.equal(res.statusCode, 400);
    assert.equal(w.profile.plan, "core", "the plan is untouched");
    assert.equal(w.mail.length, 0, "and nobody is emailed");
  });
});

test("journey: Stripe re-delivering the same event (it does, often) leaves the plan where it was and does not error", async () => {
  await withEnv(ENV, async () => {
    const w = newWorld();
    w.profile.stripe_customer_id = "cus_1";
    w.setSubs([sub("active", "price_premium")]);
    const evt = { id: "evt_dup", type: "customer.subscription.updated", data: { object: sub("active", "price_premium") } };
    for (let i = 0; i < 3; i++) {
      const res = await stripeSends(w, evt);
      assert.equal(res.statusCode, 200);
      assert.equal(w.profile.plan, "premium");
    }
  });
});

test("journey: a subscription on a price we do not recognise is reported as a failure, never quietly granted Premium", async () => {
  await withEnv(ENV, async () => {
    const w = newWorld();
    w.profile.stripe_customer_id = "cus_1";
    const res = await stripeSends(w, { id: "evt_odd", type: "customer.subscription.updated", data: { object: sub("active", "price_unknown") } });
    assert.equal(res.statusCode, 500, "Stripe is told it failed so it retries and we are alerted");
    assert.equal(w.profile.plan, "free", "nobody is given a plan by mistake");
  });
});
