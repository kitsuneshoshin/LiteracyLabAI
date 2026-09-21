const test = require("node:test");
const assert = require("node:assert/strict");
const { targetsForGrade, targetsFor, isMappedCountry, GRADE_MAPPED_TARGETS } = require("../api/_lib/masteryTargets");

test("targetsForGrade: a directly mapped grade resolves at grade granularity with no approximation", () => {
  const result = targetsForGrade("🇬🇧 United Kingdom", "Year 5", "elementary");
  assert.equal(result.grain, "grade");
  assert.equal(result.approximatedFrom, null);
  assert.ok(result.targets.length > 0);
});

test("targetsForGrade: a grade with no national standard falls back to a real, nearby mapped year (not a fabricated one)", () => {
  // UK Reception has no National Curriculum targets of its own (EYFS is separate) -
  // it must fall back to Year 1, not silently return an empty or invented target list.
  const result = targetsForGrade("🇬🇧 United Kingdom", "Reception", "early");
  assert.equal(result.approximatedFrom, "Year 1");
  const year1 = targetsForGrade("🇬🇧 United Kingdom", "Year 1", "early");
  assert.deepEqual(result.targets, year1.targets);
});

test("targetsForGrade: an unrecognised country falls back to tier-level targets, not a crash", () => {
  const result = targetsForGrade("🇿🇿 Nowhere Land", "Year 5", "elementary");
  assert.equal(result.grain, "tier");
  assert.ok(Array.isArray(result.targets));
});

test("isMappedCountry: every country in the app's own dropdown is either mapped or explicitly not, never throws", () => {
  const countries = ["🇬🇧 United Kingdom", "🇺🇸 United States", "🇦🇺 Australia", "🇨🇦 Canada", "🇦🇪 UAE & GCC Hubs", "🇸🇬 Singapore & SE Asia", "🌐 Global ESL Mode"];
  for (const c of countries) {
    assert.equal(typeof isMappedCountry(c), "boolean");
  }
});

test("targetsFor: every tier-level fallback target set has unique, non-empty target names", () => {
  const countries = ["🇬🇧 United Kingdom", "🇺🇸 United States", "🇦🇺 Australia", "🇨🇦 Canada", "🇦🇪 UAE & GCC Hubs", "🇸🇬 Singapore & SE Asia", "🌐 Global ESL Mode", "🇿🇿 Nowhere Land"];
  const tiers = ["early", "elementary", "middle", "high"];
  const issues = [];
  for (const country of countries) {
    for (const tier of tiers) {
      const targets = targetsFor(country, tier);
      assert.ok(Array.isArray(targets) && targets.length > 0, `${country} / ${tier}: no targets returned`);
      const names = targets.map((t) => t.name);
      if (names.some((n) => !n)) issues.push(`${country} / ${tier}: empty target name`);
      if (new Set(names).size !== names.length) issues.push(`${country} / ${tier}: duplicate target names ${JSON.stringify(names)}`);
    }
  }
  assert.deepEqual(issues, []);
});

// Regression check for the exact class of bug fixed earlier this session:
// every grade this app actually offers (see GRADE_MAPPED_TARGETS, the
// per-grade citation source) must resolve to a real, unique, non-empty set
// of target names - a duplicate or empty name here is exactly the shape of
// bug that let a citation silently fail to aggregate into mastery scoring.
test("regression: every individually-mapped grade across every country has unique, non-empty target names", () => {
  const issues = [];
  for (const [country, byGrade] of Object.entries(GRADE_MAPPED_TARGETS)) {
    for (const [gradeLabel, targets] of Object.entries(byGrade)) {
      const names = targets.map((t) => t.name);
      if (names.length === 0) issues.push(`${country} / ${gradeLabel}: no targets`);
      if (names.some((n) => !n)) issues.push(`${country} / ${gradeLabel}: empty target name`);
      if (new Set(names).size !== names.length) issues.push(`${country} / ${gradeLabel}: duplicate target names ${JSON.stringify(names)}`);
    }
  }
  assert.deepEqual(issues, []);
});
