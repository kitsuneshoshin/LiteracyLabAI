const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadHandler, call } = require("./harness");

// A parent opening an earlier piece from the dashboard's activity list: what the learner wrote and the feedback they
// were given. Before this the list showed one line per piece and nothing opened.

const writing = {
  id: "w1", kind: "writing", tier: "middle", country: "🇬🇧 United Kingdom", grade_label: "Year 7", interest: "space",
  content: { generatedPrompt: { title: "The Last Rocket", prompt: "Write about a launch." }, text: "The rocket roared." },
  score: null, total_questions: null, word_count: 3, created_at: "2026-10-05T10:00:00Z",
  feedback: { glow: "Vivid verbs.", grow: "Add a setting.", overallScore: 7 },
};
const db = (rows) => (q) => {
  if (q.table !== "submissions") return { data: null, error: null };
  const ids = q.ops.find(([n]) => n === "select")[1] === "id";
  if (ids) return { data: rows.map((r) => ({ id: r.id })), error: null };
  return { data: rows[0] || null, error: null };
};
const get = (plan, rows, submissionId) => call(loadHandler("history.js", { plan, db: db(rows) }), { method: "GET", query: { childId: "c1", submissionId } });

test("opening a past writing piece returns the prompt, the learner's own text and the saved feedback", async () => {
  const res = await get("core", [writing], "w1");
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.text, "The rocket roared.");
  assert.equal(res.body.prompt.title, "The Last Rocket");
  assert.equal(res.body.feedback.glow, "Vivid verbs.");
  assert.equal(res.body.gradeLabel, "Year 7");
});

test("a piece outside what the plan's activity list shows cannot be opened, and one that is not this learner's is not found", async () => {
  const res = await get("free", [{ id: "other" }], "w1");
  assert.equal(res.statusCode, 404);
  const none = await get("core", [writing], "w1");
  assert.equal(none.statusCode, 200);
});

test("a plan without the whole-piece score does not see one on an older piece either", async () => {
  const res = await get("free", [writing], "w1");
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.feedback.overallScore, null);
});

test("the activity list has a way in: finished rows open the piece, and the dashboard renders it", () => {
  const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  assert.match(APP, /View writing & feedback/);
  assert.match(APP, /submissionId=\$\{submissionId\}/);
  assert.match(APP, /<PastPiece /);
});
