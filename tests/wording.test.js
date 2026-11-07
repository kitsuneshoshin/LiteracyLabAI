const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildWritingPrompt, buildReadingPrompt } = require("../api/_lib/prompt");
const { plainStandardInGlow } = require("../api/_lib/validate");
const { targetsForGrade } = require("../api/_lib/masteryTargets");
const { standardsFor } = require("../api/_lib/curriculum");

// Wording of the feedback children and parents read: no exam-speak for young children, interest comparisons only where
// they help (never for the youngest), and curriculum codes kept out of the sentence.

const US = "🇺🇸 United States";
function writing(tier, gradeLabel, motivation = "grades") {
  const { targets } = targetsForGrade(US, gradeLabel, tier);
  return buildWritingPrompt({ tier, country: US, gradeLabel, interest: "coding", confidenceWriting: "growing", motivation, prompt: "Write a story.", text: "I went to the park and played.", targetNames: targets.map((t) => t.name), targets, capabilities: {}, genre: "narrative" });
}
function reading(tier, gradeLabel) {
  const { targets } = targetsForGrade(US, gradeLabel, tier);
  return buildReadingPrompt({ tier, country: US, gradeLabel, interest: "coding", confidenceReading: "growing", motivation: "grades", passageTitle: "T", passage: "A short passage.", questions: [{ q: "Q?", type: "mc", options: ["a", "b"], correct: 0 }], answers: [0], score: 1, totalQuestions: 1, targetNames: targets.map((t) => t.name), targets, capabilities: {} });
}

test("ages 8 to 10 are never told to please a grader or examiner; middle and high school keep the exam wording", () => {
  for (const build of [() => writing("elementary", "Grade 3"), () => reading("elementary", "Grade 3")]) {
    const p = build();
    assert.ok(!/what an examiner or grader would/.test(p), "the exam-speak goal note is gone for this age");
    assert.match(p, /never 'grader', 'examiner'/);
  }
  assert.match(writing("middle", "Grade 7"), /examiner or grader would specifically reward/);
  assert.match(writing("high", "Grade 10"), /examiner or grader would specifically reward/);
});

