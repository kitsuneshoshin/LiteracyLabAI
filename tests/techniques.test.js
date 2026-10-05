const test = require("node:test");
const assert = require("node:assert/strict");
const TECH = require("../api/_lib/techniques");
const { buildReadingPrompt, buildWritingPrompt } = require("../api/_lib/prompt");

// Named reading strategies and word tricks, fitted to the age band. Fixed names and how-tos, so a
// model can only choose one and apply it; it never defines one.

const TIERS = ["early", "elementary", "middle", "high"];

test("every age band has several distinct reading strategies, each with a clear how-to", () => {
  for (const tier of TIERS) {
    const list = TECH.strategiesFor(tier);
    assert.ok(list.length >= 3, `${tier}: only ${list.length}`);
    assert.equal(new Set(list.map((s) => s.name.toLowerCase())).size, list.length, `${tier}: duplicate names`);
    for (const s of list) assert.ok(s.name.length >= 4 && s.how.length >= 30, `${tier}: ${s.name}`);
  }
  // the young get fewer, simpler moves than older students
  assert.ok(TECH.strategiesFor("early").length < TECH.strategiesFor("high").length);
  // an unknown age band is treated as elementary, never as nothing
  assert.deepEqual(TECH.strategiesFor("nonsense"), TECH.strategiesFor("elementary"));
});

test("each age band has one word-building trick with a how-to", () => {
  const names = new Set();
  for (const tier of TIERS) {
    const t = TECH.vocabTrickFor(tier);
    assert.ok(t.name && t.how.length >= 30, tier);
    names.add(t.name);
  }
  assert.equal(names.size, TIERS.length, "a different trick for each age band");
});

test("a strategy name is matched loosely but snapped back to the exact name, and invented names are refused", () => {
  for (const tier of TIERS) {
    for (const s of TECH.strategiesFor(tier)) {
      const issues = [];
      TECH.validateReadingStrategy({ readingStrategy: { name: s.name.toUpperCase() + ".", tip: "Look at question 2 again and use this on the passage first." } }, tier, issues);
      assert.deepEqual(issues, [], `${tier}: ${s.name}`);
      const parsed = { readingStrategy: { name: s.name.toLowerCase(), tip: "  Look at question 2 again and use this on the passage first.  " } };
      TECH.attachReadingStrategy(parsed, tier);
      assert.deepEqual(parsed.readingStrategy, { name: s.name, how: s.how, tip: "Look at question 2 again and use this on the passage first." });
    }
    const bad = [];
    TECH.validateReadingStrategy({ readingStrategy: { name: "Made up strategy", tip: "Look at question 2 again and use this on the passage first." } }, tier, bad);
    assert.ok(bad.some((i) => /readingStrategy\.name must be exactly one of/.test(i)), tier);
  }
  const missing = []; TECH.validateReadingStrategy({}, "elementary", missing);
  assert.deepEqual(missing, ["readingStrategy is missing"]);
  const short = []; TECH.validateReadingStrategy({ readingStrategy: { name: "Predict", tip: "Try." } }, "elementary", short);
  assert.ok(short.some((i) => /tip is missing, too short/.test(i)));
  const dropped = { readingStrategy: { name: "Nope", tip: "Look at question 2 again and use this on the passage first." } };
  TECH.attachReadingStrategy(dropped, "elementary");
  assert.equal(dropped.readingStrategy, undefined, "an unknown strategy is removed rather than shown");
});

test("a strategy for one age band is not accepted for another (the young are not given 'Evaluate the argument')", () => {
  const issues = [];
  TECH.validateReadingStrategy({ readingStrategy: { name: "Evaluate the argument", tip: "Look at question 2 again and decide how convincing it is." } }, "early", issues);
  assert.ok(issues.length > 0);
});

test("word tricks that are missing, tiny or huge are dropped quietly, good ones are kept and trimmed", () => {
  const parsed = { vocab: [{ term: "a", definition: "x", example: "y", trick: "  un + happy: un- means not.  " }, { term: "b", definition: "x", example: "y", trick: "ok" }, { term: "c", definition: "x", example: "y", trick: "x".repeat(300) }, { term: "d", definition: "x", example: "y" }, { term: "e", definition: "x", example: "y", trick: 42 }] };
  TECH.repairVocabTricks(parsed);
  assert.equal(parsed.vocab[0].trick, "un + happy: un- means not.");
  assert.ok(!("trick" in parsed.vocab[1]) && !("trick" in parsed.vocab[2]) && !("trick" in parsed.vocab[4]));
  assert.ok(!("trick" in parsed.vocab[3]));
  assert.doesNotThrow(() => TECH.repairVocabTricks({}));
});

const readingArgs = (tier) => ({ tier, country: "🇬🇧 United Kingdom", gradeLabel: "Year 5", interest: "football", passageTitle: "T", passage: "A passage.", questions: [{ q: "Q?", options: ["a", "b", "c", "d"], correct: 0 }], answers: [1], score: 0, totalQuestions: 1, targets: [], targetNames: ["A"], capabilities: {} });
const writingArgs = (tier) => ({ tier, country: "🇬🇧 United Kingdom", gradeLabel: "Year 5", interest: "football", prompt: "Write.", text: "A short piece of writing with some words in it.", targets: [], targetNames: ["A"], genre: "narrative", capabilities: {} });

test("the reading prompt offers exactly that age band's strategies and the word trick; the writing prompt asks for the word trick only", () => {
  for (const tier of TIERS) {
    const r = buildReadingPrompt(readingArgs(tier));
    for (const s of TECH.strategiesFor(tier)) assert.ok(r.includes(`"${s.name}"`), `${tier}: strategy ${s.name}`);
    for (const other of TIERS.filter((t) => t !== tier)) {
      for (const s of TECH.strategiesFor(other)) {
        if (!TECH.strategiesFor(tier).some((x) => x.name === s.name)) assert.ok(!r.includes(`"${s.name}" (`), `${tier} prompt must not offer ${other}'s "${s.name}"`);
      }
    }
    assert.match(r, /"readingStrategy": \{/);
    assert.ok(r.includes(TECH.vocabTrickFor(tier).name), `${tier}: trick`);
    assert.match(r, /"trick": "one short sentence/);
    const w = buildWritingPrompt(writingArgs(tier));
    assert.ok(w.includes(TECH.vocabTrickFor(tier).name), `${tier}: writing trick`);
    assert.ok(!w.includes("readingStrategy"), `${tier}: writing is not asked for a reading strategy`);
  }
});
