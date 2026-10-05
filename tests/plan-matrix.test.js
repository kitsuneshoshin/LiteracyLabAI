const test = require("node:test");
const assert = require("node:assert/strict");
const { capabilitiesFor } = require("../api/_lib/plans");
const { buildWritingPrompt, buildReadingPrompt, buildReadingPassagePrompt } = require("../api/_lib/prompt");
const { validatePassage } = require("../api/_lib/validate");
const { targetsForGrade, examTargetsFor } = require("../api/_lib/masteryTargets");
const { assessLength } = require("../api/_lib/calibrate");
const RESP = require("../api/_lib/responses");
const TECH = require("../api/_lib/techniques");
const { frameworkParts } = require("../api/_lib/writingFrameworks");
const { standardsFor } = require("../api/_lib/curriculum");
const { frameworkFor, DEFAULT_GENRE_BY_TIER } = require("../api/_lib/writingFrameworks");
const { did, loadHandler, call } = require("./harness");

// The full matrix: every plan x every age tier x writing/reading, run through
// the REAL submit / prompt / passage handlers with only the database, the AI
// and the user stood in for. plan-gates.test.js proves each pricing-table
// promise one at a time; this proves the whole feedback pipeline behaves
// correctly for every combination, against three kinds of model:
//   obedient  - returns exactly what the plan's prompt asks for
//   over-eager - returns EVERYTHING, whatever the plan (the server must strip)
//   lazy      - leaves sections out (the server must reject what the plan
//               includes, and must not care about what it doesn't)

const COUNTRY = "🇬🇧 United Kingdom";
const PLANS = ["free", "core", "premium", "pro", "admin"];
const TIERS = { early: "Year 2", elementary: "Year 5", middle: "Year 8", high: "Year 11" };
const EXAM_TIERS = new Set(["middle", "high"]);

const TEXT = "The dog ran fast. It saw a cat up in a tree. The end of the story was happy.";
const PASSAGE = "Mia built a volcano for the science fair. Her brother knocked it over one night. She rebuilt it with her dad until midnight. The next day she smiled at the judges. Sometimes the best ideas come after a mess.";
const QUESTIONS = Array.from({ length: 5 }, (_, i) => ({ q: `Question number ${i + 1} about the passage?`, options: ["Option A", "Option B", "Option C", "Option D"], correct: i % 4 }));
const ANSWERS = [0, 1, 2, 0, 1]; // questions 1-3 right, 4-5 wrong (correct answers are 0,1,2,3,0)

// What a plan + tier + kind should end up with, per the pricing table.
function expectedSections(plan, tier, kind) {
  const caps = capabilitiesFor(plan);
  return {
    growNext: !!caps.deepFeedback,
    examTechnique: !!caps.examTechnique && EXAM_TIERS.has(tier),
    overallScore: kind === "writing" && caps.overallScore !== false,
    spellingGrammar: kind === "writing" && caps.spellingGrammar !== false,
    revisedStory: kind === "writing",
    frameworkTip: kind === "writing",
    highlights: kind === "writing",
    questionReview: kind === "reading",
    readingStrategy: kind === "reading",
  };
}
function sectionsPresent(fb) {
  return {
    growNext: fb.growNext != null,
    examTechnique: fb.examTechnique != null,
    overallScore: fb.overallScore != null,
    spellingGrammar: fb.spellingGrammar != null,
    revisedStory: fb.revisedStory != null,
    frameworkTip: fb.frameworkTip != null,
    highlights: fb.highlights != null,
    questionReview: fb.questionReview != null,
    readingStrategy: fb.readingStrategy != null,
  };
}

// A distinctive word from the first mapped standard, so the Glow "cites" it
// the way real feedback must.
function standardToken(tier) {
  const list = standardsFor(COUNTRY, tier, TIERS[tier]) || [];
  for (const std of list) {
    const tok = (std.toLowerCase().match(/[a-z0-9.\-]+/g) || []).find((t) => t.length >= 3 && !["the","and","for","statutory","english","app","year","yr","standard","standards","grade","level","aim","aims","programme","study","content","domain"].includes(t));
    if (tok) return tok;
  }
  return "";
}

function baseFeedback(tier) {
  const targets = targetsForGrade(COUNTRY, TIERS[tier], tier).targets;
  return {
    glow: `Your opening is clear and confident. It shows ${standardToken(tier)} well.`,
    grow: "Add one describing word to the cat sentence. It will paint a clearer picture.",
    vocab: [
      { term: "describe", definition: "to say what something is like.", example: "Please describe the cat in the tree." },
      { term: "climax", definition: "the most exciting part of a story.", example: "The climax came when the cat jumped." },
    ],
    glowTarget: targets[0].name,
    growTarget: targets[1] ? targets[1].name : targets[0].name,
  };
}

