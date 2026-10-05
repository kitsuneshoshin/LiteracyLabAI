const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { recordUsage, costUsd, priceFor, PRICES, alertThreshold, alertEmail, utcDay } = require("../api/_lib/aiUsage");

// Every AI call is counted per day and model with an estimated cost, and the owner gets one
// email on the day spend passes a level. None of it may ever break feedback.

test("cost is tokens times the per-million price, dated snapshots share their base price, and unknown models are not free", () => {
  assert.equal(costUsd("gpt-5.4-mini", 1_000_000, 0), 0.75);
  assert.equal(costUsd("gpt-5.4-mini", 0, 1_000_000), 4.5);
  assert.ok(Math.abs(costUsd("gpt-4o-mini", 2_000_000, 1_000_000) - 0.9) < 1e-9);
  assert.deepEqual(priceFor("gpt-4o-mini-2024-07-18"), PRICES["gpt-4o-mini"]);
  assert.ok(costUsd("some-future-model", 1_000_000, 1_000_000) > 0, "an unknown model is estimated, never zero");
  assert.equal(costUsd("gpt-5.4-mini", undefined, undefined), 0);
  // A typical Premium answer (about 3.5k in, 2.5k out) is about a cent and a bit, as quoted to the owner.
  const c = costUsd("gpt-5.4-mini", 3500, 2500);
  assert.ok(c > 0.012 && c < 0.016, String(c));
});

test("the alert level defaults to 2 dollars, can be set, and ignores nonsense", () => {
  const saved = process.env.AI_DAILY_ALERT_USD;
  try {
    delete process.env.AI_DAILY_ALERT_USD;
    assert.equal(alertThreshold(), 2);
    process.env.AI_DAILY_ALERT_USD = "5";
    assert.equal(alertThreshold(), 5);
    process.env.AI_DAILY_ALERT_USD = "abc";
    assert.equal(alertThreshold(), 2);
    process.env.AI_DAILY_ALERT_USD = "-1";
    assert.equal(alertThreshold(), 2);
  } finally { if (saved == null) delete process.env.AI_DAILY_ALERT_USD; else process.env.AI_DAILY_ALERT_USD = saved; }
});

function fakeDb({ rows, alreadyAlerted = false }) {
  const calls = { rpc: [], alertInserts: [] };
  const supabase = {
    rpc: async (name, args) => { calls.rpc.push([name, args]); return { data: rows, error: null }; },
    from: (table) => ({
      insert: (row) => ({ select: async () => { calls.alertInserts.push([table, row]); return alreadyAlerted ? { data: [], error: { code: "23505", message: "duplicate" } } : { data: [row], error: null }; } }),
    }),
  };
  return { supabase, calls };
}

test("a call is recorded with the UTC day, model, tokens and estimated cost", async () => {
  const { supabase, calls } = fakeDb({ rows: [{ model: "gpt-5.4-mini", calls: 1, input_tokens: 1000, output_tokens: 500, est_cost_usd: 0.003 }] });
  const out = await recordUsage({ model: "gpt-5.4-mini", inputTokens: 1000, outputTokens: 500 }, { getSupabase: () => supabase, now: new Date("2026-10-05T23:59:00Z"), sendEmail: async () => assert.fail("no email below the level") });
  assert.equal(calls.rpc.length, 1);
  assert.equal(calls.rpc[0][0], "record_ai_usage");
  assert.deepEqual(calls.rpc[0][1], { p_day: "2026-10-05", p_model: "gpt-5.4-mini", p_in: 1000, p_out: 500, p_cost: costUsd("gpt-5.4-mini", 1000, 500) });
  assert.equal(calls.alertInserts.length, 0);
  assert.ok(out.cost < 2);
  assert.equal(utcDay(new Date("2026-10-05T23:59:59Z")), "2026-10-05");
  assert.equal(utcDay(new Date("2026-10-06T00:00:00Z")), "2026-10-06");
});

test("crossing the daily level sends one email to the first admin address, once per day", async () => {
  const saved = { a: process.env.ADMIN_EMAILS, l: process.env.AI_DAILY_ALERT_USD };
  process.env.ADMIN_EMAILS = "owner@example.com, other@example.com";
  process.env.AI_DAILY_ALERT_USD = "2";
  try {
    const rows = [{ model: "gpt-5.4-mini", calls: 150, input_tokens: 600000, output_tokens: 400000, est_cost_usd: 2.25 }];
    const sent = [];
    const first = fakeDb({ rows });
    await recordUsage({ model: "gpt-5.4-mini", inputTokens: 1, outputTokens: 1 }, { getSupabase: () => first.supabase, sendEmail: async (m) => { sent.push(m); } });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "owner@example.com");
    assert.match(sent[0].subject, /OpenAI spend today has reached \$2\.25/);
    assert.match(sent[0].text, /150 AI calls/);
    assert.match(sent[0].text, /gpt-5\.4-mini: 150 calls, \$2\.25/);
    assert.match(sent[0].text, /platform\.openai\.com/);
    // the second call the same day: the alert row already exists, so no second email
    const second = fakeDb({ rows, alreadyAlerted: true });
    await recordUsage({ model: "gpt-5.4-mini", inputTokens: 1, outputTokens: 1 }, { getSupabase: () => second.supabase, sendEmail: async (m) => { sent.push(m); } });
    assert.equal(sent.length, 1, "at most one email a day");
  } finally {
    if (saved.a == null) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = saved.a;
    if (saved.l == null) delete process.env.AI_DAILY_ALERT_USD; else process.env.AI_DAILY_ALERT_USD = saved.l;
  }
});

