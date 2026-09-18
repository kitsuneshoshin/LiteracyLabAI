// Canonical curriculum mastery targets — the single source of truth for
// (a) what the AI is told it may cite/tag feedback against (see prompt.js),
// (b) the real per-target mastery computed from submission history
// (see progress.js), and (c) the demo-mode static fallback shown in
// app.html when no backend is configured (kept in sync by hand, same as
// curriculum.js already notes).

const MASTERY_TARGETS_UK = {
  early: [
    { name: "Sentence Punctuation", standard: "Y1 statutory · Writing PoS" },
    { name: "Expanded Noun Phrases", standard: "Y2 statutory · Writing PoS" },
    { name: "Inference From the Text", standard: "Content domain 1d · KS1 reading" },
  ],
  elementary: [
    { name: "Fronted Adverbials", standard: "Y4 statutory · English App. 2" },
    { name: "Modal Verbs", standard: "Y5 statutory · English App. 2" },
    { name: "Inference & Justification", standard: "Content domain 2d · KS2 reading" },
    { name: "Cohesion Across Paragraphs", standard: "Y5-6 statutory · English App. 2" },
  ],
  middle: [
    { name: "Rhetorical Awareness", standard: "KS3 Programme of Study aim" },
    { name: "Summarising & Organising Ideas", standard: "KS3 Programme of Study aim" },
    { name: "Inference & Textual Evidence", standard: "KS3 reading aim" },
    { name: "Accurate, Fluent Writing", standard: "KS3 Programme of Study aim" },
  ],
  high: [
    { name: "Viewpoint & Argument Writing", standard: "AQA GCSE English Language · AO5" },
    { name: "Analysing Language for Effect", standard: "AQA GCSE English Language · AO2" },
    { name: "Comparing Writers' Perspectives", standard: "AQA GCSE English Language · AO3" },
    { name: "Technical Accuracy", standard: "AQA GCSE English Language · AO6" },
  ],
};

const MASTERY_TARGETS_US = {
  early: [
    { name: "Opinion Writing With Reasons", standard: "CCSS.ELA-LITERACY.W.1.1" },
    { name: "Frequently Occurring Conjunctions", standard: "CCSS.ELA-LITERACY.L.1.1" },
    { name: "Answering Questions About Key Details", standard: "CCSS.ELA-LITERACY.RI.1.1 / RL.1.1" },
  ],
  elementary: [
    { name: "Modal Auxiliaries", standard: "CCSS.ELA-LITERACY.L.4.1.c" },
    { name: "Opinion Writing & Organization", standard: "CCSS.ELA-LITERACY.W.4.1" },
    { name: "Inference From the Text", standard: "CCSS.ELA-LITERACY.RL.4.1 / RI.4.1" },
  ],
  middle: [
    { name: "Argument Writing", standard: "CCSS.ELA-LITERACY.W.6.1" },
    { name: "Citing Textual Evidence", standard: "CCSS.ELA-LITERACY.RL.6.1 / RI.6.1" },
    { name: "Claims vs. Counterclaims", standard: "CCSS.ELA-LITERACY.W.8.1" },
  ],
  high: [
    { name: "Precise Claims", standard: "CCSS.ELA-LITERACY.W.9-10.1" },
    { name: "Stylistic Control", standard: "AP English Language Big Idea: Style" },
    { name: "Reasoning & Organization", standard: "AP English Language Big Idea: Reasoning and Organization" },
  ],
};

// Verified directly against the live v9 Australian Curriculum content
// descriptors at australiancurriculum.edu.au (Foundation, Year 2, Year 4,
// Year 7 and Year 10 — the closest single-year snapshot to each app tier).
// Years 11-12 aren't set by ACARA; they're state/territory senior-secondary
// syllabuses (e.g. NSW HSC, VCE Study Designs), so "high" is anchored to
// Year 10, the last nationally common year, rather than a fabricated code —
// the same honesty rule already applied to the UK's KS3.
const MASTERY_TARGETS_AU = {
  early: [
    { name: "Sentence Boundary Punctuation", standard: "AC9E2LY06 · Year 2 Literacy" },
    { name: "Compound Sentences", standard: "AC9E2LA06 · Year 2 Language" },
    { name: "Literal & Inferred Meaning", standard: "AC9E2LY05 · Year 2 Literacy" },
  ],
  elementary: [
    { name: "Complex Sentences", standard: "AC9E4LA06 · Year 4 Language" },
    { name: "Planning & Editing Texts", standard: "AC9E4LY06 · Year 4 Literacy" },
    { name: "Comprehension Strategies", standard: "AC9E4LY05 · Year 4 Literacy" },
  ],
  middle: [
    { name: "Complex & Compound-Complex Sentences", standard: "AC9E7LA05 · Year 7 Language" },
    { name: "Structuring Texts With Literary Devices", standard: "AC9E7LY06 · Year 7 Literacy" },
    { name: "Analysing & Summarising Information", standard: "AC9E7LY05 · Year 7 Literacy" },
  ],
  high: [
    { name: "Evaluating Sentence Structure", standard: "AC9E10LA05 · Year 10 Language" },
    { name: "Analytical & Persuasive Writing", standard: "AC9E10LY06 · Year 10 Literacy" },
    { name: "Interpreting Complex & Abstract Ideas", standard: "AC9E10LY05 · Year 10 Literacy" },
  ],
};

