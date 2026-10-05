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

const { examTargetsFor, targetMode } = require("../api/_lib/masteryTargets");
const { frameworkParts } = require("../api/_lib/writingFrameworks");
const RESP = require("../api/_lib/responses");

function standardToken(country, tier, gradeLabel) {
  const skip = new Set(["the", "and", "for", "statutory", "english", "app", "year", "yr", "standard", "standards", "grade", "level", "aim", "aims", "programme", "study", "content", "domain"]);
  for (const std of standardsFor(country, tier, gradeLabel) || []) {
    const tok = (std.toLowerCase().match(/[a-z0-9.-]+/g) || []).find((t) => t.length >= 3 && !skip.has(t));
    if (tok) return tok;
  }
  return "";
}

// Letters-only filler, so a fixture response has an exact number of distinct words.
function filler(n, seed) {
  return Array.from({ length: n }, (_, i) => {
    let k = i + seed * 37 + 1;
    let w = "";
    while (k > 0) { w += "abcdefghijklmnopqrstuvwxyz"[k % 26]; k = Math.floor(k / 26); }
    return w + "ly";
  });
}

// What a generous model said for the short Year 11 essay: score 5, "Secure", "not
// attempted" banded 2. It is shown only the writing objectives, so a compliant
// answer bands only those.
function modelOutput({ country, gradeLabel, tier, text, extra }) {
  const all = targetsForGrade(country, gradeLabel, tier).targets;
  const writing = examTargetsFor(all, "writing");
  const fw = frameworkForGenre(resolveGenre("persuasive", tier));
  const parts = frameworkParts(fw);
  const lim = RESP.modelLimits(assessLength({ text, tier, country, gradeLabel }));
  const per = Math.max(3, Math.floor(lim.n / parts.length));
  const sentences = parts.map((pt, k) => { const w = filler(per, k + 1); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return w.join(" ") + "."; });
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0];
  const four = text.split(" ").slice(0, 4).join(" ");
  const out = {
    glow: `You made a clear claim about freedom and safety in your very first sentence, which shows ${standardToken(country, tier, gradeLabel)} well.`,
    grow: "Try adding a second reason and one example to back up your claim.",
    vocab: [
      { term: "liberty", definition: "the freedom to choose how you live.", example: "Liberty matters to many people." },
      { term: "balance", definition: "keeping two things in fair proportion.", example: "A fair rule keeps a balance." },
    ],
    glowTarget: all[0].name, growTarget: all[0].name,
    highlights: [
      { quote: four, type: "glow", note: "A clear claim." },
      { quote: text.split(" ").slice(4, 8).join(" "), type: "grow", note: "Say why.", revision: "which is exactly why it matters" },
    ],
    overallScore: 5, scoreReason: "A clear stance with some good ideas, though the technical accuracy could be better.",
    revisedStory: text + " " + filler(12, 99).join(" ") + ".",
    revisedFramework: [{ part: parts[0].name, text: firstSentence, note: "This sentence states the response's position." }],
    modelResponse: sentences.join(" "),
    modelFramework: parts.map((pt, k) => ({ part: pt.name, text: sentences[k], note: "This sentence does the job of " + pt.name + "." })),
    spellingGrammarTotal: 0, spellingGrammar: [],
    growNext: `Once that feels natural, take "${four}" and add one example after it.`,
    examTechnique: writing.map((t, i) => ({ criterion: t.name, band: i === 0 ? 3 : 2, descriptor: i === 0 ? "Secure" : "Developing", evidence: i === 0 ? four : "Not attempted", toNextBand: "Add more developed points to your own writing." })),
    examSummary: "Developing the argument would gain the most marks next.",
    frameworkTip: { name: fw.name, quote: text.split(" ").slice(0, 6).join(" "), revision: "Point: freedom matters. Evidence: people choose. Explain: it respects them. Link: so freedom should lead." },
  };
  return Object.assign(out, extra || {});
}

