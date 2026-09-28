const test = require("node:test");
const assert = require("node:assert/strict");
const { validateFeedback, validatePassage, validateWritingPrompt, resolveTarget } = require("../api/_lib/validate");

const SUBMITTED_TEXT = "The dog ran fast. It saw a cat up in a tree. The end of the story was happy.";

function baseFeedback(overrides = {}) {
  return {
    glow: "This is a solid piece of writing with a clear beginning and end for the story.",
    grow: "Try joining two short sentences together to build a more complex sentence structure.",
    vocab: [
      { term: "adjective", definition: "a word that describes a noun, like happy or fast.", example: "\"Fast\" is an adjective in the sentence \"the fast dog ran.\"" },
      { term: "sentence", definition: "a group of words that expresses a complete thought.", example: "\"The dog ran fast\" is a complete sentence." },
    ],
    commitOptions: ["I'll combine two sentences", "I'll add more description", "I'll check my spelling"],
    glowTarget: "",
    growTarget: "",
    // Matches the "elementary" tier's framework (see writingFrameworks.js) -
    // most tests below use tier: "elementary", so this default keeps them
    // passing without every one needing its own frameworkTip override.
    frameworkTip: { name: "Story Mountain", quote: "It saw a cat up in a tree.", revision: "Climax: It suddenly spotted a cat up in a tree, its heart racing with excitement." },
    overallScore: 6,
    scoreReason: "Clear structure and a happy ending, but the sentences stay very short throughout.",
    spellingGrammarTotal: 0,
    spellingGrammar: [],
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

// Writing "and" for "&" is the most likely way a model breaks a "copy this
// verbatim" instruction, and several real target names contain "&" (see
// masteryTargets.js). On glowTarget/growTarget this failure is SILENT: the
// value doesn't match, so api/progress.js's Map lookup misses and that
// submission just never aggregates into the student's mastery history -
// no error, no retry, the number is quietly wrong.
test("regression: a target name's \"&\" still resolves when the model writes it out as \"and\"", () => {
  const names = ["Viewpoint & Argument Writing", "Summarising & Organising Ideas", "Technical Accuracy"];
  assert.equal(resolveTarget("Viewpoint and Argument Writing", names), "Viewpoint & Argument Writing");
  assert.equal(resolveTarget("viewpoint and argument writing", names), "Viewpoint & Argument Writing");
  assert.equal(resolveTarget("Viewpoint & Argument Writing", names), "Viewpoint & Argument Writing");
  assert.equal(resolveTarget("Summarising and Organising Ideas", names), "Summarising & Organising Ideas");
  // Expanding "&" to "and" must not blur two genuinely different targets
  // into one another.
  assert.equal(resolveTarget("Technical Accuracy", names), "Technical Accuracy");
  assert.equal(resolveTarget("Argument Writing", names), null);
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

// Regression tests for the exact two fabricated glows caught by live
// testing on a 0/3 reading-comprehension attempt.
test("regression: a reading glow fabricating comprehension on a 0-score attempt is rejected", () => {
  const fabricated = [
    "You captured an interesting moment in the passage when you mentioned the urgency around the missing dagger. It shows you noticed the tension present, which is an important aspect when interpreting the emotions of a story.",
    "You engaged thoughtfully with complex ideas about coding and its relevance today. This reflects an understanding of how to articulate opinions.",
  ];
  for (const glow of fabricated) {
    const result = validateFeedback(baseFeedback({ glow }), { tier: "middle", standardsList: [], targetNames: [], submittedText: null, readingScore: 0 });
    assert.equal(result.ok, false, `expected rejection for: "${glow}"`);
    assert.ok(result.issues.some((i) => i.includes("fabricates comprehension")), `expected a fabrication issue for: "${glow}"`);
  }
});

test("regression: the same fabrication check does not fire when the score is not zero", () => {
  const glow = "You engaged thoughtfully with complex ideas about coding and its relevance today.";
  const result = validateFeedback(baseFeedback({ glow }), { tier: "middle", standardsList: [], targetNames: [], submittedText: null, readingScore: 2 });
  assert.equal(result.ok, true, `unexpected issues: ${JSON.stringify(result.issues)}`);
});

test("regression: an honest, content-free zero-score glow passes", () => {
  const glow = "You gave this passage a real go, and that's exactly the habit that builds stronger reading over time.";
  const result = validateFeedback(baseFeedback({ glow }), { tier: "middle", standardsList: [], targetNames: [], submittedText: null, readingScore: 0 });
  assert.equal(result.ok, true, `unexpected issues: ${JSON.stringify(result.issues)}`);
});

test("validateFeedback: frameworkTip.name must exactly match this tier's named framework", () => {
  const feedback = baseFeedback({
    highlights: [{ quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." }],
    frameworkTip: { name: "PEEL", quote: "It saw a cat up in a tree.", revision: "Point: the cat's height showed real danger. Evidence: it saw a cat up in a tree. Explain: this raised the stakes. Link: that's what kept the dog running." },
  });
  // "PEEL" is middle's framework, not elementary's ("Story Mountain").
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("frameworkTip.name must be exactly \"Story Mountain\"")));
});

test("validateFeedback: a missing frameworkTip.quote or revision is rejected", () => {
  const feedback = baseFeedback({
    highlights: [{ quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." }],
    frameworkTip: { name: "Story Mountain" },
  });
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("frameworkTip.quote")));
  assert.ok(result.issues.some((i) => i.includes("frameworkTip.revision")));
});

test("validateFeedback: frameworkTip.quote must be verbatim in the submission", () => {
  const feedback = baseFeedback({
    highlights: [{ quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." }],
    frameworkTip: { name: "Story Mountain", quote: "something never written", revision: "Climax: something never written, and it was thrilling." },
  });
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("frameworkTip.quote does not appear verbatim")));
});

test("validateFeedback: frameworkTip.revision identical to its quote is rejected", () => {
  const feedback = baseFeedback({
    highlights: [{ quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." }],
    frameworkTip: { name: "Story Mountain", quote: "It saw a cat up in a tree.", revision: "It saw a cat up in a tree." },
  });
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("identical to its quote")));
});

test("regression: frameworkTip.revision that only swaps a look-alike character for its quote is still rejected as a no-op", () => {
  // A straight apostrophe in the "submission" vs a curly one in the
  // "revision" - the same word to a human eye, different Unicode code
  // point, so a plain === check on the raw strings would wrongly treat
  // this as a genuine rewrite.
  const text = "The dog's bark scared the cat up in the tree.";
  const feedback = baseFeedback({
    highlights: [{ quote: "the cat up in the tree", type: "glow", note: "Nice concrete detail here." }],
    frameworkTip: { name: "Story Mountain", quote: "The dog's bark scared the cat up in the tree.", revision: "The dog’s bark scared the cat up in the tree." },
  });
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: text });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("identical to its quote")));
});

