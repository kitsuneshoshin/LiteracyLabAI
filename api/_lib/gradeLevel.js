// How hard a reading passage and a writing prompt should be, year by year.
//
// The app groups learners into four tiers (early, elementary, middle, high), but a tier spans up to six school
// years: Reception and Year 2 used to get the same passage length, and Year 10 the same "adult register" as
// Year 13. Here every grade of every country is given the typical age of the learners in it, and each age has its
// own reading band (length, sentence length, vocabulary, a readability ceiling that is checked mechanically after
// the model writes) and its own writing-prompt band. The English-learner mode is banded by CEFR level instead.
//
// The bands aim at a small step ABOVE what a typical learner of that age reads comfortably - the point of the
// app is to stretch - but never the "adult register" a 14-year-old was being given before.

// Typical age (in years) of the learners in each grade. Ages follow each country's usual school start.
const GRADE_AGE = {
  "🇬🇧 United Kingdom": { "Reception": 5, "Year 1": 5, "Year 2": 6, "Year 3": 7, "Year 4": 8, "Year 5": 9, "Year 6": 10, "Year 7": 11, "Year 8": 12, "Year 9": 13, "Year 10": 14, "Year 11": 15, "Year 12": 16, "Year 13": 17 },
  "🇺🇸 United States": { "Kindergarten": 5, "Grade 1": 6, "Grade 2": 7, "Grade 3": 8, "Grade 4": 9, "Grade 5": 10, "Grade 6": 11, "Grade 7": 12, "Grade 8": 13, "Grade 9": 14, "Grade 10": 15, "Grade 11": 16, "Grade 12": 17 },
  "🇦🇺 Australia": { "Foundation": 5, "Year 1": 6, "Year 2": 7, "Year 3": 8, "Year 4": 9, "Year 5": 10, "Year 6": 11, "Year 7": 12, "Year 8": 13, "Year 9": 14, "Year 10": 15, "Year 11": 16, "Year 12": 17 },
  "🇨🇦 Canada": { "Kindergarten": 5, "Grade 1": 6, "Grade 2": 7, "Grade 3": 8, "Grade 4": 9, "Grade 5": 10, "Grade 6": 11, "Grade 7": 12, "Grade 8": 13, "Grade 9": 14, "Grade 10": 15, "Grade 11": 16, "Grade 12": 17 },
  "🇳🇿 New Zealand": { "Year 1": 5, "Year 2": 6, "Year 3": 7, "Year 4": 8, "Year 5": 9, "Year 6": 10, "Year 7": 11, "Year 8": 12, "Year 9": 13, "Year 10": 14, "Year 11": 15, "Year 12": 16, "Year 13": 17 },
  "🇮🇪 Ireland": { "Junior Infants": 5, "Senior Infants": 5, "1st Class": 6, "2nd Class": 7, "3rd Class": 8, "4th Class": 9, "5th Class": 10, "6th Class": 11, "1st Year": 12, "2nd Year": 13, "3rd Year": 14, "Transition Year": 15, "5th Year": 16, "6th Year": 17 },
  "🇮🇳 India": { "Class 1": 6, "Class 2": 7, "Class 3": 8, "Class 4": 9, "Class 5": 10, "Class 6": 11, "Class 7": 12, "Class 8": 13, "Class 9": 14, "Class 10": 15, "Class 11": 16, "Class 12": 17 },
  "🇿🇦 South Africa": { "Grade R": 5, "Grade 1": 6, "Grade 2": 7, "Grade 3": 8, "Grade 4": 9, "Grade 5": 10, "Grade 6": 11, "Grade 7": 12, "Grade 8": 13, "Grade 9": 14, "Grade 10": 15, "Grade 11": 16, "Grade 12": 17 },
  "🇭🇰 Hong Kong": { "Primary 1": 6, "Primary 2": 7, "Primary 3": 8, "Primary 4": 9, "Primary 5": 10, "Primary 6": 11, "Secondary 1": 12, "Secondary 2": 13, "Secondary 3": 14, "Secondary 4": 15, "Secondary 5": 16, "Secondary 6": 17 },
  "🇦🇪 UAE & GCC Hubs": { "Cambridge Primary 1": 5, "Cambridge Primary 2": 6, "Cambridge Primary 3": 7, "Cambridge Primary 4": 8, "Cambridge Primary 5": 9, "Cambridge Primary 6": 10, "Lower Secondary 7": 11, "Lower Secondary 8": 12, "Lower Secondary 9": 13, "IGCSE Year 10": 14, "IGCSE Year 11": 15, "AS Level (Yr 12)": 16, "A Level (Yr 13)": 17 },
  "🇸🇬 Singapore & SE Asia": { "Primary 1": 6, "Primary 2": 7, "Primary 3": 8, "Primary 4": 9, "Primary 5": 10, "Primary 6": 11, "Secondary 1": 12, "Secondary 2": 13, "Secondary 3": 14, "O-Level / IGCSE Yr 4": 15, "O-Level / IGCSE Yr 5": 16, "IB Diploma Yr 1": 16, "IB Diploma Yr 2": 17 },
};

