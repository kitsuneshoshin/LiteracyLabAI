const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { targetsForGrade, examTargetsFor } = require("../api/_lib/masteryTargets");
const { paragraphise } = require("../api/_lib/passageFormat");
const { buildReadingPassagePrompt } = require("../api/_lib/prompt");
const { did, loadHandler, call } = require("./harness");

// Regression for a real Premium / High School failure: a reading attempt with
// EVERY answer wrong failed all three generation attempts with
//   "glow fabricates comprehension ...; glow does not appear to reference the
//    specific curriculum standard ...; examTechnique[0..2].band must be an
//    integer from 1 to 4"
// The three checks were fighting the model: it was told to praise effort only
// (so it could not also cite a standard), used the word "understanding", and
// echoed the template's quoted band placeholder as a string.

const COUNTRY = "🇦🇺 Australia";
const GRADE = "Year 11";
const PASSAGE = "Mia built a volcano for the science fair. Her brother knocked it over one night. She rebuilt it with her dad until midnight. The next day she smiled at the judges. Sometimes the best ideas come after a mess.";
const QUESTIONS = Array.from({ length: 5 }, (_, i) => ({ q: `Question number ${i + 1} about the passage?`, options: ["Option A", "Option B", "Option C", "Option D"], correct: i % 4 }));
const ALL_WRONG = [1, 2, 3, 0, 1]; // correct answers are 0,1,2,3,0

function db(written) {
  const row = { id: "sub1", child_id: "c1", tier: "high", country: COUNTRY, grade_label: GRADE, interest: "pop", content: { generatedPassage: { title: "The Volcano", skill: "Inference", passage: PASSAGE, questions: QUESTIONS } }, feedback: null };
  return (q) => {
    if (q.table !== "submissions") return { data: null, error: null };
    if (did(q, "single")) return { data: row, error: null };
    if (did(q, "is")) return { data: [{ id: "sub1" }], error: null };
    const upd = q.ops.find(([n]) => n === "update");
    if (upd && upd[1] && upd[1].feedback && !upd[1].feedback._pending) written.push(upd[1]);
    return { data: null, error: null };
  };
}

function modelOutput(bandValue, glow) {
  const targets = targetsForGrade(COUNTRY, GRADE, "high").targets;
  return {
    glow,
    grow: "Go back to the second paragraph and look for the sentence that shows how the writer feels.",
    vocab: [
      { term: "duality", definition: "having two different sides at once.", example: "Progress has a duality of benefit and harm." },
      { term: "juxtaposition", definition: "placing two things side by side to compare them.", example: "The juxtaposition of rich and poor was striking." },
    ],
    growNext: "Once that feels natural, pick the next question and write which sentence in the passage best supports the main claim.",
    glowTarget: targets[0].name,
    growTarget: targets[1] ? targets[1].name : targets[0].name,
    examTechnique: examTargetsFor(targets, "reading").map((t) => ({ criterion: t.name, band: bandValue, descriptor: "Emerging", evidence: "Question 1 was answered incorrectly", toNextBand: "Re-read the passage and find the sentence that supports the answer." })),
    examSummary: "Reading closely for the writer's claim would help the most next.",
    questionReview: [1, 2, 3, 4, 5].map((n) => ({ n, explanation: `Question ${n}: the correct answer is supported by the passage.`, evidence: "She rebuilt it with her dad until midnight" })),
  };
}

// The exact glow from the failing screenshot.
const BAD_GLOW = "You gave this passage a real go, and that's exactly the habit that builds stronger reading over time. As you progress, you'll find that examining your understanding is key for deeper connections to texts.";
const GOOD_GLOW = "Tackling a tricky passage like this takes real effort, and you stuck with it to the end.";

async function submit(script) {
  const written = [];
  const h = loadHandler("submit.js", { plan: "premium", db: db(written), generate: async () => ({ parsed: JSON.parse(JSON.stringify(script)), modelUsed: "stub" }) });
  const res = await call(h, { method: "POST", body: { kind: "reading", submissionId: "sub1", answers: ALL_WRONG } });
  return { res, written };
}

for (const [label, band] of [["a quoted number", "1"], ["'Band 2' text", "Band 2"], ["zero for 'not attempted'", 0], ["a real integer", 2]]) {
  test(`0-correct reading (Premium, High School): exam bands given as ${label} are accepted`, async () => {
    const { res, written } = await submit(modelOutput(band, BAD_GLOW));
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    for (const e of res.body.feedback.examTechnique) assert.ok(Number.isInteger(e.band) && e.band >= 1 && e.band <= 4, `band ${e.band}`);
    assert.equal(written.length, 1);
  });
}

test("0-correct reading: a glow that claims understanding is replaced with an honest effort sentence, not failed", async () => {
  const { res } = await submit(modelOutput(1, BAD_GLOW));
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.ok(!/understanding/i.test(res.body.feedback.glow), res.body.feedback.glow);
  assert.match(res.body.feedback.glow, /real go/);
});

test("0-correct reading: a good effort-only glow that cites no standard is kept as written", async () => {
  const { res } = await submit(modelOutput(1, GOOD_GLOW));
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.feedback.glow, GOOD_GLOW);
});

test("a band that is genuinely out of range (or missing) is still rejected", async () => {
  for (const bad of [7, null, "high"]) {
    const { res } = await submit(modelOutput(bad, GOOD_GLOW));
    assert.equal(res.statusCode, 502, `band ${bad} should fail`);
  }
});

// ------------------------------------------------------------------ paragraphs

