const { curriculumLabel, standardsFor } = require("./curriculum");
const { MAX_AVG_WORDS_PER_SENTENCE } = require("./validate");

const TIER_LABEL = { early: "Early Years (ages 5-7)", elementary: "Elementary (ages 8-10)", middle: "Middle School (ages 11-13)", high: "High School (ages 14-18)" };

const CONFIDENCE_NOTE = {
  starting: "This student marked themselves as just starting out and building confidence in this skill. Open the Glow with one extra sentence of genuine, specific encouragement before anything else — not generic praise, but something tied to what they actually did. Keep the Grow to exactly one plain, achievable step.",
  growing: "This student is getting there — steady, matter-of-fact encouragement is right, no need to over-praise. Give the Grow at exactly the difficulty it's written for; this is their zone of proximal development, not a stretch goal.",
  confident: "This student is already confident — treat them as capable of hearing direct, specific feedback without extra cushioning. After the main Grow, add one extra sentence offering a genuine stretch or extension of the same skill (a harder version of the same challenge) — a confident learner is under-served by a step they've already outgrown.",
};

const MOTIVATION_NOTE = {
  grades: "Their stated goal is school grades and exams — close the Grow by connecting it to what an examiner or grader would specifically reward.",
  enjoyment: "Their stated goal is personal enjoyment — close the Grow by connecting it to what makes the piece more fun or engaging to read, not exam performance.",
  competition: "Their stated goal is competition or test prep — close the Grow by connecting it to the kind of polish that separates a strong entry from a winning one.",
};

function standardsClause(country, tier, gradeLabel) {
  const standards = standardsFor(country, tier, gradeLabel);
  if (standards) {
    return `This region's curriculum for this tier is individually mapped to real standards. Cite ONE of these specific standards by name in the Glow, verbatim: ${standards.join(" | ")}. Do not invent a different code.`;
  }
  return `This region (${country}) has not yet been mapped to individual standard codes for this tier. Reference "${curriculumLabel(country)}" in general terms in the Glow — do NOT invent a specific standard code, grade-level number, or content-domain letter that hasn't been given to you.`;
}

// Tells the model which named skill areas it may tag the Glow/Grow against.
// Those tags (glowTarget/growTarget) are what the dashboard's mastery table
// is actually computed from later — see api/progress.js — so an exact,
// verbatim match to one of these names matters more than for free prose.
function targetsClause(targetNames) {
  return `You must also identify which ONE skill area from this list the Glow demonstrates a strength in, and which ONE (can be the same or different) the Grow is building towards. Use the EXACT name from this list, verbatim, character-for-character — do not paraphrase it: ${targetNames.map((n) => `"${n}"`).join(", ")}.`;
}

// Tells the model to also return short exact quotes from the student's own
// text, tagged glow/grow, so the UI can highlight directly in their writing
// where each point applies — instead of prose feedback the student has to
// manually map back onto what they wrote. Every "grow" highlight also gets
// a "revision": the same fragment actually rewritten to apply the
// suggestion, not just described in the abstract — showing a student
// exactly what "add more sentence variety" looks like IN THEIR OWN SENTENCE
// is what makes the advice concrete and actionable rather than generic.
function highlightsClause() {
  return `You must also return 2-5 "highlights": short fragments copied EXACTLY, character-for-character (including any spelling or grammar mistakes — do not correct them), from the student's submitted text above. Each one is tagged "glow" (something that worked) or "grow" (something to improve), with a short note explaining why.
For every "grow" highlight, also include a "revision" field: rewrite that exact fragment to actually apply the suggested improvement, in language this student would plausibly write themselves (same vocabulary level, same voice) — not a generic example, a rewrite of THEIR sentence. Omit "revision" entirely for "glow" highlights (there's nothing to fix).
IMPORTANT: "revision" is spliced into the story in place of "quote" and NOTHING else — everything immediately before and after stays exactly as the student wrote it. So "revision" must NOT repeat or restate wording from the sentence right before or after the quote, even if your suggestion is to join two sentences with a conjunction. Wrong example: quote "It saw a cat.", suggestion "join with 'and'", revision "The dog ran fast and saw a cat." — this restates "The dog ran fast" from the previous sentence, so the final story reads "The dog ran fast. The dog ran fast and saw a cat." (duplicated). Right way to handle a joining suggestion: revise the quote itself to start with the conjunction, e.g. revision "And it saw a cat." — the previous sentence stays untouched and the joined feel still comes through.
Every highlight's "quote" must be a real substring that appears verbatim in the submitted text — never paraphrase or reconstruct a quote from memory.`;
}