// Used when a grade label is not recognised: the middle of the tier.
const TIER_AGE = { early: 6, elementary: 9, middle: 12, high: 16 };

// ---------------------------------------------------------------- reading
// words: [min, max] for the passage; sentences: how many; avg: target average words per sentence (the check allows
// a little over it); fk: the readability ceiling (Flesch-Kincaid grade, checked on the finished passage); vocab:
// what the words should be like; structure: how the ideas are built.
const READING_BY_AGE = {
  5:  { words: [35, 60],   sentences: "5-7",   avg: 7,  fk: 2.5,  vocab: "only very common words a child who is learning to read already knows, with the same key words repeated; at most one new word, easy to guess from the sentence", structure: "one simple idea told in order, with single short sentences and no sentence joined by more than 'and' or 'but'" },
  6:  { words: [50, 80],   sentences: "6-8",   avg: 8,  fk: 3.5,  vocab: "everyday words, with a couple of slightly less common words a child can work out from the sentence", structure: "a simple beginning, middle and end, in short sentences, with 'and', 'but' and 'because' as the only joining words" },
  7:  { words: [70, 110],  sentences: "7-10",  avg: 10, fk: 4.5,  vocab: "everyday words plus a few new ones that the sentence makes clear", structure: "short sentences with a few longer ones joined by 'and', 'but', 'because' or 'when'" },
  8:  { words: [100, 150], sentences: "9-12",  avg: 11, fk: 5.5,  vocab: "mostly everyday words, with two or three richer words that can be worked out from context", structure: "short and medium sentences, with a clear order and one idea in each short paragraph" },
  9:  { words: [130, 180], sentences: "10-13", avg: 12, fk: 6.5,  vocab: "mostly everyday words, with three or four richer words that can be worked out from context", structure: "a mix of short and medium sentences, with a little description and one feeling or idea to infer" },
  10: { words: [160, 215], sentences: "11-14", avg: 13, fk: 7.5,  vocab: "everyday words with some richer vocabulary and a little figurative language that can be worked out from context", structure: "varied sentence lengths, with some complex sentences, in clear paragraphs" },
  11: { words: [190, 250], sentences: "12-16", avg: 14, fk: 8.5,  vocab: "a good range of vocabulary, with some figurative language and a few harder words that context explains", structure: "complex and compound sentences in short paragraphs, with one idea that is hinted at rather than stated" },
  12: { words: [220, 290], sentences: "13-17", avg: 15, fk: 9.5,  vocab: "a good range of vocabulary and figurative language, with a few subject words explained by the text", structure: "complex and compound sentences, with some implied meaning" },
  13: { words: [250, 320], sentences: "14-18", avg: 16, fk: 10.5, vocab: "rich vocabulary and figurative language; any technical word is explained by the text", structure: "varied sentence structures, with a clear viewpoint and some implied meaning" },
  14: { words: [280, 350], sentences: "14-19", avg: 17, fk: 11.5, vocab: "rich, precise vocabulary, with figurative language and a few abstract words", structure: "varied sentence structures, with an argument or a mood that builds across paragraphs" },
  15: { words: [300, 380], sentences: "15-20", avg: 18, fk: 12.5, vocab: "rich, precise vocabulary with some abstract and formal words", structure: "varied and sometimes long sentences, with a layered idea or a viewpoint that needs interpreting" },
  16: { words: [330, 420], sentences: "15-21", avg: 19, fk: 13.5, vocab: "sophisticated vocabulary, still clear on a careful first read", structure: "varied and sometimes long sentences, with nuanced or layered ideas" },
  17: { words: [350, 450], sentences: "16-22", avg: 20, fk: 14.5, vocab: "sophisticated vocabulary and a confident, formal or literary register", structure: "long and varied sentences, with nuanced ideas and a clear stance or tone" },
  18: { words: [370, 480], sentences: "16-22", avg: 20, fk: 15.5, vocab: "sophisticated, adult vocabulary and register", structure: "long and varied sentences, with nuanced, layered ideas and a clear stance or tone" },
};

