const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const QT = require("../api/_lib/questionTypes");

// app.html is one big in-browser script, so its reading helpers can't be imported. They are copied out
// of the source text and run here, to prove the page and the server agree on what counts as answered,
// right, and part of the instant score. If they drift, a student could see a tick the server marked wrong.
const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const start = APP.indexOf("const qStyle = ");
const end = APP.indexOf("const Q_STYLE_NAME");
assert.ok(start > 0 && end > start, "the reading helpers are in app.html");
const client = new Function(APP.slice(start, end) + "\nreturn { qStyle, qIsAnswered, qIsRight, qIsAuto, qAutoCount, qAnswerText, qCorrectText };")();

const stored = [
  { type: "mc", q: "q", options: ["a", "b", "c", "d"], correct: 2 },
  { type: "tfng", q: "s", options: QT.TFNG_OPTIONS, correct: 1 },
  { type: "evidence", q: "e", options: ["a", "b", "c", "d"], correct: 0 },
  { type: "order", q: "o", items: ["w", "x", "y", "z"], correct: [1, 0, 3, 2] },
  { type: "match", q: "m", items: ["p", "q", "r"], options: ["1", "2", "3"], correct: [2, 0, 1] },
  { type: "cloze", q: "c", text: "a ___ b ___", blanks: [["a", "b", "c", "d"], ["a", "b", "c", "d"]], correct: [3, 1] },
  { type: "short", q: "why", marks: 3, modelAnswer: "because", keyPoints: ["a", "b"] },
];
const candidates = (q) => {
  const base = [undefined, null, "", "x", "  ", "A written answer.", 0, 1, 2, 3, 5, -1, 1.5, [], [0], [0, 1], [1, 0, 3, 2], [2, 0, 1], [3, 1], [3, 1, 0], [0, 0, 0, 0], ["1", "0"], {}];
  return base.concat(Array.isArray(q.correct) ? [q.correct.slice()] : q.correct !== undefined ? [q.correct] : []);
};

test("the page and the server agree on answered, right and auto-marked for every style and every kind of answer", () => {
  for (const q of stored) {
    assert.equal(client.qStyle(q), QT.styleOf(q));
    assert.equal(client.qIsAuto(q), QT.isAuto(q), q.type);
    for (const a of candidates(q)) {
      assert.equal(client.qIsAnswered(q, a), QT.isAnswered(q, a), `${q.type} answered? ${JSON.stringify(a)}`);
      assert.equal(client.qIsRight(q, a), QT.isRight(q, a), `${q.type} right? ${JSON.stringify(a)}`);
    }
  }
  assert.equal(client.qAutoCount(stored), QT.autoTotal(stored));
  assert.equal(QT.autoTotal(stored), 6);
});

test("a written answer is never auto-right, and a right answer set to the key is right in both", () => {
  for (const q of stored) {
    if (q.type === "short") { assert.equal(client.qIsRight(q, "anything at all"), false); continue; }
    assert.equal(client.qIsRight(q, q.correct), true, q.type);
    assert.equal(QT.isRight(q, q.correct), true, q.type);
  }
});

test("the page's plain-words answer text names the real option, and never crashes on a garbled answer", () => {
  assert.equal(client.qAnswerText(stored[0], 2), "c");
  assert.match(client.qAnswerText(stored[3], [1, 0, 3, 2]), /1\. x\s+2\. w\s+3\. z\s+4\. y/);
  assert.match(client.qAnswerText(stored[5], [3, 1]), /d, b/);
  assert.match(client.qCorrectText(stored[4]), /p = 3; q = 1; r = 2/);
  assert.equal(client.qAnswerText(stored[6], "  Because it was busy. "), "Because it was busy.");
  for (const q of stored) for (const a of candidates(q)) assert.doesNotThrow(() => client.qAnswerText(q, a));
});
