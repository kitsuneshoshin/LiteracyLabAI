const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { GRADE_AGE, READING_BY_AGE, READING_BY_CEFR, WRITING_BY_AGE, WRITING_BY_CEFR, levelFor, readability } = require("../api/_lib/gradeLevel");
const { GRADE_WORD_TARGETS } = require("../api/_lib/writingLimits");
const { validatePassage, validateWritingPrompt } = require("../api/_lib/validate");
const { buildReadingPassagePrompt, buildWritingPromptGenerator } = require("../api/_lib/prompt");

const UK = "🇬🇧 United Kingdom";
const QUESTIONS = Array.from({ length: 5 }, (_, i) => ({ type: "mc", q: `Question ${i + 1}?`, options: ["a", "b", "c", "d"].map((x) => x + i), correct: 0 }));

// Every grade the app offers, read straight from app.html so this cannot drift from it.
function appGrades() {
  const html = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  const out = {};
  for (const m of html.matchAll(/^\s*"([^"]+)":\s*\{\s*curriculum:[^\n]*?grades:\s*\[([^\]]*)\]/gm)) {
    out[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((g) => g[1]);
  }
  return out;
}

test("every grade in the app has an age (or a CEFR level) and the same grades the word targets use", () => {
  const grades = appGrades();
  assert.equal(Object.keys(grades).length, 12, "all twelve syllabuses found in app.html");
  for (const [country, list] of Object.entries(grades)) {
    if (/Global ESL/.test(country)) {
      for (const g of list) assert.ok(levelFor(country, g, "middle").cefr, `${g} has a CEFR level`);
      continue;
    }
    assert.deepEqual(Object.keys(GRADE_AGE[country] || {}), list, `${country}: ages cover exactly the grades in the app, in order`);
    assert.deepEqual(Object.keys(GRADE_WORD_TARGETS[country]), list, `${country}: word targets cover the same grades`);
    const ages = list.map((g) => GRADE_AGE[country][g]);
    ages.forEach((a, i) => { assert.ok(a >= 5 && a <= 18, `${list[i]} age in range`); if (i) assert.ok(a >= ages[i - 1], `${country}: ages never go down at ${list[i]}`); });
  }
});

test("the reading bands rise year by year and never skip: more words, longer sentences, a higher ceiling", () => {
  const rungs = (table) => Object.keys(table).sort((a, b) => (a > b ? 1 : -1));
  const ages = Object.keys(READING_BY_AGE).map(Number).sort((a, b) => a - b);
  assert.deepEqual(ages, Array.from({ length: 14 }, (_, i) => i + 5), "one band for every age from 5 to 18");
  for (let i = 1; i < ages.length; i++) {
    const a = READING_BY_AGE[ages[i - 1]], b = READING_BY_AGE[ages[i]];
    assert.ok(b.words[0] > a.words[0] && b.words[1] > a.words[1], `words rise at age ${ages[i]}`);
    assert.ok(b.avg >= a.avg && b.fk > a.fk, `sentence length and ceiling rise at age ${ages[i]}`);
    assert.ok(b.words[1] - a.words[1] <= 70, `no big jump in length at age ${ages[i]}`);
  }
  const cefr = rungs(READING_BY_CEFR);
  for (let i = 1; i < cefr.length; i++) assert.ok(READING_BY_CEFR[cefr[i]].words[1] > READING_BY_CEFR[cefr[i - 1]].words[1] && READING_BY_CEFR[cefr[i]].fk > READING_BY_CEFR[cefr[i - 1]].fk, `${cefr[i]} harder than ${cefr[i - 1]}`);
  const wages = Object.keys(WRITING_BY_AGE).map(Number).sort((a, b) => a - b);
  for (let i = 1; i < wages.length; i++) assert.ok(WRITING_BY_AGE[wages[i]].maxWords > WRITING_BY_AGE[wages[i - 1]].maxWords, `prompts may be longer at age ${wages[i]}`);
  assert.ok(WRITING_BY_CEFR.C2.maxWords > WRITING_BY_CEFR.A1.maxWords);
});

test("a Reception child is no longer given a Year 2 passage, and Year 10 is not given Year 13's", () => {
  const lengthOf = (country, grade, tier) => buildReadingPassagePrompt({ tier, country, gradeLabel: grade }).match(/roughly (\d+)-(\d+) words/).slice(1).map(Number);
  assert.deepEqual(lengthOf(UK, "Reception", "early"), [35, 60]);
  assert.ok(lengthOf(UK, "Reception", "early")[1] <= lengthOf(UK, "Year 2", "early")[1]);
  assert.ok(lengthOf(UK, "Year 10", "high")[1] < lengthOf(UK, "Year 13", "high")[1]);
  assert.ok(lengthOf(UK, "Year 3", "elementary")[1] < lengthOf(UK, "Year 6", "elementary")[1]);
  // The old setting gave all of Reception to Year 2 the same 90-130 words.
  assert.ok(lengthOf(UK, "Year 2", "early")[1] <= 110);
});

test("the prompt names the year, the vocabulary and the sentence limit, and asks for a small stretch only", () => {
  const p = buildReadingPassagePrompt({ tier: "elementary", country: UK, gradeLabel: "Year 4" });
  assert.match(p, /an 8-year-old in Year 4/);
  assert.match(p, /average sentence must be about 11 words or fewer/);
  assert.match(p, /small stretch/);
  assert.doesNotMatch(p, /adult-register/);
  const young = buildReadingPassagePrompt({ tier: "early", country: UK, gradeLabel: "Year 1" });
  assert.match(young, /simple inference/);
  const esl = buildReadingPassagePrompt({ tier: "early", country: "🌐 Global ESL Mode", gradeLabel: "A1 Beginner" });
  assert.match(esl, /CEFR level A1/);
  const w = buildWritingPromptGenerator({ tier: "early", country: UK, gradeLabel: "Reception" });
  assert.match(w, /no more than 12 words/);
  assert.match(w, /5-year-old in Reception/);
});