// English learners, by CEFR level.
const READING_BY_CEFR = {
  A1: { words: [35, 65],   sentences: "5-7",   avg: 8,  fk: 3,  vocab: "only the most common English words (the first 500 or so), the present simple tense, and no idioms", structure: "very short, simple sentences about a familiar topic such as family, food or a daily routine" },
  A2: { words: [65, 110],  sentences: "7-10",  avg: 10, fk: 4.5, vocab: "common everyday words, the past simple and present simple, and no idioms", structure: "short sentences joined by 'and', 'but', 'because' and 'then', about a familiar topic" },
  B1: { words: [120, 180], sentences: "9-13",  avg: 13, fk: 7,  vocab: "everyday words plus some topic words, with a few idioms or phrasal verbs that context explains", structure: "short and medium sentences in clear paragraphs, using linking words such as 'however', 'so' and 'although'" },
  B2: { words: [190, 270], sentences: "12-16", avg: 15, fk: 10, vocab: "a wide range of vocabulary, with some less common words and figurative expressions that context explains", structure: "complex sentences and clear paragraphs, with some implied meaning" },
  C1: { words: [270, 370], sentences: "14-19", avg: 18, fk: 13, vocab: "rich, precise vocabulary, including abstract and formal words and idiomatic language", structure: "long and varied sentences, with nuanced ideas and some implied attitude" },
  C2: { words: [330, 450], sentences: "15-21", avg: 20, fk: 16, vocab: "sophisticated, precise vocabulary in a confident register", structure: "long and varied sentences, with subtle, layered ideas and a clear tone" },
};