function submitHandler(plan, { country, gradeLabel, tier, text, extra }, prompts) {
  const row = { id: "sub1", child_id: "c1", tier, country, grade_label: gradeLabel, interest: "coding", content: { generatedPrompt: { prompt: "Argue a point.", genre: "persuasive" } }, feedback: null };
  return loadHandler("submit.js", {
    plan,
    db: (q) => {
      if (q.table !== "submissions") return { data: null, error: null };
      if (did(q, "single")) return { data: row, error: null };
      if (did(q, "is")) return { data: [{ id: "sub1" }], error: null };
      return { data: null, error: null };
    },
    generate: async (prompt) => { if (prompts) prompts.push(prompt); return { parsed: JSON.parse(JSON.stringify(modelOutput({ country, gradeLabel, tier, text, extra }))), modelUsed: "stub" }; },
  });
}

async function runWeak(args, plan = "premium") {
  const prompts = [];
  const h = submitHandler(plan, args, prompts);
  const res = await call(h, { method: "POST", body: { kind: "writing", submissionId: "sub1", text: args.text } });
  return { res, prompts };
}

const FAMILIES = [
  { country: "🇦🇺 Australia", gradeLabel: "Year 11", tier: "high" },
  { country: "🇬🇧 United Kingdom", gradeLabel: "Year 10", tier: "high" },
  { country: "🇺🇸 United States", gradeLabel: "Grade 12", tier: "high" },
  { country: "🇨🇦 Canada", gradeLabel: "Grade 8", tier: "middle" },
  { country: "🇸🇬 Singapore & SE Asia", gradeLabel: "Secondary 2", tier: "middle" },
  { country: "🇦🇪 UAE & GCC Hubs", gradeLabel: "IGCSE Year 11", tier: "high" },
];
const SHORT = "Freedom matters more than safety because people need to choose for themselves. Rules help but they should not control everything we do.";

for (const fam of FAMILIES) {
  test(`end to end (${fam.country}, ${fam.gradeLabel}): short piece - low score, honest bands on writing objectives only, model response with the framework labelled`, async () => {
    const { res } = await runWeak({ ...fam, text: SHORT });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body).slice(0, 400));
    const fb = res.body.feedback;
    assert.ok(fb.overallScore <= 3, `score ${fb.overallScore}`);
    assert.match(fb.scoreReason, /words against about \d+ expected/);
    const all = targetsForGrade(fam.country, fam.gradeLabel, fam.tier).targets;
    const writingNames = examTargetsFor(all, "writing").map((t) => t.name);
    assert.deepEqual(fb.examTechnique.map((e) => e.criterion), writingNames, "only writing objectives are banded on a piece of writing");
    fb.examTechnique.forEach((e) => {
      assert.ok(e.band <= 2, `band ${e.band} for ${e.criterion}`);
      assert.ok(!/not attempted/i.test(e.evidence), "never 'not attempted' on a writing task");
    });
    const readingNames = all.filter((t) => targetMode(t) === "reading").map((t) => t.name);
    assert.deepEqual(fb.examNotBanded || [], readingNames, "the reading objectives are listed as not banded here");
    const fw = frameworkForGenre(resolveGenre("persuasive", fam.tier));
    assert.equal(typeof fb.modelResponse, "string");
    assert.deepEqual([...new Set(fb.modelFramework.map((e) => e.part))], frameworkParts(fw).map((p) => p.name), "every part of the framework is labelled in the model response");
    fb.modelFramework.forEach((e) => assert.ok(fb.modelResponse.includes(e.text), "each label quotes the model response exactly"));
    assert.ok(fb.revisedFramework.length >= 1 && fb.revisedFramework.every((e) => fb.revisedStory.includes(e.text)));
    assert.equal(fb.frameworkInfo.name, fw.name);
    assert.ok(RESP.wordCount(fb.revisedStory) <= RESP.revisedLimits(assessLength({ text: SHORT, ...fam }), RESP.wordCount(SHORT)).max);
  });
}

test("end to end: a rewrite far beyond the allowed length is replaced by the student's own text with the fixes applied, and its labels are dropped", async () => {
  const { res } = await runWeak({ ...FAMILIES[0], text: SHORT, extra: { revisedStory: SHORT + " " + filler(300, 5).join(" ") + ".", spellingGrammarTotal: 1, spellingGrammar: [{ quote: "everything we do", type: "punctuation", correction: "everything we do!" }] } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body).slice(0, 300));
  assert.equal(res.body.feedback.revisedStory, SHORT.replace("everything we do", "everything we do!"));
  assert.equal(res.body.feedback.revisedFramework, undefined);
});

