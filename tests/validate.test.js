const test = require("node:test");
const assert = require("node:assert/strict");
const { validateFeedback, validatePassage, validateWritingPrompt, resolveTarget } = require("../api/_lib/validate");

const SUBMITTED_TEXT = "The dog ran fast. It saw a cat up in a tree. The end of the story was happy.";

function baseFeedback(overrides = {}) {
  return {
    glow: "This is a solid piece of writing with a clear beginning and end for the story.",
    grow: "Try joining two short sentences together to build a more complex sentence structure.",
    microMission: "Next time, combine two short sentences into one.",
    vocab: [
      { term: "adjective", definition: "a word that describes a noun, like happy or fast." },
      { term: "sentence", definition: "a group of words that expresses a complete thought." },
    ],
    commitOptions: ["I'll combine two sentences", "I'll add more description", "I'll check my spelling"],
    glowTarget: "",
    growTarget: "",
    ...overrides,
  };
}

test("validateFeedback: a well-formed response with no targets to match passes cleanly", () => {
  const result = validateFeedback(baseFeedback(), { tier: "elementary", standardsList: [], targetNames: [], submittedText: null });
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, []);
});

test("validateFeedback: glowTarget/growTarget must match a given target name", () => {
  const result = validateFeedback(baseFeedback({ glowTarget: "Not A Real Target" }), {
    tier: "elementary", standardsList: [], targetNames: ["Fronted Adverbials"], submittedText: null,
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("glowTarget")));
});

test("validateFeedback: highlight quote must appear verbatim in the submitted text", () => {
  const feedback = baseFeedback({
    highlights: [
      { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
      { quote: "something the student never wrote", type: "grow", note: "Needs work.", revision: "a real rewrite of it" },
    ],
  });
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("does not appear verbatim")));
});

test("validateFeedback: a grow revision identical to its own quote is rejected", () => {
  const feedback = baseFeedback({
    highlights: [
      { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
      { quote: "The dog ran fast.", type: "grow", note: "Needs work.", revision: "The dog ran fast." },
    ],
  });
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("identical to its quote")));
});

// Regression test for a real bug found by live testing this session: the
// model tried to satisfy a "combine sentences" suggestion by restating
// wording that already exists ELSEWHERE in the story (not just the quote's
// immediate neighbour) - which would duplicate that text once spliced in.
test("regression: a revision that restates other text from elsewhere in the story is rejected", () => {
  const feedback = baseFeedback({
    highlights: [
      { quote: "The end of the story was happy", type: "glow", note: "Good closing line." },
      // Restates "The dog ran fast" from the story's first sentence, several words back.
      { quote: "It saw a cat up in a tree", type: "grow", note: "Combine these ideas.", revision: "The dog ran fast and it saw a cat up in a tree" },
    ],
  });
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("restates wording that already appears elsewhere")));
});

// Regression test for a real bug found by live testing this session: an
// interest-based analogy ("like how I...", later "similar to how...")
// leaking into a formal middle/high-tier essay's revision text.
test("regression: an analogy phrase in a high-tier revision is rejected, in any grammatical person", () => {
  const analogies = [
    "like how I see trends in technology use among my friends",
    "similar to how video games can become an alternative social space",
    "just like a well-run team relies on trust",
  ];
  for (const analogy of analogies) {
    const feedback = baseFeedback({
      highlights: [
        { quote: "The end of the story was happy", type: "glow", note: "Strong closing." },
        { quote: "It saw a cat up in a tree", type: "grow", note: "Needs more formal phrasing.", revision: `This demonstrates the theme, ${analogy}.` },
      ],
    });
    const result = validateFeedback(feedback, { tier: "high", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
    assert.equal(result.ok, false, `expected rejection for analogy: "${analogy}"`);
    assert.ok(result.issues.some((i) => i.includes("interest-based analogy")), `expected an analogy issue for: "${analogy}"`);
  }
});

test("regression: the same analogy phrasing is ALLOWED for early/elementary tiers (personal voice is expected there)", () => {
  const feedback = baseFeedback({
    highlights: [
      { quote: "The end of the story was happy", type: "glow", note: "Great ending!" },
      { quote: "It saw a cat up in a tree", type: "grow", note: "Nice detail.", revision: "It saw a cat up in a tree, just like the cat from my favourite game." },
    ],
  });
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, true, `unexpected issues: ${JSON.stringify(result.issues)}`);
});

test("validateFeedback: sentences that are too long for the age tier are flagged", () => {
  const longSentence = "This is a very long sentence that just keeps going and going and going and going and going and going and going and going and going and going and going without ever stopping to make a real point which is exactly the kind of overly long sentence a young early-tier reader should not be given as feedback.";
  const feedback = baseFeedback({ glow: longSentence, grow: longSentence });
  const result = validateFeedback(feedback, { tier: "early", standardsList: [], targetNames: [], submittedText: null });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("too long for this age tier")));
});

test("resolveTarget: matches exactly, and fuzzily ignoring case/punctuation", () => {
  const names = ["Fronted Adverbials", "Modal Verbs"];
  assert.equal(resolveTarget("Fronted Adverbials", names), "Fronted Adverbials");
  assert.equal(resolveTarget("fronted adverbials", names), "Fronted Adverbials");
  assert.equal(resolveTarget("Fronted-Adverbials!", names), "Fronted Adverbials");
  assert.equal(resolveTarget("Something Else Entirely", names), null);
});

test("validatePassage: rejects a passage far outside the expected word-count band for its tier", () => {
  const tooShort = { title: "A Title", skill: "Inference", passage: "This is a short passage that is nowhere near long enough for a high school reading task.", questions: [
    { q: "Question one goes here?", options: ["a", "b", "c", "d"], correct: 0 },
    { q: "Question two goes here?", options: ["a", "b", "c", "d"], correct: 1 },
    { q: "Question three goes here?", options: ["a", "b", "c", "d"], correct: 2 },
  ] };
  const result = validatePassage(tooShort, { tier: "high" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("expected roughly")));
});

test("validatePassage: rejects duplicate answer options", () => {
  const passage = {
    title: "A Title", skill: "Inference",
    passage: "word ".repeat(150),
    questions: [
      { q: "Question one goes here?", options: ["same", "same", "c", "d"], correct: 0 },
      { q: "Question two goes here?", options: ["a", "b", "c", "d"], correct: 1 },
      { q: "Question three goes here?", options: ["a", "b", "c", "d"], correct: 2 },
    ],
  };
  const result = validatePassage(passage, { tier: "high" });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("duplicate answer choices")));
});

test("validateWritingPrompt: rejects a missing or too-short prompt", () => {
  const result = validateWritingPrompt({ title: "A Title", prompt: "Too short" }, { tier: "elementary" });
  assert.equal(result.ok, false);
});
