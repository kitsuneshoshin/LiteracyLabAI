// "Choose your focus": what a learner can ask to practise, instead of a surprise.
//
//   Writing: the kind of piece (a story, a description, a persuasive piece, an analysis), from the kinds that suit the age.
//            Premium can also ask for the prompt in the style of their exam (NAPLAN, EQAO, PSLE, GCSE, IGCSE, NCEA, the Leaving Cert, CBSE, NSC, HKDSE, a US state test, a CEFR task).
//   Reading: the kind of text (story, poem, article, a table or chart, two texts...) and a comprehension skill to work on.
//
// Everything a learner can choose is checked here against these lists, so nothing from the browser is ever put into a prompt
// as free text. app.html carries a copy of the lists for the buttons (tests/focus.test.js proves the two agree).

const { VALID_GENRES } = require("./writingFrameworks");
const { TEXT_TYPES } = require("./questionTypes");

// ---------------------------------------------------------------- writing
const GENRE_ORDER = ["narrative", "descriptive", "persuasive", "analytical"];
const WRITING_GENRES = {
  early: ["narrative", "descriptive", "persuasive"], // explaining a text is beyond the youngest
  elementary: GENRE_ORDER.slice(),
  middle: GENRE_ORDER.slice(),
  high: GENRE_ORDER.slice(),
};

// What kind of prompt to write for each kind of piece, at each age.
const WRITING_TASK = {
  narrative: {
    early: "a short imaginative story prompt (one or two sentences), with a simple, concrete premise a young child can picture immediately",
    elementary: "an adventure-story prompt (one or two sentences) that gives the student a clear situation or discovery to build a story around",
    middle: "a story prompt (one or two sentences) that sets up a turning point or a difficult choice for a character",
    high: "a short-story prompt (one or two sentences) that suggests a mood, a setting or an opening line, in the style of a timed creative-writing task",
  },
  descriptive: {
    early: "a description prompt (one or two sentences) that asks a young child to describe a place or a thing using what they can see, hear and feel",
    elementary: "a description prompt (one or two sentences) that asks the student to bring a place, a person or a moment to life with sensory detail",
    middle: "a descriptive-writing prompt (one or two sentences) that asks for a place or a moment with figurative language and a clear mood",
    high: "a descriptive-writing prompt (one or two sentences) in the style of a timed task: a setting or scene to describe, with deliberate choices of language and structure",
  },
  persuasive: {
    early: "a very short opinion prompt (one sentence), for example which of two things is better, asking the child to say what they think and why",
    elementary: "a persuasive prompt (one or two sentences) that asks the student to convince a reader of something, such as a letter to a head teacher",
    middle: "a persuasive prompt (one or two sentences) about a debatable school or community issue, asking for an article, a letter or a speech",
    high: "a persuasive/argumentative essay prompt in the style of a timed exam question: a debatable claim (often as a quotation) followed by an instruction to agree or disagree with reference to texts or examples",
  },
  analytical: {
    elementary: "a short prompt that asks the student to explain how a character or a writer made them feel, or what a text is about, using evidence from a text they know - it must NOT name a specific book, since the student could have read anything",
    middle: "a short analytical-response prompt (one or two sentences) asking the student to analyse a literary technique (e.g. setting, characterisation, tension) in a story or text they've read recently — it must NOT name a specific book, since the student could have read anything",
    high: "an analytical-response prompt (one or two sentences) asking the student to analyse how a writer uses language or structure for effect in a text they have studied - it must NOT name a specific book, since the student could have read anything",
  },
};