test("end to end: a model that banded a reading objective on a piece of writing is retried, then refused", async () => {
  const all = targetsForGrade(FAMILIES[0].country, FAMILIES[0].gradeLabel, FAMILIES[0].tier).targets;
  const reading = all.find((t) => targetMode(t) === "reading");
  const { res, prompts } = await runWeak({ ...FAMILIES[0], text: SHORT, extra: { examTechnique: [{ criterion: reading.name, band: 1, descriptor: "Emerging", evidence: "Too little writing to judge this yet.", toNextBand: "Write more." }] } });
  assert.equal(res.statusCode, 502);
  assert.equal(prompts.length, 3);
});

test("end to end: Band 2 or more needs the student's own words as evidence", async () => {
  const fam = FAMILIES[0];
  const names = examTargetsFor(targetsForGrade(fam.country, fam.gradeLabel, fam.tier).targets, "writing");
  const { res } = await runWeak({ ...fam, text: SHORT, extra: { examTechnique: names.map((t) => ({ criterion: t.name, band: 2, descriptor: "Developing", evidence: "The writer shows some control.", toNextBand: "Add more developed points to your own writing." })) } });
  assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /copied exactly from the student's text/);
});

test("end to end: the same model output for a full-length piece keeps the model's score; only a 'not attempted' band is forced to 1", async () => {
  const text = varied(480);
  const { res } = await runWeak({ country: "🇦🇺 Australia", gradeLabel: "Year 11", tier: "high", text, extra: { revisedStory: text } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body).slice(0, 300));
  assert.equal(res.body.feedback.overallScore, 5);
  assert.equal(res.body.feedback.examTechnique[0].band, 3);
  const na = res.body.feedback.examTechnique.find((e) => /too little writing/i.test(e.evidence));
  assert.ok(na && na.band === 1, "a 'not attempted' entry becomes Band 1 with an honest reason");
});

test("a non-Premium plan never receives the model response or the framework labels", async () => {
  const h = submitHandler("core", { ...FAMILIES[3], text: SHORT });
  const res = await call(h, { method: "POST", body: { kind: "writing", submissionId: "sub1", text: SHORT } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body).slice(0, 300));
  for (const k of ["modelResponse", "modelFramework", "revisedFramework", "frameworkInfo"]) assert.equal(res.body.feedback[k], undefined, k);
});

// ------------------------------------------------------------ screen

const APP = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "app.html"), "utf8");

test("screen: the revised piece is called a response, not a story, and the framework panel is wired in", () => {
  assert.ok(APP.includes("Your response, corrected and improved") && APP.includes("Your response, revised"));
  assert.ok(!APP.includes("Your story, corrected and improved"), "the old wording is gone");
  assert.ok(APP.includes("<ResponsesPanel feedback={feedback} />"));
  assert.ok(APP.includes("A MODEL RESPONSE TO THE SAME TASK") && APP.includes("IN YOUR RESPONSE (corrected and improved)"));
  assert.ok(APP.includes("Not in your response yet"), "parts missing from the student's response are named");
  assert.ok(APP.includes("Not banded here:"), "the exam panel says which objectives it left out and why");
});

test("screen: labelledRuns keeps every word, orders labels as they occur, and skips labels it cannot find", () => {
  const src = APP.match(/function labelledRuns\(text, labels\)\{[\s\S]*?\n\}\n/)[0];
  const labelledRuns = new Function(src + "\nreturn labelledRuns;")();
  const text = "Freedom matters. People choose for themselves. So freedom should lead.";
  const runs = labelledRuns(text, [
    { part: "Link", text: "So freedom should lead.", note: "n" },
    { part: "Point", text: "Freedom matters.", note: "n" },
    { part: "Evidence", text: "this text is not in the response", note: "n" },
  ]);
  assert.deepEqual(runs.map((r) => r.part || "plain"), ["Point", "plain", "Link"]);
  assert.equal(runs.map((r) => r.text).join(""), text, "nothing is lost or duplicated");
  assert.deepEqual(labelledRuns("abc", undefined).map((r) => r.text), ["abc"]);
});

// ------------------------------------------------------------ exam objectives and responses, across every country and grade

const { GRADE_MAPPED_TARGETS } = require("../api/_lib/masteryTargets");
const { FRAMEWORK_BY_GENRE } = require("../api/_lib/writingFrameworks");

