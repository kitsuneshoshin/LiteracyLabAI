const test = require("node:test");
const assert = require("node:assert/strict");
const { validateFeedback } = require("../api/_lib/validate");
const { buildWritingPrompt, examTechniqueSupported } = require("../api/_lib/prompt");

// Exam-technique scoring is the capability the Premium tier is sold
// on. It was added precisely because the pricing page had claimed it while
// it existed nowhere in the code, so these tests hold the implementation to
// the claim: banded against the student's real assessment objectives, every
// objective covered, evidence attached, and never a fabricated raw mark.

const TARGETS = [
  { name: "Viewpoint & Argument Writing", standard: "AQA GCSE English Language · AO5" },
  { name: "Technical Accuracy", standard: "AQA GCSE English Language · AO6" },
];
const TARGET_NAMES = TARGETS.map((t) => t.name);

function baseFeedback(overrides = {}) {
  return {
    glow: "Your opening claim is clear and you commit to it straight away in the first line.",
    grow: "Try adding one counter-argument before your conclusion so the argument feels tested.",
    vocab: [
      { term: "concession", definition: "admitting part of the other side's point before answering it.", example: "Her concession that the other team trained hard made her win even sweeter." },
      { term: "rebuttal", definition: "the part where you answer the opposing argument directly.", example: "His rebuttal directly addressed the counter-argument from paragraph two." },
    ],
    glowTarget: "Viewpoint & Argument Writing",
    growTarget: "Technical Accuracy",
    growNext: "Once counter-arguments feel natural, reorder them so the strongest one lands last, starting from your sentence \"this proves the point\".",
    examTechnique: [
      { criterion: "Viewpoint & Argument Writing", band: 3, descriptor: "Secure", evidence: "your opening claim", toNextBand: "Sustain the same viewpoint through every paragraph, not just the opening." },
      { criterion: "Technical Accuracy", band: 2, descriptor: "Developing", evidence: "two comma splices in the third paragraph", toNextBand: "Split comma-spliced sentences into two full sentences." },
    ],
    examSummary: "Technical accuracy is the objective worth working on next, because it costs marks on every paragraph.",
    ...overrides,
  };
}

const CAPS = { deepFeedback: true, examTechnique: true };
const CTX = { tier: "high", standardsList: [], targetNames: TARGET_NAMES, submittedText: null, capabilities: CAPS };

test("a complete exam-technique report passes", () => {
  const result = validateFeedback(baseFeedback(), CTX);
  assert.equal(result.ok, true, result.issues.join("; "));
});

test("every assessment objective must be banded - a model can't skip the weak one", () => {
  const feedback = baseFeedback({
    examTechnique: [baseFeedback().examTechnique[0]],
  });
  const result = validateFeedback(feedback, CTX);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("Technical Accuracy")));
});

test("a band outside 1-4 is rejected", () => {
  // Numeric strings ("3") and 0 are normalised rather than rejected - see
  // coerceBand in validate.js and tests/reading-zero-score.test.js.
  for (const band of [5, 3.5, "3.5", "high", null, undefined]) {
    const entries = baseFeedback().examTechnique;
    entries[1].band = band;
    const result = validateFeedback(baseFeedback({ examTechnique: entries }), CTX);
    assert.equal(result.ok, false, `band ${String(band)} should be rejected`);
    assert.ok(result.issues.some((i) => i.includes("band must be an integer")));
  }
});

test("a criterion not in the student's objective list is rejected", () => {
  const entries = baseFeedback().examTechnique;
  entries[1].criterion = "Creative Flair";
  const result = validateFeedback(baseFeedback({ examTechnique: entries }), CTX);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("criterion must exactly match")));
});

test("a criterion is snapped back to its canonical name when the model drops punctuation", () => {
  const entries = baseFeedback().examTechnique;
  entries[0].criterion = "viewpoint and argument writing";
  const feedback = baseFeedback({ examTechnique: entries });
  const result = validateFeedback(feedback, CTX);
  assert.equal(result.ok, true, result.issues.join("; "));
  assert.equal(feedback.examTechnique[0].criterion, "Viewpoint & Argument Writing");
});

