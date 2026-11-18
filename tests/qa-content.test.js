const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { samplePlan, runSample, tierForAge } = require("../api/_lib/qaContent");
const { GRADE_AGE } = require("../api/_lib/gradeLevel");

test("the content spot-check plan covers every country with a younger and an older year, reading and writing", () => {
  const plan = samplePlan();
  for (const country of Object.keys(GRADE_AGE)) {
    const mine = plan.filter((s) => s.country === country);
    assert.ok(new Set(mine.map((s) => s.gradeLabel)).size >= 2, `${country} has two years`);
    for (const kind of ["reading", "writing"]) assert.ok(mine.some((s) => s.kind === kind && !s.exam), `${country} ${kind}`);
  }
  assert.ok(plan.some((s) => s.exam && s.kind === "reading") && plan.some((s) => s.exam && s.kind === "writing"), "exam-style samples are included");
  assert.equal(tierForAge(6), "early"); assert.equal(tierForAge(9), "elementary"); assert.equal(tierForAge(12), "middle"); assert.equal(tierForAge(16), "high");
});

test("a sample runs the real prompt and validator once and returns the text with its readability numbers", async () => {
  let seen = null;
  const generate = async (prompt) => {
    seen = prompt;
    return { parsed: { title: "A test", genre: "narrative", prompt: "Write about a day at the beach with your family." } };
  };
  const w = await runSample({ kind: "writing", country: "🇬🇧 United Kingdom", gradeLabel: "Year 4", tier: "elementary", generate });
  assert.match(seen, /Curriculum fit/);
  assert.equal(w.kind, "writing"); assert.equal(w.prompt, "Write about a day at the beach with your family."); assert.ok(w.words > 5);
  assert.equal(w.exam, null);
  const e = await runSample({ kind: "writing", country: "🇬🇧 United Kingdom", gradeLabel: "Year 4", tier: "elementary", exam: true, generate });
  assert.equal(e.exam, "KS2 English");
});

test("the admin-only route exists and refuses anyone who is not an admin", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "api", "email.js"), "utf8");
  assert.match(src, /action === "qaContent"/);
  const fn = src.match(/async function handleQaContent[\s\S]*?\n\}/)[0];
  assert.match(fn, /isOwner\(user\)/);
  assert.match(fn, /401/);
});
