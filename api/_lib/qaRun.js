// The weekly marking-quality check. A fixed set of sample pieces goes through the
// REAL prompt and the REAL validator, once each (no retries, on purpose: the first
// attempt is what shows how often the model gets it right unaided), and the
// result is saved as one row so a drop in quality shows up the week it happens.
//
// Nothing here touches a customer's data: the samples are made up, nothing is
// stored against any account, and only a summary row is written.

const { capabilitiesFor } = require("./plans");
const { buildWritingPrompt, buildReadingPrompt, examTechniqueSupported, correctiveAddendum } = require("./prompt");
const { standardsFor } = require("./curriculum");
const { targetsForGrade } = require("./masteryTargets");
const { DEFAULT_GENRE_BY_TIER } = require("./writingFrameworks");
const { assessLength, calibrateWriting, repairExamEvidence } = require("./calibrate");
const { examTargetsFor } = require("./masteryTargets");
const TECH = require("./techniques");
const { validateFeedback, dropRestatingHighlights, repairResponses, dropGlowsQuotingMisspellings, dropInvalidSpellingGrammar, sanitizeQuestionReview, repairZeroScoreGlow, repairReadingExamEvidence, stripUngrantedSections } = require("./validate");

const COUNTRY = "🇬🇧 United Kingdom";
const GRADES = { early: "Year 2", elementary: "Year 5", middle: "Year 8", high: "Year 11" };

const PASSAGE = "Mia built a volcano for the science fair. Her brother knocked it over one night, and it broke into three pieces. She was upset, but she did not give up. She rebuilt it with her dad until midnight, using more glue and a stronger base. The next day she smiled at the judges as the volcano bubbled over. Sometimes the best ideas come after a mistake.";
const QUESTIONS = [
  { q: "What did Mia build?", options: ["A robot", "A volcano", "A boat", "A kite"], correct: 1 },
  { q: "What happened to it?", options: ["It was lost", "It was sold", "Her brother knocked it over", "It melted"], correct: 2 },
  { q: "Who helped her rebuild it?", options: ["Her dad", "Her teacher", "Her friend", "Nobody"], correct: 0 },
  { q: "How did she feel after it broke?", options: ["Angry at the judges", "Upset but determined", "Bored", "Proud"], correct: 1 },
  { q: "What is the main message of the passage?", options: ["Science is hard", "Fairs are fun", "Mistakes can lead to better ideas", "Brothers are careless"], correct: 2 },
];

const WRITING = [
  { name: "Year 2, very short, many errors (Premium)", plan: "premium", tier: "early", prompt: "Write about a pet.", text: "i like my dog he is brown. we play in the park he runs fast" },
  { name: "Year 5, short story with errors (Premium)", plan: "premium", tier: "elementary", prompt: "Write about a character you admire.", text: "a character that i have chose is superman. he struggled with bad people and cryponite. the imapct made me confused" },
  { name: "Year 8, formal paragraph (Premium)", plan: "premium", tier: "middle", prompt: "Should schools start later in the morning?", text: "I belive schools should start later because teenagers need more sleep. Studies shows that tired students cant concentrate. For example, many students falls asleep in the first lesson. Therefore a later start would improve results and also make students happier at school." },
  { name: "Year 11, persuasive essay with errors (Premium)", plan: "premium", tier: "high", prompt: "Social media does more harm than good. Discuss.", text: "Social media has become a part of everyday life, but its affects on young people are often negative. Firstly, it encourages constant comparison, which damages self esteem. However, some argue that it connects people across the world. This is true, yet connection online is rarely as meaningful as face to face contact. In conclusion the harm outweigh the benefits and schools should teach students to use it carefully." },
  { name: "Year 5, ordinary piece (Free)", plan: "free", tier: "elementary", prompt: "Write about your favourite place.", text: "My favourite place is the beach. The sand is warm and the waves are loud. I like to build big sandcastles with my sister. We always eat ice cream before we go home." },
  { name: "Year 11, analytical paragraph (Core)", plan: "core", tier: "high", prompt: "How does the writer create tension?", text: "The writer creates tension by using short sentences at the start of the scene. This makes the reader feel rushed. The word 'creaked' suggests that something is wrong in the old house. The writer also ends the paragraph with a question which leaves the reader unsure about what happens next." },
];