test("scoring the same objective twice is rejected", () => {
  const first = baseFeedback().examTechnique[0];
  const result = validateFeedback(baseFeedback({ examTechnique: [first, { ...first }] }), CTX);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("scored more than once")));
});

test("each band needs evidence and a route to the next band", () => {
  const entries = baseFeedback().examTechnique;
  delete entries[0].evidence;
  delete entries[1].toNextBand;
  const result = validateFeedback(baseFeedback({ examTechnique: entries }), CTX);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("evidence")));
  assert.ok(result.issues.some((i) => i.includes("toNextBand")));
});

test("a fabricated raw mark, percentage or grade letter is rejected", () => {
  const fabrications = [
    "Overall this sits at about 17/24 for the paper.",
    "This would land around 68% on the real exam paper.",
    "On this evidence the piece is a grade 6 answer overall.",
    "Roughly 12 out of 20 marks on this objective overall.",
  ];
  for (const examSummary of fabrications) {
    const result = validateFeedback(baseFeedback({ examSummary }), CTX);
    assert.equal(result.ok, false, `should reject: ${examSummary}`);
    assert.ok(result.issues.some((i) => i.includes("invents a raw mark")));
  }
});

test("exam technique is not required when the plan doesn't grant it", () => {
  const feedback = baseFeedback({ examTechnique: undefined, examSummary: undefined, growNext: undefined });
  const result = validateFeedback(feedback, { ...CTX, capabilities: { deepFeedback: false, examTechnique: false } });
  assert.equal(result.ok, true, result.issues.join("; "));
});

test("deep feedback requires a growNext that isn't just the grow again", () => {
  const caps = { deepFeedback: true, examTechnique: false };
  const ctx = { ...CTX, capabilities: caps };

  const missing = validateFeedback(baseFeedback({ growNext: undefined, examTechnique: undefined, examSummary: undefined }), ctx);
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.some((i) => i.includes("growNext")));

  const base = baseFeedback({ examTechnique: undefined, examSummary: undefined });
  const echoed = validateFeedback({ ...base, growNext: base.grow }, ctx);
  assert.equal(echoed.ok, false);
  assert.ok(echoed.issues.some((i) => i.includes("identical to grow")));
});

test("banded objectives only apply to middle and high tiers", () => {
  assert.equal(examTechniqueSupported("early"), false);
  assert.equal(examTechniqueSupported("elementary"), false);
  assert.equal(examTechniqueSupported("middle"), true);
  assert.equal(examTechniqueSupported("high"), true);
});

test("the prompt only asks for paid sections when the plan grants them", () => {
  const args = {
    tier: "high", country: "UK", gradeLabel: "Year 11", interest: "football",
    confidenceWriting: "growing", motivation: "grades", prompt: "Agree or disagree.",
    text: "An essay.", targetNames: TARGET_NAMES, targets: TARGETS,
  };

  const free = buildWritingPrompt({ ...args, capabilities: { deepFeedback: false, examTechnique: false } });
  assert.ok(!free.includes("EXAM-TECHNIQUE SCORING"));
  assert.ok(!free.includes("growNext"));

  const premium = buildWritingPrompt({ ...args, capabilities: { deepFeedback: true, examTechnique: true } });
  assert.ok(premium.includes("EXAM-TECHNIQUE SCORING"));
  assert.ok(premium.includes("growNext"));
  // The real objective names and their published standards must reach the
  // model - that's what makes the band traceable rather than invented.
  assert.ok(premium.includes("AQA GCSE English Language · AO5"));
  assert.ok(premium.includes("Viewpoint & Argument Writing"));
});