// When the student previously tapped a "what will you try next time?"
// commitment, this asks the model to genuinely check whether the new
// submission shows evidence of it — never fabricated, and omitted if
// there's nothing real to say.
function followUpClause(previousCommitment) {
  if (!previousCommitment) return "";
  return `\n\nLast time, this student committed to trying: "${previousCommitment}" in their next submission. Look for genuine evidence of this in what they submitted now. If you find real evidence, briefly and warmly acknowledge it. If there's no clear evidence, gently note that without scolding — it's still worth trying. Put this 1-sentence check-in in a "followUp" field. Never claim evidence that isn't actually there.`;
}

// A single worked example, shown to every call regardless of the actual
// student, purely to anchor tone/structure/specificity. Models follow a
// concrete example far more reliably than an abstract description of one.
const WORKED_EXAMPLE = `Example of the required tone and specificity (a different student, shown only so you can match the STYLE — do not reuse this content):
Student text fragment: "...the dark forest was really scary and the trees looked spooky..."
{
  "glow": "You built real tension with \\"the dark forest was really scary.\\" That's exactly the kind of description Year 4 fronted-adverbial work is aiming for.",
  "grow": "Try opening that sentence with a fronted adverbial instead: \\"Without warning, the dark forest grew scary.\\" Think of it like a rocket's countdown. The delay before the reveal makes the moment land harder. That's the kind of detail that makes a story fun to reread.",
  "vocab": [
    { "term": "ominous", "definition": "giving the feeling that something bad is about to happen, like storm clouds before a launch" },
    { "term": "murmur", "definition": "a soft, low sound, like mission control talking quietly in the background" }
  ],
  "microMission": "In your next story, start one sentence with a fronted adverbial before you reveal something scary or exciting.",
  "commitOptions": ["Start a sentence with a fronted adverbial", "Reread my scary bit out loud", "Use one of today's new words"],
  "glowTarget": "Fronted Adverbials",
  "growTarget": "Fronted Adverbials",
  "highlights": [
    { "quote": "the dark forest was really scary", "type": "glow", "note": "Great tense-building detail right here." },
    { "quote": "the trees looked spooky", "type": "grow", "note": "Try opening with a fronted adverbial to build more suspense.", "revision": "Without warning, the trees looked spooky." }
  ]
}
Notice: the glow quotes the student's actual words, the standard is named naturally (not bolted on), the analogy is concrete, vocab defs are one plain sentence each, glowTarget/growTarget are copied verbatim from the given list, each highlight's "quote" is an exact substring of the student's text (typos and all) rather than a paraphrase, and the "grow" highlight's "revision" is that same fragment actually rewritten — not restated advice, a real rewrite the student could paste straight into their story. Match that bar exactly for the real student below — every claim must be traceable to what they actually wrote/answered.`;

function successCriteria(tier) {
  const cap = MAX_AVG_WORDS_PER_SENTENCE[tier] || 30;
  return `Before you respond, check your own draft against these pass/fail criteria — if any fail, revise before sending:
1. The glow names something concrete the student actually wrote or answered (quote a short fragment) — not a generic compliment that could apply to any submission.
2. The glow's curriculum reference is either the exact standard you were given, or (if none was given) a general curriculum phrase — never an invented code.
3. The grow names exactly ONE step, uses the student's stated interest as a real, concrete analogy (not just name-dropped), and ends with the motivation-appropriate line.
4. Count the words per sentence across your glow and grow COMBINED, and average it — it must be UNDER ${cap} words per sentence for this age tier. Short, plain sentences. This is checked mechanically, so if a sentence is running long, split it into two rather than adding a comma clause.
5. Both vocab definitions are one plain sentence each, framed through the student's interest where natural.
6. glowTarget and growTarget are copied EXACTLY, character-for-character, from the provided list of skill area names — not paraphrased, shortened, or invented.
7. Every highlight's "quote" is an exact, verbatim substring you can point to in the submitted text above — not a cleaned-up or paraphrased version of it.
8. Every "grow" highlight has a "revision" that is an actual rewrite of its quote (different wording, applying the fix) — never the same text repeated, and never just advice about the quote instead of a rewrite of it.`;
}