// The exam a learner in this country and year is most likely preparing for (null where there is no clear one).
// The year is read from the grade label ("Year 5", "Grade 8"); anything else gets no exam style.
function gradeNumber(gradeLabel) {
  const m = String(gradeLabel || "").match(/(?:year|grade)\s*(\d{1,2})\b/i);
  return m ? Number(m[1]) : null;
}
// Singapore, the UAE and English learners label their years differently ("Primary 5", "Cambridge Primary 4", "B1 Intermediate").
function labelNumber(label, re) {
  const m = String(label || "").trim().match(re);
  return m ? Number(m[1]) : null;
}
// One short stem per CEFR level: what a task at that level asks for (word counts follow the usual Cambridge English task sizes).
const CEFR_STYLE = {
  A1: "a very short, simple writing task: one or two lines of instruction about a familiar topic (yourself, your family, your day), asking for a few short sentences of about 20 to 30 words",
  A2: "a short everyday writing task of about 25 to 35 words, such as a message or a note to a friend, with two or three things to include",
  B1: "a writing task of about 100 words, such as an email or a short story, with a clear situation and a few points to cover",
  B2: "a writing task of about 140 to 190 words, such as an article, an essay, a review or an informal letter, with a clear situation, audience and purpose",
  C1: "a writing task of about 220 to 260 words, such as an essay or a report, where the writer has to give an opinion, weigh up ideas and choose a suitable formal or semi-formal register",
  C2: "a demanding writing task of about 240 to 280 words, such as an essay, a review or a report, asking for a precise, well-organised and nuanced answer in a register suited to the reader",
};
function examStyleFor(country, gradeLabel) {
  const c = String(country || "");
  const label = String(gradeLabel || "");
  if (/Singapore/.test(c)) {
    const p = labelNumber(label, /^Primary\s*(\d{1,2})$/i);
    if (p != null && p >= 4 && p <= 6) return { name: "PSLE English", style: "the way a PSLE English continuous-writing task is worded: a theme or a set of pictures to build a story around, with a short instruction, for a timed composition of at least 150 words" };
    if (labelNumber(label, /^Secondary\s*([1-3])$/i) != null || /^O-Level\s*\/\s*IGCSE\s*Yr\s*[45]$/i.test(label)) {
      return { name: "O-Level English Paper 1", style: "the way a Singapore secondary English writing paper is worded: a short instruction with a theme, a title or a viewpoint, asking for a narrative, a descriptive or a discursive piece" };
    }
    return null;
  }
  if (/UAE|GCC/.test(c)) {
    const p = labelNumber(label, /^Cambridge Primary\s*(\d)$/i);
    if (p != null && p >= 4 && p <= 6) return { name: "Cambridge Primary Checkpoint", style: "the way a Cambridge Primary English writing task is worded: a clear purpose and audience, in simple language a child of this age can follow" };
    if (labelNumber(label, /^Lower Secondary\s*([7-9])$/i) != null) return { name: "Cambridge Lower Secondary Checkpoint", style: "the way a Cambridge Lower Secondary English writing task is worded: a clear purpose, audience and form, such as an article, a letter or a story" };
    if (/^IGCSE Year\s*1[01]$/i.test(label)) return { name: "IGCSE English First Language", style: "the way an IGCSE English First Language writing question is worded: a topic or a viewpoint, and a clear form (a descriptive or narrative piece, an article, a letter or a speech)" };
    if (/^A(S)? Level\b/i.test(label)) return { name: "Cambridge AS and A Level English", style: "the way a Cambridge AS and A Level English writing task is worded: a topic or a statement, and a clear form (a discursive, a narrative or a descriptive piece) for a timed response" };
    return null;
  }
  if (/India/.test(c)) {
    const k = labelNumber(label, /^Class\s*(\d{1,2})$/i);
    if (k != null && k >= 9 && k <= 10) return { name: "CBSE Class 10 English", style: "the way a CBSE Class 10 English writing task is worded: a short situation, and an instruction to write a clear form such as a formal letter, an article, a story or a notice within a word limit" };
    if (k != null && k >= 11 && k <= 12) return { name: "CBSE Class 12 English", style: "the way a CBSE Class 12 English writing task is worded: a short situation, and an instruction to write a clear form such as a formal letter, a report, an article or a speech within a word limit" };
    return null;
  }
  if (/Hong Kong/.test(c)) {
    if (labelNumber(label, /^Secondary\s*([4-6])$/i) != null) return { name: "HKDSE English Language", style: "the way an HKDSE English Language Paper 2 writing task is worded: a short situation or stimulus, and an instruction to write a stated text type (such as a letter, an article, a speech or a story) for a stated audience" };
    return null;
  }
  if (/Ireland/.test(c)) {
    if (/^[123](st|nd|rd) Year$/i.test(label)) return { name: "Junior Cycle English", style: "the way a Junior Cycle English written task is worded: a topic or a situation and a clear form, such as a speech, an article, a letter or a short story" };
    if (/^[56]th Year$/i.test(label)) return { name: "Leaving Certificate English", style: "the way a Leaving Certificate English Paper 1 composition is worded: a title or a prompt, with a choice of forms such as a personal essay, a speech, a short story, a magazine article or a news report, for a timed response" };
    return null;
  }
  if (/ESL|Global/.test(c)) {
    const m = label.match(/^(A1|A2|B1|B2|C1|C2)\b/i);
    if (!m) return null;
    const level = m[1].toUpperCase();
    return { name: "CEFR writing task", style: CEFR_STYLE[level] + ", at " + level + " level, with simple clear wording for the instruction" };
  }
  const n = gradeNumber(gradeLabel);
  if (n == null) return null;
  if (/Australia/.test(c) && n >= 3 && n <= 9) {
    return { name: "NAPLAN", style: "a short stimulus (a topic, a statement or a question) followed by a plain instruction, written the way a NAPLAN writing task is, for a timed response" };
  }
  if (/New Zealand/.test(c) && n >= 11 && n <= 13) {
    return { name: "NCEA English", style: "the way an NCEA English writing task is worded: a topic or a statement, and an instruction to write a clear, developed response (a creative piece or a formal essay) in a timed assessment" };
  }
  if (/South Africa/.test(c) && n >= 10 && n <= 12) {
    return { name: "NSC English", style: "the way a South African NSC English writing paper is worded: a choice of essay topics (narrative, descriptive, reflective, argumentative or discursive) and a transactional text such as a formal letter, a speech, a review or a newspaper article" };
  }
  if (/Canada/.test(c)) {
    if (n >= 3 && n <= 9) return { name: "EQAO", style: "the way an Ontario EQAO writing task is worded: a short situation or topic and a clear instruction about what to write, in plain language for a timed response" };
    if (n === 10) return { name: "OSSLT", style: "the way the Ontario Secondary School Literacy Test words its writing tasks: a short situation, and an instruction to write a news report or a series of paragraphs giving an opinion, supported with reasons and examples" };
  }
  if (/United Kingdom/.test(c)) {
    if (n >= 10 && n <= 11) return { name: "GCSE English Language", style: "the way a GCSE English Language writing question is worded: a situation or a viewpoint, and a clear form (a description, a story, an article, a letter or a speech)" };
    if (n >= 7 && n <= 9) return { name: "KS3 English", style: "the way a Key Stage 3 English writing task is worded: a clear purpose and audience, and a form such as an article, a letter or a speech" };
    if (n >= 3 && n <= 6) return { name: "KS2 SATs", style: "the way a Key Stage 2 writing task is worded: a clear purpose and audience, in simple language a child of this age can follow" };
  }
  if (/United States/.test(c) && n >= 3 && n <= 12) {
    return { name: "state test (Common Core)", style: "the way a Common Core state writing task is worded: a topic or a claim, and an instruction to write with reasons, evidence or a clear sequence of events" };
  }
  return null;
}

