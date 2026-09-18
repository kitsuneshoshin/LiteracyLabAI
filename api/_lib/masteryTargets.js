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
    { name: "Modal Verbs", standard: "Y6 statutory · English App. 2" },
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
  return Boolean(MAPPED_TARGETS[country]);
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

// Countries mapped at individual-year granularity. Anything not listed
// here still works via targetsFor()'s tier-level buckets — this is an
// additive, per-country upgrade, not a replacement.
const GRADE_MAPPED_TARGETS = {
  "🇦🇺 Australia": MASTERY_TARGETS_AU_BY_GRADE,
};

// The precise version of targetsFor(): resolves to the exact grade/year
// when that country has been mapped at that granularity, and reports when
// it had to anchor to a nearby real year instead of the one asked for
// (e.g. AU Year 11/12 -> Year 10) so the UI can be honest about it.
function targetsForGrade(country, gradeLabel, tier) {
  const byGrade = GRADE_MAPPED_TARGETS[country];
  if (byGrade) {
    if (byGrade[gradeLabel]) return { targets: byGrade[gradeLabel], grain: "grade", approximatedFrom: null };
    const keys = Object.keys(byGrade);
    const last = keys[keys.length - 1];
    return { targets: byGrade[last], grain: "grade", approximatedFrom: last };
  }
  return { targets: targetsFor(country, tier), grain: "tier", approximatedFrom: null };
}

module.exports = {
  MASTERY_TARGETS_UK, MASTERY_TARGETS_US, MASTERY_TARGETS_AU, MASTERY_TARGETS_GENERIC,
  MASTERY_TARGETS_AU_BY_GRADE, GRADE_MAPPED_TARGETS,
  MAPPED_TARGETS, isMappedCountry, targetsFor, targetsForGrade,
};
