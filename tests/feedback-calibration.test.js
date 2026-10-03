const test = require("node:test");
const assert = require("node:assert/strict");
const { assessLength, calibrateWriting, applyCorrections, lengthClause, LEVELS } = require("../api/_lib/calibrate");
const { GRADE_WORD_TARGETS } = require("../api/_lib/writingLimits");
const { buildWritingPrompt } = require("../api/_lib/prompt");
const { dropInvalidSpellingGrammar, dropGlowsQuotingMisspellings, validateFeedback } = require("../api/_lib/validate");
const { targetsForGrade } = require("../api/_lib/masteryTargets");
const { frameworkForGenre, resolveGenre } = require("../api/_lib/writingFrameworks");
const { standardsFor } = require("../api/_lib/curriculum");
const { did, loadHandler, call } = require("./harness");

// These tests are about the RULE, not one essay: every country, every grade,
// every tier, and many kinds of weak input. Nothing here depends on a single
// piece of writing or a single curriculum.

const TIERS = ["early", "elementary", "middle", "high"];
const COMBOS = [];
for (const [country, grades] of Object.entries(GRADE_WORD_TARGETS)) {
  for (const gradeLabel of Object.keys(grades)) COMBOS.push({ country, gradeLabel, target: grades[gradeLabel] });
}
const words = (n, stem = "w") => Array.from({ length: n }, (_, i) => `${stem}${i}x`).join(" ");
const sentence = (n) => Array.from({ length: n }, (_, i) => ["the", "team", "trained", "hard", "every", "single", "week", "because", "winning", "matters", "to", "them", "and", "their", "fans"][i % 15] + (i % 15 === 14 ? "," : "")).join(" ") + ".";
// Long enough with real variety, so repetition handling never touches it.
const varied = (n) => Array.from({ length: n }, (_, i) => `word${i}`.replace(/\d/g, (d) => "abcdefghij"[d])).join(" ");

test("every country and grade has a target and a calibration that is monotonic in length", () => {
  for (const { country, gradeLabel, target } of COMBOS) {
    for (const tier of TIERS) {
      const order = ["minimal", "thin", "short", "ok"];
      let last = -1;
      for (const frac of [0.02, 0.1, 0.2, 0.4, 0.55, 0.7, 1, 1.5]) {
        const n = Math.max(1, Math.round(target * frac));
        const a = assessLength({ text: varied(n), tier, country, gradeLabel });
        const idx = order.indexOf(a.level);
        assert.ok(idx >= last, `${country} ${gradeLabel} ${tier}: level got worse as the piece got longer (${n} words -> ${a.level})`);
        last = idx;
        assert.equal(a.target, target);
      }
    }
  }
});

test("a piece at or above the expected length is never capped or banded down, anywhere", () => {
  for (const { country, gradeLabel, target } of COMBOS) {
    for (const tier of TIERS) {
      const text = varied(Math.max(target, 8));
      const a = assessLength({ text, tier, country, gradeLabel });
      assert.equal(a.level, "ok", `${country} ${gradeLabel} ${tier}`);
      const parsed = { overallScore: 10, scoreReason: "Strong, controlled writing throughout the piece.", examTechnique: [{ criterion: "A", band: 4, descriptor: "Strong", evidence: "a quote", toNextBand: "n/a n/a n/a" }] };
      calibrateWriting(parsed, { text, tier, country, gradeLabel });
      assert.equal(parsed.overallScore, 10);
      assert.equal(parsed.examTechnique[0].band, 4);
      assert.equal(parsed.scoreReason, "Strong, controlled writing throughout the piece.");
    }
  }
});

test("a far-too-short piece is capped for every country, grade and tier, and the cap never goes UP with the tier's leniency", () => {
  for (const { country, gradeLabel, target } of COMBOS) {
    if (target < 30) continue; // a 10-word expectation (Reception) has almost no room to be 'short'
    for (const tier of TIERS) {
      const text = varied(Math.max(3, Math.round(target * 0.05)));
      const parsed = { overallScore: 9, scoreReason: "Good ideas and tidy writing overall." };
      const a = calibrateWriting(parsed, { text, tier, country, gradeLabel });
      assert.ok(["minimal", "thin"].includes(a.level), `${country} ${gradeLabel} ${tier} -> ${a.level}`);
      assert.ok(parsed.overallScore <= LEVELS[tier].cap[a.level], `${country} ${gradeLabel} ${tier}: ${parsed.overallScore}`);
      assert.ok(parsed.overallScore <= 4, "never above 4 for a piece under 5% of the expectation");
    }
  }
});