// What the learner asked for, checked. raw: { genre, examStyle } from the browser (anything may be missing or wrong).
// Returns { genre, exam } where genre is one of the kinds for this age or null, and exam is the exam style (Premium only) or null.
function writingFocusFor({ tier, country, gradeLabel, capabilities }, raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const allowed = WRITING_GENRES[tier] || [];
  const genre = typeof r.genre === "string" && allowed.includes(r.genre) && VALID_GENRES.includes(r.genre) ? r.genre : null;
  const exam = r.examStyle === true && capabilities && capabilities.deepFeedback ? examStyleFor(country, gradeLabel) : null;
  return { genre, exam };
}

// ---------------------------------------------------------------- reading
// Skills a learner can ask to work on, with the wording the passage prompt uses.
const READING_SKILLS = {
  retrieve: "finding and using facts and details that the text states",
  infer: "inferring what the text suggests but does not say",
  evidence: "finding the evidence in the text that supports an answer",
  vocab: "working out what words and phrases mean from their context",
  mainidea: "identifying and summing up the main idea",
  purpose: "understanding the writer's purpose, viewpoint and choices",
  compare: "comparing ideas, viewpoints or texts",
};
const SKILL_ORDER = ["retrieve", "infer", "evidence", "vocab", "mainidea", "purpose", "compare"];
const READING_SKILLS_BY_TIER = {
  early: ["retrieve", "infer", "vocab", "mainidea"],
  elementary: SKILL_ORDER.slice(),
  middle: SKILL_ORDER.slice(),
  high: SKILL_ORDER.slice(),
};

// raw: { textType: a name from this age's list, skill: a key } -> { textType: the full entry or null, skill: { key, text } or null }
function readingFocusFor({ tier }, raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const list = TEXT_TYPES[tier] || [];
  const textType = typeof r.textType === "string" ? list.find((t) => t.name === r.textType) || null : null;
  const allowed = READING_SKILLS_BY_TIER[tier] || [];
  const key = typeof r.skill === "string" && allowed.includes(r.skill) ? r.skill : null;
  return { textType, skill: key ? { key, text: READING_SKILLS[key] } : null };
}

module.exports = {
  WRITING_GENRES, WRITING_TASK, GENRE_ORDER, examStyleFor, gradeNumber, writingFocusFor,
  READING_SKILLS, READING_SKILLS_BY_TIER, SKILL_ORDER, readingFocusFor,
};
