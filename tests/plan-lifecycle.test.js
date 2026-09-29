const test = require("node:test");
const assert = require("node:assert/strict");
const { capabilitiesFor } = require("../api/_lib/plans");
const { did, loadHandler, call } = require("./harness");

// The rest of what a customer on each plan can do that isn't feedback:
// leaving (the "cancel anytime" promise), taking their data with them,
// rating feedback, and the things the pricing table says are free on every
// plan - the vocabulary quiz and the skill breakdown.

const PLANS = ["free", "core", "premium", "pro", "admin"];
const COUNTRY = "🇬🇧 United Kingdom";

// ------------------------------------------------------------------ Leaving: export and delete

function accountDb(profile) {
  return (q) => {
    if (q.table === "profiles") return { data: profile, error: null };
    return { data: [], error: null };
  };
}

for (const plan of PLANS) {
  test(`export: ${plan} - the account's data downloads as a file, whatever the plan`, async () => {
    const h = loadHandler("account.js", { plan, db: accountDb({ id: "user-1", email: "parent@example.com", plan, created_at: "2026-09-01" }) });
    const res = await call(h);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Content-Disposition"], /attachment; filename="literacylab-data-export-user-1\.json"/);
    const data = JSON.parse(res.body);
    assert.equal(data.account.plan, plan);
    for (const key of ["children", "submissions", "commitments"]) assert.ok(Array.isArray(data[key]), key);
  });
}

test("delete: a Free account with no subscription is deleted without touching Stripe", async () => {
  const deleted = [];
  let stripeTouched = false;
  const h = loadHandler("account.js", {
    plan: "free",
    db: accountDb({ stripe_subscription_id: null }),
    stripe: new Proxy({}, { get() { stripeTouched = true; return () => {}; } }),
    supabaseExtras: { auth: { admin: { deleteUser: async (id) => { deleted.push(id); return { error: null }; } } } },
  });
  const res = await call(h, { method: "DELETE" });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { deleted: true });
  assert.deepEqual(deleted, ["user-1"]);
  assert.equal(stripeTouched, false, "Stripe was called for an account that never subscribed");
});

for (const plan of ["core", "premium", "pro"]) {
  test(`delete: ${plan} - the subscription is cancelled BEFORE the account goes, so nobody is billed after deleting`, async () => {
    const order = [];
    const h = loadHandler("account.js", {
      plan,
      db: accountDb({ stripe_subscription_id: "sub_123" }),
      stripe: { subscriptions: { cancel: async (id) => { order.push("cancel:" + id); return {}; } } },
      supabaseExtras: { auth: { admin: { deleteUser: async () => { order.push("delete"); return { error: null }; } } } },
    });
    const res = await call(h, { method: "DELETE" });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(order, ["cancel:sub_123", "delete"]);
  });
}

test("delete: if Stripe can't cancel, the account is still deleted (and the failure is logged, not swallowed silently)", async () => {
  const logged = [];
  const realError = console.error;
  console.error = (...a) => logged.push(a.join(" "));
  try {
    const deleted = [];
    const h = loadHandler("account.js", {
      plan: "premium",
      db: accountDb({ stripe_subscription_id: "sub_123" }),
      stripe: { subscriptions: { cancel: async () => { throw new Error("stripe is down"); } } },
      supabaseExtras: { auth: { admin: { deleteUser: async (id) => { deleted.push(id); return { error: null }; } } } },
    });
    const res = await call(h, { method: "DELETE" });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(deleted, ["user-1"]);
    assert.ok(logged.some((l) => /Stripe subscription/.test(l)), "the cancel failure wasn't logged");
  } finally { console.error = realError; }
});

test("delete: a failed deletion is reported, not claimed as done", async () => {
  const h = loadHandler("account.js", {
    plan: "free",
    db: accountDb({ stripe_subscription_id: null }),
    supabaseExtras: { auth: { admin: { deleteUser: async () => ({ error: new Error("db locked") }) } } },
  });
  const res = await call(h, { method: "DELETE" });
  assert.equal(res.statusCode, 500);
  assert.notDeepEqual(res.body, { deleted: true });
});

test("account: other methods are refused", async () => {
  const h = loadHandler("account.js", { plan: "free", db: accountDb({}) });
  assert.equal((await call(h, { method: "PUT" })).statusCode, 405);
});

// ------------------------------------------------------------------ Rating feedback (thumbs up / down)

function ratingDb({ owns = true, inserted = [] } = {}) {
  return (q) => {
    if (q.table === "submissions") return { data: owns ? { id: "sub1" } : null, error: owns ? null : { message: "none" } };
    if (q.table === "commitments" && did(q, "insert")) {
      inserted.push(q.ops.find(([n]) => n === "insert")[1]);
      return { data: { id: "r1", ...inserted[inserted.length - 1] }, error: null };
    }
    return { data: null, error: null };
  };
}

