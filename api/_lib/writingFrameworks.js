// Named writing frameworks taught alongside feedback, one per GENRE - not
// tier. Framework choice follows what a specific piece actually asked the
// student to write (see the "genre" field buildWritingPromptGenerator now
// returns, in prompt.js), not the student's age: a persuasive piece written
// by an early-tier student still gets PEAL, not Story Mountain, because
// Story Mountain has nothing to do with proving a point. These are
// widely-taught pedagogical techniques (not curriculum standards - see
// masteryTargets.js for those), so the name and description are fixed here
// rather than left to the model: a hallucinated definition of "PEEL" would
// actively mis-teach a parent, whereas the worked example (prompt.js) is the
// one part that genuinely benefits from being generated fresh per student.
const FRAMEWORK_BY_GENRE = {
  descriptive: {
    name: "Show, Don't Tell",
    description: "Instead of naming a feeling or fact, describe what a reader would see, hear, or feel that proves it — \"her hands were shaking\" instead of \"she was scared\".",
  },
  narrative: {
    name: "Story Mountain",
    description: "A story's shape: Opening (introduce who and where), Build-up (something starts to happen), Climax (the most exciting or tense moment), Resolution (it gets sorted out), Ending (how things settle).",
  },
  analytical: {
    name: "PEEL",
    description: "A paragraph that proves a point: Point (state it), Evidence (a quote or detail that backs it up), Explain (say what the evidence shows), Link (connect back to the question or the next idea).",
  },
  persuasive: {
    name: "PEAL",
    description: "A paragraph that argues a case: Point (state your argument), Evidence (a quote, fact or example that backs it up), Analysis (explain why that evidence matters and the effect it has - not just what it shows), Link (tie it back to the question or your overall argument).",
  },
};

const VALID_GENRES = Object.keys(FRAMEWORK_BY_GENRE);

// What genre each tier's writing exercise defaults to (see
// WRITING_EXERCISE_TYPE in prompt.js) - used to (a) tell the prompt
// generator what to aim for, and (b) as a safe fallback for a submission
// generated before "genre" existed on the record at all, or if the model
// ever omits/mistags it.
const DEFAULT_GENRE_BY_TIER = { early: "descriptive", elementary: "narrative", middle: "analytical", high: "persuasive" };

function frameworkForGenre(genre) {
  return FRAMEWORK_BY_GENRE[genre] || null;
}

// Resolves the genre that actually applies to this feedback call: the
// genre the prompt itself was tagged with (from buildWritingPromptGenerator,
// stored on the submission) if it's a real, recognised one, else the
// tier's default - covers submissions from before this field existed and
// guards against a mistagged/invented genre string reaching FRAMEWORK_BY_GENRE.
function resolveGenre(genre, tier) {
  if (genre && FRAMEWORK_BY_GENRE[genre]) return genre;
  return DEFAULT_GENRE_BY_TIER[tier] || null;
}

function frameworkForTier(tier) {
  return frameworkForGenre(DEFAULT_GENRE_BY_TIER[tier]);
}

module.exports = { FRAMEWORK_BY_GENRE, VALID_GENRES, DEFAULT_GENRE_BY_TIER, frameworkForGenre, resolveGenre, frameworkForTier };