// Illustrative skill categories (no citable national standard) for regions
// not yet individually mapped — Canada, UAE/GCC, Singapore/SE Asia, Global
// ESL. Real per-student mastery is still computed from submission history;
// only the standard citation is a placeholder here.
const MASTERY_TARGETS_GENERIC = {
  early: [
    { name: "Phonics Blending", standard: null },
    { name: "Sight-Word Recognition", standard: null },
    { name: "Capitals & Full Stops", standard: null },
  ],
  elementary: [
    { name: "Fronted Adverbials", standard: null },
    { name: "Paragraph Structure", standard: null },
    { name: "Descriptive Adjectives", standard: null },
    { name: "Speech Punctuation", standard: null },
  ],
  middle: [
    { name: "Modal Verbs", standard: null },
    { name: "Inference & Evidence", standard: null },
    { name: "Essay Structure (PEEL)", standard: null },
    { name: "Cohesive Devices", standard: null },
  ],
  high: [
    { name: "Thesis Construction", standard: null },
    { name: "Rhetorical Devices", standard: null },
    { name: "Argumentative Structure", standard: null },
    { name: "Exam Technique & Timing", standard: null },
  ],
};

const MAPPED_TARGETS = {
  "🇬🇧 United Kingdom": MASTERY_TARGETS_UK,
  "🇺🇸 United States": MASTERY_TARGETS_US,
  "🇦🇺 Australia": MASTERY_TARGETS_AU,
};

function isMappedCountry(country) {
  return Boolean(MAPPED_TARGETS[country]) || Boolean(GRADE_MAPPED_TARGETS[country]);
}

function targetsFor(country, tier) {
  const mapped = MAPPED_TARGETS[country];
  if (mapped && mapped[tier]) return mapped[tier];
  return MASTERY_TARGETS_GENERIC[tier] || [];
}

