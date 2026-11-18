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
    source: "National Curriculum in England: English programmes of study (DfE, July 2014); KS2 English reading test framework content domains (gov.uk, 2015); AQA GCSE English Language 8700 (v1.5, Oct 2021) and WJEC Eduqas GCSE English Language (v3, Jan 2019). Post-16 English is described only in general terms and has not been checked against A level specifications",
    reviewed: "2026-11-18",
    bands: [
      { to: 7, reading: "a short story, rhyme or simple non-fiction text of the kind used in Key Stage 1, with familiar British settings", skill: "retrieving details, making simple inferences and predicting what happens next", writing: "a short sentence-level task about a familiar experience, in the way Key Stage 1 writing is set" },
      { to: 11, reading: "fiction, non-fiction or poetry of the kind used in Key Stage 2 reading tests, with British settings and vocabulary", skill: "word meaning in context, retrieval, summarising, inference with evidence, prediction, how the text is organised, the effect of the writer's language choices, and comparing", writing: "a Key Stage 2 style task with a clear purpose and audience (to entertain, inform, persuade or discuss), such as a narrative, a letter or a recount" },
      { to: 14, reading: "a Key Stage 3 text: fiction, non-fiction or poetry, with attention to what the writer chose to do", skill: "inference and evidence, the effect of language and structure, the writer's viewpoint and purpose", writing: "a Key Stage 3 task with a stated purpose, audience and form, such as an article, a letter, a speech or a story" },
      { to: 16, reading: "a text in the style of the final two years of compulsory English (Years 10-11): either a 20th or 21st century literary fiction extract, or a non-fiction or literary non-fiction piece with a viewpoint (the non-fiction pairing can include a 19th-century text)", skill: "how writers use language and structure for effect, identifying and interpreting implicit meaning, evaluating a writer's viewpoint, and comparing perspectives", writing: "a task for the final two years of compulsory English giving a situation, audience and form: a description or narrative (creative), or a viewpoint piece such as an article, letter, speech, leaflet, review or report (non-fiction)" },
      { to: 18, reading: "a text of the kind read closely in post-16 English study: a literary extract, or a non-fiction piece with a clear viewpoint", skill: "analysing how a writer shapes meaning, evaluating a viewpoint, and comparing texts", writing: "a discursive, analytical or creative piece for a stated audience, written to a timed or extended task" },
    ],
  },
  "🇺🇸 United States": {
    source: "Common Core State Standards for English Language Arts: Reading Literature (RL), Reading Informational Text (RI) and Writing (W) strands",
    reviewed: "2026-11-18",
    bands: [
      { to: 7, reading: "a short literary or informational text (a story, a simple fact text), with American settings and school vocabulary (grade, recess, math)", skill: "asking and answering questions about key details, retelling, describing characters and events, and word meaning", writing: "an opinion, informative or narrative task of the kind Common Core asks for in the early grades: state a view or topic, give a reason or fact, and an ending" },
      { to: 11, reading: "a literary or informational text (story, poem, drama-style scene, or a science or social-studies informational text)", skill: "quoting the text to support answers, finding the theme or central idea, how a narrator's or character's point of view shapes events, word meaning including figurative language, and text structure", writing: "one of the three Common Core text types: an opinion piece with reasons (from Grade 6 it is called an argument, with claims and evidence), an informative text, or a narrative with sequenced events" },
      { to: 14, reading: "a literary or informational text of the kind used with Common Core grades 6-8, with a clear author's claim or a developing theme", skill: "citing textual evidence, tracing how a theme or central idea develops, analysing how an author's choices shape meaning, and assessing an author's reasoning", writing: "an argument with claims, reasons and evidence; an informative or explanatory text; or a narrative" },
      { to: 18, reading: "a literary or informational text of the kind used with Common Core grades 9-12, including an argument or a text that rewards close reading", skill: "citing strong and thorough textual evidence, analysing how an author's structure and rhetoric advance a purpose, evaluating an argument's reasoning, and determining the theme", writing: "a written argument that supports a claim with relevant evidence, or an explanatory or narrative piece, in the style of a timed task" },
    ],
  },
  "🇦🇺 Australia": {
    source: "Australian Curriculum v9.0: English (Foundation-10; strands Language, Literature, Literacy); NAPLAN reading and writing test descriptions at nap.edu.au (Years 3, 5, 7 and 9). Senior secondary English courses are set by each state or territory",
    reviewed: "2026-11-18",
    bands: [
      { to: 8, reading: "an imaginative or informative text of the kind used in the Foundation to Year 2 years, with familiar Australian settings", skill: "understanding what is stated, making simple inferences, and the meaning of words and images", writing: "a short imaginative or informative piece about a familiar experience, in the style of the early-years English curriculum" },
      { to: 11, reading: "an imaginative, informative or persuasive text of the kind used in Years 3-6 English, with Australian settings welcome", skill: "literal comprehension, inference, and interpreting how language and structure create meaning", writing: "a narrative or a persuasive text (the two text types national writing tests use), with a short stimulus and a plain instruction; informative texts are also taught" },
      { to: 15, reading: "an imaginative, informative or persuasive text of the kind used in national literacy testing in Years 7 and 9 and in Years 7-10 English", skill: "interpreting and evaluating: how a writer's choices shape the reader's response, inference, and the effect of language, structure and point of view", writing: "a narrative or persuasive text with a stimulus, written to the Years 7-10 curriculum's expectations for purpose, audience and language choices" },
      { to: 18, reading: "a text of the kind studied in Senior Secondary English: an argument, a feature article or a literary extract", skill: "analysing how language and structure position the reader, evaluating an argument, and comparing texts", writing: "an analytical, persuasive or imaginative piece of the kind set in Senior Secondary English" },
    ],
  },
  "🇨🇦 Canada": {
    source: "The Ontario Curriculum: Language (Grades 1-8, 2023); English (Grade 9, 2023; Grades 10-12, 2007); EQAO Grade 3 and 6 Assessment of Reading, Writing and Mathematics (frameworks and 2025 at-a-glance, read directly); OSSLT (Grade 10) description at eqao.com, not rechecked",
    reviewed: "2026-11-18",
    bands: [
      { to: 8, reading: "a story, poem or information text of the kind used in the Ontario primary years, with Canadian settings and school words (Grade, recess); in Grade 3 an informational text and a narrative text, each followed by questions and one written answer", skill: "understanding explicit and implicit meaning, making inferences, and responding with reasons", writing: "a short narrative, information or opinion piece, in the style of the Ontario primary writing expectations" },
      { to: 12, reading: "an informational text or a narrative text of the kind used in Ontario primary and junior language, with Canadian settings, followed by selected-response questions and one written answer", skill: "understanding explicit and implicit ideas, making inferences with evidence from the text, and forming and supporting an opinion about the text", writing: "a narrative, an information piece or an opinion piece, with a short situation and a clear instruction, and a written response to a prompt" },
      { to: 16, reading: "a text of the kind used in Ontario Grades 7-10 English and in the provincial literacy test: a real-life narrative, an information paragraph, a news report or a dialogue", skill: "direct, indirect and implicit meaning, and the writer's purpose, with supporting evidence", writing: "a series of paragraphs giving an opinion with reasons and examples (the provincial literacy test task), or a narrative or news report as Ontario Grades 8-11 English sets them" },
      { to: 18, reading: "a text of the kind used in Ontario Grades 11-12 English: a feature article, a literary extract or a media text", skill: "analysing how a writer's choices create meaning and evaluating an argument's reasoning", writing: "an analytical or argumentative piece of the kind set in Ontario Grades 11-12 English" },
    ],
  },
  "🇳🇿 New Zealand": {
    source: "The New Zealand Curriculum English learning area, refreshed Years 0-10 (Tahurangi English Phases 1-4, in force during 2026 and replaced from 1 January 2027 by NZC English Years 0-10 2026; Phase 1 and Phase 3 pages read, writing is organised by purpose: entertain, inform, persuade; Phases 2 and 4 not read); NCEA Level 1 English achievement standards AS91924-91927 (NZQA). NCEA Level 1 is due to be replaced from 2028, so re-check then",
    reviewed: "2026-11-18",
    bands: [
      { to: 10, reading: "a story, poem or information text of the kind used in New Zealand primary years, with New Zealand settings welcome", skill: "making meaning from ideas, language and structure, and making inferences using evidence", writing: "a short narrative, an information piece (a series of sentences, then a paragraph with a topic sentence, details and a closing sentence) or a persuasive paragraph stating an opinion with reasons" },
      { to: 14, reading: "a story, article or poem of the kind used in Years 7-10 English, with New Zealand settings welcome", skill: "how a writer's choices of ideas, language and structure make meaning, and inference with evidence", writing: "a text to entertain (a narrative, poem or descriptive piece with sensory detail and a resolution), to inform (a report, explanation, article, discussion or character profile with headings and precise vocabulary) or to persuade, with a clear purpose and audience" },
      { to: 18, reading: "unfamiliar texts of the kind studied in the senior years, such as a poem, a prose extract or a feature or media text", skill: "analysing how language and structure create meaning for the audience, and supporting an interpretation with evidence", writing: "a piece of fiction or non-fiction writing, such as a personal account, a narrative, a poem, a script, a report or an essay, developed over time in class" },
    ],
  },
  "🇮🇪 Ireland": {
    source: "Primary Language curriculum specification (Ireland: the new Language specification for English, Irish and modern foreign languages that replaces the 2019 Primary Language Curriculum; text forms by class not yet read from it); Junior Cycle English specification (NCCA, amended 2018); Leaving Certificate English syllabus (current, Paper 1 Comprehending and Composing). A new Leaving Certificate English specification is due no earlier than September 2027 and will change Paper 1, so re-check then",
    reviewed: "2026-11-18",
    bands: [
      { to: 11, reading: "a story, poem or information text of the kind used in the Irish primary classes, with Irish settings welcome", skill: "understanding and responding to texts: retrieving, inferring and giving a personal response with a reason", writing: "a short piece in a primary-class text form, such as a recount, a description, a story or a persuasive letter" },
      { to: 15, reading: "a text of the kind used in Junior Cycle English: a narrative, an informational or a persuasive text", skill: "understanding, inferring and evaluating a text, and the effect of the writer's choices", writing: "a Junior Cycle written task with a topic or situation and a clear form, such as a speech, an article, a letter or a short story" },
      { to: 18, reading: "a text in the style of a senior-cycle comprehension: an article, a speech or a personal essay of some length, with a clear voice", skill: "understanding the writer's purpose and style, the effect of language and tone, and responding in your own words", writing: "a senior-cycle composition: a personal essay, a speech, a short story, a magazine article or a news report" },
    ],
  },
  "🇮🇳 India": {
    source: "NCERT English syllabus (primary to Class 12; primary and middle notes not yet checked against the textbooks); CBSE Class 10 English Language and Literature (184) and Class 12 English Core (301) syllabuses 2025-26 and 2026-27, read via the Delhi Directorate of Education copies at edustud.nic.in. CBSE also sets a separate Communicative paper (101), not covered",
    reviewed: "2026-11-18",
    bands: [
      { to: 10, reading: "a short story, poem or factual passage of the kind used in NCERT primary English, with Indian settings and names welcome", skill: "reading for facts, finding the meaning of words from the sentence, and understanding what a character feels", writing: "a short piece such as a paragraph, a simple letter or a story, in the way NCERT primary English sets it" },
      { to: 14, reading: "a story, a descriptive or a factual passage of the kind used in the NCERT middle years, with Indian settings welcome", skill: "finding the main idea, inference, vocabulary in context, and what a pronoun or phrase refers to", writing: "a formal or informal letter, a notice, a paragraph or a story, as set in the middle school years" },
      { to: 16, reading: "an unseen discursive passage, or an unseen factual passage that comes with a chart, table or statistical data, followed by multiple-choice and short-answer questions", skill: "comprehension, inference, analysis, interpretation, evaluation, vocabulary in context, and reading data from a chart or table", writing: "a board-style writing task: a formal letter based on a given situation (about 100-120 words), or an analytical paragraph on a given chart, graph or set of cues (about 100-120 words)" },
      { to: 18, reading: "two unseen passages: a factual, descriptive or literary passage, and a factual passage with a chart or statistical input, with multiple-choice and short-answer questions", skill: "inference, the writer's attitude, vocabulary in context, and the meaning of a word, a phrase or a reference", writing: "a short composition within a word limit: a notice, or an invitation and its reply (up to 50 words), a letter (a job application, or a letter to the editor giving an opinion on a public issue), an article or a report (about 120-150 words)" },
    ],
  },
  "🇿🇦 South Africa": {
    source: "DBE Official Languages Home Language Grade 12 Examination Guidelines (2017, structure confirmed unchanged in 2023 papers): Paper 1 comprehension, summary and language; Paper 3 essay and two transactional texts. Foundation, Intermediate and Senior Phase CAPS details not yet checked. First Additional Language papers are different and not covered",
    reviewed: "2026-11-18",
    bands: [
      { to: 10, reading: "a story, poem or information text of the kind used in the CAPS Foundation and early Intermediate Phase, with South African settings welcome", skill: "understanding what is stated, simple inference, and the meaning of words from the sentence", writing: "a short narrative, a description or a simple transactional text, in the way the early primary phases set it" },
      { to: 14, reading: "a story, an information text or a text with a visual (an advert or a cartoon-style text), as CAPS comprehension sets", skill: "literal and inferential comprehension, the writer's purpose, and language in context", writing: "a narrative, descriptive or reflective essay, or a transactional text such as a letter or a dialogue, as CAPS sets it" },
      { to: 18, reading: "a prose comprehension passage of about 700-800 words with a related visual text (a cartoon, an advert or a graphic), as in the senior certificate English papers", skill: "literal, inferential and evaluative questions, the effect of language, the writer's viewpoint or tone, summarising in your own words, and language in context (adverts, cartoons, prose)", writing: "a senior-certificate Paper 3 style task: an essay on a chosen topic (narrative, descriptive, reflective, discursive or argumentative, 400-450 words), or a transactional text such as a letter, a CV and covering letter, a report, a review, a newspaper or magazine article, a speech, a dialogue or a written interview (180-200 words)" },
    ],
  },
  "🇭🇰 Hong Kong": {
    source: "EDB English Language Education Key Learning Area Curriculum Guide (P1-S6) 2017, Primary English Language Curriculum Guide 2025 and the S1-3 supplement 2018 (primary and junior text types not yet checked against the key-stage tables); HKEAA 2026 HKDSE English Language Introduction (Paper 1 Reading, Paper 2 Writing)",
    reviewed: "2026-11-18",
    bands: [
      { to: 11, reading: "a short text of the kind used in Hong Kong primary English, with Hong Kong settings (a school, a market, a MTR ride), for pupils who learn English as an additional language", skill: "understanding main ideas and details, simple inference, and the meaning of words from context", writing: "a simple piece of the kind set in Hong Kong primary English: a description, a short message, a story, in plain language" },
      { to: 15, reading: "a magazine article, a letter, a story or a report of the kind used in Hong Kong junior secondary English, for learners of English as an additional language", skill: "main ideas, details, inference, the meaning of words from context, and telling fact from opinion", writing: "a text of a stated type (a letter, an article, a story) for a stated audience, in the way Hong Kong junior secondary English sets it" },
      { to: 18, reading: "a written text of the kind used in senior secondary public-exam reading (for example a magazine feature, an opinion piece, a letter or a report), at a length and difficulty suited to learners of English as an additional language", skill: "identifying the main ideas and details, inference, the contextual meaning of words, tone and mood, and the writer's views, attitudes and arguments", writing: "a senior secondary public-exam style task: either a short guided task giving the situation, the purpose and some information to use (about 200 words), or a longer open task for a stated audience (about 400 words, such as a story, an article, a speech or a letter)" },
    ],
  },
  "🇦🇪 UAE & GCC Hubs": {
    source: "Cambridge Primary English (0058) and Cambridge Lower Secondary English (0861) curriculum frameworks and Checkpoint (framework objectives by stage not yet read in full); Cambridge IGCSE First Language English 0500 (2027-2029 syllabus, Version 1); Cambridge International AS & A Level English Language 9093 (2024-2026 and 2027-2028 syllabuses). Gulf-suitability guidance is ours, not Cambridge's",
    reviewed: "2026-11-18",
    bands: [
      { to: 10, reading: "a story, poem or non-fiction text of the kind used in Cambridge Primary English, with international or Gulf settings that suit a school in the region. Avoid references to alcohol, pork, dating or anything a Gulf school would not use", skill: "retrieving information, making inferences, the meaning of words in context, and the writer's choice of language, as the Cambridge Primary reading objectives name them", writing: "a Cambridge Primary style task with a clear purpose and audience: a story, a description, a letter or an information text" },
      { to: 13, reading: "a fiction or non-fiction text of the kind used in Cambridge Lower Secondary English, with international or Gulf settings that suit a school in the region. Avoid alcohol, pork, dating or anything a Gulf school would not use", skill: "explicit and implicit meaning, the writer's purpose and viewpoint, and how language and structure create effects", writing: "a Cambridge Lower Secondary style task with a clear purpose, audience and form, such as an article, a letter or a story" },
      { to: 15, reading: "a text of the kind used in Cambridge upper-secondary reading: related non-fiction texts (articles, reports or similar) to be read closely, with international or Gulf settings", skill: "explicit and implicit meaning, summarising points in your own words, and the effect of the writer's language", writing: "a Cambridge upper-secondary style task: either directed writing in response to a text (a discursive, argumentative or persuasive speech, letter, article or report, about 250-350 words) or a composition from a title (descriptive or narrative, about 350-450 words)" },
      { to: 18, reading: "an unseen non-literary text of the kind studied in Cambridge AS and A Level English Language (for example a news story, article, blog, brochure, editorial or diary), with international settings", skill: "analysing how a writer's form, structure and language shape meaning for a purpose and audience, and comparing texts", writing: "a task whose brief gives a form, purpose and audience (for example an article, a review, a blog, a speech or a travel piece), either a short text or an extended imaginative, discursive or review piece" },
    ],
  },
  "🇸🇬 Singapore & SE Asia": {
    source: "Singapore MOE English Language Syllabus 2020 (Primary and Secondary E/N(A)); SEAB PSLE English Language 0001 (format document for 2026, implemented from the 2025 examination) and Singapore-Cambridge GCE O-Level English Language 1184 (2026 syllabus), both read directly from seab.gov.sg. Cambridge/IGCSE courses used by international schools in the region are not described separately",
    reviewed: "2026-11-18",
    bands: [
      { to: 9, reading: "a short story or information text of the kind used in Singapore primary English, with Singapore settings (a hawker centre, an HDB block, a school canteen) and names from Singapore's Chinese, Malay, Indian and other communities, in standard English with no Singlish", skill: "retrieving facts, inference, what a word or pronoun refers to, and the meaning of words from the sentence", writing: "a short composition in the way Singapore primary English sets it: a picture or a theme to build a story or a recount around" },
      { to: 11, reading: "a passage of the kind used in upper-primary English comprehension: a narrative or an information text, with Singapore settings and names from its different communities, in standard English, with items such as a short visual text (a poster or advert), a comprehension cloze and open-ended questions", skill: "retrieving and inferring, what a word or phrase refers to, vocabulary in context, and answering in your own words", writing: "an upper-primary writing task: either continuous writing (a topic with three pictures, described in words, that offer different angles, where the composition of at least 150 words is based on at least one of them) or situational writing (a short functional piece such as a letter, email or report for a given purpose, audience and context)" },
      { to: 13, reading: "a text of the kind used in Singapore lower secondary English (Secondary 1-2): an article, a narrative or a visual text with a clear purpose", skill: "inference, the writer's purpose and tone, vocabulary in context, and the reference of words and phrases", writing: "a Singapore secondary English style task: a short instruction with a theme, a title or a viewpoint, asking for a narrative, a descriptive or an argumentative piece" },
      { to: 15, reading: "a text of the kind used in Singapore upper secondary English (Secondary 3-4): a short text with a visual, a narrative or recount, and a non-narrative text, with questions on vocabulary in context, the effect of language and a summary of about 80 words in your own words", skill: "inference, the writer's purpose and tone, vocabulary in context, and the reference of words and phrases", writing: "a senior secondary task: either situational writing (250-350 words: an email, letter, report or speech built from a situation that includes a visual such as a poster, notice or chart, using the given information) or continuous writing (350-500 words, one of several topics, such as a narrative or an argument)" },
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
