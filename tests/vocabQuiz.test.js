const test = require("node:test");
const assert = require("node:assert/strict");
const { buildQuiz, dedupeByTerm, MIN_TERMS_TO_QUIZ, OPTIONS_PER_QUESTION } = require("../api/_lib/vocabQuiz");

function word(term, definition, createdAt = "2026-01-01") {
  return { term, definition, example: `An example using ${term}.`, createdAt };
}

test("dedupeByTerm: keeps the first (newest) occurrence of a repeated term", () => {
  const words = [
    word("ominous", "newest definition", "2026-03-01"),
    word("ominous", "older definition", "2026-01-01"),
    word("murmur", "a soft sound"),
  ];
  const out = dedupeByTerm(words);
  assert.equal(out.length, 2);
  assert.equal(out.find((w) => w.term === "ominous").definition, "newest definition");
});

test("dedupeByTerm: is case- and whitespace-insensitive on the term", () => {
  const words = [word(" Ominous ", "def1"), word("ominous", "def2")];
  assert.equal(dedupeByTerm(words).length, 1);
});

test(`buildQuiz: fewer than ${MIN_TERMS_TO_QUIZ} distinct terms returns no questions`, () => {
  const words = [word("a", "def a"), word("b", "def b"), word("c", "def c")];
  const result = buildQuiz(words, 5);
  assert.equal(result.questions.length, 0);
  assert.equal(result.available, 3);
  assert.equal(result.minRequired, MIN_TERMS_TO_QUIZ);
});

test("buildQuiz: builds well-formed questions once there are enough distinct terms", () => {
  const words = ["a", "b", "c", "d", "e", "f"].map((t) => word(t, `definition of ${t}`));
  const result = buildQuiz(words, 5);
  assert.equal(result.available, 6);
  assert.equal(result.questions.length, 5);
  for (const q of result.questions) {
    assert.ok(q.term);
    assert.equal(q.options.length, OPTIONS_PER_QUESTION);
    // No duplicate options, and the correct index really does point at
    // this question's own term's definition.
    assert.equal(new Set(q.options).size, OPTIONS_PER_QUESTION);
    assert.equal(q.options[q.correctIndex], `definition of ${q.term}`);
  }
});

test("buildQuiz: asking for more questions than distinct terms exist caps at what's available", () => {
  const words = ["a", "b", "c", "d"].map((t) => word(t, `definition of ${t}`));
  const result = buildQuiz(words, 10);
  assert.equal(result.questions.length, 4);
});

test("buildQuiz: with exactly the minimum, options fall back to fewer than 4 rather than repeating a definition", () => {
  const words = ["a", "b", "c", "d"].map((t) => word(t, `definition of ${t}`));
  const result = buildQuiz(words, 1);
  const q = result.questions[0];
  assert.equal(q.options.length, MIN_TERMS_TO_QUIZ);
  assert.equal(new Set(q.options).size, MIN_TERMS_TO_QUIZ);
});

test("buildQuiz: the same rng sequence produces the same quiz every time", () => {
  const words = ["a", "b", "c", "d", "e"].map((t) => word(t, `definition of ${t}`));
  // A fixed sequence of "random" numbers, replayed identically each call.
  const sequence = [0.9, 0.1, 0.5, 0.7, 0.2, 0.4, 0.6, 0.3, 0.8, 0.05];
  const makeRng = () => { let i = 0; return () => sequence[i++ % sequence.length]; };
  const first = buildQuiz(words, 3, makeRng());
  const second = buildQuiz(words, 3, makeRng());
  assert.deepEqual(first, second);
});

// ------------------------------------------------------------------ a new quiz gives new words

const bank = (n) => Array.from({ length: n }, (_, i) => ({ term: `word${i}`, definition: `definition of word ${i}` }));

test("a new quiz avoids the words from the previous quiz when the bank has enough others", () => {
  const words = bank(12);
  for (let run = 0; run < 100; run++) {
    const first = buildQuiz(words, 5).questions.map((q) => q.term);
    const second = buildQuiz(words, 5, Math.random, first).questions.map((q) => q.term);
    assert.equal(second.length, 5);
    for (const t of second) assert.ok(!first.includes(t), `${t} was repeated straight away`);
  }
});

test("when there are too few other words, the previous ones fill the gap but new words come first", () => {
  const words = bank(7);
  const first = ["word0", "word1", "word2", "word3", "word4"];
  for (let run = 0; run < 50; run++) {
    const terms = buildQuiz(words, 5, Math.random, first).questions.map((q) => q.term);
    assert.equal(terms.length, 5);
    assert.ok(terms.includes("word5") && terms.includes("word6"), "both unseen words must be used");
    assert.equal(new Set(terms).size, 5, "no word twice in one quiz");
  }
});

test("with no exclusions the quiz behaves as before", () => {
  const q = buildQuiz(bank(10), 5);
  assert.equal(q.questions.length, 5);
  for (const item of q.questions) assert.equal(item.options.length, OPTIONS_PER_QUESTION);
});
