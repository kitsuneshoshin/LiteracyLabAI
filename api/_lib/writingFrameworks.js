// Named writing frameworks taught alongside feedback, one per tier. These
// are widely-taught pedagogical techniques (not curriculum standards - see
// masteryTargets.js for those), so the name and description are fixed here
// rather than left to the model: a hallucinated definition of "PEEL" would
// actively mis-teach a parent, whereas the worked example (prompt.js) is the
// one part that genuinely benefits from being generated fresh per student.
//
// Chosen per tier to match the writing this age actually produces
// (WRITING_EXERCISE_TYPE in prompt.js): early/elementary write stories, so
// they get a descriptive technique and a narrative-structure technique;
// middle/high write analytical/persuasive pieces, so they get the two
// standard evidence-based paragraph frameworks used for that genre.
const FRAMEWORK_BY_TIER = {
  early: {
    name: "Show, Don't Tell",
    genre: "descriptive",
    description: "Instead of naming a feeling or fact, describe what a reader would see, hear, or feel that proves it — \"her hands were shaking\" instead of \"she was scared\".",
  },
  elementary: {
    name: "Story Mountain",
    genre: "narrative",
    description: "A story's shape: Opening (introduce who and where), Build-up (something starts to happen), Climax (the most exciting or tense moment), Resolution (it gets sorted out), Ending (how things settle).",
  },
  middle: {
    name: "PEEL",
    genre: "analytical",
    description: "A paragraph that proves a point: Point (state it), Evidence (a quote or detail that backs it up), Explain (say what the evidence shows), Link (connect back to the question or the next idea).",
  },
  high: {
    name: "PEAL",
    genre: "persuasive",
    description: "PEEL's more advanced sibling for extended essays: Point, Evidence, Analysis (not just what the evidence shows, but why the writer chose it and what effect it creates), Link.",
  },
};

function frameworkForTier(tier) {
  return FRAMEWORK_BY_TIER[tier] || null;
}

module.exports = { FRAMEWORK_BY_TIER, frameworkForTier };