// Regression: live testing (via a real submission that failed validation 3
// times in a row) found the model consistently banding only the objective
// it judged "relevant" to the piece and silently dropping the rest, even
// though the prose instruction already said every objective must be
// banded. Every target must appear as its own numbered checklist line, and
// the "exactly N entries" line must name the real count, not a vague "every
// objective" - both are what should make skipping one harder to do by
// accident.
test("exam-technique objectives are repeated as an explicit numbered checklist the model can't silently skip", () => {
  const args = {
    tier: "high", country: "UK", gradeLabel: "Year 11", interest: "football",
    confidenceWriting: "growing", motivation: "grades", prompt: "Agree or disagree.",
    text: "An essay.", targetNames: TARGET_NAMES, targets: TARGETS,
    capabilities: { deepFeedback: true, examTechnique: true },
  };
  const premium = buildWritingPrompt(args);
  assert.ok(premium.includes(`exactly ${TARGETS.length} entries`));
  TARGETS.forEach((t, i) => {
    assert.ok(premium.includes(`${i + 1}. "${t.name}"`), `missing checklist line for "${t.name}"`);
  });
});

// Regression: the JSON template shown to the model used to contain ONE
// generic example entry, and the model copied that shape - returning a
// one-item examTechnique array on real Middle/High School submissions. The
// template must now carry one pre-named entry per objective.
test("the exam-technique JSON template has one pre-named entry per objective, not a single generic one", () => {
  const prompt = buildWritingPrompt({
    tier: "high", country: "UK", gradeLabel: "Year 11", interest: "football",
    confidenceWriting: "growing", motivation: "grades", prompt: "Agree or disagree.",
    text: "An essay.", targetNames: TARGET_NAMES, targets: TARGETS,
    capabilities: { deepFeedback: true, examTechnique: true },
  });
  TARGETS.forEach((t) => {
    assert.ok(prompt.includes(`"criterion": ${JSON.stringify(t.name)}`), `template missing criterion entry for "${t.name}"`);
  });
  assert.ok(!prompt.includes("the exact assessment objective name"), "old single generic template entry is still present");
});

// Premium-only features must not even be REQUESTED on a plan without them:
// asking Free/Core for a spelling list and a score would spend tokens on
// content we then couldn't show, and validating for it would fail feedback
// over a section that plan doesn't get.
test("the writing prompt only asks for the spelling check and overall score when the plan includes them", () => {
  const args = {
    tier: "middle", country: "UK", gradeLabel: "Year 7", interest: "gaming",
    confidenceWriting: "growing", motivation: "grades", prompt: "Analyse a character.",
    text: "An essay.", targetNames: ["Rhetorical Awareness"], targets: [{ name: "Rhetorical Awareness", standard: "KS3" }], genre: "analytical",
  };
  const core = buildWritingPrompt({ ...args, capabilities: { spellingGrammar: false, overallScore: false } });
  for (const marker of ["SPELLING AND GRAMMAR CHECK", "OVERALL SCORE (required", '"overallScore"', '"spellingGrammarTotal"', '"spellingGrammar"']) {
    assert.ok(!core.includes(marker), "Core prompt still contains: " + marker);
  }
  const premium = buildWritingPrompt({ ...args, capabilities: { spellingGrammar: true, overallScore: true } });
  for (const marker of ["SPELLING AND GRAMMAR CHECK", "OVERALL SCORE (required", '"overallScore"', '"spellingGrammarTotal"']) {
    assert.ok(premium.includes(marker), "Premium prompt is missing: " + marker);
  }
});

test("feedback without a score or spelling list validates for a plan that doesn't include them, and fails for one that does", () => {
  const fb = baseFeedback({});
  delete fb.overallScore; delete fb.scoreReason; delete fb.spellingGrammar; delete fb.spellingGrammarTotal;
  const ctx = { tier: "high", standardsList: [], targetNames: TARGET_NAMES, submittedText: "An essay of some length here.", genre: "persuasive" };
  const core = validateFeedback(fb, { ...ctx, capabilities: { spellingGrammar: false, overallScore: false } });
  assert.ok(!core.issues.some((i) => /overallScore|scoreReason|spellingGrammar/.test(i)), "Core was held to Premium-only fields: " + core.issues.join("; "));
  const premium = validateFeedback(fb, { ...ctx, capabilities: { spellingGrammar: true, overallScore: true } });
  assert.ok(premium.issues.some((i) => /overallScore/.test(i)));
  assert.ok(premium.issues.some((i) => /spellingGrammar/.test(i)));
});

