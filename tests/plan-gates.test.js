const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { capabilitiesFor } = require("../api/_lib/plans");

// End-to-end checks of what the pricing table promises, per plan, run
// against the REAL endpoint handlers. plans.test.js proves the capability
// table itself is right; these prove each endpoint actually enforces it.
// Only the outside world is stood in for: the database, Stripe, the AI model
// and the logged-in user. Everything the plan decides runs for real.

const ROOT = path.join(__dirname, "..");
const lib = (p) => path.join(ROOT, "api", "_lib", p);

function stub(file, exports) {
  const id = require.resolve(file);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

// A stand-in for the Supabase client. Every query-builder call is recorded;
// awaiting the query asks `resolve` what the database would return.
function fakeSupabase(resolve, log = []) {
  return {
    from(table) {
      const q = { table, ops: [] };
      log.push(q);
      const chain = new Proxy({}, {
        get(_, prop) {
          if (prop === "then") {
            const result = resolve(q) || { data: null, error: null };
            return (ok, bad) => Promise.resolve(result).then(ok, bad);
          }
          return (...args) => { q.ops.push([prop, ...args]); return chain; };
        },
      });
      return chain;
    },
  };
}
const did = (q, op) => q.ops.some(([name]) => name === op);

function fakeRes() {
  const res = { statusCode: 200, body: undefined, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.end = () => res;
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

// Loads a handler fresh with the given plan, usage and database.
function loadHandler(name, { plan = "free", used = 0, db, log, stripe, generate } = {}) {
  const caps = capabilitiesFor(plan);
  stub(lib("auth.js"), {
    requireUser: async () => ({ id: "user-1", email: "parent@example.com" }),
    // Mirrors the real sendError: deliberate 4xx errors carry their code.
    sendError: async (res, err) => {
      const status = err.statusCode || 500;
      const body = { error: err.message };
      if (status < 500 && err.code) body.code = err.code;
      return res.status(status).json(body);
    },
  });
  stub(lib("usage.js"), {
    getMonthlyUsage: async () => ({ used, cap: caps.monthlyCap, plan, capabilities: caps }),
    FREE_MONTHLY_CAP: 3,
  });
  stub(lib("supabaseAdmin.js"), { getSupabaseAdmin: () => fakeSupabase(db || (() => ({ data: null })), log) });
  stub(lib("rateLimit.js"), { checkRateLimit: async () => {} });
  stub(lib("openai.js"), { generateFeedbackJSON: generate || (async () => ({ parsed: {}, modelUsed: "stub" })) });
  if (stripe) stub(lib("stripe.js"), { getStripe: () => stripe });
  const file = require.resolve(path.join(ROOT, "api", name));
  delete require.cache[file];
  return require(file);
}

async function call(handler, { method = "GET", query = {}, body } = {}) {
  const res = fakeRes();
  await handler({ method, query, body, headers: {} }, res);
  return res;
}

// ---------------------------------------------------------------- Submissions per month: 3 / Unlimited / Unlimited

test("Free: a 4th submission in the month is refused", async () => {
  const h = loadHandler("writing-prompt.js", { plan: "free", used: 3 });
  const res = await call(h, { method: "POST", body: { tier: "middle", country: "🇬🇧 United Kingdom", gradeLabel: "Year 9", childId: "c1" } });
  assert.equal(res.statusCode, 402);
});

for (const plan of ["core", "premium"]) {
  test(`${plan}: no monthly cap, even after 500 submissions`, async () => {
    // The learner lookup returns nothing, so a request that gets PAST the
    // cap stops at "learner not found" (404). A 402 would mean it was capped.
    const h = loadHandler("writing-prompt.js", { plan, used: 500, db: () => ({ data: null, error: null }) });
    const res = await call(h, { method: "POST", body: { tier: "middle", country: "🇬🇧 United Kingdom", gradeLabel: "Year 9", childId: "c1" } });
    assert.notEqual(res.statusCode, 402, `${plan} was capped`);
    assert.equal(res.statusCode, 404);
  });
}

// ---------------------------------------------------------------- Learners on one account: 1 / 1 / Up to 6

function learnerDb(existing) {
  return (q) => {
    if (q.table === "child_profiles" && did(q, "insert")) return { data: { id: "new-child" }, error: null };
    if (q.table === "child_profiles") return { data: null, count: existing, error: null };
    return { data: null };
  };
}

for (const plan of ["free", "core"]) {
  test(`${plan}: a second learner is refused, with Premium named as the fix`, async () => {
    const h = loadHandler("child-profile.js", { plan, db: learnerDb(1) });
    const res = await call(h, { method: "POST", body: { display_name: "Second" } });
    assert.equal(res.statusCode, 402);
    assert.equal(res.body.upgradeTo, "premium");
    assert.match(res.body.error, /Premium/);
  });
}

test("premium: learners 2 through 6 are allowed", async () => {
  for (const existing of [1, 5]) {
    const h = loadHandler("child-profile.js", { plan: "premium", db: learnerDb(existing) });
    const res = await call(h, { method: "POST", body: { display_name: "Next" } });
    assert.equal(res.statusCode, 200, `refused with ${existing} existing learners`);
  }
});

test("premium: a 7th learner is refused", async () => {
  const h = loadHandler("child-profile.js", { plan: "premium", db: learnerDb(6) });
  const res = await call(h, { method: "POST", body: { display_name: "Seventh" } });
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.upgradeTo, null);
});

// ---------------------------------------------------------------- Anonymous ranking: — / Yes / Yes

function cohortDb() {
  return (q) => {
    if (q.table === "child_profiles") return { data: { id: "c1" }, error: null };
    if (q.table === "submissions") return { data: [], error: null };
    return { data: null };
  };
}
const cohortQuery = { tier: "middle", country: "🇬🇧 United Kingdom", gradeLabel: "Year 9", childId: "c1" };

test("Free: the year-group ranking is withheld by the server, not just hidden", async () => {
  const log = [];
  const h = loadHandler("cohort-stats.js", { plan: "free", db: cohortDb(), log });
  const res = await call(h, { query: cohortQuery });
  assert.equal(res.statusCode, 402);
  assert.ok(!log.some((q) => q.table === "submissions"), "other families' submissions were read for a free account");
});

for (const plan of ["core", "premium"]) {
  test(`${plan}: the year-group ranking is served`, async () => {
    const h = loadHandler("cohort-stats.js", { plan, db: cohortDb() });
    const res = await call(h, { query: cohortQuery });
    assert.equal(res.statusCode, 200);
  });
}

// ---------------------------------------------------------------- Trend chart: — / Yes / Yes · History: Last 10 / Full / Full

function historyDb(n) {
  const rows = Array.from({ length: n }, (_, i) => ({
    id: `s${i}`, kind: "writing", tier: "middle", country: "UK", score: null, total_questions: null,
    word_count: 100, feedback: { glow: "Nice", glowTarget: "A", growTarget: "B" },
    created_at: new Date(Date.UTC(2026, 8, 25) - i * 86400000).toISOString(),
  }));
  return (q) => (q.table === "submissions" ? { data: rows, error: null } : { data: null });
}

test("Free: no trend chart, and activity history stops at the last 10", async () => {
  const h = loadHandler("history.js", { plan: "free", db: historyDb(40) });
  const res = await call(h, { query: { childId: "c1" } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.timeline, null);
  assert.equal(res.body.timelineLocked, true);
  assert.equal(res.body.recent.length, 10);
  // The headline stats are free on every plan.
  assert.equal(res.body.totalSubmissions, 40);
  assert.equal(res.body.wordsWritten, 4000);
});

for (const plan of ["core", "premium"]) {
  test(`${plan}: trend chart included and the full activity history returned`, async () => {
    const h = loadHandler("history.js", { plan, db: historyDb(40) });
    const res = await call(h, { query: { childId: "c1" } });
    assert.equal(res.body.timelineLocked, false);
    assert.ok(Array.isArray(res.body.timeline) && res.body.timeline.length > 0);
    assert.equal(res.body.recent.length, 40, "history was cut short on a paid plan");
  });
}

// ---------------------------------------------------------------- Extended feedback & exam technique: — / — / Yes

// Runs a real writing submission and captures the prompt sent to the AI.
async function promptFor(plan, tier, gradeLabel) {
  const prompts = [];
  const db = (q) => {
    if (q.table === "submissions" && did(q, "single")) {
      return { data: { id: "sub1", child_id: "c1", tier, country: "🇬🇧 United Kingdom", grade_label: gradeLabel, interest: "football", content: { generatedPrompt: { prompt: "Argue a point." } }, feedback: null }, error: null };
    }
    if (q.table === "submissions" && did(q, "is")) return { data: [{ id: "sub1" }], error: null }; // claim succeeds
    return { data: null, error: null };
  };
  const h = loadHandler("submit.js", {
    plan, db,
    generate: async (p) => { prompts.push(p); return { parsed: {}, modelUsed: "stub" }; },
  });
  await call(h, { method: "POST", body: { kind: "writing", submissionId: "sub1", text: "Football teaches teamwork because players rely on each other." } });
  return prompts[0] || "";
}

test("Free and Core: no exam-technique scoring and no second step are requested", async () => {
  for (const plan of ["free", "core"]) {
    const p = await promptFor(plan, "high", "Year 11");
    assert.ok(p.length > 0, "no prompt reached the AI");
    assert.ok(!p.includes("EXAM-TECHNIQUE SCORING"), `${plan} got exam technique`);
    assert.ok(!p.includes("growNext"), `${plan} got the second step`);
  }
});

test("Premium, age 11+: exam-technique scoring and the second step are both requested", async () => {
  const p = await promptFor("premium", "high", "Year 11");
  assert.ok(p.includes("EXAM-TECHNIQUE SCORING"));
  assert.ok(p.includes("growNext"));
});

test("Premium, under 11: the second step is given, exam technique is not (as the table's 'ages 11+' says)", async () => {
  const p = await promptFor("premium", "elementary", "Year 5");
  assert.ok(p.includes("growNext"));
  assert.ok(!p.includes("EXAM-TECHNIQUE SCORING"));
});

// ---------------------------------------------------------------- Buying and changing plans

function fakeStripe(overrides = {}) {
  const calls = [];
  return {
    calls,
    customers: { create: async () => { calls.push(["customers.create"]); return { id: "cus_new" }; } },
    checkout: { sessions: { create: async (args) => { calls.push(["checkout", args]); return { url: "https://checkout.stripe.test/s" }; } } },
    billingPortal: { sessions: { create: async (args) => { calls.push(["portal", args]); return { url: "https://portal.stripe.test/p" }; } } },
    ...overrides,
  };
}

function withPrices(fn) {
  return async () => {
    const saved = { ...process.env };
    Object.assign(process.env, { SITE_URL: "https://www.literacylabai.com", STRIPE_PRICE_ID_CORE: "price_core", STRIPE_PRICE_ID_PREMIUM: "price_premium" });
    try { await fn(); } finally { process.env = saved; }
  };
}

for (const [tier, price] of [["core", "price_core"], ["premium", "price_premium"]]) {
  test(`Choose ${tier}: checkout is opened for the ${tier} price`, withPrices(async () => {
    const stripe = fakeStripe();
    const h = loadHandler("billing-session.js", { plan: "free", stripe, db: (q) => (q.table === "profiles" && did(q, "single") ? { data: { plan: "free", stripe_customer_id: null }, error: null } : { data: null, error: null }) });
    const res = await call(h, { method: "POST", body: { tier } });
    assert.equal(res.statusCode, 200);
    const checkout = stripe.calls.find(([k]) => k === "checkout")[1];
    assert.deepEqual(checkout.line_items, [{ price, quantity: 1 }]);
    assert.equal(checkout.mode, "subscription");
    assert.match(checkout.success_url, /^https:\/\/www\.literacylabai\.com\//);
  }));
}

test("An existing subscriber goes to the portal to switch or cancel, not a second checkout", withPrices(async () => {
  for (const plan of ["core", "premium", "pro"]) {
    const stripe = fakeStripe();
    const h = loadHandler("billing-session.js", { plan, stripe, db: (q) => (q.table === "profiles" ? { data: { plan, stripe_customer_id: "cus_1" }, error: null } : { data: null }) });
    const res = await call(h, { method: "POST", body: { tier: "premium" } });
    assert.equal(res.statusCode, 200);
    assert.ok(stripe.calls.some(([k]) => k === "portal"), `${plan} was not sent to the portal`);
    assert.ok(!stripe.calls.some(([k]) => k === "checkout"), `${plan} was offered a second subscription`);
  }
}));

test("An unknown plan name is rejected, so nothing can be bought that isn't on sale", withPrices(async () => {
  const stripe = fakeStripe();
  const h = loadHandler("billing-session.js", { stripe, db: () => ({ data: { plan: "free", stripe_customer_id: null }, error: null }) });
  const res = await call(h, { method: "POST", body: { tier: "admin" } });
  assert.equal(res.statusCode, 400);
  assert.ok(!stripe.calls.some(([k]) => k === "checkout"));
}));

// ---------------------------------------------------------------- The webhook grants exactly what was paid for

function webhookReq(event) {
  const req = new EventEmitter();
  req.method = "POST";
  req.headers = { "stripe-signature": "t=1,v1=sig" };
  process.nextTick(() => { req.emit("data", Buffer.from(JSON.stringify(event))); req.emit("end"); });
  return req;
}

async function runWebhook(event, subscriptionForCheckout) {
  const updates = [];
  const saved = { ...process.env };
  Object.assign(process.env, { STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_PRICE_ID_CORE: "price_core", STRIPE_PRICE_ID_PREMIUM: "price_premium" });
  try {
    const stripe = {
      webhooks: { constructEvent: (raw) => JSON.parse(raw.toString()) },
      subscriptions: { retrieve: async () => subscriptionForCheckout },
    };
    const h = loadHandler("stripe-webhook.js", {
      stripe,
      db: (q) => { if (did(q, "update")) updates.push(q.ops.find(([n]) => n === "update")[1]); return { data: null, error: null }; },
    });
    const res = fakeRes();
    await h(webhookReq(event), res);
    return { res, updates };
  } finally { process.env = saved; }
}

const sub = (price, status = "active") => ({ id: "sub_1", customer: "cus_1", status, items: { data: [{ price: { id: price } }] } });

for (const [price, plan] of [["price_core", "core"], ["price_premium", "premium"]]) {
  test(`Paying for ${plan} grants exactly ${plan}`, async () => {
    const { res, updates } = await runWebhook(
      { type: "checkout.session.completed", data: { object: { mode: "subscription", subscription: "sub_1", customer: "cus_1", client_reference_id: "user-1" } } },
      sub(price)
    );
    assert.equal(res.statusCode, 200);
    assert.equal(updates[0].plan, plan);
  });
}

test("Upgrading Core to Premium in the portal switches the plan", async () => {
  const { updates } = await runWebhook({ type: "customer.subscription.updated", data: { object: sub("price_premium") } });
  assert.equal(updates[0].plan, "premium");
});

test("Cancelling drops the account back to Free", async () => {
  const { updates } = await runWebhook({ type: "customer.subscription.deleted", data: { object: sub("price_premium", "canceled") } });
  assert.equal(updates[0].plan, "free");
});

test("A payment for a price we don't sell is refused rather than granting a paid plan", async () => {
  const { res, updates } = await runWebhook({ type: "customer.subscription.updated", data: { object: sub("price_someone_elses") } });
  assert.equal(res.statusCode, 500);
  assert.equal(updates.length, 0);
});

// ---------------------------------------------------------------- After a downgrade: extra learners pause, work kept

// A family that had Premium with two learners, now on Core (one learner).
function downgradedFamilyDb({ activeChildId = null, activeChildSetAt = null, updates = [] } = {}) {
  const kids = [
    { id: "kid-older", display_name: "Older", created_at: "2026-09-01T00:00:00Z" },
    { id: "kid-younger", display_name: "Younger", created_at: "2026-09-02T00:00:00Z" },
  ];
  return (q) => {
    if (did(q, "update")) { updates.push({ table: q.table, set: q.ops.find(([n]) => n === "update")[1] }); return { data: null, error: null }; }
    if (q.table === "profiles") return { data: { active_child_id: activeChildId, active_child_set_at: activeChildSetAt }, error: null };
    if (q.table === "child_profiles" && did(q, "maybeSingle")) {
      const id = (q.ops.find(([n, col]) => n === "eq" && col === "id") || [])[2];
      return { data: kids.some((k) => k.id === id) ? { id } : null, error: null };
    }
    if (q.table === "child_profiles") return { data: kids, error: null };
    if (q.table === "submissions" && did(q, "insert")) return { data: { id: "reserved-1" }, error: null };
    return { data: null, error: null };
  };
}
const promptBody = (childId) => ({ tier: "middle", country: "🇬🇧 United Kingdom", gradeLabel: "Year 9", childId });

test("Core after a downgrade: the paused learner can't start new work, and the parent is told why", async () => {
  const h = loadHandler("writing-prompt.js", { plan: "core", used: 0, db: downgradedFamilyDb({ activeChildId: "kid-older" }) });
  const res = await call(h, { method: "POST", body: promptBody("kid-younger") });
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.code, "learner_locked");
  assert.match(res.body.error, /still saved/);
});

test("Core after a downgrade: the active learner carries on as normal", async () => {
  const h = loadHandler("writing-prompt.js", { plan: "core", used: 0, db: downgradedFamilyDb({ activeChildId: "kid-older" }) });
  const res = await call(h, { method: "POST", body: promptBody("kid-older") });
  assert.notEqual(res.body && res.body.code, "learner_locked");
  assert.notEqual(res.statusCode, 402);
});

test("Reading passages are paused the same way", async () => {
  const h = loadHandler("reading-passage.js", { plan: "core", used: 0, db: downgradedFamilyDb({ activeChildId: "kid-older" }) });
  const res = await call(h, { method: "POST", body: promptBody("kid-younger") });
  assert.equal(res.statusCode, 402);
  assert.equal(res.body.code, "learner_locked");
});

test("Upgrading back to Premium unlocks every learner", async () => {
  const h = loadHandler("writing-prompt.js", { plan: "premium", used: 0, db: downgradedFamilyDb({ activeChildId: "kid-older" }) });
  const res = await call(h, { method: "POST", body: promptBody("kid-younger") });
  assert.notEqual(res.body && res.body.code, "learner_locked");
});

test("The learner list tells the app which learner is paused, and keeps both learners' work visible", async () => {
  const h = loadHandler("child-profile.js", { plan: "core", db: downgradedFamilyDb({ activeChildId: "kid-younger" }) });
  const res = await call(h);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.profiles.length, 2, "a paused learner must still be listed");
  const byId = Object.fromEntries(res.body.profiles.map((p) => [p.id, p.locked]));
  assert.deepEqual(byId, { "kid-older": true, "kid-younger": false });
  assert.equal(res.body.maxLearners, 1);
});

test("The parent can choose the active learner the first time, any time", async () => {
  const updates = [];
  const h = loadHandler("child-profile.js", { plan: "core", db: downgradedFamilyDb({ updates }) });
  const res = await call(h, { method: "POST", body: { makeActive: true, childId: "kid-younger" } });
  assert.equal(res.statusCode, 200);
  assert.equal(updates[0].table, "profiles");
  assert.equal(updates[0].set.active_child_id, "kid-younger");
});

test("Switching the active learner again within 30 days is refused, so it can't stand in for Premium", async () => {
  const updates = [];
  const recently = new Date(Date.now() - 3 * 86400000).toISOString();
  const h = loadHandler("child-profile.js", { plan: "core", db: downgradedFamilyDb({ activeChildId: "kid-older", activeChildSetAt: recently, updates }) });
  const res = await call(h, { method: "POST", body: { makeActive: true, childId: "kid-younger" } });
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, "active_change_cooldown");
  assert.equal(updates.length, 0, "the active learner was changed anyway");
});

test("After 30 days the parent can switch again", async () => {
  const updates = [];
  const longAgo = new Date(Date.now() - 31 * 86400000).toISOString();
  const h = loadHandler("child-profile.js", { plan: "core", db: downgradedFamilyDb({ activeChildId: "kid-older", activeChildSetAt: longAgo, updates }) });
  const res = await call(h, { method: "POST", body: { makeActive: true, childId: "kid-younger" } });
  assert.equal(res.statusCode, 200);
  assert.equal(updates[0].set.active_child_id, "kid-younger");
});

test("A parent can't make someone else's child their active learner", async () => {
  const updates = [];
  const h = loadHandler("child-profile.js", { plan: "core", db: downgradedFamilyDb({ updates }) });
  const res = await call(h, { method: "POST", body: { makeActive: true, childId: "another-familys-kid" } });
  assert.equal(res.statusCode, 404);
  assert.equal(updates.length, 0);
});
