const test = require("node:test");
const assert = require("node:assert/strict");
const { FRAMEWORK_BY_GENRE, VALID_GENRES, DEFAULT_GENRE_BY_TIER, frameworkForGenre, resolveGenre, frameworkForTier } = require("../api/_lib/writingFrameworks");

test("frameworkForGenre: every valid genre has exactly one named framework", () => {
  for (const genre of VALID_GENRES) {
    const fw = frameworkForGenre(genre);
    assert.ok(fw, `expected a framework for genre "${genre}"`);
    assert.ok(fw.name && fw.name.length > 0);
    assert.ok(fw.description && fw.description.length >= 20, `description too short for "${fw.name}"`);
  }
});

test("frameworkForGenre: an unknown genre returns null rather than throwing", () => {
  assert.equal(frameworkForGenre("not-a-real-genre"), null);
  assert.equal(frameworkForGenre(undefined), null);
});

test("frameworkForGenre: no two genres share the same framework name", () => {
  const names = Object.values(FRAMEWORK_BY_GENRE).map((fw) => fw.name);
  assert.equal(new Set(names).size, names.length, "expected every genre's framework to be distinct");
});

test("resolveGenre: a real, valid genre is used as-is regardless of tier", () => {
  // The whole point: a persuasive piece from an early-tier student still
  // resolves to "persuasive", not silently overridden by the tier default.
  assert.equal(resolveGenre("persuasive", "early"), "persuasive");
  assert.equal(resolveGenre("descriptive", "high"), "descriptive");
});

test("resolveGenre: a missing or invalid genre falls back to the tier's default", () => {
  for (const tier of Object.keys(DEFAULT_GENRE_BY_TIER)) {
    assert.equal(resolveGenre(undefined, tier), DEFAULT_GENRE_BY_TIER[tier]);
    assert.equal(resolveGenre(null, tier), DEFAULT_GENRE_BY_TIER[tier]);
    assert.equal(resolveGenre("not-a-real-genre", tier), DEFAULT_GENRE_BY_TIER[tier]);
  }
});

test("frameworkForTier: matches resolveGenre's tier default, for callers with no prompt-level genre yet", () => {
  for (const tier of Object.keys(DEFAULT_GENRE_BY_TIER)) {
    assert.deepEqual(frameworkForTier(tier), frameworkForGenre(DEFAULT_GENRE_BY_TIER[tier]));
  }
});

test("regression: a persuasive early-years piece gets the persuasive framework, not the tier's usual one", () => {
  const early = frameworkForGenre(resolveGenre("persuasive", "early"));
  assert.equal(early.name, "PEAL");
  assert.notEqual(early.name, frameworkForTier("early").name);
});