// Full per-year Australian Curriculum v9.0 mapping — every code below was
// read directly off the live content descriptors at
// australiancurriculum.edu.au for that exact year level (Foundation
// through Year 10), not inferred from a neighbouring year. Years 11-12
// aren't set by ACARA at all (they're state/territory senior-secondary
// syllabuses — NSW HSC, VCE, etc.), so those two years fall back to Year
// 10, the closest real, citable anchor, rather than a fabricated code.
const MASTERY_TARGETS_AU_BY_GRADE = {
  "Foundation": [
    { name: "Punctuation & Capital Letters", standard: "AC9EFLA09 · Foundation Language" },
    { name: "Creating Short Written Texts", standard: "AC9EFLY06 · Foundation Literacy" },
    { name: "Comprehension Strategies", standard: "AC9EFLY05 · Foundation Literacy" },
  ],
  "Year 1": [
    { name: "Simple Sentences", standard: "AC9E1LA06 · Year 1 Language" },
    { name: "Creating & Editing Short Texts", standard: "AC9E1LY06 · Year 1 Literacy" },
    { name: "Comprehension Strategies", standard: "AC9E1LY05 · Year 1 Literacy" },
  ],
  "Year 2": [
    { name: "Compound Sentences", standard: "AC9E2LA06 · Year 2 Language" },
    { name: "Creating & Editing Texts", standard: "AC9E2LY06 · Year 2 Literacy" },
    { name: "Comprehension Strategies", standard: "AC9E2LY05 · Year 2 Literacy" },
  ],
  "Year 3": [
    { name: "Clauses & Subject-Verb Agreement", standard: "AC9E3LA06 · Year 3 Language" },
    { name: "Planning & Publishing Texts", standard: "AC9E3LY06 · Year 3 Literacy" },
    { name: "Comprehension Strategies", standard: "AC9E3LY05 · Year 3 Literacy" },
  ],
  "Year 4": [
    { name: "Complex Sentences", standard: "AC9E4LA06 · Year 4 Language" },
    { name: "Planning, Editing & Publishing Texts", standard: "AC9E4LY06 · Year 4 Literacy" },
    { name: "Comprehension Strategies", standard: "AC9E4LY05 · Year 4 Literacy" },
  ],
  "Year 5": [
    { name: "Complex Sentences for Effect", standard: "AC9E5LA05 · Year 5 Language" },
    { name: "Planning, Editing & Publishing Texts", standard: "AC9E5LY06 · Year 5 Literacy" },
    { name: "Comprehension Strategies", standard: "AC9E5LY05 · Year 5 Literacy" },
  ],
  "Year 6": [
    { name: "Embedded Clauses", standard: "AC9E6LA05 · Year 6 Language" },
    { name: "Planning, Editing & Publishing Texts", standard: "AC9E6LY06 · Year 6 Literacy" },
    { name: "Comprehension Strategies", standard: "AC9E6LY05 · Year 6 Literacy" },
  ],
  "Year 7": [
    { name: "Complex & Compound-Complex Sentences", standard: "AC9E7LA05 · Year 7 Language" },
    { name: "Structuring Texts With Literary Devices", standard: "AC9E7LY06 · Year 7 Literacy" },
    { name: "Analysing & Summarising Information", standard: "AC9E7LY05 · Year 7 Literacy" },
  ],
  "Year 8": [
    { name: "Embedded Clauses That Expand Ideas", standard: "AC9E8LA05 · Year 8 Language" },
    { name: "Organising & Selecting Text Structures", standard: "AC9E8LY06 · Year 8 Literacy" },
    { name: "Interpreting & Evaluating Ideas", standard: "AC9E8LY05 · Year 8 Literacy" },
  ],
  "Year 9": [
    { name: "Varying Sentence Structure for Effect", standard: "AC9E9LA05 · Year 9 Language" },
    { name: "Organising & Developing Ideas", standard: "AC9E9LY06 · Year 9 Literacy" },
    { name: "Comparing & Contrasting Ideas", standard: "AC9E9LY05 · Year 9 Literacy" },
  ],
  "Year 10": [
    { name: "Evaluating Sentence Structure", standard: "AC9E10LA05 · Year 10 Language" },
    { name: "Analytical & Persuasive Writing", standard: "AC9E10LY06 · Year 10 Literacy" },
    { name: "Interpreting Complex & Abstract Ideas", standard: "AC9E10LY05 · Year 10 Literacy" },
  ],
};

