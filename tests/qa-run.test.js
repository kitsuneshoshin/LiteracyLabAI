const test = require("node:test");
// These scripted tests give one reply per attempt; the two-call Premium split is tested in split-generate.test.js.
if (process.env.PREMIUM_SPLIT === undefined) process.env.PREMIUM_SPLIT = "0";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { runQa, WRITING, READING } = require("../api/_lib/qaRun");
const { buildWritingPrompt } = require("../api/_lib/prompt");
const { loadHandler, call, did } = require("./harness");

// The weekly marking-quality check: the samples, the summary, the protected
// endpoint that runs it, and that it is wired to a weekly schedule and a table.

const ROOT = path.join(__dirname, "..");

test("the sample set covers every age tier, a Free, a Core and a Premium piece, and a zero-score and a part-right reading attempt", () => {
  const tiers = new Set(WRITING.map((s) => s.tier));
  for (const t of ["early", "elementary", "middle", "high"]) assert.ok(tiers.has(t), `no ${t} writing sample`);
  const plans = new Set([...WRITING, ...READING].map((s) => s.plan));
  for (const p of ["free", "core", "premium"]) assert.ok(plans.has(p), `no ${p} sample`);
  assert.ok(READING.some((r) => r.answers.every((a) => a === 0 || a === 1)) && READING.length >= 2);
  assert.equal(WRITING.length + READING.length, 8);
  // The real Superman piece that prompted the corrected-story work is in the set.
  assert.ok(WRITING.some((s) => /cryponite/.test(s.text)));
});

test("every sample builds a real prompt, and a failing sample is retried like a customer's: up to three attempts, each told what was wrong", async () => {
  const prompts = [];
  await runQa({ generate: async (p) => { prompts.push(p); return { parsed: {}, modelUsed: "stub" }; } });
  const first = prompts.filter((p) => !p.includes("Your previous attempt failed these checks"));
  const retries = prompts.filter((p) => p.includes("Your previous attempt failed these checks"));
  assert.equal(first.length, 8, "one first attempt per sample");
  assert.equal(retries.length, 16, "two retries for each of the eight failing samples");
  assert.ok(first.every((p) => p.length > 1500), "each prompt is a full prompt");
  assert.ok(first.filter((p) => /REVISED RESPONSE \(required\)/.test(p)).length === 6, "all six writing samples ask for the corrected story");
});

test("a model that returns nothing usable fails every sample cleanly after three attempts: no crash, a plain reason each, and the numbers add up", async () => {
  const summary = await runQa({ generate: async () => ({ parsed: {}, modelUsed: "stub" }) });
  assert.equal(summary.total, 8);
  assert.equal(summary.passed, 0, "none right first time");
  assert.equal(summary.delivered, 0, "and none would reach a customer");
  assert.equal(summary.passRate, 0);
  assert.equal(summary.deliveredRate, 0);
  assert.equal(summary.avgAttempts, 3);
  assert.ok(summary.results.every((r) => !r.ok && !r.firstTry && r.attempts === 3 && r.outcome === "failed" && r.issues.length > 0 && r.lastIssues.length > 0));
});

test("a model call that throws is recorded as a failed sample, and the other samples still run all their attempts", async () => {
  const summary = await runQa({ generate: async (p) => { if (p.includes("Year 11")) throw new Error("rate limited"); return { parsed: {}, modelUsed: "stub" }; } });
  assert.equal(summary.total, 8);
  const failed = summary.results.filter((r) => r.issues.some((i) => /model call failed: rate limited/.test(i)));
  assert.equal(failed.length, 3, "the three Year 11 samples");
  assert.ok(summary.results.filter((r) => !failed.includes(r)).every((r) => r.attempts === 3), "the rest were unaffected");
});

// ---- the protected endpoint

