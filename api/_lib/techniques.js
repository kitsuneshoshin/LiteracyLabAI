// Named reading strategies and word-building tricks, chosen for each age band. The names and the
// "how to" sentences are fixed here (like the writing frameworks), so a model can only pick one and
// apply it to the student's own attempt; it can never invent a definition. They are widely taught,
// curriculum-neutral techniques (for example the reciprocal-reading moves predict, clarify, question
// and summarise, and teaching word parts), not claims about any exam board.

const READING_STRATEGIES = {
  early: [
    ["Look back", "Go back to the text and find the line that answers the question."],
    ["Picture it", "Make a picture in your head of what you read, then check it against the words."],
    ["Say it again", "Tell what happened in your own words, in the right order."],
  ],
  elementary: [
    ["Predict", "Use the clues so far to guess what comes next, then read on to check."],
    ["Clarify", "Stop at a tricky word or sentence and use the words around it to work out what it means."],
    ["Ask a question", "Ask yourself who, what, why or how as you read, and look for the answer."],
    ["Summarise", "Say the main idea in one or two sentences."],
    ["Infer", "Read between the lines: join a clue in the text to what you know, \"I think... because the text says...\"."],
    ["Find the evidence", "Point to the exact line in the text that proves your answer."],
  ],
  middle: [
    ["Infer with evidence", "Say what the text suggests, then back it with a short quotation."],
    ["Spot the writer's purpose", "Ask why the writer wrote this and what they want you to think or feel."],
    ["Summarise the main idea", "Strip a section down to its main point in your own words."],
    ["Compare ideas", "Set two ideas, characters or viewpoints side by side and say how they are alike and different."],
    ["Work words out from context", "Use the sentence around an unfamiliar word to work out its meaning."],
    ["Question the text", "Ask what is stated, what is only suggested, and what the writer leaves out."],
  ],
  high: [
    ["Infer implied meaning", "Explain what is suggested rather than stated, using precise evidence."],
    ["Analyse language and structure", "Name a choice of word, image or structure and explain the effect it has on the reader."],
    ["Weigh the evidence", "Judge how reliable, complete or one-sided the evidence is."],
    ["Synthesise ideas", "Draw ideas from different parts or texts together into one point."],
    ["Annotate as you read", "Mark key words, claims and turning points in the margin as you go."],
    ["Evaluate the argument", "Decide how convincing the writer's case is, and why."],
  ],
};

const VOCAB_TRICKS = {
  early: ["Chunk it", "Clap the word in chunks (syllables) and look for a small word hiding inside."],
  elementary: ["Look inside the word", "Look for a smaller word, a prefix (un-, re-) or a suffix (-ful, -ly) that helps you work out the meaning."],
  middle: ["Word parts and families", "Split the word into prefix, root and suffix, and think of other words from the same family."],
  high: ["Roots and shades of meaning", "Use the root (often Latin or Greek) to unlock the meaning, and compare it with a close synonym to see the difference in tone."],
};

// ---- AFOREST: the persuasive devices. A checklist, not a paragraph shape: which of the seven did this piece use,
// and which one would help most next. Names and meanings are fixed here, like the writing frameworks.
const PERSUASIVE_DEVICES = [
  ["Alliteration", "Words close together that start with the same sound, like \"big, bold and brave\"."],
  ["Facts", "Information that can be checked and shown to be true."],
  ["Opinion", "What the writer thinks or believes."],
  ["Rhetorical question", "A question asked for effect, where the answer is meant to be obvious."],
  ["Emotive language", "Words chosen to make the reader feel something strongly."],
  ["Statistics", "Numbers or percentages used to back up a point."],
  ["Triple", "Three words or ideas in a row, like \"safe, fair and fun\"."],
];
const DEVICE_LETTERS = "AFOREST";
const deviceList = () => PERSUASIVE_DEVICES.map(([name, meaning], i) => ({ letter: DEVICE_LETTERS[i], name, meaning }));

