const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { cleanEvent, buildActivity, isOwner, EVENT_NAMES } = require("../api/_lib/activity");
const { loadHandler, call, did } = require("./harness");

// The usage log and the owner's activity report: what is stored (names and short values, never writing),
// who may read it, and that the report shows prompt, writing and feedback together.

const ROOT = path.join(__dirname, "..");

test("an event keeps only a known name and short, approved values; anything else is dropped", () => {
  assert.equal(cleanEvent({ name: "drop_table" }), null);
  assert.equal(cleanEvent({}), null);
  const ev = cleanEvent({ name: "prompt_generated", props: { kind: "writing", tier: "middle", interest: "coding", text: "my secret story", email: "a@b.c", view: "x".repeat(200) } });
  assert.equal(ev.name, "prompt_generated");
  assert.deepEqual(Object.keys(ev.props).sort(), ["interest", "kind", "tier", "view"]);
  assert.equal(ev.props.view.length, 40, "values are cut short");
  assert.ok(!JSON.stringify(ev).includes("secret"), "free text never gets through");
  assert.ok(EVENT_NAMES.includes("view"));
});

const NOW = new Date("2026-11-07T12:00:00Z");
const profiles = [
  { id: "p1", email: "alice@example.com", plan: "premium", created_at: "2026-10-01T00:00:00Z" },
  { id: "p2", email: "bob@example.com", plan: "free", created_at: "2026-10-02T00:00:00Z" },
];
const submissions = [
  { id: "s1", profile_id: "p1", kind: "writing", tier: "elementary", country: "UK", grade_label: "Year 5", interest: "coding", created_at: "2026-11-06T10:00:00Z", word_count: 120, model_used: "m",
    content: { text: "My story", generatedPrompt: { genre: "narrative", title: "T", prompt: "Write a story" } }, feedback: { glow: "Nice", grow: "More", vocab: [{ term: "x", definition: "y" }] } },
  { id: "s2", profile_id: "p2", kind: "writing", tier: "elementary", created_at: "2026-11-06T11:00:00Z", content: { generatedPrompt: { genre: "persuasive", title: "P", prompt: "Persuade" } }, feedback: null },
  { id: "s3", profile_id: "p2", kind: "reading", tier: "middle", created_at: "2026-11-06T12:00:00Z", score: 2, total_questions: 5, content: { answers: [0, 1], generatedPassage: { title: "G", skill: "inference", passage: "Text" } }, feedback: { glow: "ok" } },
  { id: "s4", profile_id: "p1", kind: "reading", tier: "middle", created_at: "2026-11-06T13:00:00Z", content: {}, feedback: null },
];
const events = [
  { profile_id: "p1", name: "view", props: { view: "workspace" }, created_at: "2026-11-06T09:00:00Z" },
  { profile_id: "p1", name: "view", props: { view: "dashboard" }, created_at: "2026-11-06T09:05:00Z" },
  { profile_id: "p2", name: "generate_failed", props: { status: "429" }, created_at: "2026-11-07T09:00:00Z" },
  { profile_id: "p2", name: "view", props: { view: "workspace" }, created_at: "2026-09-01T09:00:00Z" },
];

test("the report joins prompt, writing and feedback, and tells marked pieces from stopped ones", () => {
  const r = buildActivity({ events, submissions, profiles, now: NOW });
  const by = Object.fromEntries(r.submissions.map((s) => [s.id, s]));
  assert.equal(by.s1.status, "marked");
  assert.equal(by.s1.prompt.text, "Write a story");
  assert.equal(by.s1.written, "My story");
  assert.equal(by.s1.feedback.glow, "Nice");
  assert.equal(by.s2.status, "stopped", "a writing prompt that was never answered");
  assert.equal(by.s2.written, null);
  assert.equal(by.s3.status, "marked");
  assert.equal(by.s3.passage.text, "Text");
  assert.equal(by.s4.status, "stopped", "a reading passage that was never answered");
  assert.equal(r.totals.marked, 2);
  assert.equal(r.totals.stopped, 2);
  assert.match(by.s1.user, /^al…@example\.com$/, "the list shows a shortened address");
});

