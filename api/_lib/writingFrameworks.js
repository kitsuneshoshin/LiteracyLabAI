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
    parts: [["Show", "A detail the reader can see, hear or feel that proves the feeling or fact, instead of just naming it."]],
    description: "Instead of naming a feeling or fact, describe what a reader would see, hear, or feel that proves it — \"her hands were shaking\" instead of \"she was scared\".",
  },
  narrative: {
    name: "Story Mountain",
    parts: [["Opening", "Introduces who and where."], ["Build-up", "Something starts to happen."], ["Climax", "The most exciting or tense moment."], ["Resolution", "It gets sorted out."], ["Ending", "How things settle."]],
    description: "A story's shape: Opening (introduce who and where), Build-up (something starts to happen), Climax (the most exciting or tense moment), Resolution (it gets sorted out), Ending (how things settle).",
  },
  analytical: {
    name: "PEEL",
    parts: [["Point", "States the point."], ["Evidence", "A quote or detail that backs it up."], ["Explain", "Says what the evidence shows."], ["Link", "Connects back to the question or the next idea."]],
    description: "A paragraph that proves a point: Point (state it), Evidence (a quote or detail that backs it up), Explain (say what the evidence shows), Link (connect back to the question or the next idea).",
  },
  persuasive: {
    name: "PEAL",
    parts: [["Point", "States the argument."], ["Evidence", "A fact, quote or example that backs it up."], ["Analysis", "Explains why that evidence matters and its effect."], ["Link", "Ties back to the question or the overall argument."]],
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

// The named parts of a framework, as [{ name, meaning }].
function frameworkParts(fw) {
  return fw && Array.isArray(fw.parts) ? fw.parts.map(([name, meaning]) => ({ name, meaning })) : [];
}

// Age-appropriate versions of a genre's framework. The names and parts are fixed here, like the
// main table, so a model can never invent a definition. Anything not listed uses the table above.
const FRAMEWORK_VARIANTS = {
  early: {
    descriptive: {
      name: "Use Your Senses",
      description: "Describe what you can see, hear and feel so the reader can picture it: See (what it looks like), Hear (what it sounds like), Feel (how it feels to touch, or how you feel).",
      parts: [["See", "What it looks like."], ["Hear", "What it sounds like."], ["Feel", "How it feels to touch, or how you feel."]],
    },
    narrative: {
      name: "Beginning, Middle, End",
      description: "A story has three parts: Beginning (who and where), Middle (what happens) and End (how it finishes).",
      parts: [["Beginning", "Who and where."], ["Middle", "What happens."], ["End", "How it finishes."]],
    },
    persuasive: {
      name: "Opinion and Reason",
      description: "Say what you think and why: Opinion (what you think) and Reason (why you think it, using the word because).",
      parts: [["Opinion", "What you think."], ["Reason", "Why you think it, using because."]],
    },
  },
  elementary: {
    persuasive: {
      name: "OREO",
      description: "An opinion paragraph: Opinion (say what you think), Reason (why), Example (a fact or example that backs the reason) and Restate (finish by saying your opinion again in new words).",
      parts: [["Opinion", "Says what you think."], ["Reason", "Says why."], ["Example", "A fact or example that backs the reason."], ["Restate", "Says the opinion again in new words."]],
    },
  },
};

function frameworkForGenre(genre, tier) {
  const variant = tier && FRAMEWORK_VARIANTS[tier] && FRAMEWORK_VARIANTS[tier][genre];
  return variant || FRAMEWORK_BY_GENRE[genre] || null;
}

// The framework for this piece: its genre (or the tier's default), in the form that suits the age.
function frameworkFor(genre, tier) {
  return frameworkForGenre(resolveGenre(genre, tier), tier);
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
  return frameworkForGenre(DEFAULT_GENRE_BY_TIER[tier], tier);
}

module.exports = { frameworkFor, FRAMEWORK_VARIANTS, frameworkParts, FRAMEWORK_BY_GENRE, VALID_GENRES, DEFAULT_GENRE_BY_TIER, frameworkForGenre, resolveGenre, frameworkForTier };