// Only for a persuasive piece, from Elementary up (an Early Years child has Opinion and Reason).
function devicesApply(genre, tier) {
  const { resolveGenre } = require("./writingFrameworks");
  return resolveGenre(genre, tier) === "persuasive" && !!tier && tier !== "early";
}
function deviceClause(genre, tier) {
  if (!devicesApply(genre, tier)) return "";
  const list = PERSUASIVE_DEVICES.map(([n, m]) => `"${n}" (${m})`).join("; ");
  return `\n\nPERSUASIVE DEVICES (AFOREST): This is a persuasive piece, so also check it against the AFOREST devices: ${list}. Return "deviceCheck": { "used": the devices the student genuinely used, each { "device": a name copied EXACTLY from the list, "quote": a short fragment (2 to 12 words) copied EXACTLY, verbatim, from their text that uses it } - none invented, at most 5; "tryNext": ONE device from the list they did NOT use, { "device": its exact name, "idea": one plain sentence (under 35 words) saying where in THEIR piece it would fit and what to try, without rewriting it for them }. If every device is already used, leave "tryNext" out. No analogy.`;
}
function deviceShape(genre, tier) {
  return devicesApply(genre, tier)
    ? '  "deviceCheck": { "used": [{ "device": "an exact device name from the list", "quote": "exact words from the student\'s text" }], "tryNext": { "device": "a device they did not use", "idea": "one plain sentence" } }'
    : "";
}
const looseText = (s) => String(s || "").toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9]+/g, " ").trim();
const canonDevice = (name) => PERSUASIVE_DEVICES.find(([n]) => norm(n) === norm(name));
// A bonus section: anything wrong is dropped, never a reason to fail the feedback. A device only counts as "used" if
// its quote really is in the student's text.
function repairDevices(parsed, text) {
  if (!parsed || !("deviceCheck" in parsed)) return parsed;
  const dc = parsed.deviceCheck;
  if (!dc || typeof dc !== "object") { delete parsed.deviceCheck; return parsed; }
  const hay = looseText(text);
  const used = [], seen = new Set();
  for (const u of Array.isArray(dc.used) ? dc.used : []) {
    const d = u && typeof u === "object" ? canonDevice(u.device) : null;
    const quote = u && typeof u.quote === "string" ? u.quote.trim() : "";
    if (!d || seen.has(d[0]) || !quote || quote.split(/\s+/).length > 14 || !hay.includes(looseText(quote))) continue;
    seen.add(d[0]); used.push({ device: d[0], quote });
  }
  let tryNext;
  const t = dc.tryNext;
  const td = t && typeof t === "object" ? canonDevice(t.device) : null;
  const idea = t && typeof t.idea === "string" ? t.idea.trim() : "";
  if (td && !seen.has(td[0]) && idea.length >= 10 && idea.length <= 260) tryNext = { device: td[0], idea };
  if (!used.length && !tryNext) { delete parsed.deviceCheck; return parsed; }
  parsed.deviceCheck = { used, ...(tryNext ? { tryNext } : {}), devices: deviceList() };
  return parsed;
}

// ---- The Frayer card for a vocabulary word: definition, characteristics, example, non-example. The first and third
// were always there; the model now adds the other two (from Elementary up). Both are optional: a missing or odd one is
// dropped and the card shows what it has.
const frayerOn = (tier) => !!tier && tier !== "early";
function frayerClause(tier) {
  if (!frayerOn(tier)) return "";
  return `\n\nFRAYER WORD CARD: For each vocabulary item also return "characteristics": 2 to 6 words naming a key feature of the word's meaning (what it is like), and "nonExample": a short phrase (under 14 words) giving something that is NOT an example of the word, so the student sees the edges of its meaning. With the definition and example, these make a four-box word card.`;
}
function frayerShape(tier) {
  return frayerOn(tier) ? ', "characteristics": "2-6 words: a key feature of the meaning", "nonExample": "a short phrase that is NOT an example of the word"' : "";
}
function repairFrayer(parsed) {
  if (!parsed || !Array.isArray(parsed.vocab)) return parsed;
  for (const v of parsed.vocab) {
    if (!v || typeof v !== "object") continue;
    for (const [k, min, max] of [["characteristics", 3, 80], ["nonExample", 3, 120]]) {
      if (!(k in v)) continue;
      const t = typeof v[k] === "string" ? v[k].trim().replace(/\.$/, "") : "";
      if (t.length < min || t.length > max) delete v[k]; else v[k] = t;
    }
  }
  return parsed;
}

