// Mirrors the citations shown in the app's dashboard so the LLM cites the
// same real standards the UI promises, rather than inventing its own.
// masteryTargets.js is the single source of truth for the standards
// themselves — this file just formats them for the prompt.

const { targetsFor, isMappedCountry } = require("./masteryTargets");

const CURRICULUM_LABEL = {
  "🇬🇧 United Kingdom": "UK National Curriculum / GCSE",
  "🇺🇸 United States": "Common Core State Standards / AP",
  "🇦🇺 Australia": "Australian Curriculum v9.0 (ACARA)",
  "🇨🇦 Canada": "Provincial Language Arts Benchmarks",
  "🇦🇪 UAE & GCC Hubs": "Cambridge IGCSE & IB Primary/Middle Years",
  "🇸🇬 Singapore & SE Asia": "Cambridge Academic & IB Pathway",
  "🌐 Global ESL Mode": "CEFR Alignment: A1 Beginner to C2 Proficient",
};

function curriculumLabel(country) {
  return CURRICULUM_LABEL[country] || "this region's general literacy expectations";
}

// Only UK, US and Australia are mapped to real, individually-cited
// standards so far. Everything else must be told to stay generic rather
// than invent a fake code — returning null signals exactly that.
function standardsFor(country, tier) {
  if (!isMappedCountry(country)) return null;
  return targetsFor(country, tier).map((t) => `${t.name} (${t.standard})`);
}

module.exports = { curriculumLabel, standardsFor, CURRICULUM_LABEL };
