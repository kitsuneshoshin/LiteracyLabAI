// Reading-comprehension question styles. A passage's five questions follow one of a few
// fixed "templates" per age band, so every attempt mixes styles in a way that suits the age.
//
// Styles (all marked instantly, by code, with no AI involved in grading):
//   mc        multiple choice, one correct option
//   tfng      a statement the student judges True, False or Not given
//   evidence  "which line proves it": follows an mc question; options are quotes from the passage
//   order     put four events in order
//   match     match words from the passage to their meanings
//   cloze     fill one or two gaps in a sentence taken from the passage
//
// The model writes questions in simple shapes; normalizeQuestions turns them into the stored
// form (shuffling, working out the answer key), so the AI never has to produce a shuffled answer.
// app.html mirrors isRight/isAnswered/answerText/correctText: keep both in step.

const TFNG_OPTIONS = ["True", "False", "Not given"];
const MC_FOUR = ["mc", "mc", "mc", "mc", "mc"];

const TEMPLATES = {
  early: [["mc", "order", "match", "cloze", "mc"], ["order", "mc", "cloze", "match", "mc"]],
  elementary: [["tfng", "mc", "order", "match", "cloze"], ["tfng", "mc", "evidence", "cloze", "order"], ["mc", "tfng", "match", "mc", "evidence"]],
  middle: [["tfng", "mc", "evidence", "match", "cloze"], ["mc", "evidence", "tfng", "cloze", "mc"], ["tfng", "mc", "evidence", "tfng", "match"]],
  high: [["tfng", "mc", "evidence", "mc", "tfng"], ["mc", "mc", "evidence", "tfng", "mc"], ["mc", "tfng", "mc", "evidence", "mc"]],
};

function pickTemplate(tier, rng = Math.random) {
  const list = TEMPLATES[tier] || TEMPLATES.elementary;
  return list[Math.floor(rng() * list.length)].slice();
}

// The kinds of text a passage can be, by age band: more than stories and information texts.
const TEXT_TYPES = {
  early: [
    { name: "short story", lines: false }, { name: "simple poem", lines: true, note: "Use short lines in two or three stanzas, with a clear picture or feeling." },
    { name: "set of instructions", lines: false, note: "Numbered or ordered steps for making or doing something, written in simple commands." },
  ],
  elementary: [
    { name: "short story", lines: false }, { name: "information text", lines: false }, { name: "poem", lines: true, note: "Two to four stanzas of short lines, with imagery and, if you like, rhyme." },
    { name: "set of instructions", lines: false, note: "A clear title, what you need, and ordered steps." }, { name: "diary entry or letter", lines: false, note: "Written in the first person, with a date or greeting and sign-off." },
  ],
  middle: [
    { name: "short story", lines: false }, { name: "news or magazine article", lines: false, note: "With a headline-style title, a clear opening, quotations or facts, and a viewpoint." },
    { name: "persuasive piece", lines: false, note: "A writer arguing for a view, with reasons and at least one persuasive device." }, { name: "poem", lines: true, note: "Two to four stanzas with imagery, rhythm and a shift in feeling or idea." },
    { name: "diary entry or letter", lines: false, note: "In a distinct first-person voice." },
  ],
  high: [
    { name: "story extract", lines: false, note: "An extract that starts mid-story, with carefully chosen detail and an implied mood." }, { name: "article", lines: false, note: "An analytical or feature article that presents more than one view." },
    { name: "persuasive or opinion piece", lines: false, note: "A reasoned argument with rhetorical choices and a clear structure." }, { name: "speech", lines: false, note: "A speech with direct address, rhetorical devices and a call to action." },
    { name: "poem", lines: true, note: "Two to four stanzas with layered imagery and a shift in tone." },
  ],
};

function pickTextType(tier, rng = Math.random) {
  const list = TEXT_TYPES[tier] || TEXT_TYPES.elementary;
  return list[Math.floor(rng() * list.length)];
}

// Short written answers are marked by the AI in the feedback call, so they are not part of the
// instant score: scoreAnswers never counts them and autoTotal leaves them out.
const SHORT_MARKS = { elementary: 2, middle: 3, high: 3 };
const SHORT_MAX_CHARS = 1200;

const STYLE_LABEL = {
  short: "short written answer, marked by you",
  mc: "multiple choice", tfng: "true, false or not given", evidence: "which line proves it",
  order: "put in order", match: "match words to meanings", cloze: "fill the gap",
};