for (const plan of PLANS) {
  test(`rating: ${plan} - a thumbs-down with a comment is saved against the learner's own submission`, async () => {
    const inserted = [];
    const h = loadHandler("commit.js", { plan, db: ratingDb({ inserted }) });
    const res = await call(h, { method: "POST", body: { submissionId: "sub1", helpfulRating: "down", feedbackText: "It missed the point." } });
    assert.equal(res.statusCode, 200);
    assert.equal(inserted[0].helpful_rating, "down");
    assert.equal(inserted[0].feedback_text, "It missed the point.");
    assert.equal(inserted[0].profile_id, "user-1");
  });
}

test("rating: only up or down is accepted, comments are length-limited, and a missing submission id is refused", async () => {
  const h = loadHandler("commit.js", { plan: "free", db: ratingDb() });
  assert.equal((await call(h, { method: "POST", body: { submissionId: "sub1", helpfulRating: "meh" } })).statusCode, 400);
  assert.equal((await call(h, { method: "POST", body: { submissionId: "sub1", helpfulRating: "up", feedbackText: "x".repeat(1001) } })).statusCode, 400);
  assert.equal((await call(h, { method: "POST", body: { helpfulRating: "up" } })).statusCode, 400);
  assert.equal((await call(h, { method: "GET" })).statusCode, 405);
});

test("rating: you can't rate someone else's submission", async () => {
  const inserted = [];
  const h = loadHandler("commit.js", { plan: "premium", db: ratingDb({ owns: false, inserted }) });
  const res = await call(h, { method: "POST", body: { submissionId: "not-mine", helpfulRating: "up" } });
  assert.equal(res.statusCode, 404);
  assert.equal(inserted.length, 0);
});

test("rating: the retired 'what will you try next time' action is no longer stored, even if a stale page sends it", async () => {
  const inserted = [];
  const h = loadHandler("commit.js", { plan: "core", db: ratingDb({ inserted }) });
  await call(h, { method: "POST", body: { submissionId: "sub1", helpfulRating: "up", chosenAction: "Use a fronted adverbial" } });
  assert.equal(inserted[0].chosen_action, undefined);
});

// ------------------------------------------------------------------ Free on every plan: vocabulary quiz and skill breakdown

const vocabRows = Array.from({ length: 8 }, (_, i) => ({
  id: `s${i}`, kind: "writing", tier: "elementary", country: COUNTRY, score: null, total_questions: null, word_count: 50,
  feedback: { vocab: [{ term: `term${i}a`, definition: `a definition for term ${i}a`, example: `an example using term${i}a` }, { term: `term${i}b`, definition: `a definition for term ${i}b`, example: `an example using term${i}b` }] },
  created_at: new Date(Date.UTC(2026, 8, 20) + i * 3600000).toISOString(),
}));

for (const plan of PLANS) {
  const hasBank = capabilitiesFor(plan).vocabBank !== false;

  test(`vocabulary: ${plan} - the self-test quiz is ${hasBank ? "available" : "refused (the bank is Core and Premium)"}`, async () => {
    const h = loadHandler("history.js", { plan, db: (q) => (q.table === "submissions" ? { data: vocabRows, error: null } : { data: null }) });
    const res = await call(h, { query: { childId: "c1", quiz: "1", count: "5" } });
    if (hasBank) {
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.questions.length, 5);
      for (const q of res.body.questions) assert.ok(q.options.length >= 2 && q.options.length <= 4);
    } else {
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.vocabLocked, true);
      assert.equal(res.body.questions, undefined);
    }
  });

  test(`vocabulary: ${plan} - the vocabulary bank is ${hasBank ? "returned" : "withheld"} with the dashboard data`, async () => {
    const h = loadHandler("history.js", { plan, db: (q) => (q.table === "submissions" ? { data: vocabRows, error: null } : { data: null }) });
    const res = await call(h, { query: { childId: "c1" } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.vocabWords.length, hasBank ? 16 : 0);
    assert.equal(res.body.vocabLocked, !hasBank);
  });

  test(`skill breakdown: ${plan} - mastery is served on every plan, scoped to the learner`, async () => {
    const log = [];
    const rows = [{ feedback: { glowTarget: "Fronted Adverbials", growTarget: "Modal Verbs" } }, { feedback: { glowTarget: "Fronted Adverbials", growTarget: "Fronted Adverbials" } }];
    const h = loadHandler("progress.js", { plan, log, db: (q) => (q.table === "submissions" ? { data: rows, error: null } : { data: null }) });
    const res = await call(h, { query: { tier: "elementary", country: COUNTRY, gradeLabel: "Year 4", childId: "c1" } });
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.targets.length > 0);
    const submissionsQuery = log.find((q) => q.table === "submissions");
    assert.ok(submissionsQuery.ops.some(([n, col, val]) => n === "eq" && col === "child_id" && val === "c1"), "not scoped to the learner");
  });
}

