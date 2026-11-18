// Content spot-check: generates ONE reading passage or writing prompt through the REAL prompt builders, the real model
// and the real validator, for a chosen country and year, and returns the text with its readability numbers, so a person
// (or Claude) can judge whether it suits that country and year. Admin only (see api/email.js, action=qaContent).
// Nothing is stored and no learner's data is touched. One attempt, no retries, on purpose: the first attempt shows what
// the model does unaided.

const { GRADE_AGE, levelFor, readability } = require("./gradeLevel");
const { examStyleFor, readingExamStyleFor } = require("./focus");
const QT = require("./questionTypes");
const { buildReadingPassagePrompt, buildWritingPromptGenerator } = require("./prompt");
const { validatePassage, validateWritingPrompt } = require("./validate");

const tierForAge = (age) => (age <= 7 ? "early" : age <= 10 ? "elementary" : age <= 13 ? "middle" : "high");

// A fixed plan so every run covers the same ground: for every country, a primary-age year and a senior year, reading and
// writing, plus the exam-style version where that year has an exam.
function samplePlan() {
  const out = [];
  for (const country of Object.keys(GRADE_AGE)) {
    const grades = Object.entries(GRADE_AGE[country]);
    const pick = (target) => grades.reduce((best, g) => (best == null || Math.abs(g[1] - target) < Math.abs(best[1] - target) ? g : best), null);
    for (const target of [9, 15]) {
      const [gradeLabel, age] = pick(target);
      const tier = tierForAge(age);
      out.push({ country, gradeLabel, tier, kind: "reading" });
      out.push({ country, gradeLabel, tier, kind: "writing" });
      if (readingExamStyleFor(country, gradeLabel)) out.push({ country, gradeLabel, tier, kind: "reading", exam: true });
      if (examStyleFor(country, gradeLabel)) out.push({ country, gradeLabel, tier, kind: "writing", exam: true });
    }
  }
  return out;
}

async function runSample({ kind, country, gradeLabel, tier, exam, generate, rng = Math.random }) {
  const level = levelFor(country, gradeLabel, tier);
  const t0 = Date.now();
  if (kind === "reading") {
    const textType = QT.pickTextType(tier, rng);
    const template = QT.pickTemplate(tier, rng, textType);
    const examStyle = exam ? readingExamStyleFor(country, gradeLabel) : null;
    const prompt = buildReadingPassagePrompt({ tier, country, gradeLabel, textType, template, exam: examStyle || undefined });
    const { parsed } = await generate(prompt, { maxTokens: 3800 });
    if (parsed && Array.isArray(parsed.questions)) parsed.questions = QT.normalizeQuestions(parsed.questions, template, rng, tier);
    const check = validatePassage(parsed, { tier, template, textType, country, gradeLabel });
    const text = parsed && parsed.passage ? String(parsed.passage) : "";
    const r = readability(text);
    return {
      kind, country, gradeLabel, tier, exam: examStyle ? examStyle.name : null, textType: textType.name, title: parsed && parsed.title,
      passage: text, visual: parsed && parsed.visual || null,
      questions: ((parsed && parsed.questions) || []).map((q) => ({ type: q.type, q: q.q || q.prompt || q.text, options: q.options, correct: q.correct, answer: q.answer })),
      measured: { words: r.words, avgSentence: Number(r.avg.toFixed(1)), fk: Number(r.fk.toFixed(1)) },
      target: level.reading ? { words: level.reading.words, avg: level.reading.avg, fk: level.reading.fk } : null,
      valid: check.ok, issues: check.issues || [], ms: Date.now() - t0,
    };
  }
  const examStyle = exam ? examStyleFor(country, gradeLabel) : null;
  const prompt = buildWritingPromptGenerator({ tier, country, gradeLabel, exam: examStyle || undefined });
  const { parsed } = await generate(prompt, { maxTokens: 1200 });
  const check = validateWritingPrompt(parsed, { tier, country, gradeLabel });
  const text = parsed && parsed.prompt ? String(parsed.prompt) : "";
  return {
    kind, country, gradeLabel, tier, exam: examStyle ? examStyle.name : null, title: parsed && parsed.title, prompt: text, genre: parsed && parsed.genre,
    words: text.split(/\s+/).filter(Boolean).length, maxWords: level.writing ? level.writing.maxWords : null,
    valid: check.ok, issues: check.issues || [], ms: Date.now() - t0,
  };
}

module.exports = { samplePlan, runSample, tierForAge };
