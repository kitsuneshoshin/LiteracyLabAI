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
    microMission: "Next time, add one sentence acknowledging the opposing view.",
    vocab: [
      { term: "concession", definition: "admitting part of the other side's point before answering it." },
      { term: "rebuttal", definition: "the part where you answer the opposing argument directly." },
    ],
    commitOptions: ["I'll add a counter-argument", "I'll test my claim harder", "I'll vary my sentence openings"],
    glowTarget: "Viewpoint & Argument Writing",
    growTarget: "Technical Accuracy",
    growNext: "Once counter-arguments feel natural, try ordering them so the strongest one lands last.",
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
  for (const band of [0, 5, 3.5, "3", null, undefined]) {
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
    text: "An essay.", targetNames: TARGET_NAMES, targets: TARGETS, previousCommitment: null,
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