const LONG = "In the pantheon of human advancement, few ideas are as bewildering as progress. It is often described as a forward march. Yet it hides an unsettling duality. Take the Industrial Revolution. It brought engineering feats and economic growth. It also caused environmental damage and deep divisions between classes. Consider smartphones next. They revolutionised communication. They also fostered distraction and eroded face-to-face contact. We must therefore scrutinise the stories we tell about progress. Only then can we harness its benefits. An uncritical embrace of progress risks repeating old mistakes. Prominent thinkers have debated this for centuries. The rhetoric around progress almost always skews towards optimism, and the prevailing discourse overlooks the collateral damage done in the name of advancement.";

test("passages: one dense block is regrouped into paragraphs at sentence boundaries", () => {
  const out = paragraphise(LONG);
  const paras = out.split("\n\n");
  assert.ok(paras.length >= 2 && paras.length <= 5, `${paras.length} paragraphs`);
  assert.equal(paras.join(" "), LONG, "no words lost or reordered");
  for (const p of paras) assert.match(p, /[.!?]$/, "each paragraph ends on a full sentence");
});

test("passages: paragraphs the model already wrote are kept", () => {
  assert.equal(paragraphise("First paragraph here.\n\nSecond paragraph here."), "First paragraph here.\n\nSecond paragraph here.");
  assert.equal(paragraphise("First line.\nstill first.\n\n\n\nSecond."), "First line. still first.\n\nSecond.");
});

test("passages: a short passage stays a single paragraph", () => {
  assert.equal(paragraphise("Mia built a volcano. It fell over. She rebuilt it."), "Mia built a volcano. It fell over. She rebuilt it.");
});

test("passages: the generation prompt asks for paragraphs at every age", () => {
  for (const tier of ["early", "elementary", "middle", "high"]) {
    const p = buildReadingPassagePrompt({ tier, country: COUNTRY, gradeLabel: "Year 5" });
    assert.match(p, /paragraphs/, tier);
    assert.match(p, /blank line between paragraphs/, tier);
    assert.ok(p.includes("separate paragraphs with \\n\\n)"), `${tier}: the prompt must show the literal \\n\\n separator`);
  }
});

test("app.html renders passage paragraphs as separate blocks", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  assert.ok(app.includes("function passageParagraphs") && app.includes("re.exec(text)"), "the passage is split on blank lines, paragraph by paragraph");
});

// ------------------------------------------------------------------ question review voice and interest

const { buildReadingPrompt } = require("../api/_lib/prompt");
function readingPrompt(interest) {
  const targets = targetsForGrade(COUNTRY, GRADE, "high").targets;
  return buildReadingPrompt({
    tier: "high", country: COUNTRY, gradeLabel: GRADE, interest, confidenceReading: "growing", motivation: "grades",
    passageTitle: "The Volcano", passage: PASSAGE, questions: QUESTIONS, answers: ALL_WRONG, score: 0, totalQuestions: 5,
    targets, targetNames: targets.map((t) => t.name), capabilities: {},
  });
}

test("question review: explanations are tied to the learner's interest where it fits, and never forced", () => {
  const p = readingPrompt("gaming");
  assert.match(p, /through the student's interest \(gaming\)/);
  assert.match(p, /never force it/);
  assert.match(p, /never let it replace the reason the answer is right/);
});

test("question review: explanations speak to the learner as 'you', not about 'the student'", () => {
  const p = readingPrompt("gaming");
  assert.match(p, /written directly to the student as "you" \(never "the student"\)/);
});

test("question review: with no interest the prompt carries no interest instruction", () => {
  assert.ok(!/short comparison or example/.test(readingPrompt("")));
  assert.match(readingPrompt("gaming"), /short comparison or example/);
});

// ------------------------------------------------------------------ exam scoring on a reading task

test("reading exam scoring: 'not attempted' evidence is replaced with the real facts, since every question was answered", async () => {
  const out = modelOutput(1, GOOD_GLOW);
  out.examTechnique.forEach((e) => { e.evidence = "not attempted"; });
  const { res } = await submit(out);
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  for (const e of res.body.feedback.examTechnique) assert.equal(e.evidence, "All 5 questions were answered incorrectly.");
});

test("reading exam scoring: evidence that names real questions is left alone", async () => {
  const out = modelOutput(1, GOOD_GLOW);
  out.examTechnique.forEach((e) => { e.evidence = "Q2 and Q4 answered incorrectly"; });
  const { res } = await submit(out);
  for (const e of res.body.feedback.examTechnique) assert.equal(e.evidence, "Q2 and Q4 answered incorrectly");
});

test("reading exam scoring: the prompt forbids 'not attempted' and writing advice on a reading task", () => {
  const targets = targetsForGrade(COUNTRY, GRADE, "high").targets;
  const p = buildReadingPrompt({
    tier: "high", country: COUNTRY, gradeLabel: GRADE, interest: "pop", confidenceReading: "growing", motivation: "grades",
    passageTitle: "The Volcano", passage: PASSAGE, questions: QUESTIONS, answers: ALL_WRONG, score: 0, totalQuestions: 5,
    targets, targetNames: targets.map((t) => t.name), capabilities: { examTechnique: true },
  });
  assert.match(p, /never say an objective was "not attempted"/);
  assert.match(p, /advice for READING practice/);
  const w = require("../api/_lib/prompt").buildWritingPrompt({
    tier: "high", country: COUNTRY, gradeLabel: GRADE, interest: "pop", prompt: "Write.", text: "Some text here.",
    targets, targetNames: targets.map((t) => t.name), capabilities: { examTechnique: true }, genre: "persuasive",
  });
  assert.ok(!/READING task/.test(w), "the writing prompt must not carry the reading note");
});