// Full per-year UK National Curriculum in England mapping. Grammar/language
// items are read directly from English Appendix 2 (assets.publishing.
// service.gov.uk), which — unlike the narrative programme of study — genuinely
// does list separate statutory content for each of Year 1 through Year 6
// individually. Writing-composition and reading-comprehension citations are
// NOT split further than the source itself splits them: the DfE's own
// document states "programmes of study for English are set out year-by-year
// for key stage 1 and two-yearly for key stage 2" — so Years 3-4 share one
// programme and Years 5-6 share another for those two rows, honestly labelled
// as a band rather than invented as single-year content. Key stage 3 (Years
// 7-9) has no year-by-year breakdown in the National Curriculum at all — it's
// broad aims only — so those three years continue to share one entry, same
// as before. Key stage 4 (Years 10-11) is a single 2-year GCSE course, so
// AQA's Assessment Objectives apply to both years equally.
const MASTERY_TARGETS_UK_BY_GRADE = {
  "Year 1": [
    { name: "Joining Clauses With 'and'", standard: "Y1 statutory · English App. 2" },
    { name: "Sequencing Sentences Into Narratives", standard: "Y1 statutory · Writing composition PoS" },
    { name: "Making Inferences From the Text", standard: "Y1 statutory · Reading comprehension PoS" },
  ],
  "Year 2": [
    { name: "Subordination & Co-ordination", standard: "Y2 statutory · English App. 2" },
    { name: "Planning & Revising Writing", standard: "Y2 statutory · Writing composition PoS" },
    { name: "Answering & Asking Questions About a Text", standard: "Y2 statutory · Reading comprehension PoS" },
  ],
  "Year 3": [
    { name: "Time, Place & Cause Conjunctions", standard: "Y3 statutory · English App. 2" },
    { name: "Organising Paragraphs Around a Theme", standard: "Years 3-4 statutory · Writing composition PoS" },
    { name: "Drawing Inferences With Evidence", standard: "Years 3-4 statutory · Reading comprehension PoS" },
  ],
  "Year 4": [
    { name: "Fronted Adverbials", standard: "Y4 statutory · English App. 2" },
    { name: "Organising Paragraphs Around a Theme", standard: "Years 3-4 statutory · Writing composition PoS" },
    { name: "Drawing Inferences With Evidence", standard: "Years 3-4 statutory · Reading comprehension PoS" },
  ],
  "Year 5": [
    { name: "Modal Verbs & Relative Clauses", standard: "Y5 statutory · English App. 2" },
    { name: "Building Cohesion Across Paragraphs", standard: "Years 5-6 statutory · Writing composition PoS" },
    { name: "Summarising Main Ideas", standard: "Years 5-6 statutory · Reading comprehension PoS" },
  ],
  "Year 6": [
    { name: "Passive Voice & Formal Register", standard: "Y6 statutory · English App. 2" },
    { name: "Building Cohesion Across Paragraphs", standard: "Years 5-6 statutory · Writing composition PoS" },
    { name: "Summarising Main Ideas", standard: "Years 5-6 statutory · Reading comprehension PoS" },
  ],
  "Year 7": MASTERY_TARGETS_UK.middle,
  "Year 8": MASTERY_TARGETS_UK.middle,
  "Year 9": MASTERY_TARGETS_UK.middle,
  "Year 10": MASTERY_TARGETS_UK.high,
  "Year 11": MASTERY_TARGETS_UK.high,
};

