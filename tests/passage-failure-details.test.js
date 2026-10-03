const test = require("node:test");
const assert = require("node:assert/strict");
const { loadHandler } = require("./harness");
const { errorDetails } = require("../api/_lib/sentry");

// NODE-8: "couldn't generate a reading passage" reached Sentry without saying
// which quality check failed. The failed checks now travel on the error.
test("a passage that fails validation twice reports which checks failed", async () => {
  const handler = loadHandler("reading-passage.js", { generate: async () => ({ parsed: { title: "x", passage: "too short", questions: [] }, modelUsed: "stub" }) });
  await assert.rejects(
    () => handler.generateAndValidate("prompt", "early"),
    (err) => {
      assert.equal(err.statusCode, 502);
      assert.match(err.message, /couldn't generate a reading passage/);
      assert.ok(Array.isArray(err.checkIssues) && err.checkIssues.length > 0, "failed checks missing");
      return true;
    }
  );
});

test("failed checks are redacted before going to Sentry", () => {
  const out = errorDetails({ checkIssues: ['passage quotes ("the child wrote this")'] });
  assert.deepEqual(out, ['passage quotes ("[redacted]")']);
  assert.equal(errorDetails(new Error("x")), null);
});