function writingExtras(tier, caps) {
  const targets = targetsForGrade(COUNTRY, TIERS[tier], tier).targets;
  const fw = frameworkFor(DEFAULT_GENRE_BY_TIER[tier], tier);
  const out = {
    highlights: [
      { quote: "The dog ran fast", type: "glow", note: "A clear, strong opening." },
      { quote: "It saw a cat up in a tree", type: "grow", note: "Add a describing word here.", revision: "It spotted a tiny grey cat high up in a tree" },
    ],
    frameworkTip: { name: fw.name, quote: "The end of the story was happy", revision: "Ending: everyone smiled as the story settled into a happy close." },
  };
  if (caps.overallScore !== false) { out.overallScore = 6; out.scoreReason = "Clear structure but very short sentences throughout."; }
  out.revisedStory = "The dog ran fast. It spotted a tiny grey cat high up in a tree. The end of the story was happy.";
  if (caps.spellingGrammar !== false) {
    out.spellingGrammarTotal = 1;
    out.spellingGrammar = [{ quote: "The end of the story was happy", type: "grammar", correction: "The ending of the story was happy" }];
  }
  return { out, targets };
}

// Letters-only filler words, so a fixture response has an exact number of distinct words.
function filler(n, seed) {
  return Array.from({ length: n }, (_, i) => {
    let k = i + seed * 37 + 1;
    let w = "";
    while (k > 0) { w += "abcdefghijklmnopqrstuvwxyz"[k % 26]; k = Math.floor(k / 26); }
    return w + "ly";
  });
}
// A compliant Premium model response and labels for the default genre of this tier.
function premiumResponses(tier) {
  const fw = frameworkFor(DEFAULT_GENRE_BY_TIER[tier], tier);
  const parts = frameworkParts(fw);
  const lim = RESP.modelLimits(assessLength({ text: TEXT, tier, country: COUNTRY, gradeLabel: TIERS[tier] }));
  const per = Math.max(3, Math.floor(lim.n / parts.length));
  const sentences = parts.map((pt, k) => {
    const w = filler(per, k + 1);
    w[0] = w[0][0].toUpperCase() + w[0].slice(1);
    return w.join(" ") + ".";
  });
  return {
    modelResponse: sentences.join(" "),
    modelFramework: parts.map((pt, k) => ({ part: pt.name, text: sentences[k], note: "This sentence does the job of " + pt.name + " clearly." })),
    revisedFramework: [{ part: parts[0].name, text: "The dog ran fast.", note: "This sentence opens the response clearly." }],
  };
}

function planExtras(tier, caps, targets, kind = "writing") {
  const out = {};
  if (caps.deepFeedback) out.growNext = "Once that feels natural, rework \"The dog ran fast\" so it opens with where or when.";
  if (caps.examTechnique && EXAM_TIERS.has(tier)) {
    out.examTechnique = examTargetsFor(targets, kind).map((t) => ({ criterion: t.name, band: 2, descriptor: "Developing", evidence: "The dog ran fast", toNextBand: "Add one more developed sentence to show this clearly." }));
    out.examSummary = "Accurate, fluent writing would gain the most marks next.";
  }
  return out;
}

function strategyFor(tier) {
  return { name: TECH.strategiesFor(tier)[0].name, tip: "Look at question 2 again and use this strategy on the passage before you choose." };
}

function readingReview() {
  return [1, 2, 3, 4, 5].map((n) => ({ n, explanation: `Question ${n}: here is why the right answer works in the passage.`, evidence: "She rebuilt it with her dad until midnight" }));
}

// What a compliant model returns for this plan.
function obedient(plan, tier, kind) {
  const caps = capabilitiesFor(plan);
  const fb = baseFeedback(tier);
  const { out, targets } = writingExtras(tier, caps);
  Object.assign(fb, planExtras(tier, caps, targets, kind));
  if (kind === "writing") { Object.assign(fb, out); if (caps.deepFeedback) Object.assign(fb, premiumResponses(tier)); }
  else { fb.questionReview = readingReview(); fb.readingStrategy = strategyFor(tier); }
  return fb;
}

