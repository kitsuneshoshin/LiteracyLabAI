const test = require("node:test");
const assert = require("node:assert/strict");
const { FRAMEWORK_BY_TIER, frameworkForTier } = require("../api/_lib/writingFrameworks");

test("frameworkForTier: every app tier has exactly one named framework", () => {
  for (const tier of ["early", "elementary", "middle", "high"]) {
    const fw = frameworkForTier(tier);
    assert.ok(fw, `expected a framework for tier "${tier}"`);
    assert.ok(fw.name && fw.name.length > 0);
    assert.ok(fw.genre && fw.genre.length > 0);
    assert.ok(fw.description && fw.description.length >= 20, `description too short for "${fw.name}"`);
  }
});

test("frameworkForTier: an unknown tier returns null rather than throwing", () => {
  assert.equal(frameworkForTier("not-a-real-tier"), null);
  assert.equal(frameworkForTier(undefined), null);
});

test("frameworkForTier: no two tiers share the same framework name", () => {
  const names = Object.values(FRAMEWORK_BY_TIER).map((fw) => fw.name);
  assert.equal(new Set(names).size, names.length, "expected every tier's framework to be distinct");
});

test("frameworkForTier: tiers progress from a technique (early/elementary) to a named paragraph structure (middle/high)", () => {
  // Early/elementary get a descriptive/narrative technique; middle/high get
  // an evidence-based analytical/persuasive paragraph framework - matches
  // the genre each tier's writing exercise actually produces (prompt.js).
  assert.equal(frameworkForTier("early").genre, "descriptive");
  assert.equal(frameworkForTier("elementary").genre, "narrative");
  assert.equal(frameworkForTier("middle").genre, "analytical");
  assert.equal(frameworkForTier("high").genre, "persuasive");
});