test("the report counts pages, problems and people, and ignores events older than the window", () => {
  const r = buildActivity({ events, submissions, profiles, now: NOW, days: 30 });
  assert.equal(r.totals.events, 3, "the September event is outside 30 days");
  assert.deepEqual(r.views.find((v) => v.label === "workspace"), { label: "workspace", count: 1 });
  assert.deepEqual(r.failures, [{ label: "generate_failed (429)", count: 1 }]);
  assert.equal(r.totals.paid, 1);
  const p2 = r.users.find((u) => u.userId === "p2");
  assert.equal(p2.reading, 1);
  assert.equal(p2.stopped, 1);
  assert.deepEqual(r.genres.map((g) => g.label).sort(), ["narrative", "persuasive"]);
  assert.deepEqual(r.interests, [{ label: "coding", count: 1 }]);
});

// ---- the endpoints

const res0 = () => ({ statusCode: 200, body: undefined, headers: {} });
async function hit({ query, method = "POST", body = {}, bearer = "Bearer user-token", owner = "", count = 0, log = [] } = {}) {
  const saved = process.env.ACTIVITY_OWNER_EMAIL;
  process.env.ACTIVITY_OWNER_EMAIL = owner;
  try {
    const db = (q) => {
      if (q.table === "usage_events" && did(q, "insert")) { log.push(q.ops.find(([n]) => n === "insert")[1]); return { data: null, error: null }; }
      if (q.table === "usage_events") return { data: events, count, error: null };
      if (q.table === "submissions") return { data: submissions, error: null };
      if (q.table === "profiles") return { data: profiles, error: null };
      return { data: null, error: null };
    };
    return await call(loadHandler("email.js", { db }), { method, query, body, headers: bearer ? { authorization: bearer } : {} });
  } finally { if (saved == null) delete process.env.ACTIVITY_OWNER_EMAIL; else process.env.ACTIVITY_OWNER_EMAIL = saved; }
}

test("event endpoint: a signed-in person's event is saved against their account with only the approved values", async () => {
  const log = [];
  const r = await hit({ query: { action: "event" }, body: { name: "vocab_quiz", props: { kind: "reading", text: "nope" }, childId: "11111111-2222-3333-4444-555555555555" }, log });
  assert.equal(r.statusCode, 204);
  assert.equal(log.length, 1);
  assert.equal(log[0].profile_id, "user-1");
  assert.equal(log[0].name, "vocab_quiz");
  assert.deepEqual(log[0].props, { kind: "reading" });
  assert.equal(log[0].child_id, "11111111-2222-3333-4444-555555555555");
});

test("event endpoint: unknown names, a flood from one account, and a bad child id are handled quietly", async () => {
  const log = [];
  assert.equal((await hit({ query: { action: "event" }, body: { name: "bogus" }, log })).statusCode, 204);
  assert.equal((await hit({ query: { action: "event" }, body: { name: "view", props: { view: "plan" } }, count: 60, log })).statusCode, 204);
  assert.equal(log.length, 0, "neither was stored");
  await hit({ query: { action: "event" }, body: { name: "view", childId: "not-a-uuid" }, log });
  assert.equal(log[0].child_id, null);
  assert.equal((await hit({ query: { action: "event" }, method: "GET" })).statusCode, 405);
});

test("owner check: only the one confirmed owner address passes", () => {
  const saved = process.env.ACTIVITY_OWNER_EMAIL;
  process.env.ACTIVITY_OWNER_EMAIL = "Owner@Example.com";
  try {
    assert.equal(isOwner({ email: "owner@example.com", email_confirmed_at: "2026-01-01" }), true);
    assert.equal(isOwner({ email: "owner@example.com" }), false, "an unconfirmed address is refused");
    assert.equal(isOwner({ email: "other@example.com", email_confirmed_at: "2026-01-01" }), false);
    assert.equal(isOwner(null), false);
    delete process.env.ACTIVITY_OWNER_EMAIL;
    assert.equal(isOwner({ email: "kitsune.shoshin@gmail.com", email_confirmed_at: "2026-01-01" }), true, "default owner");
  } finally { if (saved == null) delete process.env.ACTIVITY_OWNER_EMAIL; else process.env.ACTIVITY_OWNER_EMAIL = saved; }
});