// What an over-eager model returns: every section there is, for any plan.
function overEager(tier, kind) {
  const premium = capabilitiesFor("premium");
  const fb = baseFeedback(tier);
  const { out, targets } = writingExtras(tier, premium);
  Object.assign(fb, out, planExtras(tier, { deepFeedback: true, examTechnique: true }, targets, kind));
  if (kind === "writing") Object.assign(fb, premiumResponses(tier));
  fb.questionReview = readingReview();
  fb.readingStrategy = strategyFor(tier);
  fb.commitOptions = ["Try this", "Try that"];
  fb.followUp = "Great job trying last time.";
  return fb;
}

// A fake database holding one ungraded submission of the given kind, and a
// record of what was finally written back.
function submissionDb(tier, kind, written) {
  const row = kind === "writing"
    ? { id: "sub1", child_id: "c1", tier, country: COUNTRY, grade_label: TIERS[tier], interest: "football", content: { generatedPrompt: { prompt: "Write a short story.", genre: DEFAULT_GENRE_BY_TIER[tier] } }, feedback: null }
    : { id: "sub1", child_id: "c1", tier, country: COUNTRY, grade_label: TIERS[tier], interest: "football", content: { generatedPassage: { title: "The Volcano", skill: "Inference", passage: PASSAGE, questions: QUESTIONS } }, feedback: null };
  return (q) => {
    if (q.table !== "submissions") return { data: null, error: null };
    if (did(q, "single")) return { data: row, error: null };
    if (did(q, "is")) return { data: [{ id: "sub1" }], error: null }; // claim succeeds
    const upd = q.ops.find(([n]) => n === "update");
    if (upd && upd[1] && upd[1].feedback && !upd[1].feedback._pending) written.push(upd[1]);
    return { data: null, error: null };
  };
}

const bodyFor = (kind) => (kind === "writing"
  ? { kind: "writing", submissionId: "sub1", text: TEXT }
  : { kind: "reading", submissionId: "sub1", answers: ANSWERS });

// Runs the real submit handler against a scripted model. `script` is called
// with (attemptNumber, prompt) and returns the parsed JSON for that attempt.
async function runSubmit(plan, tier, kind, script, { body } = {}) {
  const written = [];
  const prompts = [];
  const h = loadHandler("submit.js", {
    plan,
    db: submissionDb(tier, kind, written),
    generate: async (prompt) => {
      prompts.push(prompt);
      return { parsed: JSON.parse(JSON.stringify(script(prompts.length, prompt))), modelUsed: "stub" };
    },
  });
  const res = await call(h, { method: "POST", body: body || bodyFor(kind) });
  return { res, written, prompts };
}

// ------------------------------------------------------------------ 1. What each plan's PROMPT asks for

for (const plan of PLANS) {
  for (const tier of Object.keys(TIERS)) {
    test(`prompt: ${plan} / ${tier} writing asks for exactly what the plan includes`, () => {
      const caps = capabilitiesFor(plan);
      const { targets } = writingExtras(tier, caps);
      const examCaps = { ...caps, examTechnique: caps.examTechnique && EXAM_TIERS.has(tier) };
      const p = buildWritingPrompt({
        tier, country: COUNTRY, gradeLabel: TIERS[tier], interest: "football", confidenceWriting: "growing", motivation: "grades",
        prompt: "Write.", text: TEXT, targets, targetNames: targets.map((t) => t.name), capabilities: examCaps, genre: DEFAULT_GENRE_BY_TIER[tier],
      });
      const want = expectedSections(plan, tier, "writing");
      assert.equal(p.includes("EXAM-TECHNIQUE SCORING"), want.examTechnique, "exam technique");
      assert.equal(p.includes("growNext"), want.growNext, "second step");
      assert.equal(p.includes("OVERALL SCORE (required"), want.overallScore, "overall score");
      assert.equal(p.includes("SPELLING AND GRAMMAR CHECK"), want.spellingGrammar, "spelling check");
      assert.ok(p.includes("FRAMEWORK SPOTLIGHT"), "framework spotlight is on every plan");
      assert.ok(!p.includes("QUESTION-BY-QUESTION REVIEW"), "a writing prompt must not ask for a question review");
      if (want.examTechnique) examTargetsFor(targets, "writing").forEach((t) => assert.ok(p.includes(`"criterion": ${JSON.stringify(t.name)}`), `exam template missing ${t.name}`));
    });

    test(`prompt: ${plan} / ${tier} reading asks for exactly what the plan includes`, () => {
      const caps = capabilitiesFor(plan);
      const { targets } = writingExtras(tier, caps);
      const examCaps = { ...caps, examTechnique: caps.examTechnique && EXAM_TIERS.has(tier) };
      const p = buildReadingPrompt({
        tier, country: COUNTRY, gradeLabel: TIERS[tier], interest: "football", confidenceReading: "growing", motivation: "grades",
        passageTitle: "The Volcano", passage: PASSAGE, questions: QUESTIONS, answers: ANSWERS, score: 3, totalQuestions: 5,
        targets, targetNames: targets.map((t) => t.name), capabilities: examCaps,
      });
      const want = expectedSections(plan, tier, "reading");
      assert.equal(p.includes("EXAM-TECHNIQUE SCORING"), want.examTechnique, "exam technique");
      assert.equal(p.includes("growNext"), want.growNext, "second step");
      assert.ok(p.includes("QUESTION-BY-QUESTION REVIEW"), "reading always gets the per-question review");
      assert.equal((p.match(/"n": \d/g) || []).length, 5, "one pre-numbered review entry per question");
      for (const banned of ["SPELLING AND GRAMMAR CHECK", "OVERALL SCORE (required", "FRAMEWORK SPOTLIGHT"]) {
        assert.ok(!p.includes(banned), `a reading prompt must not ask for: ${banned}`);
      }
    });
  }
}