const easy = "The cat sat on the mat. It was a big red cat. The dog ran to the park. We went to play there. It was fun and warm. We had a snack on the grass. Then we all went home to bed. ";
const hard = "Notwithstanding considerable meteorological uncertainty, the expedition's organisers deliberately postponed the departure until sufficiently favourable atmospheric conditions materialised across the surrounding mountainous territory, whereupon participants enthusiastically resumed their extensively documented preparations.";

test("validatePassage: a plain passage passes for Year 2 and a dense one is sent back for it, naming the year", () => {
  const ok = validatePassage({ title: "Day out", skill: "Recall", passage: easy.repeat(2), questions: QUESTIONS }, { tier: "early", country: UK, gradeLabel: "Year 2", template: ["mc", "mc", "mc", "mc", "mc"] });
  assert.ok(!ok.issues.some((i) => /too long|reads too hard|words, expected/.test(i)), ok.issues.join("; "));
  const bad = validatePassage({ title: "Day out", skill: "Recall", passage: (hard + " ").repeat(2), questions: QUESTIONS }, { tier: "early", country: UK, gradeLabel: "Year 2" });
  assert.ok(bad.issues.some((i) => /too long for Year 2/.test(i)), bad.issues.join("; "));
});

test("validatePassage: the same dense text is fine for Year 13 and the length bound follows the year", () => {
  const sixth = "Although the organisers had postponed the departure, the climbers resumed their careful preparations, and the valley below slowly filled with cloud. ";
  const long = sixth.repeat(14);
  const r = validatePassage({ title: "Expedition", skill: "Infer", passage: long, questions: QUESTIONS }, { tier: "high", country: UK, gradeLabel: "Year 13" });
  assert.ok(!r.issues.some((i) => /too long for|reads too hard/.test(i)), r.issues.join("; "));
  const tooLongForReception = validatePassage({ title: "x", skill: "y", passage: easy.repeat(6), questions: QUESTIONS }, { tier: "early", country: UK, gradeLabel: "Reception" });
  assert.ok(tooLongForReception.issues.some((i) => /words, expected roughly 26-75 for Reception/.test(i)), tooLongForReception.issues.join("; "));
});

test("validatePassage: an unknown grade label falls back to the tier's old bounds and skips the readability check", () => {
  const r = validatePassage({ title: "x", skill: "y", passage: (hard + " ").repeat(3), questions: QUESTIONS }, { tier: "high", country: UK, gradeLabel: "Year 99" });
  assert.ok(!r.issues.some((i) => /too long for|reads too hard/.test(i)), r.issues.join("; "));
});

test("validateWritingPrompt: a long, dense prompt is rejected for a young year and accepted for an older one", () => {
  const prompt = "Imagine that you have discovered a hidden door at the back of your school library, and write a story explaining who built it, what lies behind it, and why nobody has ever mentioned it before today.";
  const young = validateWritingPrompt({ title: "Door", prompt, genre: "narrative" }, { tier: "early", country: UK, gradeLabel: "Year 1" });
  assert.ok(young.issues.some((i) => /too long for Year 1/.test(i)), young.issues.join("; "));
  const older = validateWritingPrompt({ title: "Door", prompt, genre: "narrative" }, { tier: "middle", country: UK, gradeLabel: "Year 8" });
  assert.deepEqual(older.issues, []);
});

test("readability: counts words and sentences and grades long words higher than short ones", () => {
  const a = readability(easy), b = readability(hard);
  assert.ok(a.avg < 8 && a.fk < 2, JSON.stringify(a));
  assert.ok(b.avg > 20 && b.fk > 15, JSON.stringify(b));
});

test("levelFor: an unknown grade uses the middle of the tier, and the age is always 5 to 18", () => {
  assert.equal(levelFor(UK, "Year 99", "elementary").age, 9);
  assert.ok(readability('"Come here," said Tom. "Why?" asked Sam. "Look!" said Tom. "Oh!" said Sam.').sentences === 4, "closing quotes do not merge sentences");
  assert.equal(levelFor("Nowhere", "Whatever", "high").age, 16);
  assert.equal(levelFor(UK, "Year 7", "middle").age, 11);
});

test("a piece that is short for its year is told kindly: a next step, never a verdict, and the score cap still applies", () => {
  const { calibrateScore, assessLength, lengthClause } = require("../api/_lib/calibrate");
  const a = assessLength({ text: "word ".repeat(30), tier: "elementary", country: UK, gradeLabel: "Year 4" });
  const parsed = { overallScore: 9, scoreReason: "Clear ideas." };
  calibrateScore(parsed, a);
  assert.ok(parsed.overallScore <= a.scoreCap, "still capped");
  assert.match(parsed.scoreReason, /30 words against about 120 expected/);
  assert.match(parsed.scoreReason, /lift this score/);
  assert.doesNotMatch(parsed.scoreReason, /too short to score highly/);
  assert.match(lengthClause(a), /never as a failure/);
  assert.match(buildReadingPassagePrompt({ tier: "elementary", country: UK, gradeLabel: "Year 4" }), /Year 4/);
});