test("activity endpoint: only the owner can read it - not another signed-in user, not an ADMIN_EMAILS admin, not the cron secret", async () => {
  assert.equal((await hit({ query: { action: "activity" }, method: "GET", owner: "boss@example.com" })).statusCode, 401, "a signed-in non-owner");
  const savedAdmin = process.env.ADMIN_EMAILS, savedSecret = process.env.CRON_SECRET;
  process.env.ADMIN_EMAILS = "parent@example.com"; process.env.CRON_SECRET = "s3cret";
  try {
    assert.equal((await hit({ query: { action: "activity" }, method: "GET", owner: "boss@example.com" })).statusCode, 401, "an ADMIN_EMAILS admin who is not the owner");
    assert.equal((await hit({ query: { action: "activity" }, method: "GET", bearer: "Bearer s3cret", owner: "boss@example.com" })).statusCode, 401, "the cron secret");
  } finally {
    if (savedAdmin == null) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = savedAdmin;
    if (savedSecret == null) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedSecret;
  }
  const ok = await hit({ query: { action: "activity" }, method: "GET", owner: "Parent@Example.com" });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.submissions.length, 4);
  assert.equal(ok.body.totals.accounts, 2);
  assert.equal((await hit({ query: { action: "activity" }, method: "POST", owner: "parent@example.com" })).statusCode, 405);
});

// ---- wiring

test("wiring: the table exists in the schema with RLS on, /admin is routed, the page is hidden from search, and the function limit holds", () => {
  const schema = fs.readFileSync(path.join(ROOT, "supabase", "schema.sql"), "utf8");
  assert.match(schema, /create table if not exists public\.usage_events/);
  assert.match(schema, /alter table public\.usage_events enable row level security/);
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  assert.ok(vercel.rewrites.some((r) => r.source === "/admin" && r.destination === "/admin.html"));
  const page = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
  assert.match(page, /noindex/);
  assert.ok(!/innerHTML/.test(page), "what children wrote is only ever inserted as text");
  assert.ok(!fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8").includes("admin"));
  assert.ok(fs.readdirSync(path.join(ROOT, "api")).filter((f) => f.endsWith(".js")).length <= 12);
});

test("wiring: the app logs the key moments with the shared helper, and sends it no free text", () => {
  const app = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
  for (const name of ["app_open", "view", "prompt_generated", "passage_generated", "generate_failed", "submit_failed", "vocab_cards", "vocab_quiz", "feedback_rated"]) {
    assert.ok(app.includes(`logEvent("${name}"`), `${name} is not logged`);
    assert.ok(EVENT_NAMES.includes(name), `${name} is not on the server's list`);
  }
  const allowed = new Set(["view", "kind", "tier", "interest", "status", "rating"]);
  for (const m of app.matchAll(/logEvent\("[a-z_]+", (\{[^}]*\})/g)) {
    for (const k of [...m[1].matchAll(/([a-zA-Z_]+):/g)].map((x) => x[1])) assert.ok(allowed.has(k), `logEvent sends an unapproved field "${k}"`);
  }
});

// ---- the learner's Dashboard, as the parent sees it

const { buildLearnerDashboard } = require("../api/_lib/learnerDashboard");
const { targetsForGrade } = require("../api/_lib/masteryTargets");

const UK = "🇬🇧 United Kingdom";
const defs = targetsForGrade(UK, "Year 5", "elementary").targets;
const today = new Date().toISOString();
const dsubs = [
  { id: "a", kind: "writing", tier: "elementary", country: UK, grade_label: "Year 5", word_count: 120, score: null, total_questions: null, created_at: today, feedback: { glowTarget: defs[0].name, growTarget: defs[1].name, vocab: [{ term: "Clue", definition: "A hint" }] } },
  { id: "b", kind: "writing", tier: "elementary", country: UK, grade_label: "Year 5", word_count: 80, created_at: today, feedback: { glowTarget: defs[0].name, growTarget: defs[1].name, vocab: [{ term: "clue", definition: "dupe" }, { term: "plot", definition: "story line" }] } },
  { id: "c", kind: "reading", tier: "elementary", country: UK, grade_label: "Year 5", score: 3, total_questions: 5, created_at: today, feedback: { glowTarget: defs[0].name } },
  { id: "d", kind: "writing", tier: "elementary", country: UK, grade_label: "Year 5", word_count: null, created_at: today, feedback: null },
];

test("dashboard: snapshot, mastery, vocabulary and locks are worked out like the parent's own page", () => {
  const d = buildLearnerDashboard({ child: { id: "kid", display_name: "Mia", interests: ["coding"] }, submissions: dsubs, cohortRows: [], capabilities: { progressTrend: false, peerComparison: false, vocabBank: false, recentHistoryLimit: 10 }, vocabProgress: { plot: { box: 2, at: 1 } } });
  assert.equal(d.snapshot.wordsWritten, 200);
  assert.equal(d.snapshot.writingPieces, 2);
  assert.equal(d.snapshot.avgReadingScore, 60);
  assert.equal(d.snapshot.activeStreak, 1);
  assert.equal(d.snapshot.stopped, 1, "the writing prompt that was never answered");
  const first = d.mastery.targets.find((t) => t.name === defs[0].name);
  assert.equal(first.pct, 100, "three glows, no grows");
  assert.equal(d.mastery.targets.find((t) => t.name === defs[1].name).pct, 0);
  assert.equal(d.vocab.total, 2, "a repeated word is listed once");
  assert.equal(d.vocab.words.find((w) => w.term === "plot").box, 2);
  assert.deepEqual(d.locked, { timeline: true, peers: true, vocab: true, overallScore: false, historyLimit: 10 });
  assert.equal(d.peers.available, false, "no cohort data");
  assert.equal(d.child.name, "Mia");
});

test("dashboard: a learner with no pieces gets empty, honest sections rather than an error", () => {
  const d = buildLearnerDashboard({ child: { id: "kid", display_name: "Zed" }, submissions: [] });
  assert.equal(d.mastery, null);
  assert.equal(d.peers, null);
  assert.equal(d.snapshot.totalSubmissions, 0);
  assert.equal(d.vocab.total, 0);
});

test("learner endpoint: owner only, needs a real id, and returns the dashboard with the account's plan", async () => {
  const child = { id: "11111111-2222-3333-4444-555555555555", profile_id: "user-1", display_name: "Mia", country: UK, interests: [] };
  const db = (q) => {
    if (q.table === "child_profiles") return { data: child, error: null };
    if (q.table === "submissions") return { data: dsubs.map((s) => ({ ...s })), error: null };
    return { data: null, error: null };
  };
  const run = async (query, owner) => {
    const saved = process.env.ACTIVITY_OWNER_EMAIL; process.env.ACTIVITY_OWNER_EMAIL = owner;
    try { return await call(loadHandler("email.js", { db }), { method: "GET", query, headers: { authorization: "Bearer t" } }); }
    finally { if (saved == null) delete process.env.ACTIVITY_OWNER_EMAIL; else process.env.ACTIVITY_OWNER_EMAIL = saved; }
  };
  assert.equal((await run({ action: "learner", childId: child.id }, "boss@example.com")).statusCode, 401, "not the owner");
  assert.equal((await run({ action: "learner", childId: "nope" }, "parent@example.com")).statusCode, 400);
  const ok = await run({ action: "learner", childId: child.id }, "parent@example.com");
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.child.name, "Mia");
  assert.equal(ok.body.snapshot.wordsWritten, 200);
  assert.equal(ok.body.account.plan, "free");
});