// Full per-grade Common Core (CCSS) mapping. Unlike the UK/AU curricula,
// CCSS was designed with a distinct code for every single grade K-8 — no
// banding needed there. Grades 9-10 and 11-12 genuinely ARE banded pairs in
// the official CCSS documents themselves (thecorestandards.org), not a
// limitation of this mapping, so those four years honestly share two lists.
const MASTERY_TARGETS_US_BY_GRADE = {
  "Kindergarten": [
    { name: "Conventions of Standard English", standard: "CCSS.ELA-LITERACY.L.K.1" },
    { name: "Opinion Pieces", standard: "CCSS.ELA-LITERACY.W.K.1" },
    { name: "Answering Questions About Key Details", standard: "CCSS.ELA-LITERACY.RL.K.1 / RI.K.1" },
  ],
  "Grade 1": [
    { name: "Frequently Occurring Conjunctions", standard: "CCSS.ELA-LITERACY.L.1.1" },
    { name: "Opinion Writing With Reasons", standard: "CCSS.ELA-LITERACY.W.1.1" },
    { name: "Answering Questions About Key Details", standard: "CCSS.ELA-LITERACY.RI.1.1 / RL.1.1" },
  ],
  "Grade 2": [
    { name: "Compound Sentences & Irregular Plurals", standard: "CCSS.ELA-LITERACY.L.2.1" },
    { name: "Opinion Writing With Supporting Reasons", standard: "CCSS.ELA-LITERACY.W.2.1" },
    { name: "Answering Who/What/Where/When/Why/How Questions", standard: "CCSS.ELA-LITERACY.RI.2.1 / RL.2.1" },
  ],
  "Grade 3": [
    { name: "Simple, Compound & Complex Sentences", standard: "CCSS.ELA-LITERACY.L.3.1" },
    { name: "Opinion Writing With Linking Words", standard: "CCSS.ELA-LITERACY.W.3.1" },
    { name: "Referring Explicitly to the Text", standard: "CCSS.ELA-LITERACY.RL.3.1 / RI.3.1" },
  ],
  "Grade 4": [
    { name: "Modal Auxiliaries", standard: "CCSS.ELA-LITERACY.L.4.1.c" },
    { name: "Opinion Writing & Organization", standard: "CCSS.ELA-LITERACY.W.4.1" },
    { name: "Inference From the Text", standard: "CCSS.ELA-LITERACY.RL.4.1 / RI.4.1" },
  ],
  "Grade 5": [
    { name: "Correlative Conjunctions", standard: "CCSS.ELA-LITERACY.L.5.1" },
    { name: "Opinion Writing With Logically Ordered Reasons", standard: "CCSS.ELA-LITERACY.W.5.1" },
    { name: "Quoting Accurately When Explaining the Text", standard: "CCSS.ELA-LITERACY.RL.5.1 / RI.5.1" },
  ],
  "Grade 6": [
    { name: "Pronoun Case & Sentence Variety", standard: "CCSS.ELA-LITERACY.L.6.1" },
    { name: "Argument Writing", standard: "CCSS.ELA-LITERACY.W.6.1" },
    { name: "Citing Textual Evidence", standard: "CCSS.ELA-LITERACY.RL.6.1 / RI.6.1" },
  ],
  "Grade 7": [
    { name: "Phrase & Clause Function in Sentences", standard: "CCSS.ELA-LITERACY.L.7.1" },
    { name: "Argument Writing With Relevant Evidence", standard: "CCSS.ELA-LITERACY.W.7.1" },
    { name: "Citing Several Pieces of Textual Evidence", standard: "CCSS.ELA-LITERACY.RL.7.1 / RI.7.1" },
  ],
  "Grade 8": [
    { name: "Verbals & Active/Passive Voice", standard: "CCSS.ELA-LITERACY.L.8.1" },
    { name: "Claims vs. Counterclaims", standard: "CCSS.ELA-LITERACY.W.8.1" },
    { name: "Citing the Strongest Textual Evidence", standard: "CCSS.ELA-LITERACY.RL.8.1 / RI.8.1" },
  ],
  "Grade 9": [
    { name: "Parallel Structure & Sentence Variety", standard: "CCSS.ELA-LITERACY.L.9-10.1" },
    { name: "Precise Claims", standard: "CCSS.ELA-LITERACY.W.9-10.1" },
    { name: "Citing Strong & Thorough Textual Evidence", standard: "CCSS.ELA-LITERACY.RL.9-10.1 / RI.9-10.1" },
  ],
  "Grade 10": [
    { name: "Parallel Structure & Sentence Variety", standard: "CCSS.ELA-LITERACY.L.9-10.1" },
    { name: "Precise Claims", standard: "CCSS.ELA-LITERACY.W.9-10.1" },
    { name: "Citing Strong & Thorough Textual Evidence", standard: "CCSS.ELA-LITERACY.RL.9-10.1 / RI.9-10.1" },
  ],
  "Grade 11": [
    { name: "Resolving Usage Issues", standard: "CCSS.ELA-LITERACY.L.11-12.1" },
    { name: "Precise, Knowledgeable Claims", standard: "CCSS.ELA-LITERACY.W.11-12.1" },
    { name: "Citing Evidence Where the Text Is Ambiguous", standard: "CCSS.ELA-LITERACY.RL.11-12.1 / RI.11-12.1" },
  ],
  "Grade 12": [
    { name: "Resolving Usage Issues", standard: "CCSS.ELA-LITERACY.L.11-12.1" },
    { name: "Precise, Knowledgeable Claims", standard: "CCSS.ELA-LITERACY.W.11-12.1" },
    { name: "Citing Evidence Where the Text Is Ambiguous", standard: "CCSS.ELA-LITERACY.RL.11-12.1 / RI.11-12.1" },
  ],
};