// ------------------------------------------------------------------ the second, harder step (growNext)

test("growNext: a reworded copy of the main grow is rejected", () => {
  const grow = "Try adding one counter-argument before your conclusion so the argument feels tested.";
  const result = validateFeedback(baseFeedback({ grow, growNext: "Add one counter-argument before your conclusion so your argument feels properly tested." }), CTX);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => /mostly the same words as grow/.test(i)), result.issues.join("; "));
});

test("growNext: a real next level of the same skill passes", () => {
  const result = validateFeedback(baseFeedback({ growNext: "Once counter-arguments feel natural, order them so the strongest one lands last, then rewrite \"this proves the point\" so your conclusion answers it." }), CTX);
  assert.equal(result.ok, true, result.issues.join("; "));
});

test("growNext: an analogy is rejected - a forced comparison makes the step read as filler", () => {
  for (const growNext of [
    "Next time, focus on how choices reflect values, like how animals in a pack follow their leader, and rewrite \"this proves the point\".",
    "Think of it like a chess game and rewrite \"this proves the point\" so each move counts.",
    "Imagine you are a lawyer, then rewrite \"this proves the point\" with a clearer reason.",
  ]) {
    const result = validateFeedback(baseFeedback({ growNext }), CTX);
    assert.equal(result.ok, false, growNext);
    assert.ok(result.issues.some((i) => /analogy/.test(i)), result.issues.join("; "));
  }
});

test("growNext (writing): it must quote the student's own words exactly, and a made-up or missing quote is rejected", () => {
  const ctx = { ...CTX, submittedText: "I think homework helps. This proves the point because teachers say so." };
  const good = validateFeedback(baseFeedback({ growNext: "Once reasons feel natural, replace \"teachers say so\" with a reason that comes from your own experience of homework." }), ctx);
  const about = (r) => r.issues.filter((i) => /growNext/.test(i));
  assert.deepEqual(about(good), [], "a real quote passes");
  const invented = validateFeedback(baseFeedback({ growNext: "Once reasons feel natural, replace \"everyone knows this\" with a reason from your own experience of homework." }), ctx);
  assert.ok(about(invented).some((i) => /quote a short fragment/.test(i)), "an invented quote is refused");
  const vague = validateFeedback(baseFeedback({ growNext: "Once that is second nature, work on comparing multiple ideas and exploring deeper meanings in your writing." }), ctx);
  assert.ok(about(vague).length > 0, "the vague step from the real example is refused");
});

test("growNext (reading): it must point at something specific, not just talk about 'deeper meanings'", () => {
  const vague = validateFeedback(baseFeedback({ growNext: "After mastering deeper meanings, work on comparing multiple ideas in the text and exploring different values." }), CTX);
  assert.equal(vague.ok, false);
  const specific = validateFeedback(baseFeedback({ growNext: "Once that is steady, answer the next inference question by naming the sentence in the passage that proves your choice." }), CTX);
  assert.equal(specific.ok, true, specific.issues.join("; "));
});

test("growNext: the prompt asks for a concrete next level, ties it to the piece, and keeps the interest as a comparison only", () => {
  const p = buildWritingPrompt({
    tier: "high", country: "🇬🇧 United Kingdom", gradeLabel: "Year 11", interest: "gaming", prompt: "Write.", text: "Some text.",
    targets: TARGETS, targetNames: TARGET_NAMES, capabilities: { deepFeedback: true }, genre: "persuasive",
  });
  assert.match(p, /next level of the SAME writing skill/);
  assert.match(p, /concrete action the student can do in their next piece/);
  assert.match(p, /no games, points, challenges or projects/);
  assert.match(p, /the interest must never BE the task/);
});