const norm = (s) => String(s == null ? "" : s)
  .replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"')
  .replace(/[–—]/g, "-").replace(/…/g, "...").replace(/\s+/g, " ").trim().toLowerCase();

function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const styleOf = (q) => (q && q.type) || "mc";
const isArr = Array.isArray;

// ---------------------------------------------------------------- the answer key and grading

function isAnswered(q, a) {
  switch (styleOf(q)) {
    case "short": return typeof a === "string" && a.trim().length >= 2;
    case "order": return isArr(a) && a.length === (q.items || []).length && a.every((v) => Number.isInteger(v));
    case "match": return isArr(a) && a.length === (q.items || []).length && a.every((v) => Number.isInteger(v));
    case "cloze": return isArr(a) && a.length === (q.blanks || []).length && a.every((v) => Number.isInteger(v));
    default: return Number.isInteger(a);
  }
}

function isRight(q, a) {
  if (!q || !isAnswered(q, a)) return false;
  if (isArr(q.correct)) return q.correct.length === a.length && q.correct.every((v, i) => v === a[i]);
  return a === q.correct;
}

function textFor(q, value) {
  if (!q || value == null) return "(no answer)";
  switch (styleOf(q)) {
    case "short": return typeof value === "string" && value.trim() ? value.trim().slice(0, SHORT_MAX_CHARS) : "(no answer)";
    case "order": return isArr(value) && value.length ? value.map((j) => (q.items || [])[j] ?? "?").join(" -> ") : "(no answer)";
    case "match": return isArr(value) ? (q.items || []).map((w, i) => `${w} = ${(q.options || [])[value[i]] ?? "(none)"}`).join("; ") : "(no answer)";
    case "cloze": return isArr(value) ? (q.blanks || []).map((opts, i) => (opts || [])[value[i]] ?? "(none)").join(" / ") : "(no answer)";
    default: return (q.options || [])[value] ?? "(no answer)";
  }
}
const answerText = (q, a) => (isAnswered(q, a) ? textFor(q, a) : "(no answer)");
const correctText = (q) => textFor(q, q && q.correct);

const isAuto = (q) => styleOf(q) !== "short";
const autoTotal = (questions) => (questions || []).filter(isAuto).length;
const shortIndex = (questions) => (questions || []).findIndex((q) => !isAuto(q));

function scoreAnswers(questions, answers) {
  const list = isArr(answers) ? answers : [];
  return (questions || []).reduce((n, q, i) => n + (isRight(q, list[i]) ? 1 : 0), 0);
}

// What the browser may see before grading: everything except the answer key.
function publicQuestion(q) {
  const out = { type: styleOf(q), q: q.q };
  if (q.options) out.options = q.options;
  if (q.items) out.items = q.items;
  if (q.blanks) out.blanks = q.blanks;
  if (q.text) out.text = q.text;
  if (styleOf(q) === "short") out.marks = q.marks;
  return out;
}

// The question as the feedback prompt shows it to the model.
function describeForPrompt(q) {
  switch (styleOf(q)) {
    case "order": return `${q.q} Items (as shown): ${(q.items || []).join(" | ")}`;
    case "match": return `${q.q} Words: ${(q.items || []).join(", ")}. Meanings (as shown): ${(q.options || []).join(" | ")}`;
    case "cloze": return `${q.q} Sentence: ${q.text}`;
    case "short": return `${q.q} (worth ${q.marks} marks)`;
    default: return q.q;
  }
}

// ---------------------------------------------------------------- from the model's shape to the stored shape