function dbCapture(log) {
  return (q) => {
    if (q.table === "qa_runs" && did(q, "insert")) { log.push(q.ops.find(([n]) => n === "insert")[1]); return { data: null, error: null }; }
    return { data: null, error: null };
  };
}
async function hit({ secret = "s3cret", auth, query = { action: "qa" }, method = "GET", log = [] } = {}) {
  const saved = process.env.CRON_SECRET;
  if (secret == null) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret;
  try {
    const h = loadHandler("email.js", { db: dbCapture(log), generate: async () => ({ parsed: {}, modelUsed: "stub" }) });
    const res = { statusCode: 200, body: undefined, headers: {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader(k, v) { this.headers[k] = v; }, end() { return this; } };
    await h({ method, query, headers: auth ? { authorization: auth } : {}, body: {} }, res);
    return res;
  } finally { if (saved == null) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved; }
}

test("endpoint: nobody without the secret can run it (and so spend AI credit), and a missing secret setting is refused", async () => {
  assert.equal((await hit({})).statusCode, 401);
  assert.equal((await hit({ auth: "Bearer wrong" })).statusCode, 401);
  assert.equal((await hit({ auth: "Bearer s3cret", method: "DELETE" })).statusCode, 405);
  assert.equal((await hit({ secret: null, auth: "Bearer s3cret" })).statusCode, 500);
});

test("endpoint: with the secret it runs all eight samples, saves one summary row, and reports a plain result", async () => {
  const log = [];
  const res = await hit({ auth: "Bearer s3cret", log });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.total, 8);
  assert.equal(res.body.saved, true);
  assert.equal(log.length, 1, "exactly one row saved");
  assert.equal(log[0].total, 8);
  assert.equal(log[0].passed, 0);
  assert.equal(log[0].summary.delivered, 0);
  assert.equal(log[0].summary.results.length, 8);
  assert.equal(res.body.passedFirstTry, 0);
  assert.equal(res.body.delivered, 0);
  assert.ok(res.body.results.every((r) => typeof r.name === "string" && "firstTry" in r && "outcome" in r && "attempts" in r), "the report names each sample with both numbers");
});

test("endpoint: ?save=0 runs it without writing anything", async () => {
  const log = [];
  const res = await hit({ auth: "Bearer s3cret", query: { action: "qa", save: "0" }, log });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.saved, false);
  assert.equal(log.length, 0);
});

// ---- wiring

test("wiring: a weekly schedule calls it, the table exists in the schema, and the host's 12-function limit is respected", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const cron = vercel.crons.find((c) => c.path === "/api/email?action=qa");
  assert.ok(cron, "the quality check is scheduled");
  assert.match(cron.schedule, /^\d+ \d+ \* \* \d$/, "weekly: one fixed weekday");
  assert.ok(vercel.crons.length <= 2, "the host allows two scheduled jobs on this plan");
  const schema = fs.readFileSync(path.join(ROOT, "supabase", "schema.sql"), "utf8");
  assert.match(schema, /create table if not exists public\.qa_runs/);
  assert.match(schema, /alter table public\.qa_runs enable row level security/);
  const fns = fs.readdirSync(path.join(ROOT, "api")).filter((f) => f.endsWith(".js"));
  assert.ok(fns.length <= 12, `${fns.length} functions`);
  const email = fs.readFileSync(path.join(ROOT, "api", "email.js"), "utf8");
  assert.ok(email.includes('action === "qa"'));
});

test("wiring: the sample prompts match what the real writing prompt builder produces", () => {
  const s = WRITING[1];
  const p = buildWritingPrompt({ tier: s.tier, country: "🇬🇧 United Kingdom", gradeLabel: "Year 5", interest: "football", prompt: s.prompt, text: s.text, targets: [], targetNames: ["A"], genre: "narrative", capabilities: {} });
  assert.ok(p.includes(s.text));
});

// ---- a run can never be killed by the host's 60-second limit: it has a time budget

test("time budget: slow model calls cannot run past the deadline, every sample is still reported, and the summary is still produced", async () => {
  const started = Date.now();
  const summary = await runQa({ generate: () => new Promise((r) => setTimeout(() => r({ parsed: {}, modelUsed: "slow" }), 60)), budgetMs: 150 });
  assert.ok(Date.now() - started < 1500, "it came back promptly");
  assert.equal(summary.total, 8);
  assert.equal(summary.results.length, 8);
  assert.ok(summary.results.every((r) => r.attempts >= 1 && r.attempts <= 3 && !r.ok));
});

test("time budget: a model call that never answers is cut off at the deadline and recorded, not waited for", async () => {
  const started = Date.now();
  const summary = await runQa({ generate: () => new Promise(() => {}), budgetMs: 120 });
  assert.ok(Date.now() - started < 1500, "it did not hang");
  assert.equal(summary.total, 8);
  assert.ok(summary.results.every((r) => r.issues.some((i) => /timed out waiting for the model/.test(i))));
  assert.equal(summary.timedOut, 8);
});