test("every mapped objective is either a writing or a reading one, and every secondary year has both kinds to band", () => {
  for (const [country, byGrade] of Object.entries(GRADE_MAPPED_TARGETS)) {
    for (const [grade, targets] of Object.entries(byGrade)) {
      const w = examTargetsFor(targets, "writing");
      const r = examTargetsFor(targets, "reading");
      assert.equal(w.length + r.length, targets.length, `${country} ${grade}: every objective is one or the other`);
    }
  }
  const secondary = /(Year (7|8|9|10|11)$|Grade (7|8|9|10|11|12)$|Secondary|IGCSE|Lower Secondary|O-Level)/;
  for (const [country, byGrade] of Object.entries(GRADE_MAPPED_TARGETS)) {
    for (const [grade, targets] of Object.entries(byGrade)) {
      if (!secondary.test(grade)) continue;
      assert.ok(examTargetsFor(targets, "writing").length >= 1, `${country} ${grade}: a writing objective to band`);
      assert.ok(examTargetsFor(targets, "reading").length >= 1, `${country} ${grade}: a reading objective to band`);
    }
  }
});

test("objectives are sorted as the curriculum codes say: AQA AO2/AO3 and Australian LY05 are reading, AO5/AO6 and LY06 are writing", () => {
  const t = (name, standard) => ({ name, standard });
  assert.equal(targetMode(t("Analysing Language for Effect", "AQA GCSE English Language · AO2")), "reading");
  assert.equal(targetMode(t("Comparing Writers Perspectives", "AQA GCSE English Language · AO3")), "reading");
  assert.equal(targetMode(t("Viewpoint & Argument Writing", "AQA GCSE English Language · AO5")), "writing");
  assert.equal(targetMode(t("Technical Accuracy", "AQA GCSE English Language · AO6")), "writing");
  assert.equal(targetMode(t("Interpreting Complex & Abstract Ideas", "AC9E10LY05 · Year 10 Literacy")), "reading");
  assert.equal(targetMode(t("Analytical & Persuasive Writing", "AC9E10LY06 · Year 10 Literacy")), "writing");
  assert.equal(targetMode(t("Evaluating Sentence Structure", "AC9E10LA05 · Year 10 Language")), "writing");
  assert.equal(targetMode(t("Citing Strong & Thorough Textual Evidence", "CCSS.ELA-LITERACY.RL.9-10.1 / RI.9-10.1")), "reading");
  assert.equal(targetMode(t("Precise Claims", "CCSS.ELA-LITERACY.W.9-10.1")), "writing");
  assert.equal(targetMode(t("Organising Ideas for Effect", "IGCSE First Language English 0500 · AO2 Writing (W2)")), "writing");
  assert.equal(targetMode(t("Understanding Implicit Meaning", "IGCSE First Language English 0500 · AO1 Reading (R2)")), "reading");
});

test("for every genre: the model response must use every part of that framework, labelled with exact quotes; bad labels are dropped, not fatal", () => {
  const STUDENT = "Freedom matters. People choose.";
  const ASSESS = { target: 150, level: "ok" };
  for (const [genre, fw] of Object.entries(FRAMEWORK_BY_GENRE)) {
    const parts = frameworkParts(fw);
    assert.ok(parts.length >= 1, genre);
    const lim = RESP.modelLimits(ASSESS);
    const per = Math.ceil(lim.n / parts.length);
    const sentences = parts.map((p, k) => { const w = filler(per, k + 1); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return w.join(" ") + "."; });
    const good = {
      modelResponse: sentences.join(" "),
      modelFramework: parts.map((p, k) => ({ part: p.name.toLowerCase(), text: sentences[k], note: "This does the job of " + p.name + "." })),
      revisedStory: STUDENT,
      revisedFramework: [{ part: parts[0].name, text: "Freedom matters.", note: "This states the position." }],
    };
    const clone = () => JSON.parse(JSON.stringify(good));
    const check = (o) => {
      const issues = [];
      RESP.repairFrameworkLabels(o, fw, "modelFramework", "modelResponse");
      RESP.repairFrameworkLabels(o, fw, "revisedFramework", "revisedStory");
      RESP.validateResponses(o, { fw, assessment: ASSESS, submittedText: STUDENT }, issues);
      return issues;
    };
    assert.deepEqual(check(clone()), [], `${genre}: compliant`);
    if (parts.length > 1) {
      const bad = clone(); bad.modelFramework.pop();
      assert.ok(check(bad).some((i) => /^modelFramework is missing/.test(i)), `${genre}: a missing part is caught`);
    }
    const fake = clone(); fake.modelFramework[0].text = "words that are nowhere in the response";
    assert.ok(check(fake).length > 0, `${genre}: a made-up quote is not accepted`);
    const odd = clone(); odd.revisedFramework[0].part = "Nonsense";
    assert.ok(check(odd).some((i) => /^revisedFramework/.test(i)), `${genre}: an unknown part is dropped`);
    const short = clone(); short.modelResponse = "Too short."; short.modelFramework = [];
    assert.ok(check(short).some((i) => /^modelResponse/.test(i)));
    const issues = [];
    RESP.validateResponses({ ...clone(), modelResponse: STUDENT + " " + sentences.join(" ") }, { fw, assessment: ASSESS, submittedText: STUDENT }, issues);
    assert.ok(issues.some((i) => /not contain the student/.test(i)), `${genre}: copying the student is caught`);
  }
});