test("skill breakdown: missing query parameters are refused", async () => {
  const h = loadHandler("progress.js", { plan: "free" });
  assert.equal((await call(h, { query: { tier: "elementary" } })).statusCode, 400);
  assert.equal((await call(h, { query: { tier: "elementary", country: COUNTRY } })).statusCode, 400);
  assert.equal((await call(h, { method: "POST" })).statusCode, 405);
});

// ------------------------------------------------------------------ Capabilities are what the app is told

test("usage: Free tells the app there's a cap; paid plans report none (Infinity serialises to null)", async () => {
  for (const [plan, hasCap] of [["free", true], ["core", false], ["premium", false], ["pro", false], ["admin", false]]) {
    const h = loadHandler("usage.js", { plan, used: 1 });
    const res = await call(h);
    assert.equal(Number.isFinite(res.body.cap), hasCap, `${plan}: cap ${res.body.cap}`);
    assert.equal(res.body.capabilities.monthlyCap === capabilitiesFor(plan).monthlyCap, true);
  }
});

// ------------------------------------------------------------------ Old work vs. new plan rules

// Pieces written before the score became Premium-only still have one stored.
// Whether it shows must follow the plan the account is on NOW.
const scoredRows = Array.from({ length: 3 }, (_, i) => ({
  id: `w${i}`, kind: "writing", tier: "middle", country: COUNTRY, score: null, total_questions: null, word_count: 120,
  feedback: { glow: "Nice work.", overallScore: 7, scoreReason: "Clear structure." },
  created_at: new Date(Date.UTC(2026, 8, 20) + i * 86400000).toISOString(),
}));

for (const [plan, shows] of [["free", false], ["core", false], ["premium", true], ["pro", true], ["admin", true]]) {
  test(`history: ${plan} - an old stored score ${shows ? "is" : "is NOT"} shown in the activity list`, async () => {
    const h = loadHandler("history.js", { plan, db: (q) => (q.table === "submissions" ? { data: scoredRows, error: null } : { data: null }) });
    const res = await call(h, { query: { childId: "c1" } });
    assert.equal(res.statusCode, 200);
    for (const row of res.body.recent) assert.equal(row.overallScore, shows ? 7 : null);
  });
}

test("ranking: the year-group comparison is built from skill tags every plan produces, not the Premium-only score", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "api", "_lib", "cohortScoring.js"), "utf8");
  assert.ok(!/overallScore|spellingGrammar/.test(source), "cohort ranking would degrade for Core, which has ranking but not the score");
});

// ------------------------------------------------------------------ Editing a learner (year, interests) on any plan

for (const plan of PLANS) {
  test(`profile edit: ${plan} - changing the year is saved, and nothing but learner settings can be written`, async () => {
    const updates = [];
    const h = loadHandler("child-profile.js", {
      plan,
      db: (q) => {
        if (q.table === "child_profiles" && did(q, "update")) {
          const patch = q.ops.find(([n]) => n === "update")[1];
          updates.push(patch);
          return { data: { id: "c1", ...patch }, error: null };
        }
        return { data: null, error: null };
      },
    });
    const res = await call(h, { method: "POST", body: { childId: "c1", grade_idx: 7, interests: ["space", "gaming"], plan: "premium", profile_id: "someone-else", id: "hijack", stripe_customer_id: "cus_x" } });
    assert.equal(res.statusCode, 200);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].grade_idx, 7);
    assert.deepEqual(updates[0].interests, ["space", "gaming"]);
    for (const forbidden of ["plan", "profile_id", "id", "stripe_customer_id"]) {
      assert.equal(forbidden in updates[0], false, `a client could write ${forbidden} through the learner profile`);
    }
  });
}

test("profile edit: it is scoped to the account's own learners", async () => {
  const seen = [];
  const h = loadHandler("child-profile.js", {
    plan: "core",
    db: (q) => { if (q.table === "child_profiles" && did(q, "update")) seen.push(q.ops.filter(([n]) => n === "eq")); return { data: null, error: null }; },
  });
  const res = await call(h, { method: "POST", body: { childId: "not-mine", grade_idx: 3 } });
  assert.equal(res.statusCode, 404);
  assert.ok(seen[0].some(([, col, val]) => col === "profile_id" && val === "user-1"), "the update wasn't restricted to this account's learners");
});