// ------------------------------------------------------------------ 2. Obedient model: full submit, every combination

for (const plan of PLANS) {
  for (const tier of Object.keys(TIERS)) {
    for (const kind of ["writing", "reading"]) {
      test(`submit: ${plan} / ${tier} ${kind} - a compliant response is accepted and has exactly the plan's sections`, async () => {
        const { res, written, prompts } = await runSubmit(plan, tier, kind, () => obedient(plan, tier, kind));
        assert.equal(res.statusCode, 200, `got ${res.statusCode}: ${JSON.stringify(res.body)}`);
        assert.equal(prompts.length, 1, "needed a retry for a compliant response");
        assert.deepEqual(sectionsPresent(res.body.feedback), expectedSections(plan, tier, kind));
        assert.equal(written.length, 1, "feedback was not saved exactly once");
        assert.deepEqual(sectionsPresent(written[0].feedback), expectedSections(plan, tier, kind), "what was saved differs from what was returned");
        if (kind === "reading") {
          assert.equal(res.body.score, 3);
          assert.equal(res.body.questions.length, 5);
          assert.ok(res.body.questions.every((q) => q.correct != null), "answer key must be revealed after grading");
        }
        if (kind === "writing" && res.body.feedback.frameworkTip) {
          assert.ok(res.body.feedback.frameworkTip.description, "framework definition is attached server-side");
        }
      });
    }
  }
}

// ------------------------------------------------------------------ 3. Over-eager model: the server, not the model, decides what a plan gets

for (const plan of PLANS) {
  for (const tier of Object.keys(TIERS)) {
    for (const kind of ["writing", "reading"]) {
      test(`strip: ${plan} / ${tier} ${kind} - sections the model over-delivers are removed before saving and sending`, async () => {
        const { res, written } = await runSubmit(plan, tier, kind, () => overEager(tier, kind));
        assert.equal(res.statusCode, 200, `got ${res.statusCode}: ${JSON.stringify(res.body)}`);
        const want = expectedSections(plan, tier, kind);
        assert.deepEqual(sectionsPresent(res.body.feedback), want, "response leaks (or lacks) a section");
        assert.deepEqual(sectionsPresent(written[0].feedback), want, "the STORED feedback leaks (or lacks) a section");
        for (const retired of ["commitOptions", "followUp"]) {
          assert.equal(res.body.feedback[retired], undefined, `retired field ${retired} still returned`);
        }
        if (kind === "writing") assert.equal(res.body.feedback.spellingGrammar != null, want.spellingGrammar);
      });
    }
  }
}

// ------------------------------------------------------------------ 4. Lazy model: what the plan includes is enforced, what it doesn't is not