test("calibration only ever lowers: a score or band already low is left alone", () => {
  for (const { country, gradeLabel } of COMBOS.slice(0, 20)) {
    const parsed = { overallScore: 1, scoreReason: "Your piece is far too short to score highly at all.", examTechnique: [{ criterion: "A", band: 1, descriptor: "Emerging", evidence: "x", toNextBand: "y" }] };
    calibrateWriting(parsed, { text: "Hi.", tier: "high", country, gradeLabel });
    assert.equal(parsed.overallScore, 1);
    assert.equal(parsed.examTechnique[0].band, 1);
  }
});

test("the reason states the real word count against the expected one, within the 300-character limit, and is not duplicated", () => {
  const country = "🇦🇺 Australia";
  const parsed = { overallScore: 6, scoreReason: "x".repeat(290) };
  calibrateWriting(parsed, { text: varied(33), tier: "high", country, gradeLabel: "Year 11" });
  assert.ok(parsed.scoreReason.length <= 300);
  assert.match(parsed.scoreReason, /33 words against about 650 expected/);
  const again = { overallScore: 3, scoreReason: "This is too short to show much of what you can do." };
  calibrateWriting(again, { text: varied(33), tier: "high", country, gradeLabel: "Year 11" });
  assert.equal(again.scoreReason, "This is too short to show much of what you can do.", "an honest reason that already says it is short is kept");
});

test("weak input of every kind is recognised: repetition, one sentence, gibberish, pasted prompt, a single word", () => {
  const ctx = { tier: "high", country: "🇬🇧 United Kingdom", gradeLabel: "Year 11" };
  const repeated = assessLength({ ...ctx, text: Array(200).fill("I like football").join(" ") });
  assert.ok(repeated.repetitive && repeated.level !== "ok", "200 words of one phrase is not a 200-word essay");
  assert.equal(assessLength({ ...ctx, text: "Freedom matters because people need to be able to choose for themselves." }).level, "minimal");
  assert.equal(assessLength({ ...ctx, text: "asdf asdf asdf asdf asdf asdf asdf asdf asdf" }).level, "minimal");
  assert.equal(assessLength({ ...ctx, text: "Argue a point." }).level, "minimal");
  assert.equal(assessLength({ ...ctx, text: "yes" }).level, "minimal");
  assert.equal(assessLength({ ...ctx, text: "" }).level, "minimal");
  // a long piece with natural repeated words (function words) is untouched
  assert.equal(assessLength({ ...ctx, text: varied(450) }).level, "ok");
});

test("early years are judged more gently than older students (a few words is a real attempt)", () => {
  const country = "🇬🇧 United Kingdom";
  const early = assessLength({ text: "The dog ran to the park.", tier: "early", country, gradeLabel: "Year 2" });
  const high = assessLength({ text: "The dog ran to the park.", tier: "high", country, gradeLabel: "Year 11" });
  assert.equal(early.level, "thin", "6 words against 50 for Year 2");
  assert.equal(high.level, "minimal");
  const p = { overallScore: 8, scoreReason: "A neat, clear sentence." };
  calibrateWriting(p, { text: "The dog ran to the park.", tier: "early", country, gradeLabel: "Year 2" });
  assert.equal(p.overallScore, 4);
});

// ------------------------------------------------------------ exam bands