function buildWritingPrompt({ tier, country, gradeLabel, interest, confidenceWriting, motivation, prompt, text, targetNames, previousCommitment }) {
  return `You are the feedback engine inside LiteracyLab AI, an educational product for a ${TIER_LABEL[tier]} student in ${gradeLabel} (${country}).

A student was given this writing prompt:
"${prompt}"

They submitted this piece of writing:
"""
${text}
"""

Their stated interest for personalising feedback is: ${interest}.
${CONFIDENCE_NOTE[confidenceWriting] || ""}
${MOTIVATION_NOTE[motivation] || ""}
${standardsClause(country, tier, gradeLabel)}
${targetsClause(targetNames)}
${highlightsClause()}
${followUpClause(previousCommitment)}

Read the actual submitted text closely — every point you make must be traceable to something specifically in it (quote a short fragment where useful), not a generic template response.

${WORKED_EXAMPLE}

${successCriteria(tier)}

Respond with ONLY a JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "glow": "1-2 sentences of specific, genuine praise tied to something the student actually did in this text and to the curriculum standard noted above.",
  "grow": "1-2 sentences naming ONE specific, actionable next step scaled to this student's zone of proximal development — not a laundry list. Weave in an analogy drawn from their stated interest (${interest}) to make the concept concrete. End with the motivation-appropriate closing line.",
  "vocab": [
    { "term": "a single word or short phrase", "definition": "a one-sentence, age-appropriate definition, framed using their interest where natural" },
    { "term": "a second word or short phrase", "definition": "a one-sentence, age-appropriate definition, framed using their interest where natural" }
  ],
  "microMission": "One concrete, specific instruction for their NEXT submission that directly follows from the grow above.",
  "commitOptions": ["3 short first-person action phrases (5-8 words each) the student could tap to commit to trying next time, each directly derived from the grow above — not generic"],
  "glowTarget": "the exact skill area name from the given list that the glow demonstrates",
  "growTarget": "the exact skill area name from the given list that the grow is building towards",
  "highlights": [{ "quote": "an exact substring copied from the submitted text", "type": "glow or grow", "note": "a short reason", "revision": "ONLY for type=grow: that same fragment actually rewritten to apply the suggestion" }],
  "followUp": ${previousCommitment ? '"a short, honest 1-sentence check-in on the previous commitment noted above"' : "null"}
}`;
}

function buildReadingPrompt({ tier, country, gradeLabel, interest, confidenceReading, motivation, passageTitle, passage, questions, answers, score, totalQuestions, targetNames, previousCommitment }) {
  const answerLines = questions.map((q, i) => {
    const chosen = answers[i];
    const isCorrect = chosen === q.correct;
    return `Q${i + 1}: "${q.q}" — student chose "${chosen != null ? q.options[chosen] : "(no answer)"}" (${isCorrect ? "CORRECT" : `INCORRECT, correct answer was "${q.options[q.correct]}"`})`;
  }).join("\n");

  return `You are the feedback engine inside LiteracyLab AI, an educational product for a ${TIER_LABEL[tier]} student in ${gradeLabel} (${country}).

A student read this passage, titled "${passageTitle}":
"""
${passage}
"""

They answered ${score} of ${totalQuestions} comprehension questions correctly:
${answerLines}

Their stated interest for personalising feedback is: ${interest}.
${CONFIDENCE_NOTE[confidenceReading] || ""}
${MOTIVATION_NOTE[motivation] || ""}
${standardsClause(country, tier, gradeLabel)}
${targetsClause(targetNames)}
${followUpClause(previousCommitment)}

${WORKED_EXAMPLE}

${successCriteria(tier)}

Respond with ONLY a JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "glow": "1-2 sentences of specific praise. If they got questions right, name which comprehension skill they clearly demonstrated (e.g. inference, retrieval) and tie it to the curriculum standard noted above.",
  "grow": "1-2 sentences on ONE specific, actionable next step. If they missed a question, point them back to the exact idea in the passage they should re-examine, without just giving away the answer outright. Weave in an analogy from their stated interest (${interest}). End with the motivation-appropriate closing line.",
  "vocab": [
    { "term": "a word or phrase from the passage worth upgrading", "definition": "a one-sentence, age-appropriate definition, framed using their interest where natural" },
    { "term": "a second word or phrase from the passage", "definition": "a one-sentence, age-appropriate definition, framed using their interest where natural" }
  ],
  "microMission": "One concrete instruction for their next reading passage that follows from the grow above.",
  "commitOptions": ["3 short first-person action phrases (5-8 words each) the student could tap to commit to trying next time, derived from the grow above"],
  "glowTarget": "the exact skill area name from the given list that the glow demonstrates",
  "growTarget": "the exact skill area name from the given list that the grow is building towards",
  "followUp": ${previousCommitment ? '"a short, honest 1-sentence check-in on the previous commitment noted above"' : "null"}
}`;
}