function normalizeQuestions(questions, template, rng = Math.random, tier) {
  if (!isArr(questions)) return questions;
  return questions.map((raw, i) => {
    const style = template ? template[i] : styleOf(raw);
    if (!raw || typeof raw !== "object" || !style) return raw;
    switch (style) {
      case "short": return { type: "short", q: raw.q, marks: SHORT_MARKS[tier] || 2, modelAnswer: raw.modelAnswer, keyPoints: raw.keyPoints };
      case "tfng": return { type: "tfng", q: raw.q, options: TFNG_OPTIONS.slice(), correct: raw.correct };
      case "evidence": return { type: "evidence", q: raw.q, options: raw.options, correct: raw.correct };
      case "order": {
        const steps = isArr(raw.steps) ? raw.steps.map(String) : null;
        if (!steps) return { type: "order", q: raw.q, items: raw.items, correct: raw.correct };
        let perm = shuffle(steps.map((_, k) => k), rng);
        for (let tries = 0; tries < 8 && perm.every((v, j) => v === j) && steps.length > 1; tries++) perm = shuffle(perm, rng);
        const inverse = steps.map((_, k) => perm.indexOf(k));
        return { type: "order", q: raw.q, items: perm.map((k) => steps[k]), correct: inverse };
      }
      case "match": {
        const pairs = isArr(raw.pairs) ? raw.pairs.filter((p) => p && typeof p === "object") : null;
        if (!pairs) return { type: "match", q: raw.q, items: raw.items, options: raw.options, correct: raw.correct };
        const meanings = pairs.map((p) => String(p.meaning));
        let options = shuffle(meanings, rng);
        for (let tries = 0; tries < 8 && options.every((m, j) => m === meanings[j]) && meanings.length > 1; tries++) options = shuffle(options, rng);
        return { type: "match", q: raw.q, items: pairs.map((p) => String(p.word)), options, correct: meanings.map((m) => options.indexOf(m)) };
      }
      case "cloze": {
        const blanks = isArr(raw.blanks) ? raw.blanks : null;
        if (!blanks || !blanks.every((b) => b && typeof b === "object" && "answer" in b)) return { type: "cloze", q: raw.q, text: raw.text, blanks: raw.blanks, correct: raw.correct };
        const sets = blanks.map((b) => shuffle([String(b.answer), ...(isArr(b.wrong) ? b.wrong.map(String) : [])], rng));
        return { type: "cloze", q: raw.q || "Choose the best word for each gap.", text: raw.text, blanks: sets, correct: sets.map((opts, k) => opts.indexOf(String(blanks[k].answer))) };
      }
      default: return { type: "mc", q: raw.q, options: raw.options, correct: raw.correct };
    }
  });
}

// ---------------------------------------------------------------- validation of the stored shape

const okStr = (v, min, max) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;
const distinct = (list) => new Set(list.map((o) => norm(o))).size === list.length;

