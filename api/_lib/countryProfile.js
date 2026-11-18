// Country-specific alignment for generated reading passages and writing prompts: the single, static source of truth.
//
// gradeLevel.js says how HARD a text should be for a learner's age. This file says what KIND of reading and writing that
// learner's own curriculum asks for: the comprehension skills it names, the text forms it uses, the settings that feel
// familiar. It is plain data, like masteryTargets.js, so when a syllabus changes you edit the entry here and deploy.
//
// Each country has:
//   source:   the documents the notes were written from (so a reviewer knows what to re-check)
//   reviewed: the date (YYYY-MM-DD) someone last checked the entry against those documents. tests/country-profile.test.js
//             fails when an entry is more than 12 months old, which is the reminder to re-check it.
//   bands:    ordered by the learner's age ("to" = the oldest age the band covers). Each band has
//             reading: text forms and conventions for the passage,
//             skill:   the comprehension skills that curriculum names (used when the learner has not chosen a skill),
//             writing: the forms and conventions for the writing prompt.
//
// The notes are curriculum-informed summaries, not quotations. They carry no invented codes or numbers.

const PROFILES = {
  "🇬🇧 United Kingdom": {
    source: "National Curriculum in England: English programmes of study (KS1-KS3); KS1/KS2 reading test framework (content domains); AQA/Eduqas GCSE English Language specifications",
    reviewed: "2026-11-18",
    bands: [
      { to: 7, reading: "a short story, rhyme or simple non-fiction text of the kind used in Key Stage 1, with familiar British settings", skill: "retrieving details, making simple inferences and predicting what happens next", writing: "a short sentence-level task about a familiar experience, in the way Key Stage 1 writing is set" },
      { to: 11, reading: "fiction, non-fiction or poetry of the kind used in Key Stage 2 reading tests, with British settings and vocabulary", skill: "word meaning in context, retrieval, summarising, inference with evidence, prediction, how the text is organised, the effect of the writer's language choices, and comparing", writing: "a Key Stage 2 style task with a clear purpose and audience (to entertain, inform, persuade or discuss), such as a narrative, a letter or a recount" },
      { to: 14, reading: "a Key Stage 3 text: fiction, non-fiction or poetry, with attention to what the writer chose to do", skill: "inference and evidence, the effect of language and structure, the writer's viewpoint and purpose", writing: "a Key Stage 3 task with a stated purpose, audience and form, such as an article, a letter, a speech or a story" },
      { to: 18, reading: "a text in the style of the final two years of compulsory English: either a literary fiction extract or a non-fiction piece with a viewpoint", skill: "how writers use language and structure for effect, identifying and interpreting implicit meaning, evaluating a writer's viewpoint, and comparing perspectives", writing: "a final-two-years task giving a situation, audience and form (description, narrative, article, letter, speech or a viewpoint to argue)" },
    ],
  },
  "🇺🇸 United States": {
    source: "Common Core State Standards for English Language Arts: Reading Literature (RL), Reading Informational Text (RI) and Writing (W) strands",
    reviewed: "2026-11-18",
    bands: [
      { to: 7, reading: "a short literary or informational text (a story, a simple fact text), with American settings and school vocabulary (grade, recess, math)", skill: "asking and answering questions about key details, retelling, describing characters and events, and word meaning", writing: "an opinion, informative or narrative task of the kind Common Core asks for in the early grades: state a view or topic, give a reason or fact, and an ending" },
      { to: 11, reading: "a literary or informational text (story, poem, drama-style scene, or a science or social-studies informational text)", skill: "quoting the text to support answers, finding the theme or central idea, how a narrator's or character's point of view shapes events, word meaning including figurative language, and text structure", writing: "one of the three Common Core text types: an opinion piece with reasons, an informative text, or a narrative with sequenced events" },
      { to: 14, reading: "a literary or informational text of the kind used with Common Core grades 6-8, with a clear author's claim or a developing theme", skill: "citing textual evidence, tracing how a theme or central idea develops, analysing how an author's choices shape meaning, and assessing an author's reasoning", writing: "an argument with claims, reasons and evidence; an informative or explanatory text; or a narrative" },
      { to: 18, reading: "a literary or informational text of the kind used with Common Core grades 9-12, including an argument or a text that rewards close reading", skill: "citing strong and thorough textual evidence, analysing how an author's structure and rhetoric advance a purpose, evaluating an argument's reasoning, and determining the theme", writing: "a written argument that supports a claim with relevant evidence, or an explanatory or narrative piece, in the style of a timed task" },
    ],
  },
  "🇦🇺 Australia": {
    source: "Australian Curriculum v9.0: English (language, literature, literacy); NAPLAN reading and writing test descriptions (ACARA)",
    reviewed: "2026-11-18",
    bands: [
      { to: 8, reading: "an imaginative or informative text of the kind used in the Foundation to Year 2 years, with familiar Australian settings", skill: "understanding what is stated, making simple inferences, and the meaning of words and images", writing: "a short imaginative or informative piece about a familiar experience, in the style of the early-years English curriculum" },
      { to: 11, reading: "an imaginative, informative or persuasive text of the kind used in national literacy testing, with Australian settings welcome", skill: "literal comprehension, inference, and interpreting how language and structure create meaning, as national literacy testing assesses", writing: "a narrative or a persuasive text, the two text types national writing tests use, with a short stimulus and a plain instruction" },
      { to: 15, reading: "an imaginative, informative or persuasive text of the kind used in national literacy testing in Years 7 and 9 and in Years 7-10 English", skill: "interpreting and evaluating: how a writer's choices shape the reader's response, inference, and the effect of language, structure and point of view", writing: "a narrative or persuasive text with a stimulus, written to the Years 7-10 curriculum's expectations for purpose, audience and language choices" },
      { to: 18, reading: "a text of the kind studied in Senior Secondary English: an argument, a feature article or a literary extract", skill: "analysing how language and structure position the reader, evaluating an argument, and comparing texts", writing: "an analytical, persuasive or imaginative piece of the kind set in Senior Secondary English" },
    ],
  },
  "🇨🇦 Canada": {
    source: "The Ontario Curriculum: English (Grades 1-8) and English (Grades 9-12), reading and writing strands; EQAO Grade 3 and 6 reading/writing and the OSSLT descriptions",
    reviewed: "2026-11-18",
    bands: [
      { to: 8, reading: "a story, poem or information text of the kind used in the Ontario primary years, with Canadian settings and school words (Grade, recess)", skill: "understanding explicit and implicit meaning, making inferences, and responding with reasons", writing: "a short narrative, information or opinion piece, in the style of the Ontario primary writing expectations" },
      { to: 12, reading: "a story, poem or information text of the kind used in Ontario's provincial reading assessments, with Canadian settings", skill: "understanding explicit and implicit ideas, making inferences with evidence from the text, and forming and supporting an opinion about the text", writing: "a narrative, a news report or an opinion piece, with a short situation and a clear instruction as provincial assessments word them" },
      { to: 16, reading: "a text of the kind used in Ontario Grades 7-10 English and in the provincial literacy test: a news report, a short narrative, or an opinion piece", skill: "direct, indirect and implicit meaning, and the writer's purpose, with supporting evidence", writing: "a news report, a series of paragraphs giving an opinion with reasons and examples, or a narrative, as the provincial literacy test and Ontario English set them" },
      { to: 18, reading: "a text of the kind used in Ontario Grades 11-12 English: a feature article, a literary extract or a media text", skill: "analysing how a writer's choices create meaning and evaluating an argument's reasoning", writing: "an analytical or argumentative piece of the kind set in Ontario Grades 11-12 English" },
    ],
  },
  "🇳🇿 New Zealand": {
    source: "The New Zealand Curriculum: English learning area (listening, reading, viewing; speaking, writing, presenting); NCEA English achievement standards",
    reviewed: "2026-11-18",
    bands: [
      { to: 10, reading: "a story, poem or information text of the kind used in New Zealand primary years, with New Zealand settings welcome", skill: "making meaning from ideas, language and structure, and making inferences using evidence", writing: "a short imaginative or informative piece, in the way the New Zealand primary years set writing" },
      { to: 14, reading: "a story, article or poem of the kind used in Years 7-10 English, with New Zealand settings welcome", skill: "how a writer's choices of ideas, language and structure make meaning, and inference with evidence", writing: "a creative or transactional piece of the kind used in Years 7-10, with a clear purpose and audience" },
      { to: 18, reading: "a written or visual-style text of the kind studied in the senior years: an article, a feature or a literary extract", skill: "analysing how language and structure create meaning for the audience, and supporting an interpretation with evidence", writing: "a creative or formal essay response of the kind set in senior English" },
    ],
  },
  "🇮🇪 Ireland": {
    source: "Primary Language Curriculum (Ireland); Junior Cycle English specification; Leaving Certificate English syllabus (Paper 1: comprehension and composition)",
    reviewed: "2026-11-18",
    bands: [
      { to: 11, reading: "a story, poem or information text of the kind used in the Irish primary classes, with Irish settings welcome", skill: "understanding and responding to texts: retrieving, inferring and giving a personal response with a reason", writing: "a short piece in a primary-class text form, such as a recount, a description, a story or a persuasive letter" },
      { to: 15, reading: "a text of the kind used in Junior Cycle English: a narrative, an informational or a persuasive text", skill: "understanding, inferring and evaluating a text, and the effect of the writer's choices", writing: "a Junior Cycle written task with a topic or situation and a clear form, such as a speech, an article, a letter or a short story" },
      { to: 18, reading: "a text in the style of a senior-cycle comprehension: an article, a speech or a personal essay of some length, with a clear voice", skill: "understanding the writer's purpose and style, the effect of language and tone, and responding in your own words", writing: "a senior-cycle composition: a personal essay, a speech, a short story, a magazine article or a news report" },
    ],
  },
  "🇮🇳 India": {
    source: "NCERT English syllabus (primary to Class 12); CBSE English Language and Literature (Class 10) and English Core (Class 12) reading and writing sections",
    reviewed: "2026-11-18",
    bands: [
      { to: 10, reading: "a short story, poem or factual passage of the kind used in NCERT primary English, with Indian settings and names welcome", skill: "reading for facts, finding the meaning of words from the sentence, and understanding what a character feels", writing: "a short piece such as a paragraph, a simple letter or a story, in the way NCERT primary English sets it" },
      { to: 14, reading: "a story, a descriptive or a factual passage of the kind used in the NCERT middle years, with Indian settings welcome", skill: "finding the main idea, inference, vocabulary in context, and what a pronoun or phrase refers to", writing: "a formal or informal letter, a notice, a paragraph or a story, as set in the middle school years" },
      { to: 16, reading: "an unseen passage as set in Class 10 board English: a factual, a discursive or a literary text", skill: "inference, vocabulary in context (a word's meaning or its opposite), reference to a word or phrase, and the writer's purpose", writing: "a board-style writing task with a short situation, a form (a formal letter, an article, a story or a notice) and a word limit" },
      { to: 18, reading: "an unseen passage as set in Class 12 board English: a factual or a discursive text, often on a social or scientific theme", skill: "inference, the writer's attitude, vocabulary in context, and the meaning of a word, a phrase or a reference", writing: "a Class 12 board-style task with a short situation and a form (a formal letter, a report, an article or a speech) within a word limit" },
    ],
  },
  "🇿🇦 South Africa": {
    source: "Curriculum and Assessment Policy Statement (CAPS) English Home Language: reading and viewing, writing and presenting; National Senior Certificate English Paper 1 and Paper 3 descriptions",
    reviewed: "2026-11-18",
    bands: [
      { to: 10, reading: "a story, poem or information text of the kind used in the CAPS Foundation Phase, with South African settings welcome", skill: "understanding what is stated, simple inference, and the meaning of words from the sentence", writing: "a short narrative, a description or a simple transactional text, in the way the Foundation Phase sets it" },
      { to: 14, reading: "a story, an information text or a text with a visual (an advert or a cartoon-style text), as CAPS comprehension sets", skill: "literal and inferential comprehension, the writer's purpose, and language in context", writing: "a narrative, descriptive or reflective essay, or a transactional text such as a letter or a dialogue, as CAPS sets it" },
      { to: 18, reading: "a comprehension passage with a visual or a language-in-context item, as in the senior certificate English papers", skill: "literal, inferential and evaluative questions, the effect of language, and the writer's viewpoint or tone", writing: "a senior-certificate style essay (narrative, descriptive, reflective, argumentative or discursive) or a transactional text such as a formal letter, a speech or a review" },
    ],
  },
  "🇭🇰 Hong Kong": {
    source: "Hong Kong English Language Education Key Learning Area Curriculum Guide (Primary 1 - Secondary 6); HKDSE English Language Paper 1 (Reading) and Paper 2 (Writing) descriptions",
    reviewed: "2026-11-18",
    bands: [
      { to: 11, reading: "a short text of the kind used in Hong Kong primary English, with Hong Kong settings (a school, a market, a MTR ride), for pupils who learn English as an additional language", skill: "understanding main ideas and details, simple inference, and the meaning of words from context", writing: "a simple piece of the kind set in Hong Kong primary English: a description, a short message, a story, in plain language" },
      { to: 15, reading: "a magazine article, a letter, a story or a report of the kind used in Hong Kong junior secondary English, for learners of English as an additional language", skill: "main ideas, details, inference, the meaning of words from context, and telling fact from opinion", writing: "a text of a stated type (a letter, an article, a story) for a stated audience, in the way Hong Kong junior secondary English sets it" },
      { to: 18, reading: "a text of the kind used in senior secondary public-exam reading: a magazine feature, an opinion piece, a letter or a report, written for a stated purpose", skill: "identifying the main ideas and details, inference, the writer's purpose and attitude, the meaning of words from context, and fact versus opinion", writing: "a senior secondary public-exam style task: a situation, a stated text type (a letter, an article, a speech or a story) and a stated audience" },
    ],
  },
  "🇦🇪 UAE & GCC Hubs": {
    source: "Cambridge Primary English and Cambridge Lower Secondary English curriculum frameworks (reading and writing objectives) and Checkpoint tests; Cambridge IGCSE English First Language (0500) and AS/A Level English Language syllabuses",
    reviewed: "2026-11-18",
    bands: [
      { to: 11, reading: "a story, poem or non-fiction text of the kind used in Cambridge Primary English, with international or Gulf settings that suit a school in the region. Avoid references to alcohol, pork, dating or anything a Gulf school would not use", skill: "retrieving information, making inferences, the meaning of words in context, and the writer's choice of language, as the Cambridge Primary reading objectives name them", writing: "a Cambridge Primary style task with a clear purpose and audience: a story, a description, a letter or an information text" },
      { to: 14, reading: "a fiction or non-fiction text of the kind used in Cambridge Lower Secondary English, with international or Gulf settings that suit a school in the region. Avoid alcohol, pork, dating or anything a Gulf school would not use", skill: "explicit and implicit meaning, the writer's purpose and viewpoint, and how language and structure create effects", writing: "a Cambridge Lower Secondary style task with a clear purpose, audience and form, such as an article, a letter or a story" },
      { to: 16, reading: "a text of the kind used in Cambridge upper-secondary reading: a non-fiction article or a report to be read closely, with international or Gulf settings", skill: "selecting and summarising points, understanding implicit meaning, and the effect of the writer's word choices", writing: "a Cambridge upper-secondary style question: a topic or a viewpoint and a clear form (a descriptive or narrative piece, an article, a letter or a speech)" },
      { to: 18, reading: "a text of the kind studied for Cambridge AS and A Level English: a feature, a speech or an opinion piece, with international settings", skill: "analysing how a writer shapes meaning for an audience, and comparing texts", writing: "a Cambridge AS or A Level style task: a discursive, a narrative or a descriptive piece for a timed response" },
    ],
  },
  "🇸🇬 Singapore & SE Asia": {
    source: "Singapore MOE English Language Syllabus (primary and secondary); PSLE English Language Paper 2 (comprehension) and Paper 1 (writing) descriptions; Singapore-Cambridge O-Level English",
    reviewed: "2026-11-18",
    bands: [
      { to: 9, reading: "a short story or information text of the kind used in Singapore primary English, with Singapore settings (a hawker centre, an HDB block, a school canteen)", skill: "retrieving facts, inference, what a word or pronoun refers to, and the meaning of words from the sentence", writing: "a short composition in the way Singapore primary English sets it: a picture or a theme to build a story or a recount around" },
      { to: 11, reading: "a passage of the kind used in upper-primary English comprehension: a narrative or an information text, with Singapore settings", skill: "retrieving and inferring, what a word or phrase refers to, vocabulary in context, and answering in your own words", writing: "an upper-primary continuous-writing task: a theme or pictures to build a story around, with a short instruction" },
      { to: 15, reading: "a text of the kind used in Singapore lower secondary English: an article, a narrative or a visual text with a clear purpose", skill: "inference, the writer's purpose and tone, vocabulary in context, and the reference of words and phrases", writing: "a Singapore secondary English style task: a short instruction with a theme, a title or a viewpoint, asking for a narrative, a descriptive or a discursive piece" },
      { to: 18, reading: "an article, narrative or opinion text of the kind used in senior secondary English and the IB English courses, with a clear viewpoint", skill: "inference, the writer's purpose and tone, the effect of language, and summarising in your own words", writing: "a senior secondary style task: a narrative, a descriptive or a discursive/argumentative piece, with a title or a viewpoint" },
    ],
  },
};

function bandFor(country, age) {
  const p = PROFILES[country];
  if (!p || age == null) return null;
  return p.bands.find((b) => age <= b.to) || p.bands[p.bands.length - 1];
}

// What kind of text this learner's curriculum uses, ready to put in a prompt. null when the country has no profile (the
// Global ESL mode, which is levelled by CEFR instead).
function readingNote(country, age) { const b = bandFor(country, age); return b ? b.reading : null; }
// The comprehension skills the curriculum names, used when the learner did not choose a skill. null when not profiled.
function readingSkill(country, age) { const b = bandFor(country, age); return b ? b.skill : null; }
function writingNote(country, age) { const b = bandFor(country, age); return b ? b.writing : null; }

module.exports = { PROFILES, bandFor, readingNote, readingSkill, writingNote };