const READING = [
  { name: "Reading, every answer wrong (Premium, Year 11)", plan: "premium", tier: "high", answers: [0, 0, 1, 0, 0] },
  { name: "Reading, three of five right (Free, Year 5)", plan: "free", tier: "elementary", answers: [1, 2, 0, 0, 0] },
];

function capsFor(plan, tier) {
  const base = capabilitiesFor(plan);
  return { ...base, examTechnique: base.examTechnique && examTechniqueSupported(tier) };
}

function buildSample(s, kind) {
  const grade = GRADES[s.tier];
  const targets = targetsForGrade(COUNTRY, grade, s.tier).targets;
  const caps = capsFor(s.plan, s.tier);
  const common = { tier: s.tier, country: COUNTRY, gradeLabel: grade, interest: "football", motivation: "grades", capabilities: caps, targets, targetNames: targets.map((t) => t.name) };
  if (kind === "writing") {
    const genre = DEFAULT_GENRE_BY_TIER[s.tier];
    return { caps, genre, prompt: buildWritingPrompt({ ...common, confidenceWriting: "growing", prompt: s.prompt, text: s.text, genre }) };
  }
  let score = 0;
  QUESTIONS.forEach((q, i) => { if (s.answers[i] === q.correct) score += 1; });
  return {
    caps, score,
    prompt: buildReadingPrompt({ ...common, confidenceReading: "growing", passageTitle: "The Volcano", passage: PASSAGE, questions: QUESTIONS, answers: s.answers, score, totalQuestions: QUESTIONS.length }),
  };
}

// One sample, run the way a customer's piece is: up to three attempts, each retry
// told what the last one got wrong (the same rules as api/submit.js, including
// leaving out the Premium bonus sections instead of failing a whole piece). It
// records BOTH whether the first attempt was right and what the customer would
// actually have been given. Never throws: a failure is a result, not a crash.
const MAX_ATTEMPTS = 3;
const BONUS_ISSUE = /^(growNext|revisedStory|modelResponse|modelFramework|revisedFramework|readingStrategy)\b/;