// Full per-grade Ontario "Language" curriculum (2023) mapping, chosen as
// Canada's reference since there is no single national curriculum body —
// same approach as picking AQA for UK GCSE or mainstream CCSS for the US.
// Overall-expectation codes B1-B3 (Foundations of Language), C1-C3
// (Comprehension) and D1-D3 (Composition) are confirmed live at
// dcp.edu.gov.on.ca/en/curriculum/elementary-language — they apply
// identically at every grade 1-8, with grade-specific content underneath
// each one, so citing "B3 · Grade X" is honest precision, not a fabricated
// sub-number I never verified. Grades 9-12 use Ontario's real course codes
// (ENL1W for the 2023 de-streamed Grade 9 course; ENG2D/ENG3U/ENG4U for
// Grades 10-12, still on the 2007 curriculum per the Ministry's own site) —
// cited at the strand level only, since this mapping doesn't verify their
// internal numbering the way it did for the elementary strands.
const MASTERY_TARGETS_CA_BY_GRADE = {
  "Grade 1": [
    { name: "Language Conventions", standard: "B3 · Grade 1 Language" },
    { name: "Developing & Organizing Ideas", standard: "D1 · Grade 1 Language" },
    { name: "Comprehension Strategies", standard: "C2 · Grade 1 Language" },
  ],
  "Grade 2": [
    { name: "Language Conventions", standard: "B3 · Grade 2 Language" },
    { name: "Developing & Organizing Ideas", standard: "D1 · Grade 2 Language" },
    { name: "Comprehension Strategies", standard: "C2 · Grade 2 Language" },
  ],
  "Grade 3": [
    { name: "Language Conventions", standard: "B3 · Grade 3 Language" },
    { name: "Developing & Organizing Ideas", standard: "D1 · Grade 3 Language" },
    { name: "Comprehension Strategies", standard: "C2 · Grade 3 Language" },
  ],
  "Grade 4": [
    { name: "Language Conventions", standard: "B3 · Grade 4 Language" },
    { name: "Developing & Organizing Ideas", standard: "D1 · Grade 4 Language" },
    { name: "Comprehension Strategies", standard: "C2 · Grade 4 Language" },
  ],
  "Grade 5": [
    { name: "Language Conventions", standard: "B3 · Grade 5 Language" },
    { name: "Developing & Organizing Ideas", standard: "D1 · Grade 5 Language" },
    { name: "Comprehension Strategies", standard: "C2 · Grade 5 Language" },
  ],
  "Grade 6": [
    { name: "Language Conventions", standard: "B3 · Grade 6 Language" },
    { name: "Developing & Organizing Ideas", standard: "D1 · Grade 6 Language" },
    { name: "Comprehension Strategies", standard: "C2 · Grade 6 Language" },
  ],
  "Grade 7": [
    { name: "Language Conventions", standard: "B3 · Grade 7 Language" },
    { name: "Developing & Organizing Ideas", standard: "D1 · Grade 7 Language" },
    { name: "Comprehension Strategies", standard: "C2 · Grade 7 Language" },
  ],
  "Grade 8": [
    { name: "Language Conventions", standard: "B3 · Grade 8 Language" },
    { name: "Developing & Organizing Ideas", standard: "D1 · Grade 8 Language" },
    { name: "Comprehension Strategies", standard: "C2 · Grade 8 Language" },
  ],
  "Grade 9": [
    { name: "Language Conventions", standard: "ENL1W · Writing" },
    { name: "Developing & Organizing Ideas", standard: "ENL1W · Writing" },
    { name: "Comprehension Strategies", standard: "ENL1W · Reading" },
  ],
  "Grade 10": [
    { name: "Language Conventions", standard: "ENG2D · Writing" },
    { name: "Organizing & Structuring Ideas", standard: "ENG2D · Writing" },
    { name: "Reading for Meaning", standard: "ENG2D · Reading and Literature Studies" },
  ],
  "Grade 11": [
    { name: "Language Conventions", standard: "ENG3U · Writing" },
    { name: "Organizing & Structuring Ideas", standard: "ENG3U · Writing" },
    { name: "Reading for Meaning", standard: "ENG3U · Reading and Literature Studies" },
  ],
  "Grade 12": [
    { name: "Language Conventions", standard: "ENG4U · Writing" },
    { name: "Organizing & Structuring Ideas", standard: "ENG4U · Writing" },
    { name: "Reading for Meaning", standard: "ENG4U · Reading and Literature Studies" },
  ],
};

// UAE/GCC and Singapore & SE Asia both use the same underlying Cambridge
// pathway in this app (Cambridge Primary -> Lower Secondary -> IGCSE ->
// AS/A Level or IB), just different local-grade labels — so one dataset is
// shared between them. The IGCSE Assessment Objectives (AO1 Reading R1-R5,
// AO2 Writing W1-W5) are confirmed consistently across Cambridge's own
// published syllabus and independent teacher resources. The Cambridge
// Primary/Lower Secondary numbered learning-objective codes (e.g. "4Rw1")
// could NOT be confirmed reliably from a clean primary source in this
// session — search results for them were internally inconsistent — so
// those earlier stages are cited at the real strand level (Reading /
// Writing strand of Cambridge Primary/Lower Secondary English) without a
// fabricated sub-code, rather than guessing at a specific number.
function cambridgePrimaryStage(n) {
  return [
    { name: "Reading Strand", standard: `Cambridge Primary English · Stage ${n} Reading` },
    { name: "Writing Strand", standard: `Cambridge Primary English · Stage ${n} Writing` },
    { name: "Comprehension", standard: `Cambridge Primary English · Stage ${n} Reading` },
  ];
}
function cambridgeLowerSecondaryStage(n) {
  return [
    { name: "Reading Strand", standard: `Cambridge Lower Secondary English · Stage ${n} Reading` },
    { name: "Writing Strand", standard: `Cambridge Lower Secondary English · Stage ${n} Writing` },
    { name: "Comprehension", standard: `Cambridge Lower Secondary English · Stage ${n} Reading` },
  ];
}
const IGCSE_TARGETS = [
  { name: "Understanding Implicit Meaning", standard: "IGCSE First Language English 0500 · AO1 Reading (R2)" },
  { name: "Organising Ideas for Effect", standard: "IGCSE First Language English 0500 · AO2 Writing (W2)" },
  { name: "Accurate Spelling, Punctuation & Grammar", standard: "IGCSE First Language English 0500 · AO2 Writing (W5)" },
];

