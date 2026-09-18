const { curriculumLabel, standardsFor } = require("./curriculum");

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

function standardsClause(country, tier) {
  const standards = standardsFor(country, tier);
  if (standards) {
    return `This region's curriculum for this tier is individually mapped to real standards. Cite ONE of these specific standards by name in the Glow, verbatim: ${standards.join(" | ")}. Do not invent a different code.`;
  }
  return `This region (${country}) has not yet been mapped to individual standard codes for this tier. Reference "${curriculumLabel(country)}" in general terms in the Glow — do NOT invent a specific standard code, grade-level number, or content-domain letter that hasn't been given to you.`;
}

// A single worked example, shown to every call regardless of the actual
// student, purely to anchor tone/structure/specificity. Models follow a
// concrete example far more reliably than an abstract description of one.
const WORKED_EXAMPLE = `Example of the required tone and specificity (a different student, shown only so you can match the STYLE — do not reuse this content):
Student text fragment: "...the dark forest was really scary and the trees looked spooky..."
{
  "glow": "You built real tension with \\"the dark forest was really scary\\" — that's exactly the descriptive detail Year 4 fronted-adverbial work is aiming for.",
  "grow": "Try opening that sentence with a fronted adverbial instead: \\"Without warning, the dark forest grew scary.\\" Think of it like a rocket's countdown — the delay before the reveal makes the moment land harder. This is the kind of detail that makes a story fun to reread.",
  "vocab": [
    { "term": "ominous", "definition": "giving the feeling that something bad is about to happen, like storm clouds before a launch" },
    { "term": "murmur", "definition": "a soft, low sound, like mission control talking quietly in the background" }
  ],
  "microMission": "In your next story, start one sentence with a fronted adverbial before you reveal something scary or exciting.",
  "commitOptions": ["Start a sentence with a fronted adverbial", "Reread my scary bit out loud", "Use one of today's new words"]
}
Notice: the glow quotes the student's actual words, the standard is named naturally (not bolted on), the analogy is concrete, vocab defs are one plain sentence each, and nothing here is generic enough to paste into any other student's feedback. Match that bar exactly for the real student below — every claim must be traceable to what they actually wrote/answered.`;

function successCriteria() {
  return `Before you respond, check your own draft against these pass/fail criteria — if any fail, revise before sending:
1. The glow names something concrete the student actually wrote or answered (quote a short fragment) — not a generic compliment that could apply to any submission.
2. The glow's curriculum reference is either the exact standard you were given, or (if none was given) a general curriculum phrase — never an invented code.
3. The grow names exactly ONE step, uses the student's stated interest as a real, concrete analogy (not just name-dropped), and ends with the motivation-appropriate line.
4. Every sentence would be understandable read aloud to a student at this exact age — no jargon without the analogy carrying it.
5. Both vocab definitions are one plain sentence each, framed through the student's interest where natural.`;
}

function buildWritingPrompt({ tier, country, gradeLabel, interest, confidenceWriting, motivation, prompt, text }) {
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
${standardsClause(country, tier)}

Read the actual submitted text closely — every point you make must be traceable to something specifically in it (quote a short fragment where useful), not a generic template response.

${WORKED_EXAMPLE}

${successCriteria()}

Respond with ONLY a JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "glow": "1-2 sentences of specific, genuine praise tied to something the student actually did in this text and to the curriculum standard noted above.",
  "grow": "1-2 sentences naming ONE specific, actionable next step scaled to this student's zone of proximal development — not a laundry list. Weave in an analogy drawn from their stated interest (${interest}) to make the concept concrete. End with the motivation-appropriate closing line.",
  "vocab": [
    { "term": "a single word or short phrase", "definition": "a one-sentence, age-appropriate definition, framed using their interest where natural" },
    { "term": "a second word or short phrase", "definition": "a one-sentence, age-appropriate definition, framed using their interest where natural" }
  ],
  "microMission": "One concrete, specific instruction for their NEXT submission that directly follows from the grow above.",
  "commitOptions": ["3 short first-person action phrases (5-8 words each) the student could tap to commit to trying next time, each directly derived from the grow above — not generic"]
}`;
}

function buildReadingPrompt({ tier, country, gradeLabel, interest, confidenceReading, motivation, passageTitle, passage, questions, answers, score, totalQuestions }) {
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
${standardsClause(country, tier)}

${WORKED_EXAMPLE}

${successCriteria()}

Respond with ONLY a JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "glow": "1-2 sentences of specific praise. If they got questions right, name which comprehension skill they clearly demonstrated (e.g. inference, retrieval) and tie it to the curriculum standard noted above.",
  "grow": "1-2 sentences on ONE specific, actionable next step. If they missed a question, point them back to the exact idea in the passage they should re-examine, without just giving away the answer outright. Weave in an analogy from their stated interest (${interest}). End with the motivation-appropriate closing line.",
  "vocab": [
    { "term": "a word or phrase from the passage worth upgrading", "definition": "a one-sentence, age-appropriate definition, framed using their interest where natural" },
    { "term": "a second word or phrase from the passage", "definition": "a one-sentence, age-appropriate definition, framed using their interest where natural" }
  ],
  "microMission": "One concrete instruction for their next reading passage that follows from the grow above.",
  "commitOptions": ["3 short first-person action phrases (5-8 words each) the student could tap to commit to trying next time, derived from the grow above"]
}`;
}

// Appended on a retry after the validator rejects the first attempt — tells
// the model exactly what it got wrong rather than just asking it to try again.
function correctiveAddendum(issues) {
  return `\n\nYour previous attempt failed these checks — fix every one of them in this attempt:\n${issues.map(i => `- ${i}`).join("\n")}`;
}

module.exports = { buildWritingPrompt, buildReadingPrompt, correctiveAddendum };