test("validateFeedback: a correct frameworkTip for the given tier passes", () => {
  const feedback = baseFeedback({
    highlights: [
      { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
      { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
    ],
    frameworkTip: { name: "PEEL", quote: "It saw a cat up in a tree.", revision: "Point: cats up trees show real danger. Evidence: it saw a cat up in a tree. Explain: this raised the stakes. Link: that's what kept the dog running." },
  });
  const result = validateFeedback(feedback, { tier: "middle", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, true, `unexpected issues: ${JSON.stringify(result.issues)}`);
});

test("validateFeedback: a missing vocab example is rejected", () => {
  const feedback = baseFeedback({
    vocab: [
      { term: "adjective", definition: "a word that describes a noun, like happy or fast." },
      { term: "sentence", definition: "a group of words that expresses a complete thought.", example: "\"The dog ran fast\" is a complete sentence." },
    ],
  });
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: null });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("vocab[0].example")));
});

test("validateFeedback: a vocab example that never actually uses the term is rejected", () => {
  const feedback = baseFeedback({
    vocab: [
      { term: "adjective", definition: "a word that describes a noun, like happy or fast.", example: "The dog ran across the yard." },
      { term: "sentence", definition: "a group of words that expresses a complete thought.", example: "\"The dog ran fast\" is a complete sentence." },
    ],
  });
  const result = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: null });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("does not actually use the term")));
});