// A run has a time budget (the host stops a function after 60 seconds, and a run that is
// killed saves nothing). A sample that cannot finish another attempt in time stops and is
// recorded as "ran out of time" instead of taking the whole run down with it.
const ATTEMPT_MS = 14000; // about the longest one marking call takes
function withTimeout(promise, ms) {
  if (!Number.isFinite(ms)) return promise;
  ms = Math.min(ms, 2147483647);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timed out waiting for the model")), Math.max(1, ms));
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// validate can be replaced in tests; in production it is always the real validator.
async function runOne(s, kind, generate, deadline = Infinity, validate = validateFeedback) {
  const started = Date.now();
  const out = { name: s.name, kind, plan: s.plan, tier: s.tier, ok: false, firstTry: false, attempts: 0, outcome: "failed", issues: [], ms: 0 };
  try {
    const built = buildSample(s, kind);
    const grade = GRADES[s.tier];
    const standardsList = standardsFor(COUNTRY, s.tier, grade);
    const targetNames = targetsForGrade(COUNTRY, grade, s.tier).targets.map((t) => t.name);
    const examTargetNames = examTargetsFor(targetsForGrade(COUNTRY, grade, s.tier).targets, kind).map((t) => t.name);
    let prompt = built.prompt;
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      if (i > 1 && Date.now() + ATTEMPT_MS > deadline) { out.timedOut = true; out.outcome = "ran out of time"; break; }
      const attempt = await withTimeout(Promise.resolve(generate(prompt)), deadline - Date.now());
      const parsed = attempt.parsed;
      out.attempts = i;
      if (kind === "writing") {
        if (built.caps.spellingGrammar !== false) { dropInvalidSpellingGrammar(parsed, s.text); dropGlowsQuotingMisspellings(parsed); }
        dropRestatingHighlights(parsed, s.text);
        TECH.repairVocabTricks(parsed);
        if (built.caps.deepFeedback) repairResponses(parsed, built.genre, s.tier);
        repairExamEvidence(parsed);
      } else {
        if (built.score === 0) repairZeroScoreGlow(parsed);
        repairReadingExamEvidence(parsed, QUESTIONS, s.answers);
        sanitizeQuestionReview(parsed, PASSAGE, QUESTIONS.length);
      }
      const check = validate(parsed, {
        tier: s.tier, standardsList, targetNames, submittedText: kind === "writing" ? s.text : undefined,
        readingScore: kind === "reading" ? built.score : undefined, capabilities: built.caps, genre: built.genre,
        lengthInfo: kind === "writing" ? assessLength({ text: s.text, tier: s.tier, country: COUNTRY, gradeLabel: grade }) : undefined, examTargetNames,
      });
      if (i === 1) { out.firstTry = check.ok; out.issues = check.issues.slice(0, 6).map((x) => String(x).slice(0, 200)); }
      let delivered = check.ok;
      let withoutBonus = false;
      if (!delivered && i === MAX_ATTEMPTS && check.issues.length > 0 && check.issues.every((x) => BONUS_ISSUE.test(x))) {
        const growNextBad = check.issues.some((x) => /^growNext /.test(x));
        if (!growNextBad || parsed.growNext) {
          if (growNextBad) delete parsed.growNext;
          if (check.issues.some((x) => /^(modelResponse|modelFramework) /.test(x))) { delete parsed.modelResponse; delete parsed.modelFramework; }
          if (check.issues.some((x) => /^(revisedFramework|revisedStory) /.test(x))) delete parsed.revisedFramework;
          if (check.issues.some((x) => /^readingStrategy\b/.test(x))) delete parsed.readingStrategy;
          if (check.issues.some((x) => /^revisedStory /.test(x))) delete parsed.revisedStory;
          delivered = true;
          withoutBonus = true;
        }
      }
      if (delivered) {
        out.ok = true;
        out.outcome = withoutBonus ? "delivered without a bonus section" : "delivered";
        stripUngrantedSections(parsed, { capabilities: built.caps, kind });
        if (kind === "writing") calibrateWriting(parsed, { text: s.text, tier: s.tier, country: COUNTRY, gradeLabel: grade, capabilities: built.caps });
        out.sections = {
          highlights: Array.isArray(parsed.highlights) ? parsed.highlights.length : 0,
          glows: Array.isArray(parsed.highlights) ? parsed.highlights.filter((h) => h.type === "glow").length : 0,
          grows: Array.isArray(parsed.highlights) ? parsed.highlights.filter((h) => h.type === "grow").length : 0,
          revisedStory: typeof parsed.revisedStory === "string" && parsed.revisedStory.length > 0,
          growNext: typeof parsed.growNext === "string" && parsed.growNext.length > 0,
          overallScore: Number.isInteger(parsed.overallScore) ? parsed.overallScore : null,
        };
        out.model = attempt.modelUsed || null;
        break;
      }
      out.lastIssues = check.issues.slice(0, 6).map((x) => String(x).slice(0, 200));
      prompt = built.prompt + correctiveAddendum(check.issues);
    }
  } catch (err) {
    out.issues = [`The model call failed: ${String(err && err.message).slice(0, 160)}`];
  }
  out.ms = Date.now() - started;
  return out;
}

// Runs every sample at once (they are independent, and a serial run would not fit
// in the function's time limit), then builds the summary.
async function runQa({ generate, budgetMs = 48000, validate }) {
  const deadline = Date.now() + budgetMs;
  const jobs = [...WRITING.map((s) => runOne(s, "writing", generate, deadline, validate)), ...READING.map((s) => runOne(s, "reading", generate, deadline, validate))];
  const results = await Promise.all(jobs);
  const total = results.length;
  const passed = results.filter((r) => r.firstTry).length;      // right on the first attempt
  const delivered = results.filter((r) => r.ok).length;          // what a customer would actually receive
  const writing = results.filter((r) => r.kind === "writing");
  return {
    passed, total, delivered,
    passRate: total ? Math.round((passed / total) * 100) : 0,
    deliveredRate: total ? Math.round((delivered / total) * 100) : 0,
    avgMs: total ? Math.round(results.reduce((a, r) => a + r.ms, 0) / total) : 0,
    timedOut: results.filter((r) => r.timedOut || (r.issues || []).some((i) => /timed out/.test(i))).length,
    avgAttempts: total ? Math.round((results.reduce((a, r) => a + r.attempts, 0) / total) * 10) / 10 : 0,
    rewriteDelivered: writing.filter((r) => r.sections && r.sections.revisedStory).length,
    rewriteExpected: writing.length,
    results,
  };
}

module.exports = { runQa, runOne, WRITING, READING, QUESTIONS, PASSAGE };
