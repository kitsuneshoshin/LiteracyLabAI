const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { fakeSupabase } = require("./harness");
const { getMonthlyUsage, ABANDONED_AFTER_MS } = require("../api/_lib/usage");

// A used piece is given back automatically when the failure is ours: the learner paid for a prompt or passage
// they never received. Errors during generation delete the placeholder (covered below); a request cut off
// before it could (timeout, crash) leaves a placeholder that stops counting after a few minutes.

function db({ total, stale, plan = "free" }) {
  const log = [];
  const client = fakeSupabase((q) => {
    if (q.table === "profiles") return { data: { plan, email: "p@example.com" }, error: null };
    const isStaleQuery = q.ops.some(([op]) => op === "lt");
    return { count: isStaleQuery ? stale : total, error: null };
  }, log);
  return { client, log };
}

test("a placeholder that never received a prompt or passage stops counting once it is clearly abandoned", async () => {
  const { client, log } = db({ total: 3, stale: 1 });
  const u = await getMonthlyUsage(client, "u1");
  assert.equal(u.used, 2, "three rows, one of them never delivered: two pieces used");
  const q = log.find((x) => x.ops.some(([op]) => op === "lt"));
  const ops = Object.fromEntries(q.ops.map(([op, ...a]) => [op, a]));
  const cutoff = Date.now() - new Date(ops.lt[1]).getTime();
  assert.equal(ops.lt[0], "created_at");
  assert.ok(Math.abs(cutoff - ABANDONED_AFTER_MS) < 5000, "older than the abandon time");
  assert.ok(ABANDONED_AFTER_MS >= 2 * 60 * 1000, "much longer than any real generation (the host stops it at 60 s)");
  const isNull = q.ops.filter(([op]) => op === "is").map(([, col]) => col);
  assert.deepEqual(isNull.sort(), ["content->generatedPassage", "content->generatedPrompt", "feedback"].sort(), "only rows with no prompt, no passage and no feedback");
});

test("normal counting is unchanged when nothing is abandoned, and the count never goes below zero", async () => {
  assert.equal((await getMonthlyUsage(db({ total: 2, stale: 0 }).client, "u1")).used, 2);
  assert.equal((await getMonthlyUsage(db({ total: 0, stale: 0 }).client, "u1")).used, 0);
  assert.equal((await getMonthlyUsage(db({ total: 1, stale: 3 }).client, "u1")).used, 0);
});

test("a failed generation still deletes its placeholder straight away (writing and reading)", () => {
  for (const f of ["writing-prompt.js", "reading-passage.js"]) {
    const src = fs.readFileSync(path.join(__dirname, "..", "api", f), "utf8");
    assert.match(src, /catch \(genErr\) \{\s*await supabase\.from\("submissions"\)\.delete\(\)\.eq\("id", reserved\.id\);\s*throw genErr;/, f);
  }
});