const MASTERY_TARGETS_AE_BY_GRADE = {
  "Cambridge Primary 1": cambridgePrimaryStage(1),
  "Cambridge Primary 2": cambridgePrimaryStage(2),
  "Cambridge Primary 3": cambridgePrimaryStage(3),
  "Cambridge Primary 4": cambridgePrimaryStage(4),
  "Cambridge Primary 5": cambridgePrimaryStage(5),
  "Cambridge Primary 6": cambridgePrimaryStage(6),
  "Lower Secondary 7": cambridgeLowerSecondaryStage(7),
  "Lower Secondary 8": cambridgeLowerSecondaryStage(8),
  "Lower Secondary 9": cambridgeLowerSecondaryStage(9),
  "IGCSE Year 10": IGCSE_TARGETS,
  "IGCSE Year 11": IGCSE_TARGETS,
};

const MASTERY_TARGETS_SG_BY_GRADE = {
  "Primary 1": cambridgePrimaryStage(1),
  "Primary 2": cambridgePrimaryStage(2),
  "Primary 3": cambridgePrimaryStage(3),
  "Primary 4": cambridgePrimaryStage(4),
  "Primary 5": cambridgePrimaryStage(5),
  "Primary 6": cambridgePrimaryStage(6),
  "Secondary 1": cambridgeLowerSecondaryStage(7),
  "Secondary 2": cambridgeLowerSecondaryStage(8),
  "Secondary 3": cambridgeLowerSecondaryStage(9),
  "O-Level / IGCSE Yr 4": IGCSE_TARGETS,
  "O-Level / IGCSE Yr 5": IGCSE_TARGETS,
};

// Council of Europe CEFR self-assessment grid (coe.int) — the wording below
// is drawn directly from the published grid, not paraphrased from memory.
// This is the one region in the app where the grade labels ARE the levels,
// so there's no tier-vs-grade approximation needed at all.
const MASTERY_TARGETS_CEFR_BY_GRADE = {
  "A1 Beginner": [
    { name: "Understanding Familiar Words & Simple Sentences", standard: "CEFR A1 Reading" },
    { name: "Writing Short, Simple Messages", standard: "CEFR A1 Writing" },
    { name: "Filling in Forms With Personal Details", standard: "CEFR A1 Writing" },
  ],
  "A2 Elementary": [
    { name: "Finding Specific Information in Everyday Texts", standard: "CEFR A2 Reading" },
    { name: "Writing Short, Simple Notes & Messages", standard: "CEFR A2 Writing" },
    { name: "Understanding Short Personal Letters", standard: "CEFR A2 Reading" },
  ],
  "B1 Intermediate": [
    { name: "Understanding High-Frequency Everyday Language", standard: "CEFR B1 Reading" },
    { name: "Writing Simple Connected Text on Familiar Topics", standard: "CEFR B1 Writing" },
    { name: "Describing Experiences & Giving Reasons for Opinions", standard: "CEFR B1 Writing" },
  ],
  "B2 Upper-Intermediate": [
    { name: "Understanding Writers' Attitudes & Viewpoints", standard: "CEFR B2 Reading" },
    { name: "Writing Clear, Detailed Text on a Range of Subjects", standard: "CEFR B2 Writing" },
    { name: "Giving Reasons For & Against a Point of View", standard: "CEFR B2 Writing" },
  ],
  "C1 Advanced": [
    { name: "Understanding Long & Complex Texts", standard: "CEFR C1 Reading" },
    { name: "Expressing Points of View at Length", standard: "CEFR C1 Writing" },
    { name: "Writing About Complex Subjects Clearly", standard: "CEFR C1 Writing" },
  ],
  "C2 Proficient": [
    { name: "Reading Abstract & Structurally Complex Texts With Ease", standard: "CEFR C2 Reading" },
    { name: "Writing Clear, Smoothly Flowing Text in an Appropriate Style", standard: "CEFR C2 Writing" },
    { name: "Presenting a Case With Effective Logical Structure", standard: "CEFR C2 Writing" },
  ],
};