const LAZY = [
  { name: "no overallScore", kinds: ["writing"], mutate: (f) => { delete f.overallScore; delete f.scoreReason; }, includedFor: (c) => c.overallScore !== false, issue: /overallScore/ },
  { name: "no spelling check", kinds: ["writing"], mutate: (f) => { delete f.spellingGrammar; delete f.spellingGrammarTotal; }, includedFor: (c) => c.spellingGrammar !== false, issue: /spellingGrammar/ },
  { name: "no growNext", kinds: ["writing", "reading"], mutate: (f) => { delete f.growNext; }, includedFor: (c) => !!c.deepFeedback, issue: /growNext/ },
  { name: "only one exam objective banded (the real-world failure)", kinds: ["writing", "reading"], mutate: (f) => { if (f.examTechnique) f.examTechnique = f.examTechnique.slice(0, 1); }, includedFor: (c, t) => !!c.examTechnique && EXAM_TIERS.has(t), issue: /examTechnique is missing an entry/ },
  { name: "no framework spotlight", kinds: ["writing"], mutate: (f) => { delete f.frameworkTip; }, includedFor: () => true, issue: /frameworkTip/ },
  { name: "no highlights", kinds: ["writing"], mutate: (f) => { delete f.highlights; }, includedFor: () => true, issue: /highlights/ },
  { name: "no question review", kinds: ["reading"], mutate: (f) => { delete f.questionReview; }, includedFor: () => true, issue: /questionReview/ },
];

for (const plan of PLANS) {
  for (const tier of Object.keys(TIERS)) {
    for (const kind of ["writing", "reading"]) {
      for (const lazy of LAZY.filter((l) => l.kinds.includes(kind))) {
        test(`lazy: ${plan} / ${tier} ${kind} - ${lazy.name}`, async () => {
          const caps = { ...capabilitiesFor(plan) };
          const included = lazy.includedFor(caps, tier);
          // The exam case only means something where an exam block exists.
          if (lazy.name.startsWith("only one exam") && !included) return;
          // With a single objective that applies to this kind of task, one banded entry is complete.
          if (lazy.name.startsWith("only one exam") && examTargetsFor(targetsForGrade(COUNTRY, TIERS[tier], tier).targets, kind).length < 2) return;
          const { res, prompts } = await runSubmit(plan, tier, kind, () => { const f = obedient(plan, tier, kind); lazy.mutate(f); return f; });
          if (included) {
            assert.equal(res.statusCode, 502, "a plan-included section was silently allowed to be missing");
            assert.equal(prompts.length, 3, "should retry three times before giving up");
            assert.match(res.body.error, lazy.issue, "the failure doesn't name what was missing");
            assert.match(prompts[1], /Your previous attempt failed these checks/, "the retry wasn't told what to fix");
          } else {
            assert.equal(res.statusCode, 200, `${plan} was held to a section it doesn't get: ${JSON.stringify(res.body)}`);
            assert.equal(prompts.length, 1);
          }
        });
      }
    }
  }
}

// ------------------------------------------------------------------ 5. Recovery, retries and sanitising

test("retry: a bad first answer is corrected on the second attempt and the fix instructions name the problem", async () => {
  const { res, prompts } = await runSubmit("premium", "high", "writing", (n) => {
    const f = obedient("premium", "high", "writing");
    if (n === 1) { delete f.overallScore; delete f.scoreReason; }
    return f;
  });
  assert.equal(res.statusCode, 200);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Your previous attempt failed these checks[\s\S]*overallScore/);
});

test("second step: if it stays vague through every retry, only that section is dropped and the rest of the feedback is still delivered", async () => {
  const { res, prompts } = await runSubmit("premium", "high", "writing", () => {
    const f = obedient("premium", "high", "writing");
    f.growNext = "Next, think of it like how animals in a pack follow their leader and look for deeper meanings.";
    return f;
  });
  assert.equal(res.statusCode, 200, "the student still gets their feedback");
  assert.equal(prompts.length, 3, "all three attempts were made first");
  assert.equal(res.body.feedback.growNext, undefined, "the unusable bonus step is not shown");
  assert.ok(res.body.feedback.grow && res.body.feedback.glow, "the main Glow and Grow are intact");
});

test("second step: a different problem on the last attempt still fails the response, it is not hidden by the drop", async () => {
  const { res } = await runSubmit("premium", "high", "writing", () => {
    const f = obedient("premium", "high", "writing");
    f.growNext = "Think of it like a chess game.";
    delete f.overallScore; delete f.scoreReason;
    return f;
  });
  assert.equal(res.statusCode, 502);
});

test("full rewrite: if it can't be made correct through every retry, only the rewrite is dropped and the rest of the feedback is still delivered", async () => {
  const { res, prompts } = await runSubmit("premium", "high", "writing", () => {
    const f = obedient("premium", "high", "writing");
    f.revisedStory = TEXT; // handed back unchanged every time
    return f;
  });
  assert.equal(res.statusCode, 200, "the student still gets their feedback");
  assert.equal(prompts.length, 3, "all three attempts were made first");
  assert.equal(res.body.feedback.revisedStory, "The dog ran fast. It saw a cat up in a tree. The ending of the story was happy.", "the unusable rewrite is replaced by the student's own text with the listed fixes applied");
  assert.ok(res.body.feedback.highlights.length >= 2 && res.body.feedback.spellingGrammar, "everything else is intact");
});