test("'not attempted' evidence is always band 1, in any wording, and a thin piece cannot be banded above Developing", () => {
  const wordings = ["Not attempted", "This objective wasn't attempted.", "Student did not attempt this", "No evidence of this", "Nothing to assess here", "Not demonstrated at all", "Not addressed"];
  for (const w of wordings) {
    const parsed = { examTechnique: [{ criterion: "A", band: 2, descriptor: "Developing", evidence: w, toNextBand: "Try it" }] };
    calibrateWriting(parsed, { text: varied(900), tier: "high", country: "🇬🇧 United Kingdom", gradeLabel: "Year 11" });
    assert.equal(parsed.examTechnique[0].band, 1, w);
    assert.equal(parsed.examTechnique[0].descriptor, "Emerging", w);
  }
  for (const { country, gradeLabel, target } of COMBOS.filter((c) => c.target >= 200)) {
    const parsed = { examTechnique: [{ criterion: "A", band: 3, descriptor: "Secure", evidence: "A clear claim", toNextBand: "Add more" }, { criterion: "B", band: 4, descriptor: "Strong", evidence: "Neat", toNextBand: "Add more" }] };
    calibrateWriting(parsed, { text: varied(Math.round(target * 0.08)), tier: "high", country, gradeLabel });
    parsed.examTechnique.forEach((e) => { assert.ok(e.band <= 2, `${country} ${gradeLabel}: band ${e.band}`); assert.equal(e.descriptor, { 1: "Emerging", 2: "Developing" }[e.band]); });
  }
  // a piece that is merely a bit short is held to Secure
  const shortish = { examTechnique: [{ criterion: "A", band: 4, descriptor: "Strong", evidence: "Neat control", toNextBand: "n" }] };
  calibrateWriting(shortish, { text: varied(250), tier: "high", country: "🇬🇧 United Kingdom", gradeLabel: "Year 11" });
  assert.equal(shortish.examTechnique[0].band, 3);
});

// ------------------------------------------------------------ spelling and glow rules

test("a 'missing full stop' that is already there after the quote is dropped; a genuinely missing one elsewhere is kept", () => {
  const text = "I agree with the statement. Freedom matters because people choose. We need rules and we need freedom";
  const parsed = {
    spellingGrammarTotal: 3,
    spellingGrammar: [
      { quote: "I agree with the statement", type: "punctuation", correction: "I agree with the statement." },
      { quote: "people choose", type: "punctuation", correction: "people choose." },
      { quote: "we need freedom", type: "punctuation", correction: "we need freedom." },
    ],
  };
  dropInvalidSpellingGrammar(parsed, text);
  assert.deepEqual(parsed.spellingGrammar.map((s) => s.quote), ["we need freedom"]);
  assert.equal(parsed.spellingGrammarTotal, 1);
});

test("a fragment repeated in the text: the real error is kept even if the same words appear correctly punctuated earlier", () => {
  const text = "The end. The end";
  const parsed = { spellingGrammarTotal: 1, spellingGrammar: [{ quote: "The end", type: "punctuation", correction: "The end." }] };
  dropInvalidSpellingGrammar(parsed, text);
  assert.equal(parsed.spellingGrammar.length, 1, "the second 'The end' really lacks a full stop");
});

test("a glow that quotes a word listed as misspelled is dropped; the grow and other glows stay", () => {
  const parsed = {
    spellingGrammar: [{ quote: "teh dog", type: "spelling", correction: "the dog" }],
    highlights: [
      { quote: "I think teh dog is brave", type: "glow", note: "clear opinion" },
      { quote: "He ran home quickly", type: "glow", note: "good verb" },
      { quote: "I think teh dog is brave", type: "grow", note: "check this", revision: "I think the dog is brave" },
    ],
  };
  dropGlowsQuotingMisspellings(parsed);
  assert.equal(parsed.highlights.length, 2);
  assert.ok(parsed.highlights.every((h) => h.type === "grow" || !h.quote.includes("teh")));
});

test("a grow on a thin piece must be about developing it; a normal-length piece is not held to that", () => {
  const base = (grow) => ({ glow: "You gave a clear opinion in your first sentence, which is a strong start.", grow, vocab: [], highlights: [] });
  const ctx = { tier: "high", standardsList: [], targetNames: [], submittedText: "Short." };
  const polishing = validateFeedback(base("Replace the word good with a stronger adjective in your sentence."), { ...ctx, lengthLevel: "minimal" });
  assert.ok(polishing.issues.some((i) => /^grow must be about developing/.test(i)));
  const developing = validateFeedback(base("Add a second reason and one example to back up your opinion next."), { ...ctx, lengthLevel: "minimal" });
  assert.ok(!developing.issues.some((i) => /^grow must be about developing/.test(i)));
  const normal = validateFeedback(base("Replace the word good with a stronger adjective in your sentence."), { ...ctx, lengthLevel: "ok" });
  assert.ok(!normal.issues.some((i) => /^grow must be about developing/.test(i)));
});