// Countries mapped at individual-year granularity. Anything not listed
// here still works via targetsFor()'s tier-level buckets — this is an
// additive, per-country upgrade, not a replacement.
const GRADE_MAPPED_TARGETS = {
  "🇦🇺 Australia": MASTERY_TARGETS_AU_BY_GRADE,
  "🇬🇧 United Kingdom": MASTERY_TARGETS_UK_BY_GRADE,
  "🇺🇸 United States": MASTERY_TARGETS_US_BY_GRADE,
  "🇨🇦 Canada": MASTERY_TARGETS_CA_BY_GRADE,
  "🇦🇪 UAE & GCC Hubs": MASTERY_TARGETS_AE_BY_GRADE,
  "🇸🇬 Singapore & SE Asia": MASTERY_TARGETS_SG_BY_GRADE,
  "🌐 Global ESL Mode": MASTERY_TARGETS_CEFR_BY_GRADE,
};

// Grades a country's own curriculum body doesn't set at all (Reception's
// EYFS framework is separate from the National Curriculum; senior years in
// AU and UK sixth form aren't nationally codified; Ontario's Kindergarten
// Program is a distinct non-strand-numbered document; UAE/Singapore's
// AS/A-Level and IB Diploma years use their own separate AO frameworks not
// yet mapped here) fall back to the nearest real, mapped year rather than
// a fabricated one. This map makes each fallback explicit instead of
// guessing from list order.
const GRADE_APPROXIMATIONS = {
  "🇦🇺 Australia": { "Year 11": "Year 10", "Year 12": "Year 10" },
  "🇬🇧 United Kingdom": { "Reception": "Year 1", "Year 12": "Year 11", "Year 13": "Year 11" },
  "🇨🇦 Canada": { "Kindergarten": "Grade 1" },
  "🇦🇪 UAE & GCC Hubs": { "AS Level (Yr 12)": "IGCSE Year 11", "A Level (Yr 13)": "IGCSE Year 11" },
  "🇸🇬 Singapore & SE Asia": { "IB Diploma Yr 1": "O-Level / IGCSE Yr 5", "IB Diploma Yr 2": "O-Level / IGCSE Yr 5" },
};

// The precise version of targetsFor(): resolves to the exact grade/year
// when that country has been mapped at that granularity, and reports when
// it had to anchor to a nearby real year instead of the one asked for
// (e.g. AU Year 11/12 -> Year 10) so the UI can be honest about it.
function targetsForGrade(country, gradeLabel, tier) {
  const byGrade = GRADE_MAPPED_TARGETS[country];
  if (byGrade) {
    if (byGrade[gradeLabel]) return { targets: byGrade[gradeLabel], grain: "grade", approximatedFrom: null };
    const alias = (GRADE_APPROXIMATIONS[country] || {})[gradeLabel];
    if (alias && byGrade[alias]) return { targets: byGrade[alias], grain: "grade", approximatedFrom: alias };
    const keys = Object.keys(byGrade);
    const last = keys[keys.length - 1];
    return { targets: byGrade[last], grain: "grade", approximatedFrom: last };
  }
  return { targets: targetsFor(country, tier), grain: "tier", approximatedFrom: null };
}

module.exports = {
  MASTERY_TARGETS_UK, MASTERY_TARGETS_US, MASTERY_TARGETS_AU, MASTERY_TARGETS_GENERIC,
  MASTERY_TARGETS_AU_BY_GRADE, MASTERY_TARGETS_UK_BY_GRADE, MASTERY_TARGETS_US_BY_GRADE,
  MASTERY_TARGETS_CA_BY_GRADE, MASTERY_TARGETS_AE_BY_GRADE, MASTERY_TARGETS_SG_BY_GRADE,
  MASTERY_TARGETS_CEFR_BY_GRADE,
  GRADE_MAPPED_TARGETS, GRADE_APPROXIMATIONS,
  MAPPED_TARGETS, isMappedCountry, targetsFor, targetsForGrade,
};