test("full rewrite: a missing rewrite is retried, and if it never arrives the rest is still delivered", async () => {
  const { res, prompts } = await runSubmit("premium", "middle", "writing", () => {
    const f = obedient("premium", "middle", "writing");
    delete f.revisedStory;
    return f;
  });
  assert.equal(res.statusCode, 200);
  assert.equal(prompts.length, 3);
  assert.match(prompts[1], /revisedStory/, "the retry names the missing rewrite");
});

test("spelling: one made-up quote is dropped and the honest total lowered, instead of failing the whole response", async () => {
  const { res, prompts } = await runSubmit("premium", "middle", "writing", () => {
    const f = obedient("premium", "middle", "writing");
    f.spellingGrammarTotal = 2;
    f.spellingGrammar.push({ quote: "a sentence the student never wrote", type: "grammar", correction: "a fixed sentence" });
    return f;
  });
  assert.equal(res.statusCode, 200);
  assert.equal(prompts.length, 1, "should not have needed a retry");
  assert.equal(res.body.feedback.spellingGrammar.length, 1);
  assert.equal(res.body.feedback.spellingGrammarTotal, 1);
});

test("spelling: Free and Core are never asked to fix a spelling list they don't get", async () => {
  for (const plan of ["free", "core"]) {
    const { res } = await runSubmit(plan, "middle", "writing", () => {
      const f = obedient(plan, "middle", "writing");
      f.spellingGrammar = [{ quote: "not in the text", type: "grammar", correction: "x" }];
      f.spellingGrammarTotal = 1;
      return f;
    });
    assert.equal(res.statusCode, 200, plan);
    assert.equal(res.body.feedback.spellingGrammar, undefined, `${plan} received a spelling list`);
  }
});