test("revised response limits: a normal piece stays close, a short one may be developed but never past the expected length", () => {
  for (const { country, gradeLabel, target } of COMBOS) {
    for (const orig of [3, 15, 33]) {
      const a = assessLength({ text: varied(orig), tier: "high", country, gradeLabel });
      const lim = RESP.revisedLimits(a, orig);
      const tight = Math.ceil(orig * 1.35) + 8;
      assert.ok(lim.max >= tight, `${country} ${gradeLabel}: never tighter than a normal piece`);
      assert.ok(lim.max <= Math.max(target, tight), `${country} ${gradeLabel}: never past the expected length (${lim.max} vs ${target})`);
    }
    const m = RESP.modelLimits({ target });
    assert.ok(m.n <= 400 && m.min < m.n && m.max > m.n);
  }
});

test("the prompt for every genre asks for the model response, the part names and both label lists, but only for Premium", () => {
  for (const [genre, fw] of Object.entries(FRAMEWORK_BY_GENRE)) {
    const args = { tier: "high", country: "🇬🇧 United Kingdom", gradeLabel: "Year 11", interest: "football", prompt: "Write.", text: "Short answer here with a few words in it.", targets: [], targetNames: ["A"], genre };
    const premium = buildWritingPrompt({ ...args, capabilities: { deepFeedback: true, spellingGrammar: true, overallScore: true } });
    for (const p of frameworkParts(fw)) assert.ok(premium.includes(`"${p.name}"`), `${genre}: names part ${p.name}`);
    assert.match(premium, /"modelFramework":/);
    assert.match(premium, /"revisedFramework":/);
    assert.match(premium, /EVERY part present/);
    const core = buildWritingPrompt({ ...args, capabilities: { deepFeedback: false } });
    assert.ok(!core.includes("modelFramework"), `${genre}: Core is not asked`);
  }
});

test("the model response is returned once, as segments, and the full response is composed from them", () => {
  const fw = FRAMEWORK_BY_GENRE.persuasive;
  const parsed = { modelResponse: "ignored", modelFramework: [
    { part: "point", text: "Freedom matters most.", note: "States the argument clearly." },
    { part: "Evidence", text: "People choose their own paths.", note: "" },
    { part: "Nonsense", text: "Dropped.", note: "x" },
  ] };
  RESP.composeModelResponse(parsed, fw);
  assert.equal(parsed.modelResponse, "Freedom matters most. People choose their own paths.");
  assert.deepEqual(parsed.modelFramework.map((e) => e.part), ["Point", "Evidence"]);
  assert.ok(parsed.modelFramework[1].note.length >= 8, "a missing note gets a plain default");
});