function validateQuestions(questions, { template, passage } = {}, issues) {
  const want = template || MC_FOUR;
  if (!isArr(questions) || questions.length !== want.length) { issues.push(`questions must be an array of exactly ${want.length} items`); return; }
  const text = norm(passage);
  questions.forEach((q, i) => {
    const at = `questions[${i}]`;
    const style = want[i];
    if (!q || typeof q !== "object") { issues.push(`${at} is missing`); return; }
    if (styleOf(q) !== style) issues.push(`${at} must be a "${STYLE_LABEL[style]}" question`);
    if (!okStr(q.q, 5, 300)) issues.push(`${at}.q is missing or an unreasonable length`);
    const optionList = (min, max, count) => {
      if (!isArr(q.options) || q.options.length !== count) { issues.push(`${at}.options must be an array of exactly ${count} items`); return false; }
      q.options.forEach((o, oi) => { if (!okStr(o, 1, max)) issues.push(`${at}.options[${oi}] is missing or an unreasonable length`); });
      if (!distinct(q.options)) issues.push(`${at}.options has duplicate answer choices`);
      return true;
    };
    switch (style) {
      case "short": {
        if (!Number.isInteger(q.marks) || q.marks < 1 || q.marks > 4) issues.push(`${at}.marks must be an integer from 1 to 4`);
        if (!okStr(q.modelAnswer, 15, 700)) issues.push(`${at}.modelAnswer is missing or an unreasonable length`);
        const kp = q.keyPoints;
        if (!isArr(kp) || kp.length < 2 || kp.length > 4 || !kp.every((k) => okStr(k, 3, 180))) issues.push(`${at}.keyPoints must list 2 to 4 short ideas a good answer includes`);
        if (okStr(q.q, 5, 300) && !/\?\s*$/.test(q.q.trim()) && !/^(explain|describe|why|how|what|which|give|say|write)\b/i.test(q.q.trim())) issues.push(`${at}.q must be a question or instruction`);
        break;
      }
      case "mc":
        optionList(1, 150, 4);
        if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) issues.push(`${at}.correct must be an integer from 0 to 3`);
        break;
      case "tfng":
        if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 2) issues.push(`${at}.correct must be 0 (true), 1 (false) or 2 (not given)`);
        if (okStr(q.q, 5, 300) && /\?\s*$/.test(q.q.trim())) issues.push(`${at}.q must be a statement to judge, not a question`);
        break;
      case "evidence":
        if (optionList(1, 220, 4) && text) {
          q.options.forEach((o, oi) => { if (okStr(o, 1, 220) && !text.includes(norm(o))) issues.push(`${at}.options[${oi}] must be a quote copied exactly from the passage`); });
        }
        if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) issues.push(`${at}.correct must be an integer from 0 to 3`);
        if (i === 0 || want[i - 1] !== "mc") issues.push(`${at} is "which line proves it" and must follow a multiple choice question`);
        break;
      case "order": {
        if (!isArr(q.items) || q.items.length !== 4) { issues.push(`${at}.steps must list exactly 4 events`); break; }
        q.items.forEach((o, oi) => { if (!okStr(o, 3, 140)) issues.push(`${at} event ${oi + 1} is missing or an unreasonable length`); });
        if (!distinct(q.items)) issues.push(`${at} has duplicate events`);
        const c = q.correct;
        if (!isArr(c) || c.length !== 4 || !c.every((v) => Number.isInteger(v) && v >= 0 && v < 4) || new Set(c).size !== 4) issues.push(`${at} has an invalid order key`);
        break;
      }
      case "match": {
        const n = isArr(q.items) ? q.items.length : 0;
        if (n < 3 || n > 4 || !isArr(q.options) || q.options.length !== n) { issues.push(`${at}.pairs must list 3 or 4 word and meaning pairs`); break; }
        q.items.forEach((w, wi) => {
          if (!okStr(w, 1, 40)) issues.push(`${at} word ${wi + 1} is missing or an unreasonable length`);
          else if (text && !text.includes(norm(w))) issues.push(`${at} word "${w}" must appear in the passage`);
        });
        q.options.forEach((m, mi) => { if (!okStr(m, 3, 100)) issues.push(`${at} meaning ${mi + 1} is missing or an unreasonable length`); });
        if (!distinct(q.items) || !distinct(q.options)) issues.push(`${at} has duplicate words or meanings`);
        const c = q.correct;
        if (!isArr(c) || c.length !== n || !c.every((v) => Number.isInteger(v) && v >= 0 && v < n) || new Set(c).size !== n) issues.push(`${at} has an invalid match key`);
        break;
      }
      case "cloze": {
        const blanks = isArr(q.blanks) ? q.blanks : [];
        if (!okStr(q.text, 15, 320) || blanks.length < 1 || blanks.length > 2) { issues.push(`${at} needs a sentence with 1 or 2 gaps`); break; }
        const parts = String(q.text).split("___");
        if (parts.length - 1 !== blanks.length) { issues.push(`${at} has ${parts.length - 1} gaps in the sentence but ${blanks.length} sets of choices`); break; }
        const c = q.correct;
        if (!isArr(c) || c.length !== blanks.length) { issues.push(`${at} has an invalid gap key`); break; }
        let filled = parts[0];
        blanks.forEach((opts, bi) => {
          if (!isArr(opts) || opts.length !== 4 || !opts.every((o) => okStr(o, 1, 40))) issues.push(`${at} gap ${bi + 1} needs exactly 4 choices`);
          else if (!distinct(opts)) issues.push(`${at} gap ${bi + 1} has duplicate choices`);
          else if (!Number.isInteger(c[bi]) || c[bi] < 0 || c[bi] > 3) issues.push(`${at} has an invalid gap key`);
          else filled += opts[c[bi]] + parts[bi + 1];
        });
        if (text && !text.includes(norm(filled))) issues.push(`${at} sentence, with the right words in, must be copied exactly from the passage`);
        break;
      }
      default: break;
    }
  });
}

// ---------------------------------------------------------------- the prompt for the generator

const MATCH_COUNT = { early: 3 };
const CLOZE_GAPS = { early: 1, elementary: 1, middle: 2, high: 2 };