// ---- the quality check, run by hand from /admin

test("quality check: the owner may run it from the admin page; another signed-in user may not", async () => {
  const run = async (owner) => {
    const saved = { o: process.env.ACTIVITY_OWNER_EMAIL, a: process.env.ADMIN_EMAILS, c: process.env.CRON_SECRET };
    process.env.ACTIVITY_OWNER_EMAIL = owner; delete process.env.ADMIN_EMAILS; process.env.CRON_SECRET = "s3cret";
    try { return await call(loadHandler("email.js", { db: () => ({ data: null, error: null }) }), { method: "GET", query: { action: "qa", save: "0" }, headers: { authorization: "Bearer user-token" } }); }
    finally { for (const [k, v] of [["ACTIVITY_OWNER_EMAIL", saved.o], ["ADMIN_EMAILS", saved.a], ["CRON_SECRET", saved.c]]) { if (v == null) delete process.env[k]; else process.env[k] = v; } }
  };
  assert.equal((await run("boss@example.com")).statusCode, 401);
  const ok = await run("parent@example.com");
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.total, 8);
  assert.ok(Array.isArray(ok.body.results));
});

test("wiring: the admin page has a run button that calls the quality check with the signed-in session", () => {
  const page = fs.readFileSync(path.join(ROOT, "admin.html"), "utf8");
  assert.match(page, /id="qaRun"/);
  assert.match(page, /action=qa/);
  assert.ok(!/innerHTML/.test(page));
});
