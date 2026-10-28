const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { dropInvalidSpellingGrammar } = require("../api/_lib/validate");
const { loadHandler, call, did } = require("./harness");

// Code-side checks on what the model returns, and the "Report a mistake" path that sends a bad
// piece of feedback to the owner's backlog tied to the submission it was about.

const item = (quote, correction, type = "spelling") => ({ quote, correction, type });
const TEXT = "I recieved the letter yesterday. We went to the park and he ran fast.";

test("a spelling fix is kept when its quote is a whole word in the text", () => {
  const p = { spellingGrammar: [item("recieved", "received")], spellingGrammarTotal: 1 };
  dropInvalidSpellingGrammar(p, TEXT);
  assert.equal(p.spellingGrammar.length, 1);
});

test("a spelling fix whose quote only matches inside longer words is dropped, and the total drops with it", () => {
  const p = { spellingGrammar: [item("recieved", "received"), item("he", "she"), item("ecie", "eci")], spellingGrammarTotal: 3 };
  dropInvalidSpellingGrammar(p, "I recieved the letter. They went home.");
  assert.deepEqual(p.spellingGrammar.map((i) => i.quote), ["recieved"]);
  assert.equal(p.spellingGrammarTotal, 1);
});

test("the whole-word rule is for spelling only: grammar and punctuation fragments may sit inside a longer phrase", () => {
  const p = { spellingGrammar: [item("we was", "we were", "grammar"), item("park and", "park, and", "punctuation")], spellingGrammarTotal: 2 };
  dropInvalidSpellingGrammar(p, "Then we was at the park and he ran.");
  assert.equal(p.spellingGrammar.length, 2);
});

test("the claimed total can never exceed the number of words in the piece, nor fall below the items listed", () => {
  const p = { spellingGrammar: [item("recieved", "received")], spellingGrammarTotal: 40 };
  dropInvalidSpellingGrammar(p, "I recieved it");
  assert.equal(p.spellingGrammarTotal, 3);
  const q = { spellingGrammar: [item("recieved", "received")], spellingGrammarTotal: 1 };
  dropInvalidSpellingGrammar(q, TEXT);
  assert.equal(q.spellingGrammarTotal, 1);
});

const AUTH = { authorization: "Bearer a-real-looking-token" };
function ratingDb(inserted) {
  return (q) => {
    if (q.table === "submissions") return { data: { id: "sub-9", kind: "writing" }, error: null };
    if (q.table === "commitments") return { data: { id: "c1" }, error: null };
    if (q.table === "feedback" && did(q, "insert")) { inserted.push(q.ops.find(([n]) => n === "insert")[1]); return { data: null, error: null }; }
    return { data: null, error: null };
  };
}
const rate = (h, body) => call(h, { method: "POST", query: { action: "rating" }, body, headers: AUTH });

test("a mistake report is filed as a bug, names its submission, and counts as a thumbs-down", async () => {
  const inserted = [];
  const res = await rate(loadHandler("email.js", { db: ratingDb(inserted) }), { submissionId: "sub-9", helpfulRating: "down", feedbackText: "It marked 'park' as wrong", mistake: true });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].category, "bug");
  assert.equal(inserted[0].rating, "down");
  assert.equal(inserted[0].message, "MISTAKE REPORT: It marked 'park' as wrong [submission sub-9]");
  assert.equal(inserted[0].profile_id, "user-1");
});

test("a mistake report with no words is still saved, and an ordinary comment is not a bug", async () => {
  const inserted = [];
  const h = loadHandler("email.js", { db: ratingDb(inserted) });
  await rate(h, { submissionId: "sub-9", helpfulRating: "down", mistake: true });
  await rate(h, { submissionId: "sub-9", helpfulRating: "up", feedbackText: "Loved it" });
  assert.equal(inserted[0].message, "MISTAKE REPORT: [submission sub-9]");
  assert.equal(inserted[1].category, "other");
  assert.equal(inserted[1].message, "Loved it");
});

test("the app offers the Report a mistake button on both writing and reading feedback", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  assert.match(html, /Report a mistake/);
  assert.match(html, /mistake: mistake \? true : undefined/);
  assert.equal((html.match(/<ThumbsFeedback /g) || []).length, 2);
});