test("nothing can break feedback: a database error, a missing table or an email failure is swallowed", async () => {
  const quiet = console.error; console.error = () => {};
  try {
    const failing = { rpc: async () => ({ data: null, error: { message: "relation does not exist" } }), from: () => { throw new Error("no"); } };
    assert.equal(await recordUsage({ model: "m", inputTokens: 1, outputTokens: 1 }, { getSupabase: () => failing }), null);
    assert.equal(await recordUsage({ model: "m", inputTokens: 1, outputTokens: 1 }, { getSupabase: () => { throw new Error("no keys"); } }), null);
    process.env.ADMIN_EMAILS = "owner@example.com";
    const { supabase } = fakeDb({ rows: [{ model: "m", calls: 1, input_tokens: 1, output_tokens: 1, est_cost_usd: 99 }] });
    assert.equal(await recordUsage({ model: "m", inputTokens: 1, outputTokens: 1 }, { getSupabase: () => supabase, sendEmail: async () => { throw new Error("resend down"); } }), null);
  } finally { console.error = quiet; delete process.env.ADMIN_EMAILS; }
});

test("with no admin address set, crossing the level just records it (no email, no crash)", async () => {
  const saved = process.env.ADMIN_EMAILS; delete process.env.ADMIN_EMAILS;
  try {
    const { supabase } = fakeDb({ rows: [{ model: "m", calls: 1, input_tokens: 1, output_tokens: 1, est_cost_usd: 99 }] });
    const r = await recordUsage({ model: "m", inputTokens: 1, outputTokens: 1 }, { getSupabase: () => supabase, sendEmail: async () => assert.fail("no address to send to") });
    assert.ok(r.cost >= 99);
  } finally { if (saved != null) process.env.ADMIN_EMAILS = saved; }
});

test("the alert email is plain and safe: no HTML injection, mentions the exact source of truth", () => {
  const m = alertEmail({ day: "2026-10-05", cost: 3, threshold: 2, calls: 10, inTokens: 5000, outTokens: 3000, perModel: [{ model: "<b>x</b>", calls: 10, cost: 3 }] });
  assert.ok(!m.html.includes("<b>x</b>"));
  assert.match(m.text, /OpenAI's Usage page is the exact figure/);
});

test("generateFeedbackJSON counts the call even when the answer cannot be parsed, using the model OpenAI reports", async () => {
  const root = path.join(__dirname, "..");
  const openaiFile = require.resolve(path.join(root, "api", "_lib", "openai.js"));
  const usageFile = require.resolve(path.join(root, "api", "_lib", "aiUsage.js"));
  const pkg = require.resolve("openai", { paths: [root] });
  const saved = { pkg: require.cache[pkg], usage: require.cache[usageFile], key: process.env.OPENAI_API_KEY };
  const recorded = [];
  try {
    process.env.OPENAI_API_KEY = "test";
    class FakeOpenAI { constructor() { this.chat = { completions: { create: async () => ({ model: "gpt-5.4-mini-2026-03-01", usage: { prompt_tokens: 1200, completion_tokens: 800 }, choices: [{ message: { content: "not json" } }] }) } }; } }
    require.cache[pkg] = { id: pkg, filename: pkg, loaded: true, exports: FakeOpenAI };
    require.cache[usageFile] = { id: usageFile, filename: usageFile, loaded: true, exports: { ...require("../api/_lib/aiUsage"), recordUsage: async (u) => { recorded.push(u); return null; } } };
    delete require.cache[openaiFile];
    const { generateFeedbackJSON } = require(openaiFile);
    await assert.rejects(() => generateFeedbackJSON("hi"), /could not be parsed/);
    assert.deepEqual(recorded, [{ model: "gpt-5.4-mini-2026-03-01", inputTokens: 1200, outputTokens: 800 }]);
  } finally {
    if (saved.pkg) require.cache[pkg] = saved.pkg; else delete require.cache[pkg];
    if (saved.usage) require.cache[usageFile] = saved.usage; else delete require.cache[usageFile];
    delete require.cache[openaiFile];
    if (saved.key == null) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = saved.key;
  }
});

test("the schema defines the usage tables with row security on and no public access to the counting function", () => {
  const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "schema.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.ai_usage_daily/);
  assert.match(sql, /alter table public\.ai_usage_daily enable row level security/);
  assert.match(sql, /alter table public\.ai_usage_alerts enable row level security/);
  assert.match(sql, /revoke all on function public\.record_ai_usage\(date, text, integer, integer, numeric\) from public, anon, authenticated/);
  assert.match(sql, /primary key \(day, model\)/);
});
