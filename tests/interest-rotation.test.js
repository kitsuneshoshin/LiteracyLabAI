const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The rotation logic lives in app.html (there's no build step), so this runs
// the REAL function by reading its source out of that file.
const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const start = APP.indexOf("function pickInterestForNewPiece");
assert.ok(start >= 0, "pickInterestForNewPiece not found in app.html");
const end = APP.indexOf("\n}\n", start) + 3;
const pick = new Function(APP.slice(start, end) + "; return pickInterestForNewPiece;")();

const ALL_VALID = ["space", "gaming", "pop", "lit", "animals"];

test("interest rotation: never repeats the previous piece's interest when there is a choice", () => {
  for (const last of ["space", "gaming", "pop"]) {
    for (let i = 0; i < 200; i++) {
      const chosen = pick({ interests: ["space", "gaming", "pop"], validForTier: ALL_VALID, last, fallback: "space" });
      assert.notEqual(chosen, last);
    }
  }
});

test("interest rotation: every selected interest gets used over time (not just the first)", () => {
  const seen = new Set();
  let last = null;
  for (let i = 0; i < 300; i++) {
    last = pick({ interests: ["gaming", "pop", "lit", "animals"], validForTier: ALL_VALID, last, fallback: "space" });
    seen.add(last);
  }
  assert.deepEqual([...seen].sort(), ["animals", "gaming", "lit", "pop"]);
});

test("interest rotation: only interests that suit the age tier are chosen", () => {
  // "exam" is offered for high school only; a younger tier must never get it.
  for (let i = 0; i < 100; i++) {
    const chosen = pick({ interests: ["exam", "gaming", "pop"], validForTier: ["gaming", "pop"], last: null, fallback: "space" });
    assert.notEqual(chosen, "exam");
  }
});

test("interest rotation: a single interest is used every time (there is nothing to rotate to)", () => {
  assert.equal(pick({ interests: ["lit"], validForTier: ALL_VALID, last: "lit", fallback: "space" }), "lit");
});

test("interest rotation: if none of the chosen interests suit the tier, the learner's own list is used rather than nothing", () => {
  const chosen = pick({ interests: ["exam"], validForTier: ["gaming"], last: null, fallback: "space" });
  assert.equal(chosen, "exam");
});

test("interest rotation: a learner with no interests falls back safely", () => {
  assert.equal(pick({ interests: [], validForTier: ALL_VALID, last: null, fallback: "space" }), "space");
});

test("interest rotation: the random draw is what decides between the remaining options", () => {
  const opts = { interests: ["a", "b", "c"], validForTier: ["a", "b", "c"], last: "a", fallback: "z" };
  assert.equal(pick({ ...opts, random: () => 0 }), "b");
  assert.equal(pick({ ...opts, random: () => 0.99 }), "c");
});