// ---------------------------------------------------------------- writing prompts
// maxWords: the longest the prompt itself should be; ask: what the prompt is allowed to ask of the writer.
const WRITING_BY_AGE = {
  5:  { maxWords: 12, ask: "one very simple, concrete thing about something the child knows well (a pet, a toy, a favourite food, their day); one short sentence in words a five-year-old can read" },
  6:  { maxWords: 15, ask: "one simple, concrete thing about a familiar place, animal or day out, in one short sentence of everyday words" },
  7:  { maxWords: 24, ask: "one clear thing to write about, from a situation the child can easily picture; at most two short sentences, in everyday words" },
  8:  { maxWords: 32, ask: "a clear situation with one thing to do or decide, in at most two short sentences and everyday words" },
  9:  { maxWords: 38, ask: "a clear situation with one choice or a feeling to explore, in at most two sentences and mostly everyday words" },
  10: { maxWords: 44, ask: "a situation that asks the writer to make a choice or give a reason, in at most two sentences" },
  11: { maxWords: 50, ask: "a situation that asks for a choice, a viewpoint or a feeling developed with reasons or detail, in at most two sentences" },
  12: { maxWords: 56, ask: "an idea that asks the writer to take a perspective and develop it; two sentences at most, with no specialist vocabulary" },
  13: { maxWords: 62, ask: "an idea that asks the writer to take a perspective and develop it, with a little room for figurative language or structure" },
  14: { maxWords: 68, ask: "a perspective or a mood to develop, with deliberate choices of language and structure; two sentences at most" },
  15: { maxWords: 74, ask: "a perspective, mood or debatable claim to develop with deliberate choices of language and structure" },
  16: { maxWords: 80, ask: "a debatable claim or a demanding scene, in the style of a timed exam task" },
  17: { maxWords: 85, ask: "a debatable claim or a demanding scene, in the style of a timed exam task" },
  18: { maxWords: 90, ask: "a debatable claim or a demanding scene, in the style of a timed exam task" },
};
const WRITING_BY_CEFR = {
  A1: { maxWords: 22, ask: "a very simple task about yourself, your family or your day, in one or two very short sentences with only the most common words" },
  A2: { maxWords: 32, ask: "a simple everyday task, such as a short message or note, with two or three things to include, in simple sentences" },
  B1: { maxWords: 48, ask: "an everyday task, such as an email, a short story or a description, with a clear situation and a few points to cover" },
  B2: { maxWords: 64, ask: "a task with a clear situation, audience and purpose, such as an article, a review or an informal letter" },
  C1: { maxWords: 80, ask: "a task that asks for an opinion, a weighing up of ideas and a suitable register, such as an essay or a report" },
  C2: { maxWords: 90, ask: "a demanding task that asks for a precise, well-organised and nuanced answer in a register suited to the reader" },
};

function cefrKey(gradeLabel) {
  const m = String(gradeLabel || "").trim().match(/^(A1|A2|B1|B2|C1|C2)\b/i);
  return m ? m[1].toUpperCase() : null;
}

// The learner's level: { key, age, cefr, reading, writing }. A grade that is not recognised falls back to the tier.
function levelFor(country, gradeLabel, tier) {
  const cefr = /Global ESL/.test(String(country || "")) ? cefrKey(gradeLabel) : null;
  if (cefr) return { key: cefr, age: null, cefr, reading: READING_BY_CEFR[cefr], writing: WRITING_BY_CEFR[cefr] };
  const known = (GRADE_AGE[country] || {})[gradeLabel];
  const age = Math.min(18, Math.max(5, known || TIER_AGE[tier] || 9));
  return { key: String(age), age, cefr: null, reading: READING_BY_AGE[age], writing: WRITING_BY_AGE[age] };
}

// ---------------------------------------------------------------- measuring a finished text
function words(text) { return String(text || "").trim().split(/\s+/).filter(Boolean); }

function sentencesOf(text) {
  return String(text || "").replace(/\b(Mr|Mrs|Ms|Dr|St|Prof)\./g, "$1").split(/[.!?]+(?:\s|$)|\n+/).map((s) => s.trim()).filter((s) => /[A-Za-z]/.test(s));
}

// Rough English syllable count - good enough for a ceiling check, not for a published score.
function syllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

// Average words per sentence and Flesch-Kincaid grade of a prose text.
function readability(text) {
  const ws = words(text).filter((w) => /[A-Za-z]/.test(w));
  const ss = sentencesOf(text);
  if (!ws.length || !ss.length) return { avg: 0, fk: 0, words: ws.length, sentences: ss.length };
  const syl = ws.reduce((n, w) => n + syllables(w), 0);
  const avg = ws.length / ss.length;
  const fk = 0.39 * avg + 11.8 * (syl / ws.length) - 15.59;
  return { avg, fk, words: ws.length, sentences: ss.length };
}

// 'a 8-year-old' reads wrongly: 8 and 11 and 18 take 'an'.
const ageWords = (age) => (/^(8|11|18)$/.test(String(age)) ? `an ${age}-year-old` : `a ${age}-year-old`);

module.exports = { ageWords, GRADE_AGE, TIER_AGE, READING_BY_AGE, READING_BY_CEFR, WRITING_BY_AGE, WRITING_BY_CEFR, levelFor, readability, syllables, sentencesOf };
