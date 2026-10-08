const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { capabilitiesFor } = require("../api/_lib/plans");
const { buildWritingPrompt, buildReadingPrompt, buildReadingPassagePrompt } = require("../api/_lib/prompt");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const COUNTRY = "🇦🇺 Australia";

// ---------------------------------------------------------------- stricter marking on the Free plan
test("only the Free plan carries the strict standard", () => {
  assert.equal(capabilitiesFor("free").strictStandard, true);
  assert.equal(capabilitiesFor("core").strictStandard, false);
  assert.equal(capabilitiesFor("premium").strictStandard, false);
  assert.equal(capabilitiesFor("pro").strictStandard, false, "the old single paid plan is treated as Premium");
});

test("writing feedback for Free is told to hold the piece to the full grade standard, and Core and Premium are not changed", () => {
  const args = (plan) => ({ tier: "middle", country: COUNTRY, gradeLabel: "Year 8", interest: "football", prompt: "Write a story.", text: "The dog ran down the road and then he stopped at the gate. ".repeat(6), targets: [], targetNames: ["A"], genre: "narrative", capabilities: capabilitiesFor(plan) });
  const free = buildWritingPrompt(args("free"));
  assert.match(free, /STRICT STANDARD/);
  assert.match(free, /do not round up/i);
  assert.match(free, /says so plainly and concretely/);
  for (const plan of ["core", "premium"]) assert.doesNotMatch(buildWritingPrompt(args(plan)), /STRICT STANDARD/, plan);
});

test("reading feedback for Free names exactly why wrong answers fail, and the other plans are unchanged", () => {
  const q = { type: "mc", question: "Q?", options: ["a", "b", "c", "d"], answer: 1, skill: "Inference" };
  const base = { tier: "middle", country: COUNTRY, gradeLabel: "Year 8", interest: "space", passageTitle: "T", passage: "A short passage about a cake stall and a girl.", questions: [q], answers: [0], score: 0, totalQuestions: 1, targetNames: [], targets: [] };
  const free = buildReadingPrompt({ ...base, capabilities: capabilitiesFor("free") });
  assert.match(free, /STRICT STANDARD/);
  assert.match(free, /for every wrong answer say exactly why/);
  assert.doesNotMatch(buildReadingPrompt({ ...base, capabilities: capabilitiesFor("core") }), /STRICT STANDARD/);
  assert.doesNotMatch(buildReadingPrompt({ ...base, capabilities: capabilitiesFor("premium") }), /STRICT STANDARD/);
});

test("Free reading passages ask for mostly inference questions and tempting wrong options", () => {
  const args = { tier: "middle", country: COUNTRY, gradeLabel: "Year 8" };
  const strict = buildReadingPassagePrompt({ ...args, strict: true });
  assert.match(strict, /at least half of the \d+ questions must need inference/);
  assert.match(strict, /tempting to a reader who skimmed/);
  const normal = buildReadingPassagePrompt(args);
  assert.doesNotMatch(normal, /at least half of the/);
  assert.match(normal, /at least two of the \d+ questions must need inference/);
  const src = fs.readFileSync(path.join(__dirname, "..", "api", "reading-passage.js"), "utf8");
  assert.match(src, /strictStandard/);
  assert.equal((src.match(/, strict \}\)/g) || []).length, 2, "the fallback prompt is strict too");
});

// ---------------------------------------------------------------- vocabulary: clearing known words
function vocabHelpers() {
  const a = APP.indexOf("const VOCAB_BOXES = 4;"), b = APP.indexOf("const vocabDeck =");
  assert.ok(a > 0 && b > a);
  return new Function(APP.slice(a, b) + "\nreturn { vocabVisible, vocabNextBox, VOCAB_BOXES };")();
}
const W = (t, d = "") => ({ term: t, definition: d });

test("known words are tucked away so the list does not keep growing, but can be shown or searched", () => {
  const { vocabVisible, VOCAB_BOXES } = vocabHelpers();
  const words = [W("claustrophobic", "cramped"), W("ominous", "threatening"), W("meticulous", "very careful")];
  const boxes = { claustrophobic: { box: VOCAB_BOXES - 1, at: 1 }, ominous: { box: 1, at: 1 } };
  assert.deepEqual(vocabVisible(words, boxes, false, "").map((w) => w.term), ["ominous", "meticulous"], "the known word is hidden");
  assert.deepEqual(vocabVisible(words, boxes, true, "").map((w) => w.term), ["claustrophobic", "ominous", "meticulous"], "shown on request");
  assert.deepEqual(vocabVisible(words, boxes, false, "claus").map((w) => w.term), ["claustrophobic"], "a search still finds a known word");
  assert.deepEqual(vocabVisible(words, boxes, false, "VERY CAREFUL").map((w) => w.term), ["meticulous"], "searches the meaning too, ignoring case");
  assert.deepEqual(vocabVisible(null, {}, false, ""), []);
});

test("the page offers 'I know this' and 'Bring back', explains the bars, and saves the change like any other practice", () => {
  assert.match(APP, /I know this<\/button>|\/> I know this<\/button>/);
  assert.match(APP, /Bring back to practice/);
  assert.match(APP, /setWordBox\(v\.term, VOCAB_BOXES - 1\)/, "clearing sets the word to Know it");
  assert.match(APP, /setWordBox\(v\.term, 1\)/, "bringing back puts it into practice");
  assert.match(APP, /The bars on each card show how well you know the word: New, Learning, Nearly there, Know it/);
  assert.match(APP, /Show known words \(/);
  // the same save path as practice: this device, then the account
  const fn = APP.slice(APP.indexOf("function setWordBox"), APP.indexOf("function startCards"));
  assert.match(fn, /saveVocabBoxes\(childId, next\)/);
  assert.match(fn, /\/api\/history/);
});
