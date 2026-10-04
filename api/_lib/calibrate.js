// Calibrates writing feedback to how much the student actually wrote.
//
// The model can be generous about a very short or empty piece (found live: a
// 33-word essay against a 650-word expectation scored 5/10, with a "Secure"
// band for a single claim and an AO banded 2 while the evidence said "not
// attempted"). Everything here is deterministic and general: it compares the
// real word count with the expected length for THAT country, grade and tier
// (writingLimits.js), so it behaves the same for every country and year and is
// never tuned to one piece. It can only LOWER a score or band, never raise one.

const { writingLimitsForGrade } = require("./writingLimits");

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const wordsIn = (t) => String(t || "").match(WORD) || [];

// Fractions of the expected length below which a piece counts as short / thin /
// minimal, and the highest score each level may receive. Early years get gentler
// limits: a Reception child's three words is a real attempt.
const LEVELS = {
  early:      { short: 0.5,  thin: 0.3,  minimal: 0.12, cap: { short: 5, thin: 4, minimal: 3 }, minWords: 2 },
  elementary: { short: 0.6,  thin: 0.35, minimal: 0.12, cap: { short: 4, thin: 3, minimal: 2 }, minWords: 5 },
  middle:     { short: 0.6,  thin: 0.35, minimal: 0.12, cap: { short: 4, thin: 3, minimal: 2 }, minWords: 6 },
  high:       { short: 0.6,  thin: 0.35, minimal: 0.12, cap: { short: 4, thin: 3, minimal: 2 }, minWords: 8 },
};
const BAND_CAP = { short: 3, thin: 2, minimal: 2 };

// Words that carry content once repetition is collapsed: "bla bla bla" or the
// same sentence pasted ten times is not a long piece.
function effectiveWordCount(words) {
  if (words.length < 8) return words.length;
  const distinct = new Set(words.map((w) => w.toLowerCase())).size;
  return Math.min(words.length, Math.round(distinct * 2.2));
}

function assessLength({ text, tier, country, gradeLabel }) {
  const cfg = LEVELS[tier] || LEVELS.elementary;
  const words = wordsIn(text);
  const effective = effectiveWordCount(words);
  const { target } = writingLimitsForGrade(country, gradeLabel, tier);
  const ratio = target > 0 ? effective / target : 1;
  let level = "ok";
  if (ratio < cfg.minimal || effective < cfg.minWords) level = "minimal";
  else if (ratio < cfg.thin) level = "thin";
  else if (ratio < cfg.short) level = "short";
  return {
    words: words.length, effective, target, ratio, level,
    scoreCap: level === "ok" ? 10 : cfg.cap[level],
    bandCap: level === "ok" ? 4 : BAND_CAP[level],
    repetitive: effective < words.length,
  };
}

// Prompt text, built from the real numbers so the model cannot guess.
function lengthClause(a) {
  if (a.level === "ok") return "";
  const pct = Math.max(1, Math.round(a.ratio * 100));
  const lead = `\n\nLENGTH CHECK (computed, not an estimate): the student wrote ${a.words} word${a.words === 1 ? "" : "s"}${a.repetitive ? ` (about ${a.effective} once repeated words are ignored)` : ""}; about ${a.target} are expected at this level, so this piece is roughly ${pct}% of the expected length.`;
  const rules = ` Say so plainly and kindly in "scoreReason" (or in the grow if there is no score), do not award a high score or a high band for a piece this short, never describe it as developed, thorough or comprehensive, and make the main "grow" about developing the piece (adding the next reason, example or detail) rather than polishing wording. Do not praise a skill the few words do not demonstrate. Do not force an interest analogy into the grow. The revised response may develop their own points only as the REVISED RESPONSE instructions allow, and must keep their position.`;
  return lead + rules;
}

const NOT_ATTEMPTED = /not\s+attempted|wasn'?t\s+attempted|did\s+not\s+attempt|didn'?t\s+attempt|no\s+evidence|nothing\s+to\s+(assess|judge)|not\s+(shown|demonstrated|addressed)|absent/i;
const TOO_LITTLE = "Too little writing to judge this yet.";
const BAND_WORD = { 1: "Emerging", 2: "Developing", 3: "Secure", 4: "Strong" };

