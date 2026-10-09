const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// The Privacy Policy and Terms must keep describing what invites and shared cards actually store and show.
test("the Privacy Policy says what invites and shared cards store, that cards show no writing, and that they can be switched off", () => {
  const p = read("privacy.html");
  assert.match(p, /<td data-label="Category">Invites and shared cards<\/td>/);
  assert.match(p, /<h2>6A\. Inviting friends and sharing a result<\/h2>/);
  assert.match(p, /never show you the friend's name or email address|never show you the friend.s name or email address/);
  assert.match(p, /It never shows any writing, feedback or answers/);
  assert.match(p, /hidden from search engines/);
  assert.match(p, /switch a card off at any time and it stops working straight away/);
  assert.match(p, /Deleting your account deletes your cards/);
  assert.match(p, /A shared result card is kept until you switch it off or delete your account/);
  assert.match(p, /Last updated: 9 October 2026/);
});

test("the Terms cover invite rewards and the misuse rule, and numbering for every other section is unchanged", () => {
  const t = read("terms.html");
  assert.match(t, /<h2>2A\. Invites and shared cards<\/h2>/);
  assert.match(t, /may refuse or withdraw rewards/);
  assert.match(t, /use the invite or share features to create fake accounts/);
  for (let n = 1; n <= 17; n++) assert.match(t, new RegExp(`<h2>${n}\\. `), `section ${n}`);
  const p = read("privacy.html");
  for (let n = 1; n <= 16; n++) assert.match(p, new RegExp(`<h2>${n}\\. `), `privacy section ${n}`);
});

test("what the policy says matches what the code stores: a card holds no writing, and rewards have a monthly limit", () => {
  const cards = read("api/_lib/shareCards.js");
  assert.match(cards, /NEVER any writing/);
  const refs = read("api/_lib/referrals.js");
  assert.match(refs, /MAX_REWARDED_PER_MONTH = 5/);
});