test("validateFeedback: overallScore must be an integer from 1 to 10", () => {
  const highlights = [
    { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
    { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
  ];
  for (const bad of [0, 11, 7.5, "8", null, undefined]) {
    const result = validateFeedback(baseFeedback({ highlights, overallScore: bad }), {
      tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT,
    });
    assert.equal(result.ok, false, `expected ${JSON.stringify(bad)} to be rejected`);
    assert.ok(result.issues.some((i) => i.includes("overallScore")));
  }
  const ok = validateFeedback(baseFeedback({ highlights, overallScore: 3 }), {
    tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT,
  });
  assert.equal(ok.ok, true, `unexpected issues: ${JSON.stringify(ok.issues)}`);
});

test("validateFeedback: a missing scoreReason is rejected", () => {
  const highlights = [
    { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
    { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
  ];
  const result = validateFeedback(baseFeedback({ highlights, scoreReason: "" }), {
    tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT,
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("scoreReason")));
});

test("validateFeedback: overallScore is not required for reading (no submittedText)", () => {
  const result = validateFeedback(baseFeedback({ overallScore: undefined, scoreReason: undefined }), {
    tier: "elementary", standardsList: [], targetNames: [], submittedText: null,
  });
  assert.equal(result.ok, true, `unexpected issues: ${JSON.stringify(result.issues)}`);
});

test("validateFeedback: an empty spellingGrammar array is valid (a clean piece)", () => {
  const highlights = [
    { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
    { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
  ];
  const result = validateFeedback(baseFeedback({ highlights, spellingGrammar: [] }), {
    tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT,
  });
  assert.equal(result.ok, true, `unexpected issues: ${JSON.stringify(result.issues)}`);
});

test("validateFeedback: a real spellingGrammar entry passes when its quote is verbatim and the correction actually differs", () => {
  const highlights = [
    { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
    { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
  ];
  const result = validateFeedback(baseFeedback({
    highlights,
    spellingGrammarTotal: 1,
    spellingGrammar: [{ quote: "It saw a cat up in a tree", type: "punctuation", correction: "It saw a cat up in a tree." }],
  }), { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, true, `unexpected issues: ${JSON.stringify(result.issues)}`);
});

test("validateFeedback: spellingGrammarTotal must be honest — it can't read as fewer errors than are actually listed", () => {
  const highlights = [
    { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
    { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
  ];
  const result = validateFeedback(baseFeedback({
    highlights,
    spellingGrammarTotal: 0,
    spellingGrammar: [{ quote: "It saw a cat up in a tree", type: "punctuation", correction: "It saw a cat up in a tree." }],
  }), { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("cannot be smaller than the number of items")));
});

test("validateFeedback: spellingGrammarTotal is allowed to exceed the capped list (more real errors than are shown)", () => {
  const highlights = [
    { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
    { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
  ];
  const result = validateFeedback(baseFeedback({
    highlights,
    spellingGrammarTotal: 15,
    spellingGrammar: [{ quote: "It saw a cat up in a tree", type: "punctuation", correction: "It saw a cat up in a tree." }],
  }), { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, true, `unexpected issues: ${JSON.stringify(result.issues)}`);
});

test("validateFeedback: spellingGrammar rejects a quote that isn't verbatim in the submission", () => {
  const highlights = [
    { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
    { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
  ];
  const result = validateFeedback(baseFeedback({
    highlights,
    spellingGrammar: [{ quote: "something never written", type: "spelling", correction: "something written" }],
  }), { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((i) => i.includes("does not appear verbatim")));
});

test("validateFeedback: spellingGrammar rejects an invalid type and a no-op correction", () => {
  const highlights = [
    { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
    { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
  ];
  const badType = validateFeedback(baseFeedback({
    highlights,
    spellingGrammarTotal: 1,
    spellingGrammar: [{ quote: "It saw a cat", type: "style", correction: "It saw a kitten" }],
  }), { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(badType.ok, false);
  assert.ok(badType.issues.some((i) => i.includes('type must be "spelling"')));

  const noOp = validateFeedback(baseFeedback({
    highlights,
    spellingGrammarTotal: 1,
    spellingGrammar: [{ quote: "It saw a cat", type: "grammar", correction: "It saw a cat" }],
  }), { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(noOp.ok, false);
  assert.ok(noOp.issues.some((i) => i.includes("identical to its quote")));
});

test("validateFeedback: spellingGrammar must be an array, and caps at 8 items", () => {
  const highlights = [
    { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
    { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
  ];
  const notArray = validateFeedback(baseFeedback({ highlights, spellingGrammar: null }), {
    tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT,
  });
  assert.equal(notArray.ok, false);
  assert.ok(notArray.issues.some((i) => i.includes("must be an array")));

  const tooMany = validateFeedback(baseFeedback({
    highlights,
    spellingGrammarTotal: 9,
    spellingGrammar: Array.from({ length: 9 }, () => ({ quote: "It saw a cat", type: "spelling", correction: "It saw a kat" })),
  }), { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(tooMany.ok, false);
  assert.ok(tooMany.issues.some((i) => i.includes("more than 8 items")));
});

test("validateWritingPrompt: rejects a missing or too-short prompt", () => {
  const result = validateWritingPrompt({ title: "A Title", prompt: "Too short" }, { tier: "elementary" });
  assert.equal(result.ok, false);
});

test("validateWritingPrompt: requires a valid genre from the fixed list", () => {
  const base = { title: "A Title", prompt: "A perfectly reasonable writing prompt of adequate length here." };
  const missing = validateWritingPrompt(base, { tier: "elementary" });
  assert.equal(missing.ok, false);
  assert.ok(missing.issues.some((i) => i.includes("genre must be exactly one of")));

  const invented = validateWritingPrompt({ ...base, genre: "spooky" }, { tier: "elementary" });
  assert.equal(invented.ok, false);

  const valid = validateWritingPrompt({ ...base, genre: "narrative" }, { tier: "elementary" });
  assert.equal(valid.ok, true);
});

test("validateFeedback: frameworkTip is checked against the piece's OWN genre, not the tier's usual one", () => {
  const feedback = baseFeedback({
    highlights: [
      { quote: "It saw a cat", type: "glow", note: "Nice concrete detail here." },
      { quote: "The dog ran fast.", type: "grow", note: "Needs more variety.", revision: "Suddenly, the dog ran fast." },
    ],
    // "PEAL" is the persuasive framework, not elementary's usual "Story
    // Mountain" - correct here because this specific piece was persuasive.
    frameworkTip: { name: "PEAL", quote: "It saw a cat up in a tree.", revision: "Point: dogs are naturally alert. Evidence: it saw a cat up in a tree. Analysis: this shows sharp instincts at work. Link: that's what makes dogs such loyal companions." },
  });
  const result = validateFeedback(feedback, {
    tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT, genre: "persuasive",
  });
  assert.equal(result.ok, true, `unexpected issues: ${JSON.stringify(result.issues)}`);

  // The same feedback, without telling the validator this was a persuasive
  // piece, is wrongly checked against elementary's default and rejected.
  const withoutGenre = validateFeedback(feedback, { tier: "elementary", standardsList: [], targetNames: [], submittedText: SUBMITTED_TEXT });
  assert.equal(withoutGenre.ok, false);
});