test("reading review: a made-up 'quote from the passage' is dropped, the explanation next to it is kept", async () => {
  const { res } = await runSubmit("core", "elementary", "reading", () => {
    const f = obedient("core", "elementary", "reading");
    f.questionReview[1].evidence = "a line the passage never contains";
    return f;
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.feedback.questionReview[1].evidence, undefined);
  assert.ok(res.body.feedback.questionReview[1].explanation);
  assert.equal(res.body.feedback.questionReview[0].evidence, "She rebuilt it with her dad until midnight");
});

test("reading review: entries for questions that don't exist, and repeats, are dropped", async () => {
  const { res } = await runSubmit("free", "elementary", "reading", () => {
    const f = obedient("free", "elementary", "reading");
    f.questionReview.push({ n: 9, explanation: "There is no question nine in this passage." });
    f.questionReview.push({ n: 2, explanation: "Question two, said a second time." });
    return f;
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.feedback.questionReview.map((r) => r.n), [1, 2, 3, 4, 5]);
});

// ------------------------------------------------------------------ 6. Submit safety, every plan

for (const plan of PLANS) {
  test(`submit safety: ${plan} - already-submitted work can't be graded (and billed) twice`, async () => {
    const written = [];
    const h = loadHandler("submit.js", {
      plan,
      db: (q) => {
        if (q.table === "submissions" && did(q, "single")) return { data: { id: "sub1", child_id: "c1", tier: "middle", country: COUNTRY, grade_label: "Year 8", interest: "x", content: { generatedPrompt: { prompt: "p" } }, feedback: { glow: "done" } }, error: null };
        return { data: null, error: null };
      },
      generate: async () => { throw new Error("the AI must not be called"); },
    });
    const res = await call(h, { method: "POST", body: bodyFor("writing") });
    assert.equal(res.statusCode, 409);
    assert.equal(written.length, 0);
  });

  test(`submit safety: ${plan} - a failed AI call releases the claim so the student can try again`, async () => {
    const updates = [];
    const h = loadHandler("submit.js", {
      plan,
      db: (q) => {
        if (q.table !== "submissions") return { data: null, error: null };
        if (did(q, "single")) return submissionDb("middle", "writing", [])(q);
        if (did(q, "is")) return { data: [{ id: "sub1" }], error: null };
        const upd = q.ops.find(([n]) => n === "update");
        if (upd) updates.push(upd[1]);
        return { data: null, error: null };
      },
      generate: async () => { throw new Error("model exploded"); },
    });
    const res = await call(h, { method: "POST", body: bodyFor("writing") });
    assert.ok(res.statusCode >= 500);
    assert.ok(updates.some((u) => u && u.feedback === null), "the pending claim was left stuck");
  });
}

test("submit safety: bad requests are refused with a reason, whatever the plan", async () => {
  const h = loadHandler("submit.js", { plan: "premium", db: submissionDb("middle", "writing", []) });
  assert.equal((await call(h, { method: "POST", body: { kind: "poetry" } })).statusCode, 400);
  assert.equal((await call(h, { method: "POST", body: { kind: "writing", text: "x" } })).statusCode, 400);
  assert.equal((await call(h, { method: "POST", body: { kind: "writing", submissionId: "sub1" } })).statusCode, 400);
  assert.equal((await call(h, { method: "POST", body: { kind: "reading", submissionId: "sub1" } })).statusCode, 400);
  assert.equal((await call(h, { method: "GET" })).statusCode, 405);
});

test("submit safety: writing over the grade's character limit is refused before the AI is called", async () => {
  let called = false;
  const h = loadHandler("submit.js", { plan: "premium", db: submissionDb("early", "writing", []), generate: async () => { called = true; return { parsed: {} }; } });
  const res = await call(h, { method: "POST", body: { kind: "writing", submissionId: "sub1", text: "word ".repeat(5000) } });
  assert.equal(res.statusCode, 400);
  assert.equal(called, false);
});

// ------------------------------------------------------------------ 7. Generating a prompt / passage, every plan and tier

const goodPrompt = (tier) => ({ title: "A Good Title", prompt: "Write about a time you found something unexpected and explain how it made you feel.", genre: DEFAULT_GENRE_BY_TIER[tier] });

for (const plan of PLANS) {
  for (const tier of Object.keys(TIERS)) {
    test(`writing prompt: ${plan} / ${tier} - generates a prompt and bills one submission`, async () => {
      const inserted = [];
      const h = loadHandler("writing-prompt.js", {
        plan, used: 0,
        db: (q) => {
          if (q.table === "child_profiles" && did(q, "maybeSingle")) return { data: { id: "c1" }, error: null };
          if (q.table === "child_profiles") return { data: [{ id: "c1", display_name: "Kid", created_at: "2026-09-01T00:00:00Z" }], error: null };
          if (q.table === "profiles") return { data: { active_child_id: "c1", active_child_set_at: null }, error: null };
          if (did(q, "insert")) { inserted.push(q.ops.find(([n]) => n === "insert")[1]); return { data: { id: "sub-new" }, error: null }; }
          return { data: null, error: null };
        },
        generate: async () => ({ parsed: goodPrompt(tier), modelUsed: "stub" }),
      });
      const res = await call(h, { method: "POST", body: { tier, country: COUNTRY, gradeLabel: TIERS[tier], interest: "space", childId: "c1" } });
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.equal(res.body.submissionId, "sub-new");
      assert.equal(inserted.length, 1, "exactly one credit is reserved");
      assert.equal(inserted[0].interest, "space", "the chosen interest is stored with the piece");
      assert.ok(res.body.prompt && res.body.title);
    });

    test(`reading passage: ${plan} / ${tier} - generates 5 questions (plus one written answer where the plan has Premium feedback) and never sends the answer key`, async () => {
      const [lo, hi] = passageWordRange(tier);
      const passage = Array.from({ length: Math.round((lo + hi) / 2) }, (_, i) => `word${i}`).join(" ") + ".";
      const parsed = { title: "The Volcano", skill: "Inference", passage, questions: QUESTIONS.map((q, i) => ({ ...q, options: [`a${i}`, `b${i}`, `c${i}`, `d${i}`] })) };
      const h = loadHandler("reading-passage.js", {
        plan, used: 0,
        db: (q) => {
          if (q.table === "child_profiles" && did(q, "maybeSingle")) return { data: { id: "c1" }, error: null };
          if (q.table === "child_profiles") return { data: [{ id: "c1", display_name: "Kid", created_at: "2026-09-01T00:00:00Z" }], error: null };
          if (q.table === "profiles") return { data: { active_child_id: "c1", active_child_set_at: null }, error: null };
          if (did(q, "insert")) return { data: { id: "pass-new" }, error: null };
          return { data: null, error: null };
        },
        // This stand-in only ever writes plain multiple choice, so the styled plan fails and the plain fallback is used;
        // when the prompt asks for a written answer too, it adds one.
        generate: async (prompt) => {
          const copy = JSON.parse(JSON.stringify(parsed));
          if (/short written answer/.test(prompt)) copy.questions.push({ type: "short", q: "Why did the volcano matter to her?", modelAnswer: "It showed she would not give up, because she rebuilt it after it was knocked over.", keyPoints: ["she did not give up", "she rebuilt it", "it mattered to her"].slice(0, tier === "elementary" ? 2 : 3) });
          return { parsed: copy, modelUsed: "stub" };
        },
      });
      const res = await call(h, { method: "POST", body: { tier, country: COUNTRY, gradeLabel: TIERS[tier], interest: "space", childId: "c1" } });
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      const wantsWritten = ["premium", "pro", "admin"].includes(plan) && tier !== "early";
      assert.equal(res.body.questions.length, wantsWritten ? 6 : 5);
      assert.equal(res.body.questions.filter((q) => q.type === "short").length, wantsWritten ? 1 : 0);
      assert.ok(res.body.questions.every((q) => q.correct === undefined && q.modelAnswer === undefined && q.keyPoints === undefined), "the answer key reached the browser");
    });
  }
}

// The word range the reading-passage prompt tells the model to write, read
// straight out of the real prompt so this can't drift from it.
function passageWordRange(tier) {
  const m = buildReadingPassagePrompt({ tier, country: COUNTRY, gradeLabel: TIERS[tier] }).match(/roughly (\d+)-(\d+) words/);
  return [Number(m[1]), Number(m[2])];
}

for (const tier of Object.keys(TIERS)) {
  test(`reading passage: ${tier} - the length the prompt asks for is accepted by validation, and older tiers get longer passages`, () => {
    const [lo, hi] = passageWordRange(tier);
    for (const words of [lo, hi]) {
      const passage = Array.from({ length: words }, (_, i) => `w${i}`).join(" ") + ".";
      const r = validatePassage({ title: "Title", skill: "Inference", passage, questions: QUESTIONS.map((q, i) => ({ ...q, options: [`a${i}`, `b${i}`, `c${i}`, `d${i}`] })) }, { tier });
      assert.ok(!r.issues.some((i) => /words, expected roughly/.test(i)), `${tier}: ${words} words rejected - ${r.issues.join("; ")}`);
    }
  });
}

test("reading passage: older tiers are asked for longer passages than younger ones", () => {
  const order = ["early", "elementary", "middle", "high"].map((t) => passageWordRange(t)[0]);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `tier ${i} isn't longer than tier ${i - 1}: ${order.join(", ")}`);
});

// ------------------------------------------------------------------ 8. Usage endpoint, every plan

for (const plan of PLANS) {
  test(`usage: ${plan} - reports the plan and its capabilities`, async () => {
    const h = loadHandler("usage.js", { plan, used: 2 });
    const res = await call(h);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.plan, plan);
    assert.equal(res.body.used, 2);
    assert.deepEqual(res.body.capabilities, capabilitiesFor(plan));
  });
}

