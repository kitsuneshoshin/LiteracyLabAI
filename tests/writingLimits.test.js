const test = require("node:test");
const assert = require("node:assert/strict");
const { writingLimitsForGrade, GRADE_WORD_TARGETS, deriveMaxChars } = require("../api/_lib/writingLimits");

test("writingLimitsForGrade: known anchor values (UK Year 5 / Year 10)", () => {
  assert.equal(writingLimitsForGrade("🇬🇧 United Kingdom", "Year 5", "elementary").target, 160);
  assert.equal(writingLimitsForGrade("🇬🇧 United Kingdom", "Year 10", "high").target, 400);
});

test("writingLimitsForGrade: falls back to the tier default for an unmapped grade label", () => {
  const result = writingLimitsForGrade("🇬🇧 United Kingdom", "Not A Real Grade", "elementary");
  assert.equal(result.target, 150); // DEFAULT_TARGET_BY_TIER.elementary
});

test("deriveMaxChars: monotonic non-decreasing across the full realistic target range", () => {
  let prev = -Infinity;
  for (let target = 5; target <= 1000; target += 1) {
    const mc = deriveMaxChars(target);
    assert.ok(mc >= prev, `maxChars dipped at target=${target}: ${mc} < ${prev}`);
    prev = mc;
  }
});

// Regression test for a real bug found by live testing this session: a
// discrete per-tier char-to-word ratio caused an OLDER grade to get a
// SMALLER hard character cap than a YOUNGER grade right at a tier boundary
// (US Grade 9, Australia Year 10, Canada Grade 9). deriveMaxChars is now a
// continuous function of the target alone specifically to make this
// structurally impossible - this test locks that guarantee in place.
test("regression: no grade's character cap is smaller than a younger grade's, in any country", () => {
  const issues = [];
  for (const country of Object.keys(GRADE_WORD_TARGETS)) {
    const table = GRADE_WORD_TARGETS[country];
    let prevTarget = -Infinity;
    let prevMaxChars = -Infinity;
    for (const [gradeLabel, target] of Object.entries(table)) {
      const maxChars = deriveMaxChars(target);
      if (target < prevTarget) issues.push(`${country} / ${gradeLabel}: word target ${target} is lower than the previous grade's ${prevTarget}`);
      if (maxChars < prevMaxChars) issues.push(`${country} / ${gradeLabel}: char cap ${maxChars} is lower than the previous grade's ${prevMaxChars}`);
      prevTarget = target;
      prevMaxChars = maxChars;
    }
  }
  assert.deepEqual(issues, []);
});

test("every mapped grade has a positive integer word target", () => {
  const issues = [];
  for (const country of Object.keys(GRADE_WORD_TARGETS)) {
    for (const [gradeLabel, target] of Object.entries(GRADE_WORD_TARGETS[country])) {
      if (!Number.isInteger(target) || target <= 0) issues.push(`${country} / ${gradeLabel}: invalid target ${target}`);
    }
  }
  assert.deepEqual(issues, []);
});
