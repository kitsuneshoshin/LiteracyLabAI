// Mirrors the citations shown in the app's dashboard so the LLM cites the
// same real standards the UI promises, rather than inventing its own.
// masteryTargets.js is the single source of truth for the standards
// themselves — this file just formats them for the prompt.

const { targetsForGrade, isMappedCountry } = require("./masteryTargets");

const CURRICULUM_LABEL = {
  "🇬🇧 United Kingdom": "UK National Curriculum / GCSE",
  "🇺🇸 United States": "Common Core State Standards / AP",
  "🇦🇺 Australia": "Australian Curriculum v9.0 (ACARA)",
  "🇨🇦 Canada": "Ontario Curriculum (Language / English)",
  "🇦🇪 UAE & GCC Hubs": "Cambridge Primary/Lower Secondary English & IGCSE",
  "🇸🇬 Singapore & SE Asia": "Cambridge Primary/Lower Secondary English & IGCSE",
  "🌐 Global ESL Mode": "CEFR: Common European Framework of Reference",
};

function curriculumLabel(country) {
  return CURRICULUM_LABEL[country] || "this region's general literacy expectations";
}

// UK, US, Australia, Canada, UAE/GCC, Singapore and the Global ESL/CEFR
// mode are all mapped to real, individually-cited standards now (see
// masteryTargets.js for exactly how each was verified). Any country not
// listed there must be told to stay generic rather than invent a fake
// code — returning null signals exactly that.
// Pass gradeLabel when known (e.g. "Year 7") to get the exact-year
// citation instead of the coarser tier-level one.
function standardsFor(country, tier, gradeLabel) {
  if (!isMappedCountry(country)) return null;
  const { targets } = targetsForGrade(country, gradeLabel, tier);
  return targets.map((t) => `${t.name} (${t.standard})`);
}

module.exports = { curriculumLabel, standardsFor, CURRICULUM_LABEL };