function styleRule(style, n, tier) {
  switch (style) {
    case "short": return `"q": ONE open question that needs a written answer of one to three sentences and asks the student to explain, infer or support a view using the passage (for example "Why does ... ? Use evidence from the passage." or "How does the writer show ...?"). "modelAnswer": a strong answer of ${tier === "elementary" ? "one or two" : "two or three"} sentences, written the way a good student of this age would write it. "keyPoints": 2 or 3 short ideas (under 18 words each) that a correct answer should make, drawn from the passage - these are what the marking is based on. The question must have a clear, passage-supported answer, not a matter of opinion.`;
    case "mc": return '"q": a question about the passage, "options": exactly 4 answer choices, "correct": the index (0 to 3) of the one clearly correct choice. The other 3 must be plausible to a careless reader but clearly wrong to a careful one.';
    case "tfng": return '"q": ONE statement about the passage (a statement, not a question). "correct": 0 if the passage clearly says it is true, 1 if the passage clearly says the opposite, 2 if the passage simply does not say either way. Make "Not given" mean the passage really is silent, not that the answer is hard.';
    case "evidence": return `"q": "Which line from the passage best supports your answer to question ${n - 1}?" - "options": exactly 4 SHORT quotations (under 25 words each), each copied EXACTLY, word for word, from the passage; one is the best support for the correct answer to question ${n - 1}, the others come from elsewhere in the passage. "correct": the index (0 to 3) of the best one.`;
    case "order": return '"q": "Put these events in the order they happen." and "steps": exactly 4 short events (under 14 words each) from the passage, written in the CORRECT order (we shuffle them for the student). No numbering.';
    case "match": return `"q": "Match each word to its meaning as it is used in the passage." and "pairs": exactly ${MATCH_COUNT[tier] || 4} objects, each { "word": a word copied exactly from the passage, "meaning": a plain meaning under 10 words that fits how the passage uses it }. Choose words a student of this age might not know.`;
    case "cloze": {
      const k = CLOZE_GAPS[tier] || 1;
      return `"q": "Choose the best word for each gap." and "text": ONE sentence copied EXACTLY from the passage with ${k} word${k > 1 ? "s" : ""} replaced by ___ (three underscores), and "blanks": exactly ${k} object${k > 1 ? "s" : ""}, each { "answer": the word that was removed, "wrong": 3 other words of the same kind that clearly do not fit }.`;
    }
    default: return "";
  }
}

function styleShape(style, tier) {
  switch (style) {
    case "short": return '{ "type": "short", "q": "an open question answered in 1-3 sentences", "modelAnswer": "a strong model answer", "keyPoints": ["idea a good answer makes", "second idea"] }';
    case "mc": return '{ "type": "mc", "q": "question text", "options": ["option A", "option B", "option C", "option D"], "correct": 0 }';
    case "tfng": return '{ "type": "tfng", "q": "a statement about the passage", "correct": 0 }';
    case "evidence": return '{ "type": "evidence", "q": "Which line from the passage best supports your answer to the question before?", "options": ["exact quote 1", "exact quote 2", "exact quote 3", "exact quote 4"], "correct": 0 }';
    case "order": return '{ "type": "order", "q": "Put these events in the order they happen.", "steps": ["first event", "second event", "third event", "fourth event"] }';
    case "match": return '{ "type": "match", "q": "Match each word to its meaning as it is used in the passage.", "pairs": [' + Array.from({ length: MATCH_COUNT[tier] || 4 }, () => '{ "word": "word from the passage", "meaning": "short meaning" }').join(", ") + "] }";
    case "cloze": return '{ "type": "cloze", "q": "Choose the best word for each gap.", "text": "A sentence from the passage with ___ in place of a word.", "blanks": [' + Array.from({ length: CLOZE_GAPS[tier] || 1 }, () => '{ "answer": "removed word", "wrong": ["w1", "w2", "w3"] }').join(", ") + "] }";
    default: return "{}";
  }
}

function questionPlanText(template, tier) {
  return template.map((s, i) => `Question ${i + 1} - ${STYLE_LABEL[s]}: ${styleRule(s, i + 1, tier)}`).join("\n");
}
function questionShapeText(template, tier) {
  return template.map((s) => "    " + styleShape(s, tier)).join(",\n");
}

module.exports = {
  SHORT_MARKS, SHORT_MAX_CHARS, isAuto, autoTotal, shortIndex,
  TFNG_OPTIONS, TEMPLATES, MC_FOUR, TEXT_TYPES, STYLE_LABEL,
  pickTemplate, pickTextType, shuffle, styleOf, isAnswered, isRight, answerText, correctText, scoreAnswers,
  publicQuestion, describeForPrompt, normalizeQuestions, validateQuestions, questionPlanText, questionShapeText,
};
