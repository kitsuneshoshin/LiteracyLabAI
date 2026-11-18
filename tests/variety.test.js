const test = require("node:test");
const assert = require("node:assert/strict");

const T = require("../api/_lib/topics");
const F = require("../api/_lib/focus");
const QT = require("../api/_lib/questionTypes");
const { validatePassage } = require("../api/_lib/validate");
const { buildReadingPassagePrompt, buildWritingPromptGenerator } = require("../api/_lib/prompt");

const UK = "🇬🇧 United Kingdom";
const TIERS = ["early", "elementary", "middle", "high"];

test("every topic list is long enough to vary and avoids the ideas the model kept repeating", () => {
  for (const tier of TIERS) {
    assert.ok(T.READING[tier].length >= 15, `reading ${tier}`);
    assert.ok(T.NARRATIVE[tier].length >= 6 && T.PERSUASIVE[tier].length >= 6 && T.DESCRIPTIVE[tier].length >= 6, `writing ${tier}`);
    for (const list of [T.READING[tier], T.NARRATIVE[tier], T.PERSUASIVE[tier], T.DESCRIPTIVE[tier]]) {
      assert.equal(new Set(list).size, list.length, `${tier}: no duplicates`);
      for (const item of list) assert.doesNotMatch(item, /garden|seed|compost|\bkey\b|hidden door|\bbox\b|phone/i, item);
    }
  }
});

test("topics are picked at random from the age's own list, and analytical prompts get none", () => {
  for (const tier of TIERS) {
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(T.readingTopic(tier));
    assert.ok(seen.size >= 10, `${tier}: plenty of different subjects`);
    for (const s of seen) assert.ok(T.READING[tier].includes(s));
  }
  assert.equal(T.writingTopic("middle", "analytical"), null);
  assert.equal(T.writingTopic("middle", undefined), null, "middle's usual piece is analytical");
  assert.ok(T.NARRATIVE.early.includes(T.writingTopic("early", undefined, () => 0)));
  assert.ok(T.PERSUASIVE.high.includes(T.writingTopic("high", undefined, () => 0)));
  assert.ok(T.DESCRIPTIVE.elementary.includes(T.writingTopic("elementary", "descriptive", () => 0)));
});

test("the subject goes into the prompts only when one is given", () => {
  const base = { tier: "elementary", country: UK, gradeLabel: "Year 5", textType: QT.TEXT_TYPES.elementary[0], template: QT.TEMPLATES.elementary[0] };
  const withTopic = buildReadingPassagePrompt({ ...base, topic: "how bees make honey" });
  const without = buildReadingPassagePrompt(base);
  assert.match(withTopic, /Subject: write about how bees make honey/);
  assert.doesNotMatch(without, /Subject:/);
  assert.equal(withTopic.replace(/\n- Subject:[^\n]*/, ""), without, "nothing else changes");
  const w = buildWritingPromptGenerator({ tier: "high", country: UK, gradeLabel: "Year 11", topic: "whether voting should be compulsory" });
  assert.match(w, /Idea to build it around: whether voting should be compulsory/);
  assert.doesNotMatch(buildWritingPromptGenerator({ tier: "high", country: UK, gradeLabel: "Year 11" }), /Idea to build it around/);
});

test("an exam-style passage is only ever a kind of text that exam sets", () => {
  const poemOrSteps = /poem|instructions/i;
  for (const tier of TIERS) {
    for (const name of Object.keys(F.READING_EXAM)) {
      const list = F.examTextTypes(tier, name);
      assert.ok(list.length > 0, `${name} ${tier} has some kind of text`);
      if (!["KS2 SATs", "KS2 English", "state test (Common Core)", "NAPLAN", "CEFR writing task", "Junior Cycle English", "NCEA English"].includes(name)) {
        for (const t of list) assert.doesNotMatch(t.name, poemOrSteps, `${name} ${tier}: ${t.name}`);
      }
    }
  }
  for (const t of F.examTextTypes("high", "CBSE Class 10 English")) assert.ok(F.READING_EXAM_TYPES["CBSE Class 10 English"].includes(t.name));
  assert.ok(F.examTextTypes("elementary", "KS2 SATs").some((t) => /poem/.test(t.name)), "the primary reading test does set poems");
  assert.deepEqual(F.examTextTypes("elementary", "not an exam").map((t) => t.name), QT.TEXT_TYPES.elementary.filter((t) => !/poem|instructions/i.test(t.name)).map((t) => t.name));
});

// ---------------------------------------------------------------- the too-easy floor
const simple = (words) => Array.from({ length: Math.ceil(words / 6) }, () => "The cat sat on the mat.").join(" ");
const check = (passage, tier, gradeLabel, textType) => validatePassage({ title: "T", skill: "Inference", passage, questions: [] }, { tier, country: UK, gradeLabel, textType, template: QT.TEMPLATES[tier][0] });

test("an older learner is not given a passage written for much younger readers", () => {
  const issues = check(simple(340), "high", "Year 11").issues;
  assert.ok(issues.some((i) => /reads too easy for Year 11/.test(i)), issues.join(" | "));
  assert.ok(issues.find((i) => /too easy/.test(i)).includes("about 12.5"), "says what the year should be");
});

test("the too-easy check leaves younger years, speeches and poems alone", () => {
  assert.ok(!check(simple(160), "elementary", "Year 5").issues.some((i) => /too easy/.test(i)), "under 11 is exempt");
  assert.ok(!check(simple(340), "high", "Year 11", { name: "speech", lines: false }).issues.some((i) => /too easy/.test(i)), "speeches use short sentences");
  assert.ok(!check(simple(80), "high", "Year 11", { name: "poem", lines: true }).issues.some((i) => /too easy/.test(i)), "poems are not prose");
});