const tierKey = (tier) => (READING_STRATEGIES[tier] ? tier : "elementary");

function strategiesFor(tier) {
  return READING_STRATEGIES[tierKey(tier)].map(([name, how]) => ({ name, how }));
}
function vocabTrickFor(tier) {
  const [name, how] = VOCAB_TRICKS[tierKey(tier)];
  return { name, how };
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function resolveStrategy(tier, name) {
  const want = norm(name);
  return strategiesFor(tier).find((s) => norm(s.name) === want) || null;
}

function readingStrategyClause(tier) {
  const list = strategiesFor(tier).map((s) => `"${s.name}" (${s.how})`).join("; ");
  return `\n\nREADING STRATEGY (required): Choose the ONE reading strategy from this list that would help this student most on the questions they got wrong (or, if they got everything right, the one they used best): ${list}. Return "readingStrategy" with "name" copied EXACTLY from the list and "tip": one or two plain sentences (under 40 words) that apply that strategy to THEIR attempt - name a specific question number and say what to do with the passage - without giving the answer away. No analogy in the tip.`;
}
function readingStrategyShape() {
  return '  "readingStrategy": { "name": "the exact strategy name from the list", "tip": "one or two plain sentences applying it to a specific question they met, without giving the answer" }';
}

function vocabTrickClause(tier) {
  const t = vocabTrickFor(tier);
  return `\n\nWORD TRICK: For each vocabulary item also return "trick": one short sentence (under 20 words) that applies this technique to THAT word: "${t.name}" (${t.how}) For example, for "unhappy" at the "Look inside the word" level: "un + happy: the prefix un- means not, so it means not happy."`;
}

// Issues for the reading strategy (reading feedback only).
function validateReadingStrategy(parsed, tier, issues) {
  const rs = parsed && parsed.readingStrategy;
  if (!rs || typeof rs !== "object") { issues.push("readingStrategy is missing"); return; }
  if (!resolveStrategy(tier, rs.name)) issues.push(`readingStrategy.name must be exactly one of: ${strategiesFor(tier).map((s) => s.name).join(", ")}`);
  const tip = typeof rs.tip === "string" ? rs.tip.trim() : "";
  if (tip.length < 20 || tip.length > 320) issues.push("readingStrategy.tip is missing, too short, or too long");
}

// Snap the name to the canonical spelling and attach the fixed how-to sentence for the screen.
function attachReadingStrategy(parsed, tier) {
  const rs = parsed && parsed.readingStrategy;
  if (!rs) return parsed;
  const hit = resolveStrategy(tier, rs.name);
  if (!hit) { delete parsed.readingStrategy; return parsed; }
  parsed.readingStrategy = { name: hit.name, how: hit.how, tip: String(rs.tip || "").trim() };
  return parsed;
}

// A vocabulary trick is a bonus: a missing or odd one is dropped, never a reason to fail feedback.
function repairVocabTricks(parsed) {
  if (!parsed || !Array.isArray(parsed.vocab)) return parsed;
  for (const v of parsed.vocab) {
    if (!v || typeof v !== "object" || !("trick" in v)) continue;
    const t = typeof v.trick === "string" ? v.trick.trim() : "";
    if (t.length < 8 || t.length > 200) delete v.trick; else v.trick = t;
  }
  return parsed;
}

module.exports = {
  READING_STRATEGIES, VOCAB_TRICKS, strategiesFor, vocabTrickFor, resolveStrategy,
  readingStrategyClause, readingStrategyShape, vocabTrickClause,
  validateReadingStrategy, attachReadingStrategy, repairVocabTricks,
  PERSUASIVE_DEVICES, devicesApply, deviceClause, deviceShape, repairDevices,
  frayerClause, frayerShape, repairFrayer,
};