test("time guard: when another full attempt could not finish within the function limit, the current one is the last", async () => {
  const realNow = Date.now;
  let t = 0;
  Date.now = () => (t += 30000); // every reading of the clock is 30s later
  try {
    const fam = FAMILIES[0];
    // a Premium answer whose only problem is the model response: delivered without it after ONE attempt
    const prompts = [];
    const h = submitHandler("premium", { ...fam, text: SHORT, extra: { modelFramework: [] } }, prompts);
    const res = await call(h, { method: "POST", body: { kind: "writing", submissionId: "sub1", text: SHORT } });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body).slice(0, 300));
    assert.equal(prompts.length, 1, "no second attempt that could not finish in time");
    assert.equal(res.body.feedback.modelResponse, undefined, "the bonus section is dropped, the rest delivered");
    // a problem in a core section fails fast, with the plain error
    const prompts2 = [];
    const h2 = submitHandler("premium", { ...fam, text: SHORT, extra: { glow: "" } }, prompts2);
    const res2 = await call(h2, { method: "POST", body: { kind: "writing", submissionId: "sub1", text: SHORT } });
    assert.equal(res2.statusCode, 502);
    assert.equal(prompts2.length, 1);
  } finally {
    Date.now = realNow;
  }
});

// ------------------------------------------------------------ one bad suggested rewrite must not sink the feedback

const { dropRestatingHighlights } = require("../api/_lib/validate");

const KIDS_STORY = "I runned to the fig tree as fast as my feets could go! Underneath the big roots there was a glowing shiney box. It had a weird keyhole shaped like a star. I was so exited I almost droped my apple juice everywhere.\n\nI decided to open the box using a pointy stick I found on the ground. When it popped open with a loud CLICK a tiny golden compass floated up into the air. It didn't point North though it pointed right towards the principal office!\n\nBecause I choosed to open the box instead of telling a teacher, now me and my best friend gotta sneak past the lunch duty guards to follow the compass. This changed my whole boring Monday into a top secret spy mission that is super fun!";

test("a suggested rewrite that restates wording from elsewhere is dropped, the other highlights stay", () => {
  const parsed = { highlights: [
    { quote: "a glowing shiney box", type: "glow", note: "Good detail." },
    { quote: "a weird keyhole shaped like a star", type: "glow", note: "Vivid." },
    { quote: "I runned to the fig tree", type: "grow", note: "Past tense.", revision: "I ran to the fig tree" },
    { quote: "It had a weird keyhole shaped like a star.", type: "grow", note: "Join.", revision: "It had a keyhole, so I decided to open the box using a pointy stick I found." },
  ] };
  dropRestatingHighlights(parsed, KIDS_STORY);
  assert.equal(parsed.highlights.length, 3);
  assert.ok(parsed.highlights.every((h) => h.type === "glow" || /I ran to/.test(h.revision)));
});

test("a rewrite identical to its quote is dropped too, but never down to fewer than two highlights", () => {
  const two = { highlights: [
    { quote: "a glowing shiney box", type: "glow", note: "Good." },
    { quote: "I runned to the fig tree", type: "grow", note: "x", revision: "I runned to the fig tree" },
  ] };
  dropRestatingHighlights(two, KIDS_STORY);
  assert.equal(two.highlights.length, 2, "the validator still reports it, since dropping would leave fewer than two");
  const three = { highlights: [...two.highlights, { quote: "my apple juice", type: "glow", note: "Fun." }] };
  dropRestatingHighlights(three, KIDS_STORY);
  assert.equal(three.highlights.length, 2);
  assert.ok(three.highlights.every((h) => h.type === "glow"));
});

test("end to end (Australia, Year 3): that rewrite no longer turns a good response into 'Couldn't generate feedback'", async () => {
  const fam = { country: "🇦🇺 Australia", gradeLabel: "Year 3", tier: "elementary" };
  const out = modelOutput({ ...fam, text: KIDS_STORY });
  const hs = [
    { quote: "I runned to the fig tree", type: "glow", note: "A strong, fast start." },
    { quote: "a loud CLICK", type: "glow", note: "A sound the reader can hear." },
    { quote: "my feets", type: "grow", note: "Plural of foot.", revision: "my feet" },
    { quote: "a top secret spy mission", type: "grow", note: "Sharper ending.", revision: "to open the box using a pointy stick, and a secret spy mission" },
  ];
  const { res, prompts } = await runWeak({ ...fam, text: KIDS_STORY, extra: { highlights: hs, revisedStory: KIDS_STORY.replace("runned", "ran"), revisedFramework: [{ part: "Point", text: "I ran to the fig tree as fast as my feets could go!", note: "This sentence opens with a clear point." }], frameworkTip: out.frameworkTip } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body).slice(0, 300));
  assert.equal(prompts.length, 1, "no retries needed");
  assert.equal(res.body.feedback.highlights.length, 3);
});