test("the interest rule: none at all for the youngest, at most one helpful comparison for everyone else, in writing and reading", () => {
  for (const p of [writing("early", "Kindergarten"), reading("early", "Kindergarten")]) {
    assert.match(p, /do not compare anything to the student's interest anywhere/);
    assert.ok(!/at most ONE short comparison/.test(p));
  }
  for (const p of [writing("elementary", "Grade 3"), reading("middle", "Grade 7"), writing("high", "Grade 10")]) {
    assert.match(p, /at most ONE short comparison/);
    assert.match(p, /Never explain a word, a skill or a mistake in programming or game terms/);
  }
});

test("vocabulary is defined in plain words and exampled in everyday life, not built around the interest", () => {
  for (const p of [writing("elementary", "Grade 3"), reading("elementary", "Grade 3")]) {
    assert.ok(!/framed using their interest/.test(p));
    assert.ok(!/built around their stated interest/.test(p));
    assert.match(p, /in plain everyday words, with no comparison to their interest/);
    assert.match(p, /set in everyday life or school/);
    assert.ok(!/Weave in an analogy/.test(p), "the reading Grow's comparison is optional");
  }
});

test("a curriculum code is taken out of the glow sentence and kept as glowStandard", () => {
  const list = standardsFor(US, "elementary", "Grade 3");
  const std = list.find((s) => /Referring Explicitly/.test(s));
  const name = std.replace(/\s*\(.*\)$/, "");
  const fb = { glow: `You used the clues clearly. That matches "${std}" because you point to exact details.` };
  plainStandardInGlow(fb, list);
  assert.equal(fb.glow, `You used the clues clearly. That matches "${name}" because you point to exact details.`);
  assert.equal(fb.glowStandard, std);

  // Only the bracketed code, without the name beside it.
  const ref = /\(([^()]+)\)\s*$/.exec(std)[1];
  const fb2 = { glow: `You pointed to the text (${ref}) very clearly.` };
  plainStandardInGlow(fb2, list);
  assert.equal(fb2.glow, "You pointed to the text very clearly.");
  assert.equal(fb2.glowStandard, std);
});

test("a glow with no code, an unmapped region, or a non-string glow is left exactly as it was", () => {
  const list = standardsFor(US, "elementary", "Grade 3");
  const fb = { glow: "You used the clues clearly and said why." };
  plainStandardInGlow(fb, list);
  assert.deepEqual(fb, { glow: "You used the clues clearly and said why." });
  const fb2 = { glow: "A glow (with brackets) here." };
  plainStandardInGlow(fb2, null);
  assert.equal(fb2.glow, "A glow (with brackets) here.");
  assert.doesNotThrow(() => plainStandardInGlow({ glow: null }, list));
  assert.equal(plainStandardInGlow(null, list), null);
});

test("every mapped region's standards survive the clean-up: the name stays in the sentence, so the glow still passes the standard check", () => {
  const { mentionsAStandard } = (() => {
    // Not exported: re-run the real validator on a glow that has been cleaned.
    const { validateFeedback } = require("../api/_lib/validate");
    return { mentionsAStandard: (glow, list) => !validateFeedback({ glow }, { tier: "elementary", standardsList: list, targetNames: [], submittedText: "x" }).issues.some((i) => /curriculum standard/.test(i)) };
  })();
  for (const [country, tier, grade] of [[US, "elementary", "Grade 3"], ["🇬🇧 United Kingdom", "elementary", "Year 5"], ["🇨🇦 Canada", "elementary", "Grade 5"], ["🇳🇿 New Zealand", "middle", "Year 7"]]) {
    const list = standardsFor(country, tier, grade);
    for (const std of list) {
      const fb = { glow: `You did this well, which fits ${std} nicely.` };
      plainStandardInGlow(fb, list);
      assert.ok(!/\(/.test(fb.glow), `no bracket left in: ${fb.glow}`);
      assert.ok(mentionsAStandard(fb.glow, list), `still names the standard: ${fb.glow}`);
    }
  }
});

test("wiring: submit.js and the quality check both run the vocabulary trim", () => {
  for (const f of ["api/submit.js", "api/_lib/qaRun.js"]) assert.match(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), /TECH\.trimExtraVocab\(/);
});

test("wiring: both successful paths in submit.js clean the glow, and nothing in the app needed to change", () => {
  const submit = fs.readFileSync(path.join(__dirname, "..", "api", "submit.js"), "utf8");
  assert.equal((submit.match(/plainStandardInGlow\(attempt\.parsed, standardsList\)/g) || []).length, 2);
});

// ---- small repairs found by the live quality check on 7 Nov: a text total and a third vocab word cost a retry each

const { coerceSpellingTotal, dropInvalidSpellingGrammar, validateFeedback } = require("../api/_lib/validate");
const TECH = require("../api/_lib/techniques");

test("spelling total: a numeric string becomes a number, a missing or non-numeric total becomes the listed count, a real number is left alone", () => {
  const items = [{ quote: "a", correction: "b", type: "spelling" }, { quote: "c", correction: "d", type: "spelling" }];
  assert.equal(coerceSpellingTotal({ spellingGrammar: items, spellingGrammarTotal: "3" }).spellingGrammarTotal, 3);
  assert.equal(coerceSpellingTotal({ spellingGrammar: items, spellingGrammarTotal: " 7 " }).spellingGrammarTotal, 7);
  assert.equal(coerceSpellingTotal({ spellingGrammar: items }).spellingGrammarTotal, 2);
  assert.equal(coerceSpellingTotal({ spellingGrammar: items, spellingGrammarTotal: null }).spellingGrammarTotal, 2);
  assert.equal(coerceSpellingTotal({ spellingGrammar: items, spellingGrammarTotal: "many" }).spellingGrammarTotal, 2);
  assert.equal(coerceSpellingTotal({ spellingGrammar: items, spellingGrammarTotal: 5 }).spellingGrammarTotal, 5);
  assert.equal(coerceSpellingTotal({ spellingGrammar: [], spellingGrammarTotal: undefined }).spellingGrammarTotal, 0);
  assert.deepEqual(coerceSpellingTotal({ glow: "x" }), { glow: "x" }, "no spelling list: untouched");
});

test("spelling total: the repair runs inside dropInvalidSpellingGrammar, so the real-check failure no longer needs a retry", () => {
  const parsed = { spellingGrammar: [{ quote: "teh", correction: "the", type: "spelling" }], spellingGrammarTotal: "1" };
  dropInvalidSpellingGrammar(parsed, "I saw teh dog.", "🇬🇧 United Kingdom");
  assert.equal(parsed.spellingGrammarTotal, 1);
  assert.ok(Number.isInteger(parsed.spellingGrammarTotal));
});

test("vocabulary: a third word is trimmed away; one word too few is still refused", () => {
  const w = (t) => ({ term: t, definition: "d", example: `a ${t}`, trick: "a short trick here" });
  const three = TECH.trimExtraVocab({ vocab: [w("a"), w("b"), w("c")] });
  assert.deepEqual(three.vocab.map((v) => v.term), ["a", "b"]);
  const one = TECH.trimExtraVocab({ vocab: [w("a")] });
  assert.equal(one.vocab.length, 1);
  const issues = validateFeedback({ glow: "You did well on this one.", grow: "Try this next.", vocab: one.vocab }, { tier: "elementary", standardsList: [], targetNames: [], submittedText: "x" }).issues;
  assert.ok(issues.some((i) => /exactly 2 items/.test(i)));
});