test("applyCorrections: the student's own text with each listed fix applied in place, nothing added", () => {
  const text = "Teh dog ran. he was fast";
  const out = applyCorrections(text, [
    { quote: "Teh dog", correction: "The dog" },
    { quote: "he was fast", correction: "He was fast." },
    { quote: "not there", correction: "ignored" },
  ]);
  assert.equal(out, "The dog ran. He was fast.");
  assert.equal(applyCorrections(text, []), text);
  assert.equal(applyCorrections(text, undefined), text);
});

// ------------------------------------------------------------ prompt

test("the prompt tells the model the real numbers for every country and grade, and says nothing when the piece is long enough", () => {
  for (const { country, gradeLabel, target } of COMBOS) {
    const tier = "high";
    const args = { tier, country, gradeLabel, interest: "football", prompt: "Write.", targets: [], targetNames: ["A"], genre: "persuasive", capabilities: { overallScore: true, spellingGrammar: true } };
    if (target >= 30) {
      const thin = buildWritingPrompt({ ...args, text: "Short piece of writing here, only a few words in total." });
      assert.ok(thin.includes("LENGTH CHECK"), `${country} ${gradeLabel}`);
      assert.ok(thin.includes(`about ${target} are expected`), `${country} ${gradeLabel}: ${target}`);
      assert.ok(thin.includes("Do not force an interest analogy"));
    }
    const full = buildWritingPrompt({ ...args, text: varied(Math.max(target, 8)) });
    assert.ok(!full.includes("LENGTH CHECK"), `${country} ${gradeLabel}`);
  }
  assert.equal(lengthClause({ level: "ok" }), "");
});

test("the interest analogy is no longer mandatory in the prompt", () => {
  const p = buildWritingPrompt({ tier: "elementary", country: "🇬🇧 United Kingdom", gradeLabel: "Year 5", interest: "football", prompt: "Write.", text: varied(150), targets: [], targetNames: ["A"], genre: "narrative", capabilities: {} });
  assert.match(p, /only where an accurate, natural one exists/);
  assert.match(p, /leave the analogy out/);
});

// ------------------------------------------------------------ end to end, through the real submit handler

// What the model said for the Year 11 essay that prompted this work: generous
// score, "Secure", "not attempted" banded 2, an invented, longer rewrite.
function standardToken(country, tier, gradeLabel) {
  const skip = new Set(["the","and","for","statutory","english","app","year","yr","standard","standards","grade","level","aim","aims","programme","study","content","domain"]);
  for (const std of standardsFor(country, tier, gradeLabel) || []) {
    const tok = (std.toLowerCase().match(/[a-z0-9.-]+/g) || []).find((t) => t.length >= 3 && !skip.has(t));
    if (tok) return tok;
  }
  return "";
}

function generousModelOutput(targetNames, text, std) {
  return {
    glow: `You made a clear claim about freedom and safety in your very first sentence, which shows ${std} well.`,
    grow: "Think about how a coach balances rules and freedom, and try adding a second reason to your claim.",
    vocab: [
      { term: "liberty", definition: "the freedom to choose how you live.", example: "Liberty matters to many people." },
      { term: "balance", definition: "keeping two things in fair proportion.", example: "A fair rule keeps a balance." },
    ],
    glowTarget: targetNames[0], growTarget: targetNames[0],
    highlights: [
      { quote: text.split(" ").slice(0, 4).join(" "), type: "glow", note: "A clear claim." },
      { quote: text.split(" ").slice(4, 8).join(" "), type: "grow", note: "Say why.", revision: "which is exactly why it matters" },
    ],
    overallScore: 5, scoreReason: "A clear stance with some good ideas, though the technical accuracy could be better.",
    revisedStory: text + " " + words(40, "invented"),
    spellingGrammarTotal: 0, spellingGrammar: [],
    growNext: "Once that feels natural, take a different claim and add one example after it.",
    examTechnique: targetNames.map((n, i) => ({ criterion: n, band: i === 0 ? 3 : 2, descriptor: i === 0 ? "Secure" : "Developing", evidence: i === 0 ? "A clear claim" : "Not attempted", toNextBand: "Add more developed points." })),
    examSummary: "Developing the argument would gain the most marks next.",
    frameworkTip: { name: frameworkForGenre(resolveGenre("persuasive", "high")).name, quote: text.split(" ").slice(0, 6).join(" "), revision: "Point: freedom matters. Evidence: people choose. Explain: it respects them. Link: so freedom should lead." },
  };
}

