// Mirrors the citations shown in the app's dashboard (see MASTERY_TARGETS_UK /
// MASTERY_TARGETS_US in app.html) so the LLM cites the same real standards the
// UI promises, rather than inventing its own. Keep these two in sync.

const CURRICULUM_LABEL = {
  "🇬🇧 United Kingdom": "UK National Curriculum / GCSE",
  "🇺🇸 United States": "Common Core State Standards / AP",
  "🇦🇺 Australia": "ACARA Curriculum Standards",
  "🇨🇦 Canada": "Provincial Language Arts Benchmarks",
  "🇦🇪 UAE & GCC Hubs": "Cambridge IGCSE & IB Primary/Middle Years",
  "🇸🇬 Singapore & SE Asia": "Cambridge Academic & IB Pathway",
  "🌐 Global ESL Mode": "CEFR Alignment: A1 Beginner to C2 Proficient",
};

// Only UK and US are mapped to real, individually-cited standards so far.
// Everything else must be told to stay generic rather than invent a fake code.
const MAPPED_STANDARDS = {
  "🇬🇧 United Kingdom": {
    early: ["Y1 statutory Writing PoS (sentence punctuation)", "Y2 statutory Writing PoS (expanded noun phrases)", "KS1 reading content domain 1d (inference)"],
    elementary: ["Y4 statutory English App. 2 (fronted adverbials)", "Y6 statutory English App. 2 (modal verbs)", "KS2 reading content domain 2d (inference & justification)"],
    middle: ["KS3 Programme of Study aims (rhetorical awareness, summarising, fluent writing)"],
    high: ["AQA GCSE English Language AO2 (language analysis)", "AO3 (comparing perspectives)", "AO5 (viewpoint writing)", "AO6 (technical accuracy)"],
  },
  "🇺🇸 United States": {
    early: ["CCSS.ELA-LITERACY.W.1.1 (opinion writing)", "CCSS.ELA-LITERACY.L.1.1 (conjunctions)", "CCSS.ELA-LITERACY.RI.1.1/RL.1.1 (key details)"],
    elementary: ["CCSS.ELA-LITERACY.L.4.1.c (modal auxiliaries)", "CCSS.ELA-LITERACY.W.4.1 (opinion writing & organization)", "CCSS.ELA-LITERACY.RL.4.1/RI.4.1 (inference)"],
    middle: ["CCSS.ELA-LITERACY.W.6.1 (argument writing)", "CCSS.ELA-LITERACY.RL.6.1/RI.6.1 (citing textual evidence)", "CCSS.ELA-LITERACY.W.8.1 (claims vs. counterclaims)"],
    high: ["CCSS.ELA-LITERACY.W.9-10.1 (precise claims)", "AP English Language Big Idea: Style", "AP English Language Big Idea: Reasoning and Organization"],
  },
};

function curriculumLabel(country) {
  return CURRICULUM_LABEL[country] || "this region's general literacy expectations";
}

function standardsFor(country, tier) {
  const mapped = MAPPED_STANDARDS[country];
  if (mapped && mapped[tier]) return mapped[tier];
  return null; // signals "not yet mapped — stay generic, do not invent a code"
}

module.exports = { curriculumLabel, standardsFor, CURRICULUM_LABEL };