test("time budget: with no pressure nothing is cut short, and the endpoint reports how many ran out of time", async () => {
  const summary = await runQa({ generate: async () => ({ parsed: {}, modelUsed: "stub" }) });
  assert.equal(summary.timedOut, 0);
  assert.ok(summary.results.every((r) => r.attempts === 3 && !r.timedOut));
  const res = await hit({ auth: "Bearer s3cret", query: { action: "qa", save: "0" } });
  assert.equal(res.body.timedOut, 0);
});

// ---- found when the first retry-aware run reported a piece as failed that a customer would have received

const { runOne: runSample } = require("../api/_lib/qaRun");
const stubValidate = (issues) => () => ({ ok: issues.length === 0, issues });
const gen = async () => ({ parsed: { growNext: "Next, try something harder with your writing and think about it.", revisedStory: "A story.", glow: "x" }, modelUsed: "stub" });

test("a piece whose only remaining problem is a bonus section (the second step or the corrected story) is delivered without it, exactly as a customer's would be", async () => {
  const growNextQuote = "growNext must quote a short fragment (3 to 10 words) exactly as it appears in the student's own text, and say what to do with it";
  let r = await runSample(WRITING[1], "writing", gen, Infinity, stubValidate([growNextQuote]));
  assert.equal(r.ok, true);
  assert.equal(r.outcome, "delivered without a bonus section");
  assert.equal(r.attempts, 3);
  assert.equal(r.firstTry, false);
  assert.equal(r.sections.growNext, false, "the unusable bonus section is left out");
  r = await runSample(WRITING[1], "writing", gen, Infinity, stubValidate(["revisedStory must start with a capital letter"]));
  assert.equal(r.ok, true);
  assert.equal(r.sections.revisedStory, false);
  r = await runSample(WRITING[1], "writing", gen, Infinity, stubValidate([growNextQuote, "revisedStory still contains the misspelling \"x\" that the spelling check lists"]));
  assert.equal(r.ok, true, "both bonus sections can be left out together");
});

test("any other problem alongside a bonus-section problem means the piece is NOT delivered (the safety net only covers bonus sections)", async () => {
  const r = await runSample(WRITING[1], "writing", gen, Infinity, stubValidate(["growNext must quote a short fragment (3 to 10 words) exactly as it appears in the student's own text, and say what to do with it", "highlights must be an array of 2-10 items"]));
  assert.equal(r.ok, false);
  assert.equal(r.outcome, "failed");
  assert.equal(r.attempts, 3);
});

test("a run with no time budget set does not time out at once (an unlimited deadline means no timeout)", async () => {
  const r = await runSample(WRITING[0], "writing", async () => ({ parsed: {}, modelUsed: "stub" }), Infinity, stubValidate([]));
  assert.equal(r.ok, true);
  assert.equal(r.outcome, "delivered");
  assert.equal(r.attempts, 1);
  assert.equal(r.firstTry, true);
});

test("no source file contains a stray control character (a hidden backspace once turned a pattern into one that never matched)", () => {
  const dirs = ["api", "scripts", "tests"];
  const files = [];
  const walk = (d) => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|html|json)$/.test(e.name) && files.push(path.join(d, e.name))));
  dirs.forEach(walk);
  ["index.html", "app.html", "analytics.js", "pricing.js", "vercel.json"].forEach((f) => files.push(f));
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, f), "utf8");
    const bad = text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/);
    assert.ok(!bad, `${f} contains control character code ${bad && bad[0].charCodeAt(0)}`);
  }
});

test("endpoint: a signed-in admin can run it by hand (and pick another model), a signed-in non-admin cannot", async () => {
  const saved = process.env.ADMIN_EMAILS;
  try {
    process.env.ADMIN_EMAILS = "someone-else@example.com";
    assert.equal((await hit({ auth: "Bearer a-user-token" })).statusCode, 401, "a non-admin user is refused");
    process.env.ADMIN_EMAILS = "parent@example.com"; // the harness's signed-in user
    const log = [];
    const res = await hit({ secret: null, auth: "Bearer a-user-token", query: { action: "qa", model: "gpt-4.1-mini" }, log });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.total, 8);
    assert.equal(log.length, 0, "a run on another model is never saved over the weekly record");
    const bad = await hit({ secret: null, auth: "Bearer a-user-token", query: { action: "qa", model: "bad model!!" } });
    assert.equal(bad.statusCode, 200, "an invalid model name is ignored, not passed to OpenAI");
  } finally { if (saved == null) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = saved; }
});