// A reading answer's named strategy is snapped to the exact name and carries the fixed how-to; a
// strategy the model made up never reaches the student, and a writing answer never carries one.
test("reading strategy: the exact name and fixed how-to are attached, an invented name is refused, writing never gets one", async () => {
  for (const tier of Object.keys(TIERS)) {
    const first = TECH.strategiesFor(tier)[0];
    const ok = await runSubmit("core", tier, "reading", () => { const f = obedient("core", tier, "reading"); f.readingStrategy = { name: first.name.toLowerCase(), tip: "Look at question 2 again and use this on the passage first." }; return f; });
    assert.equal(ok.res.statusCode, 200, tier);
    assert.deepEqual(ok.res.body.feedback.readingStrategy, { name: first.name, how: first.how, tip: "Look at question 2 again and use this on the passage first." }, tier);
    const bad = await runSubmit("core", tier, "reading", () => { const f = obedient("core", tier, "reading"); f.readingStrategy = { name: "Totally invented", tip: "Look at question 2 again and use this on the passage first." }; return f; });
    // a bonus: after the retries the rest of the feedback is still delivered, without the strategy
    assert.equal(bad.res.statusCode, 200, tier);
    assert.equal(bad.prompts.length, 3, tier + ": retried first");
    assert.equal(bad.res.body.feedback.readingStrategy, undefined, tier);
    const w = await runSubmit("core", tier, "writing", () => { const f = obedient("core", tier, "writing"); f.readingStrategy = strategyFor(tier); return f; });
    assert.equal(w.res.statusCode, 200, tier);
    assert.equal(w.res.body.feedback.readingStrategy, undefined, tier + ": stripped from writing");
  }
});