async function runWeakSubmission({ country, gradeLabel, tier, text }) {
  const written = [];
  const targetNames = targetsForGrade(country, gradeLabel, tier).targets.map((t) => t.name);
  const row = { id: "sub1", child_id: "c1", tier, country, grade_label: gradeLabel, interest: "coding", content: { generatedPrompt: { prompt: "Argue a point.", genre: "persuasive" } }, feedback: null };
  const h = loadHandler("submit.js", {
    plan: "premium",
    db: (q) => {
      if (q.table !== "submissions") return { data: null, error: null };
      if (did(q, "single")) return { data: row, error: null };
      if (did(q, "is")) return { data: [{ id: "sub1" }], error: null };
      const upd = q.ops.find(([n]) => n === "update");
      if (upd && upd[1] && upd[1].feedback && !upd[1].feedback._pending) written.push(upd[1]);
      return { data: null, error: null };
    },
    generate: async () => ({ parsed: generousModelOutput(targetNames, text, standardToken(country, tier, gradeLabel)), modelUsed: "stub" }),
  });
  const res = await call(h, { method: "POST", body: { kind: "writing", submissionId: "sub1", text } });
  return { res, written, targetNames };
}

const FAMILIES = [
  { country: "🇦🇺 Australia", gradeLabel: "Year 11", tier: "high" },
  { country: "🇬🇧 United Kingdom", gradeLabel: "Year 10", tier: "high" },
  { country: "🇺🇸 United States", gradeLabel: "Grade 12", tier: "high" },
  { country: "🇨🇦 Canada", gradeLabel: "Grade 8", tier: "middle" },
  { country: "🇸🇬 Singapore & SE Asia", gradeLabel: "Secondary 2", tier: "middle" },
  { country: "🇦🇪 UAE & GCC Hubs", gradeLabel: "IGCSE Year 11", tier: "high" },
];

for (const fam of FAMILIES) {
  test(`end to end (${fam.country}, ${fam.gradeLabel}): a very short piece gets a low score, honest bands and a faithful corrected story`, async () => {
    const text = "Freedom matters more than safety because people need to choose for themselves. Rules help but they should not control everything we do.";
    const { res, targetNames } = await runWeakSubmission({ ...fam, text });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body).slice(0, 300));
    const fb = res.body.feedback;
    assert.ok(fb.overallScore <= 3, `score ${fb.overallScore}`);
    assert.match(fb.scoreReason, /words against about \d+ expected/);
    fb.examTechnique.forEach((e) => assert.ok(e.band <= 2, `band ${e.band} for ${e.criterion}`));
    const notAttempted = fb.examTechnique.filter((e) => /not attempted/i.test(e.evidence));
    notAttempted.forEach((e) => assert.equal(e.band, 1));
    assert.equal(fb.examTechnique.length, targetNames.length);
    // the invented, longer rewrite never reaches the student
    assert.ok(!/invented/.test(fb.revisedStory || ""), "invented content must not be shown");
  });
}

test("end to end: the same model output for a full-length piece is left exactly as the model scored it", async () => {
  const text = varied(480);
  const { res } = await runWeakSubmission({ country: "🇦🇺 Australia", gradeLabel: "Year 11", tier: "high", text });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.feedback.overallScore, 5);
  assert.equal(res.body.feedback.examTechnique[0].band, 3);
  const na = res.body.feedback.examTechnique.find((e) => /not attempted/i.test(e.evidence));
  assert.equal(na.band, 1, "a 'not attempted' entry is band 1 whatever the length");
});
