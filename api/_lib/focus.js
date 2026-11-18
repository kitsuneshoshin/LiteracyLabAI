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
  C2: "a demanding writing task of about 240 to 320 words, such as an essay, an article, a review or a report, asking for a precise, well-organised and nuanced answer in a register suited to the reader",
};
function examStyleFor(country, gradeLabel) {
  const c = String(country || "");
  const label = String(gradeLabel || "");
  if (/Singapore/.test(c)) {
    const p = labelNumber(label, /^Primary\s*(\d{1,2})$/i);
    if (p === 6) return { name: "PSLE English", style: "the way a PSLE English continuous-writing task is worded: a topic with three pictures, described in words, that offer different angles to build a story around (the composition must be based on at least one), with a short instruction, for a timed composition of at least 150 words" };
    if (p === 4 || p === 5) return { name: "PSLE English", style: "the way a PSLE English continuous-writing task is worded: a topic with pictures, described in words, to build a story around, with a short instruction, for a timed composition of a length suited to this year" };
    if (labelNumber(label, /^Secondary\s*([1-3])$/i) != null) return { name: "Singapore secondary English", style: "the way a Singapore secondary English writing task is worded: a short instruction with a theme, a title or a viewpoint, asking for a narrative, a descriptive or an argumentative piece" };
    if (/^O-Level\s*\/\s*IGCSE\s*Yr\s*[45]$/i.test(label)) {
      return { name: "O-Level English Paper 1", style: "the way a Singapore O-Level English writing paper is worded: either a situational writing task (250 to 350 words: an email, letter, report or speech built from a situation that includes a visual such as a poster, notice or chart, using the given information) or a continuous-writing task (350 to 500 words, one of several topics, such as a narrative or an argument)" };
    }
    return null;
  }
  if (/UAE|GCC/.test(c)) {
    const p = labelNumber(label, /^Cambridge Primary\s*(\d)$/i);
    if (p != null && p >= 4 && p <= 6) return { name: "Cambridge Primary Checkpoint", style: "the way a Cambridge Primary Checkpoint English writing task is worded: a clear purpose and audience, a non-fiction form (for example a letter, report or article) or a fiction piece (a story), in simple language a child of this age can follow" };
    if (labelNumber(label, /^Lower Secondary\s*([7-9])$/i) != null) return { name: "Cambridge Lower Secondary Checkpoint", style: "the way a Cambridge Lower Secondary English writing task is worded: a clear purpose, audience and form, such as an article, a letter or a story" };
    if (/^IGCSE Year\s*1[01]$/i.test(label)) return { name: "IGCSE English First Language", style: "the way an IGCSE English First Language writing question is worded: either a directed writing task (a discursive, argumentative or persuasive speech, letter, article or report, about 250 to 350 words, responding to a text) or a composition from a title (descriptive or narrative, about 350 to 450 words)" };
    if (/^A(S)? Level\b/i.test(label)) return { name: "Cambridge AS and A Level English", style: "the way a Cambridge AS Level English Language writing task is worded: a brief giving a form, purpose and audience (for example an article, a review, a blog, a speech or a travel piece), either a short text of up to 400 words or an extended piece of 600 to 900 words that is imaginative or descriptive, discursive or argumentative, or a review" };
    return null;
  }
  if (/India/.test(c)) {
    const k = labelNumber(label, /^Class\s*(\d{1,2})$/i);
    if (k != null && k >= 9 && k <= 10) return { name: "CBSE Class 10 English", style: "the way a CBSE Class 10 English writing task is worded: a short situation, and an instruction to write either a formal letter (for example a complaint, request or enquiry) or an analytical paragraph on a given chart, graph or set of cues, in about 100 to 120 words" };
    if (k != null && k >= 11 && k <= 12) return { name: "CBSE Class 12 English", style: "the way a CBSE Class 12 English writing task is worded: a short situation or input, and an instruction to write a notice, an invitation or reply (up to 50 words), or a letter, an article or a report (120 to 150 words)" };
    return null;
  }
  if (/Hong Kong/.test(c)) {
    if (labelNumber(label, /^Secondary\s*([4-6])$/i) != null) return { name: "HKDSE English Language", style: "the way an HKDSE English Language Paper 2 writing task is worded: either a short guided task (about 200 words) that gives the situation, the purpose for writing and some information to use, such as a letter, email, report or proposal for a stated reader, or a longer, more open task (about 400 words) such as a story, an article, a speech or a letter for a stated audience" };
    return null;
  }
  if (/Ireland/.test(c)) {
    if (/^[123](st|nd|rd) Year$/i.test(label)) return { name: "Junior Cycle English", style: "the way a Junior Cycle English written task is worded: a stimulus text and a clear instruction to write for a stated audience and purpose, such as a letter, a speech, an article or an imaginative piece written in response to the text" };
    if (/^[56]th Year$/i.test(label)) return { name: "Leaving Certificate English", style: "the way a Leaving Certificate English Paper 1 is worded: either a composition chosen from several titles (a short story, a personal essay, an opinion piece for a magazine, a discursive essay or a speech) or a functional writing task in response to a text (an article, a letter to a newspaper editor or a proposal), for a timed response" };
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
  if (/Australia/.test(c) && [3, 5, 7, 9].includes(n)) {
    return { name: "NAPLAN", style: "a short stimulus (a topic, a statement or a question) followed by a plain instruction, written the way a NAPLAN writing task is, for a narrative or persuasive response in a timed setting" };
  }
  if (/New Zealand/.test(c) && n >= 11 && n <= 13) {
    return { name: "NCEA English", style: "the way an NCEA English writing task is worded: a purpose and a topic, with an instruction to develop ideas in a piece of fiction or non-fiction writing (such as a personal account, narrative, poem, script, report or essay) for a stated audience, written over time in class" };
  }
  if (/South Africa/.test(c) && n >= 10 && n <= 12) {
    return { name: "NSC English", style: "the way a South African NSC English writing paper is worded: one essay chosen from several topics or pictures (narrative, descriptive, reflective, discursive or argumentative, 400 to 450 words) and two transactional texts of different kinds (for example an email, a formal letter, a speech, a magazine article, a book review or a dialogue; other years have also set a report, a CV and covering letter or an interview; 180 to 200 words each)" };
  }
  if (/Canada/.test(c)) {
    if (n === 3 || n === 6) return { name: "EQAO", style: "the way an Ontario EQAO writing task is worded: a short situation or topic and a clear instruction about what to write, in plain language, for a written response to a prompt" };
    if (n === 10) return { name: "OSSLT", style: "the way the Ontario Secondary School Literacy Test words its writing tasks: a short topic or situation, and an instruction to write a series of paragraphs giving and supporting an opinion with reasons and examples" };
  }
  if (/United Kingdom/.test(c)) {
    if (n >= 10 && n <= 11) return { name: "GCSE English Language", style: "the way a GCSE English Language writing question is worded: a situation or a viewpoint, and a clear form (a description or a story, or an article, letter, speech, leaflet, review or report)" };
    if (n >= 7 && n <= 9) return { name: "KS3 English", style: "the way a Key Stage 3 English writing task is worded: a clear purpose and audience, and a form such as an article, a letter or a speech" };
    if (n >= 3 && n <= 6) return { name: "KS2 English", style: "the way a Key Stage 2 writing task is set in school (writing is teacher-assessed, with no national writing test): a clear purpose and audience, in simple language a child of this age can follow" };
  }
  if (/United States/.test(c) && n >= 3 && n <= 12) {
    return { name: "state test (Common Core)", style: "the way a US state writing test task is worded: a topic or a claim, and an instruction to write with reasons, evidence or a clear sequence of events" };
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

// Premium: the reading paper of the exam a learner is preparing for. Applies to exactly the years examStyleFor covers, so
// one switch in the app serves both reading and writing, and the name shown is the same. "read" says how that exam words
// its reading texts and questions; it never names a real published passage.
const READING_EXAM = {
  "PSLE English": "the way the PSLE English Paper 2 comprehension section does: a narrative or information passage with Singapore settings, and open-ended questions needing a fact, an inference, what a word or phrase refers to, or a meaning in context, with answers put in the pupil's own words (Paper 2 also has multiple-choice questions on a short visual text such as an advert or notice)",
  "O-Level English Paper 1": "the way a Singapore O-Level English comprehension paper does: a short visual text with questions on how the visuals and language are used, a narrative or recount with questions on vocabulary in context and the effect of language, and a non-narrative text with a summary of about 80 words in the pupil's own words",
  "Singapore secondary English": "the way a Singapore secondary English reading task does: an article or narrative with a clear viewpoint, and questions on inference, the writer's purpose and tone, and vocabulary in context",
  "Cambridge Primary Checkpoint": "the way a Cambridge Primary English Checkpoint reading paper does: a story or non-fiction text, and questions that need a fact, an inference, a word meaning or a comment on the writer's choices",
  "Cambridge Lower Secondary Checkpoint": "the way a Cambridge Lower Secondary English Checkpoint reading paper does: a fiction or non-fiction text, and questions on explicit and implicit meaning, the writer's viewpoint and the effect of language",
  "IGCSE English First Language": "the way an IGCSE English First Language Paper 1 does: related non-fiction texts, with comprehension questions on explicit and implicit meaning, a short summary in the pupil's own words (no more than 120 words), and questions on the effect of the writer's language",
  "Cambridge AS and A Level English": "the way a Cambridge AS Level English Language Paper 1 does: an unseen text (such as a news story, article, blog, brochure, editorial or diary), with questions asking the pupil to comment on its form, structure and language and relate them to purpose and audience",
  "CBSE Class 10 English": "the way a CBSE Class 10 unseen-passage section does: a discursive passage, or a factual passage with a chart, table or statistics, with multiple-choice and short-answer questions on comprehension, inference, interpretation, evaluation and vocabulary in context",
  "CBSE Class 12 English": "the way a CBSE Class 12 reading section does: a factual, descriptive or literary passage, or a factual passage with a chart or statistics, with multiple-choice and short-answer questions on inference, the writer's attitude, vocabulary and reference",
  "HKDSE English Language": "the way an HKDSE English Language Paper 1 reading part does: written texts of different lengths and difficulty, with a mix of multiple-choice, short-answer and more extended open-ended questions on main ideas and details, the contextual meaning of words, tone and mood, and the writer's views, attitudes and arguments (a compulsory Part A, then an easier or a harder Part B)",
  "Junior Cycle English": "the way a Junior Cycle English reading paper does: a narrative, informational or persuasive text, a poster or other visual text, or a short passage such as a talk, with questions on comprehension strategies, audience and register, and the appreciation of language, including what a word means in its passage",
  "Leaving Certificate English": "the way a Leaving Certificate English Paper 1 comprehension does: linked texts of different kinds on one theme (for example an article, a literary extract and a commentary on the arts), each followed by a question asking for three developed points with reference to the text and a question on style, tone or the effect of language",
  "CEFR writing task": "the way a Cambridge English reading task at this CEFR level does: a short everyday text such as a notice, an email, an article or a story, with questions that check understanding at that level",
  "NAPLAN": "the way a NAPLAN reading test does: an imaginative, informative or persuasive text, and questions that range from finding a stated detail to inferring and interpreting",
  "NCEA English": "the way an NCEA English reading task does: unfamiliar texts (for example a poem, a short prose extract and a feature or media text), with questions on how language, structure and ideas create meaning and effects",
  "NSC English": "the way a South African NSC English Paper 1 comprehension does: a prose passage of about 700 to 800 words with a related visual text (for example a cartoon, an advert or a graphic) with questions on it, then literal, inferential and evaluative comprehension questions",
  "EQAO": "the way an Ontario EQAO reading test does: an informational text or a narrative text, each with selected-response questions on explicit information, implicit information (inference) and making connections, and one written answer",
  "OSSLT": "the way the Ontario Secondary School Literacy Test does: a real-life narrative, an information paragraph, a news report or a dialogue, with questions on direct, indirect and implicit meaning",
  "GCSE English Language": "the way a GCSE English Language reading paper does: a literary fiction extract or a non-fiction piece with a viewpoint, and questions on implicit meaning, the effect of language and structure, and the writer's perspective",
  "KS3 English": "the way a Key Stage 3 English reading task does: a fiction or non-fiction text, with questions on inference with evidence, the effect of language and the writer's purpose",
  "KS2 English": "the way Key Stage 2 reading is set in school: a fiction, non-fiction or poetry text, and questions on word meaning, retrieval, summarising, inference with evidence, prediction, structure and the effect of language",
  "KS2 SATs": "the way a Key Stage 2 reading test does: a fiction, non-fiction or poetry text, and questions on word meaning, retrieval, summarising, inference with evidence, prediction, structure and the effect of language",
  "state test (Common Core)": "the way a US state reading test does: a literary or informational text, and questions that ask for the evidence in the text, the theme or central idea, word meaning including figurative language, and the author's point of view",
};

// The learner's exam, for reading: { name, read } or null. Same applicability as the writing exam style.
function readingExamStyleFor(country, gradeLabel) {
  const e = examStyleFor(country, gradeLabel);
  if (!e) return null;
  // Year 6 in England sits a national reading test (the SATs); Years 3-5 and writing at every year are teacher-assessed.
  if (e.name === "KS2 English" && gradeNumber(gradeLabel) === 6) return { name: "KS2 SATs", read: READING_EXAM["KS2 SATs"] };
  return READING_EXAM[e.name] ? { name: e.name, read: READING_EXAM[e.name] } : null;
}

// raw: { textType: a name from this age's list, skill: a key, examStyle: true } -> { textType: the full entry or null, skill: { key, text } or null, exam }
// The exam style is Premium only and only where there is an exam, exactly as for writing.
function readingFocusFor({ tier, country, gradeLabel, capabilities }, raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const list = TEXT_TYPES[tier] || [];
  const textType = typeof r.textType === "string" ? list.find((t) => t.name === r.textType) || null : null;
  const allowed = READING_SKILLS_BY_TIER[tier] || [];
  const key = typeof r.skill === "string" && allowed.includes(r.skill) ? r.skill : null;
  const exam = r.examStyle === true && capabilities && capabilities.deepFeedback ? readingExamStyleFor(country, gradeLabel) : null;
  return { textType, skill: key ? { key, text: READING_SKILLS[key] } : null, exam };
}

module.exports = {
  WRITING_GENRES, WRITING_TASK, GENRE_ORDER, examStyleFor, readingExamStyleFor, READING_EXAM, gradeNumber, writingFocusFor,
  READING_SKILLS, READING_SKILLS_BY_TIER, SKILL_ORDER, readingFocusFor,
};
