const test = require("node:test");
const assert = require("node:assert/strict");
const { lockedChildIds, nextActiveChangeAt, ACTIVE_CHANGE_DAYS } = require("../api/_lib/learnerAccess");

// Oldest first, as loadLearnerState returns them.
const kids = ["amy", "ben", "cal", "dee"].map((id, i) => ({ id, created_at: `2026-09-0${i + 1}T00:00:00Z` }));
const ids = (set) => [...set].sort();

test("within the plan's limit, nobody is locked", () => {
  assert.deepEqual(ids(lockedChildIds(kids.slice(0, 1), 1, null)), []);
  assert.deepEqual(ids(lockedChildIds(kids, 6, null)), []);
});

test("after a downgrade with no choice made yet, the oldest learner keeps access", () => {
  // Nobody should be locked out entirely before the parent has picked.
  assert.deepEqual(ids(lockedChildIds(kids, 1, null)), ["ben", "cal", "dee"]);
});

test("the parent's chosen learner is the one that stays usable", () => {
  assert.deepEqual(ids(lockedChildIds(kids, 1, "cal")), ["amy", "ben", "dee"]);
});

test("if the chosen learner was removed, access falls back to the oldest", () => {
  assert.deepEqual(ids(lockedChildIds(kids, 1, "deleted-kid")), ["ben", "cal", "dee"]);
});

test("a limit above one keeps the chosen learner plus the oldest to fill it", () => {
  assert.deepEqual(ids(lockedChildIds(kids, 2, "dee")), ["ben", "cal"]);
});

test("exactly the plan's number of learners stays usable, never more or fewer", () => {
  for (let max = 1; max <= kids.length; max++) {
    assert.equal(kids.length - lockedChildIds(kids, max, "cal").size, max);
  }
});

test("the first choice of active learner is always allowed", () => {
  assert.equal(nextActiveChangeAt(null), null);
});

test(`changing the active learner again is blocked for ${ACTIVE_CHANGE_DAYS} days`, () => {
  const now = new Date("2026-09-25T00:00:00Z");
  const next = nextActiveChangeAt("2026-09-20T00:00:00Z", now);
  assert.ok(next, "a change 5 days later should be blocked");
  assert.equal(next.toISOString(), "2026-10-20T00:00:00.000Z");
  assert.equal(nextActiveChangeAt("2026-08-20T00:00:00Z", now), null, "a change after 36 days should be allowed");
});