// Lowers examTechnique bands that the evidence or the length cannot support.
function calibrateBands(parsed, a) {
  if (!parsed || !Array.isArray(parsed.examTechnique)) return;
  for (const e of parsed.examTechnique) {
    if (!e || typeof e !== "object") continue;
    let band = Number(e.band);
    if (!Number.isInteger(band)) continue;
    const text = `${e.evidence || ""} ${e.descriptor || ""}`;
    if (NOT_ATTEMPTED.test(text)) { band = 1; e.evidence = TOO_LITTLE; }
    band = Math.min(band, a.bandCap);
    if (band !== Number(e.band)) {
      e.band = band;
      e.descriptor = BAND_WORD[band];
    }
  }
}

// Before validation: an entry whose evidence says the objective was "not attempted" (or
// similar) on a piece of writing is an honest Band 1 with a plain reason, whatever band the
// model attached, so it is normalised rather than retried.
function repairExamEvidence(parsed) {
  if (!parsed || !Array.isArray(parsed.examTechnique)) return parsed;
  for (const e of parsed.examTechnique) {
    if (!e || typeof e !== "object" || typeof e.evidence !== "string") continue;
    if (NOT_ATTEMPTED.test(e.evidence)) { e.band = 1; e.descriptor = BAND_WORD[1]; e.evidence = TOO_LITTLE; }
  }
  return parsed;
}

function calibrateScore(parsed, a) {
  if (!parsed || !Number.isInteger(parsed.overallScore)) return;
  const original = parsed.overallScore;
  if (original > a.scoreCap) parsed.overallScore = a.scoreCap;
  // Always state the real length when it is a factor, even if the model had
  // already scored low, so the number is explained honestly.
  if (a.level !== "ok" && typeof parsed.scoreReason === "string") {
    const lead = `Your piece is ${a.words} word${a.words === 1 ? "" : "s"} against about ${a.target} expected, so it is too short to score highly. `;
    if (!/\b(too short|very short|short piece|words? (against|of|expected))\b/i.test(parsed.scoreReason)) {
      parsed.scoreReason = (lead + parsed.scoreReason).slice(0, 300);
    }
  }
  // A score of 1 is reserved for nothing meaningful at all.
  if (parsed.overallScore < 1) parsed.overallScore = 1;
}

// A glow that quotes a word the spelling check lists as misspelled is praising
// the error; a grow that does not mention developing the piece does not help a
// thin one.
const DEVELOP = /\b(add|adding|develop|developing|extend|extending|expand|expanding|more|another|next|explain|explaining|example|reason|detail|details|longer|build|continue|elaborat\w*|support)\b/i;
function growDevelops(grow) {
  return DEVELOP.test(String(grow || ""));
}

// Deterministic corrected story: the student's own text with every listed
// spelling/grammar/punctuation fix applied in place. Used when the model's
// rewrite invents content, so the student still gets a faithful corrected copy.
function applyCorrections(text, spellingGrammar) {
  let out = String(text || "");
  const items = Array.isArray(spellingGrammar) ? spellingGrammar : [];
  for (const item of items) {
    if (!item || typeof item.quote !== "string" || typeof item.correction !== "string") continue;
    if (!item.quote || item.quote === item.correction) continue;
    const i = out.indexOf(item.quote);
    if (i === -1) continue;
    out = out.slice(0, i) + item.correction + out.slice(i + item.quote.length);
  }
  return out;
}

// One call that does every deterministic repair after validation passes.
function calibrateWriting(parsed, { text, tier, country, gradeLabel, capabilities }) {
  const a = assessLength({ text, tier, country, gradeLabel });
  if (!parsed || typeof parsed !== "object") return a;
  calibrateScore(parsed, a);
  if (!capabilities || capabilities.examTechnique !== false) calibrateBands(parsed, a);
  return a;
}

module.exports = { repairExamEvidence, assessLength, lengthClause, calibrateWriting, calibrateBands, calibrateScore, applyCorrections, growDevelops, effectiveWordCount, wordsIn, LEVELS };
