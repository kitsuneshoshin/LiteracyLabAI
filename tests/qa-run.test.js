const test = require("node:test");
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

test("every sample builds a real prompt (so a broken prompt shows up here, not in a customer's feedback)", async () => {
  const prompts = [];
  await runQa({ generate: async (p) => { prompts.push(p); return { parsed: {}, modelUsed: "stub" }; } });
  assert.equal(prompts.length, 8);
  assert.ok(prompts.every((p) => p.length > 1500), "each prompt is a full prompt");
  assert.ok(prompts.filter((p) => /REVISED STORY \(required\)/.test(p)).length === 6, "all six writing samples ask for the corrected story");
});

test("a model that returns nothing usable fails every sample cleanly: no crash, a plain reason each, and the numbers add up", async () => {
  const summary = await runQa({ generate: async () => ({ parsed: {}, modelUsed: "stub" }) });
  assert.equal(summary.total, 8);
  assert.equal(summary.passed, 0);
  assert.equal(summary.passRate, 0);
  assert.ok(summary.results.every((r) => !r.ok && r.issues.length > 0));
});

test("a model call that throws is recorded as a failed sample, and the other samples still run", async () => {
  let n = 0;
  const summary = await runQa({ generate: async () => { n += 1; if (n % 2 === 0) throw new Error("rate limited"); return { parsed: {}, modelUsed: "stub" }; } });
  assert.equal(summary.total, 8);
  const failed = summary.results.filter((r) => r.issues.some((i) => /model call failed: rate limited/.test(i)));
  assert.equal(failed.length, 4);
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
  assert.equal(log[0].summary.results.length, 8);
  assert.ok(res.body.results.every((r) => typeof r.name === "string" && "ok" in r), "the report names each sample");
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
