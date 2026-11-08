const test = require("node:test");
const assert = require("node:assert/strict");
const { buildInbox, validateUpdate, submissionIdOf, cleanMessage } = require("../api/_lib/feedbackInbox");

// The owner's feedback inbox: who sent it, which piece a mistake report was about, and what the owner may change.

const SUB = "5ef4eac6-c40c-496c-b171-a6e3b9b4ff55";
const rows = [
  { id: "f1", created_at: "2026-11-07T22:04:00Z", profile_id: "p1", source: "app", email_key: "app-writing", rating: "down", category: "bug", message: `MISTAKE REPORT: It's to hard [submission ${SUB}]`, contact_ok: false, status: "new", priority: null, owner_notes: null },
  { id: "f2", created_at: "2026-11-06T10:00:00Z", profile_id: null, source: "email", email_key: "welcome", rating: null, category: "idea", message: "More dragons", contact_ok: false, status: "done", priority: "low", owner_notes: "Added" },
  { id: "f3", created_at: "2026-11-05T10:00:00Z", profile_id: "p1", source: "app", email_key: "app-reading", rating: "down", category: "bug", message: "MISTAKE REPORT: wrong [submission 00000000-0000-4000-8000-000000000000]", contact_ok: true, status: "triaged", priority: "high", owner_notes: null },
];
const profiles = [{ id: "p1", email: "parent@example.com", plan: "core" }];
const children = [{ id: "c1", profile_id: "p1", display_name: "Audrey" }];
const submissions = [{
  id: SUB, child_id: "c1", kind: "writing", country: "US", grade_label: "Grade 3", interest: "gaming", created_at: "2026-11-02T19:49:53Z", score: null, total_questions: null,
  content: { text: "Hi! My name is Audrey.", generatedPrompt: { genre: "narrative", title: "The Map Under the Slide", prompt: "Find a map." } },
  feedback: { overallScore: 5, glow: "Nice clues.", grow: "Join sentences.", scoreReason: "Short." },
}];

test("a mistake report is tied to its piece, with the tag hidden from the message", () => {
  assert.equal(submissionIdOf(rows[0].message), SUB);
  assert.equal(cleanMessage(rows[0].message), "MISTAKE REPORT: It's to hard");
  const inbox = buildInbox({ rows, profiles, children, submissions });
  const a = inbox.items[0];
  assert.equal(a.isMistakeReport, true);
  assert.equal(a.person.email, "parent@example.com");
  assert.deepEqual(a.person.learners, ["Audrey"]);
  assert.equal(a.piece.child, "Audrey");
  assert.equal(a.piece.score, 5);
  assert.equal(a.piece.prompt.title, "The Map Under the Slide");
  assert.equal(a.piece.written, "Hi! My name is Audrey.");
});

test("anonymous feedback has no person, and a missing piece is flagged instead of failing", () => {
  const inbox = buildInbox({ rows, profiles, children, submissions });
  assert.equal(inbox.items[1].person, null);
  assert.equal(inbox.items[1].piece, null);
  assert.equal(inbox.items[2].pieceMissing, true);
  assert.equal(inbox.items[2].contactOk, true);
  assert.deepEqual([inbox.counts.total, inbox.counts.new, inbox.counts.triaged, inbox.counts.done], [3, 1, 1, 1]);
});

test("the owner can change only status, priority and notes, and only to known values", () => {
  assert.deepEqual(validateUpdate({ status: "done", priority: "high", notes: " handled ", message: "hacked", profile_id: "x" }).patch, { status: "done", priority: "high", owner_notes: "handled" });
  assert.deepEqual(validateUpdate({ priority: "" }).patch, { priority: null });
  assert.ok(validateUpdate({ status: "deleted" }).error);
  assert.ok(validateUpdate({ priority: "urgent" }).error);
  assert.ok(validateUpdate({ notes: "x".repeat(4001) }).error);
  assert.ok(validateUpdate({}).error);
});