const PASSAGE_LENGTH = {
  early: "3-5 short, simple sentences (roughly 40-60 words)",
  elementary: "6-10 sentences (roughly 100-150 words)",
  middle: "8-12 sentences (roughly 150-220 words), with some more complex sentence structures",
  high: "10-15 sentences (roughly 200-300 words), written in a more sophisticated, adult-register style",
};

const PASSAGE_SKILL = {
  early: "recalling key details stated directly in the text",
  elementary: "making inferences that go slightly beyond what's stated directly",
  middle: "inferring mood, tone, or an author's implied purpose",
  high: "analysing an argument's claim, structure, and rhetorical technique",
};

// Generates a brand-new passage + comprehension questions on demand instead
// of picking from a small fixed bank, so a returning student never sees the
// same text twice. The generated answer key (the "correct" indices) is
// stripped out before this ever reaches the client — see api/reading-passage.js.
function buildReadingPassagePrompt({ tier, country, gradeLabel, interest }) {
  return `You are generating an ORIGINAL reading-comprehension exercise for a ${TIER_LABEL[tier]} student in ${gradeLabel} (${country}).

Write a short, wholly original passage — never copied or closely paraphrased from any existing published book, article, or other copyrighted work — appropriate for this age, plus 3 multiple-choice comprehension questions about it.

The student's stated interest is: ${interest}. Where it fits naturally, let the passage's subject matter connect to this interest, but the passage must stand alone and be fully understandable without any outside knowledge of that interest.

Requirements:
- Passage length: ${PASSAGE_LENGTH[tier]}.
- The questions should primarily test this comprehension skill: ${PASSAGE_SKILL[tier]}.
- Exactly 3 questions, each with exactly 4 answer options and exactly ONE unambiguously correct answer that is clearly supported by the passage. The other 3 options must be clearly wrong to a careful reader, not intentionally tricky or debatable.
- Do not reuse character names, settings, or plots from well-known published works.

Respond with ONLY a JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "title": "a short title for the passage",
  "skill": "the one comprehension skill this set of questions tests, in plain words",
  "passage": "the full original passage text",
  "questions": [
    { "q": "question text", "options": ["option A", "option B", "option C", "option D"], "correct": 0 },
    { "q": "question text", "options": ["option A", "option B", "option C", "option D"], "correct": 1 },
    { "q": "question text", "options": ["option A", "option B", "option C", "option D"], "correct": 2 }
  ]
}`;
}

const WRITING_EXERCISE_TYPE = {
  early: "a short imaginative story prompt (one or two sentences), with a simple, concrete premise a young child can picture immediately",
  elementary: "an adventure-story prompt (one or two sentences) that gives the student a clear situation or discovery to build a story around",
  middle: "a short analytical-response prompt (one or two sentences) asking the student to analyse a literary technique (e.g. setting, characterisation, tension) in a story or text they've read recently — it must NOT name a specific book, since the student could have read anything",
  high: "a persuasive/argumentative essay prompt in the style of a timed exam question: a debatable claim (often as a quotation) followed by an instruction to agree or disagree with reference to texts or examples",
};

// Generates a brand-new writing prompt on demand instead of reusing one
// fixed prompt per tier, so a returning student doesn't write to the same
// prompt every session. Mirrors buildReadingPassagePrompt's reasoning.
function buildWritingPromptGenerator({ tier, country, gradeLabel, interest }) {
  return `You are generating an ORIGINAL creative-writing or essay prompt for a ${TIER_LABEL[tier]} student in ${gradeLabel} (${country}).

Write ${WRITING_EXERCISE_TYPE[tier]}.

The student's stated interest is: ${interest}. Where it fits naturally, let the prompt's subject matter connect to this interest, but the prompt must stand alone and make sense to any student regardless of that interest.

Requirements:
- The prompt must be wholly original — not copied or closely paraphrased from any existing published writing prompt, exam question, or exercise.
- Do not reuse character names, settings, or specific plots from well-known published works.
- Keep the prompt itself short (one or two sentences) — the student does the writing, not you.

Respond with ONLY a JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "title": "a short, punchy title for this writing exercise (a few words)",
  "prompt": "the one-or-two-sentence writing prompt itself"
}`;
}

// Appended on a retry after the validator rejects the first attempt — tells
// the model exactly what it got wrong rather than just asking it to try again.
function correctiveAddendum(issues) {
  return `\n\nYour previous attempt failed these checks — fix every one of them in this attempt:\n${issues.map(i => `- ${i}`).join("\n")}`;
}

module.exports = { buildWritingPrompt, buildReadingPrompt, buildReadingPassagePrompt, buildWritingPromptGenerator, correctiveAddendum };
