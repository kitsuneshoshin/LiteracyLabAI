// Deterministic, cheap checks run on every LLM response before it ever
// reaches a child. Catches the model quietly ignoring an instruction -
// wrong shape, suspiciously generic text, or a syllabus citation that
// never actually shows up. Not a substitute for reading real output
// yourself occasionally (every submission's feedback is saved to
// submissions.feedback in Supabase for exactly that purpose).

const { growDevelops, assessLength } = require("./calibrate");
const RESP = require("./responses");
const TECH = require("./techniques");
const { frameworkFor, VALID_GENRES } = require("./writingFrameworks");

const MAX_AVG_WORDS_PER_SENTENCE = { early: 14, elementary: 18, middle: 24, high: 32 };
const SENTENCE_LENGTH_TOLERANCE = 2;
const STOPWORDS = new Set(["the","a","an","of","and","or","for","to","in","on","at","statutory","english","app","year","yr","standard","standards","grade","level","aim","aims","programme","study","content","domain"]);

function avgWordsPerSentence(text) {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length === 0) return 0;
  const totalWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).filter(Boolean).length, 0);
  return totalWords / sentences.length;
}

// Fuzzy on purpose: a model that genuinely cited "CCSS.ELA-LITERACY.W.4.1" or
// "fronted adverbials" will share at least one distinctive token with the
// standard string even if it paraphrases the rest.
function mentionsAStandard(text, standardsList) {
  if (!standardsList || standardsList.length === 0) return true; // nothing to check (unmapped region)
  const lower = text.toLowerCase();
  return standardsList.some(std => {
    const tokens = (std.toLowerCase().match(/[a-z0-9.\-]+/g) || []);
    return tokens.some(tok => tok.length >= 3 && !STOPWORDS.has(tok) && lower.includes(tok));
  });
}

function checkString(value, min, max) {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function normalizeForMatch(s) {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

// For "did this actually change anything" checks (a correction vs. its own
// quote, a revision vs. its own quote) - stricter than normalizeForMatch,
// which only lowercases and collapses whitespace. A real bug this caught:
// the model can return a "correction" that's byte-for-byte identical to a
// human reading it, but uses a different Unicode character for the same
// punctuation mark (a curly quote "'" vs a straight one "'", an em dash "—"
// vs a hyphen "-") - normalizeForMatch alone sees those as genuinely
// different strings and lets a no-op "fix" straight through, which is
// exactly what it looks like to a parent: the suggested change already
// exists in their child's submission. Folding look-alikes first means the
// equality check actually reflects what a human would see as the same text.
function foldLookalikes(s) {
  // Only folds same-glyph character variants (smart quotes, dash lengths,
  // the single ellipsis codepoint) to one canonical form - it deliberately
  // does NOT strip punctuation outright, since a "punctuation" type fix is
  // often nothing but a missing period or comma, and that real difference
  // must still register as a difference.
  return normalizeForMatch(s)
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/…/g, "...");
}

// Catches a real failure mode found in live testing (twice, in two shapes):
// the model tries to satisfy a "join these sentences" suggestion by
// restating some OTHER sentence from the story inside "revision" - not
// necessarily the one right before the quote, could be any earlier one
// (e.g. quote "The cat ran up a tree.", revision "The dog ran fast and the
// cat ran up a tree." - restating the story's very FIRST sentence, several
// sentences back). Since the app only splices "revision" in place of
// "quote" - every other sentence stays exactly where it was - restating any
// of them produces a visible duplicate once spliced in. Checks any 4-6 word
// run inside "revision" against the rest of the story (the quote's own
// span excluded) rather than just the immediately adjacent sentence.
function revisionDuplicatesExistingText(revision, normalizedSubmittedText, normalizedQuote) {
  const quoteIdx = normalizedSubmittedText.indexOf(normalizedQuote);
  if (quoteIdx === -1) return false;
  const restOfText = normalizedSubmittedText.slice(0, quoteIdx) + " " + normalizedSubmittedText.slice(quoteIdx + normalizedQuote.length);
  const revisionWords = normalizeForMatch(revision).split(/\s+/).filter(Boolean);
  for (let n = Math.min(6, revisionWords.length); n >= 4; n--) {
    for (let start = 0; start + n <= revisionWords.length; start++) {
      const chunk = revisionWords.slice(start, start + n).join(" ");
      if (chunk.length >= 12 && restOfText.includes(chunk)) return true;
    }
  }
  return false;
}

// glowTarget/growTarget drive the real mastery computation in
// api/progress.js, which looks the value up as an exact key in a Map keyed
// by the canonical target names — a paraphrase wouldn't fail loudly, it
// would just silently fail to aggregate into that student's per-skill
// history. So matching is fuzzy (models reliably drop punctuation like "&"
// even when told to copy verbatim), but a match must still be snapped back
// to the exact canonical string via resolveTarget before it's saved.
// "&" is expanded to "and" rather than stripped, because the single most
// likely way a model breaks "copy this verbatim" is by writing out
// "Viewpoint and Argument Writing" for "Viewpoint & Argument Writing".
// Stripping the "&" instead would normalise the canonical name to
// "viewpoint argument writing" while the model's version stays "viewpoint
// and argument writing" - no match, so a correct answer gets rejected.
// Found by a test written for the exam-technique report, but it affects
// glowTarget/growTarget on every tier: there, the mismatch doesn't fail
// loudly, it silently drops that submission out of the student's mastery
// history. Expanding (rather than deleting) keeps both spellings distinct
// from any other target name, so this can't collide two different targets.
function normalizeTargetKey(value) {
  return String(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function resolveTarget(value, targetNames) {
  if (typeof value !== "string" || !targetNames || targetNames.length === 0) return null;
  const lower = value.trim().toLowerCase();
  const exact = targetNames.find((n) => n.toLowerCase() === lower);
  if (exact) return exact;
  const key = normalizeTargetKey(value);
  return targetNames.find((n) => normalizeTargetKey(n) === key) || null;
}

function matchesATarget(value, targetNames) {
  if (!targetNames || targetNames.length === 0) return true;
  return resolveTarget(value, targetNames) !== null;
}

// Regression check for a reading-comprehension bug found by live testing:
// on a 0/3 attempt, the model fabricated a claim that the student had
// engaged with, noticed, or understood something from the passage - a
// prompt-only fix ("praise genuine engagement instead") was retested and
// found insufficient, since the model just softened the wording ("engaged
// thoughtfully with complex ideas", "noticed the tension present") while
// still asserting comprehension that never happened on an all-wrong
// attempt. Enforced here rather than left to hoping the model follows the
// prompt, same reasoning as the middle/high analogy-phrase check below.
const ZERO_SCORE_FABRICATION_PATTERN = /\b(you\s+(noticed|recognised|recognized|captured|identified|connected|articulated|grasped|understood|comprehended|engaged)|(an|your)\s+understanding|reflects?\s+(an|your)\s+understanding|demonstrat\w*\s+(an|your)?\s*understanding)\b/i;

// Exam-technique scoring is sold as "banded against your exam board's real
// assessment objectives", so the checks here enforce exactly that claim: an
// entry for EVERY objective the student was scored against (not a
// cherry-picked subset), criterion names that resolve to the canonical
// list, bands inside 1-4, and evidence attached to each. It also rejects a
// raw mark or grade letter, which the prompt forbids - a model volunteering
// "roughly 17/24" would be inventing a precision no single unmoderated
// piece can support, and that number would end up in front of a parent.
// A fact about how long the piece is ("about 44% of the expected length") is true and useful, and it is what our own length
// check tells the model, so it is not an invented exam score. Everything else with a percentage or a fraction still is.
const LENGTH_FACT = /\b\d{1,3}(\.\d+)?\s*%\s+of\s+(the\s+)?(expected|target|required|usual|typical|recommended)\s+(length|word count|words|number of words)/gi;
const stripLengthFacts = (s) => String(s).replace(LENGTH_FACT, "of the expected length");
const FABRICATED_MARK_PATTERN = /\b(\d{1,3}\s*(\/|out of)\s*\d{1,3}|\d{1,3}\s*%|grade\s*[A-E1-9][*+-]?\b)/i;

function coerceBand(band) {
  if (typeof band === "string") {
    const m = band.match(/^\D*([0-4])\D*$/);
    if (m) band = Number(m[1]);
  }
  if (band === 0) return 1; // the prompt defines "not attempted" as band 1
  return band;
}

// On an all-wrong reading attempt the glow has nothing true to praise except
// effort (see zeroScoreClause), so a model that instead claims understanding
// the student never showed is not worth failing three attempts over - the
// glow is swapped for a safe, honest sentence.
const ZERO_SCORE_SAFE_GLOW = "You gave this passage a real go, and sticking with a tricky text to the end is exactly the habit that builds stronger reading.";
function repairZeroScoreGlow(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const g = parsed.glow;
  if (typeof g !== "string" || g.trim().length < 20 || g.trim().length > 600 || ZERO_SCORE_FABRICATION_PATTERN.test(g)) {
    parsed.glow = ZERO_SCORE_SAFE_GLOW;
  }
  return parsed;
}

// On a reading task the student always attempted every question, so an exam
// entry saying "not attempted" is false and off-task however the AI got there.
// Rather than failing three generations over wording, the evidence is replaced
// with the real, checkable facts: which questions were answered wrongly.
function repairReadingExamEvidence(parsed, questions, answers) {
  if (!parsed || !Array.isArray(parsed.examTechnique) || !Array.isArray(questions)) return parsed;
  questions = questions.filter((q) => require("./questionTypes").isAuto(q));
  const wrong = questions.map((q, i) => (answers && require("./questionTypes").isRight(q, answers[i]) ? null : i + 1)).filter(Boolean);
  const fact = wrong.length === 0
    ? "Every question was answered correctly."
    : wrong.length === questions.length
      ? "All " + questions.length + " questions were answered incorrectly."
      : "Question" + (wrong.length > 1 ? "s " : " ") + wrong.join(", ") + " answered incorrectly.";
  for (const e of parsed.examTechnique) {
    if (e && typeof e.evidence === "string" && /not\s+attempted|wasn'?t\s+attempted|did\s+not\s+attempt/i.test(e.evidence)) e.evidence = fact;
  }
  return parsed;
}

// Share of the shorter text's meaningful words that also appear in the other -
// catches a "next step" that just rewords the main Grow.
const OVERLAP_STOPWORDS = new Set(["the","and","you","your","that","this","with","for","are","can","try","then","once","more","how","into","from","about","their","them","when","what","will","has","have","its","but","not","use","one"]);
function meaningfulWords(text) {
  return new Set(String(text).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(" ").filter((w) => w.length > 3 && !OVERLAP_STOPWORDS.has(w)));
}
const GROW_NEXT_ANALOGY = /\b(like how|similar to how|just like|much like|think of it (as|like)|imagine|as if|the way (a|an|the) )\b/i;

function wordOverlap(a, b) {
  const A = meaningfulWords(a);
  const B = meaningfulWords(b);
  const smaller = A.size <= B.size ? A : B;
  const larger = smaller === A ? B : A;
  if (smaller.size < 4) return 0; // too short to judge
  let shared = 0;
  for (const w of smaller) if (larger.has(w)) shared++;
  return shared / smaller.size;
}

function validateExamTechnique(parsed, targetNames, issues, submittedText) {
  const entries = parsed?.examTechnique;
  if (!Array.isArray(entries) || entries.length === 0) {
    issues.push("examTechnique must be an array with one entry per assessment objective");
    return;
  }
  const seen = new Set();
  entries.forEach((e, i) => {
    // The JSON template shows band as a quoted placeholder, so models often
    // answer with a string ("2", "Band 2") or 0 for "not attempted". Those
    // are unambiguous, so they are normalised rather than failing the whole
    // response three times running.
    if (e && typeof e === "object") e.band = coerceBand(e.band);
    const resolved = resolveTarget(e?.criterion, targetNames);
    if (!resolved) {
      issues.push(`examTechnique[${i}].criterion must exactly match one of the given assessment objective names: ${(targetNames || []).join(", ")}`);
    } else {
      if (seen.has(resolved)) issues.push(`examTechnique[${i}].criterion "${resolved}" is scored more than once`);
      seen.add(resolved);
      e.criterion = resolved;
    }
    if (!Number.isInteger(e?.band) || e.band < 1 || e.band > 4) {
      issues.push(`examTechnique[${i}].band must be an integer from 1 to 4`);
    }
    if (!checkString(e?.descriptor, 3, 40)) issues.push(`examTechnique[${i}].descriptor is missing or an unreasonable length`);
    if (!checkString(e?.evidence, 5, 400)) {
      issues.push(`examTechnique[${i}].evidence is missing or an unreasonable length`);
    } else if (submittedText && Number.isInteger(e.band) && e.band >= 2) {
      // On a writing task a band above Emerging has to point at the student's own words.
      const haystack = normalizeForMatch(submittedText);
      const candidates = [e.evidence, ...[...e.evidence.matchAll(/["\u201C']([^"\u201D']{3,200})["\u201D']/g)].map((m) => m[1])];
      if (!candidates.some((c) => normalizeForMatch(c).length >= 3 && haystack.includes(normalizeForMatch(c)))) {
        issues.push(`examTechnique[${i}].evidence must be a short phrase copied exactly from the student's text to support Band ${e.band} (or Band 1 with: Too little writing to judge this yet.)`);
      }
    }
    if (!checkString(e?.toNextBand, 10, 400)) issues.push(`examTechnique[${i}].toNextBand is missing or an unreasonable length`);
  });
  // Scoring only some objectives would let the model quietly skip the ones
  // the piece does badly on, which is the opposite of what an exam report
  // is for.
  const missing = (targetNames || []).filter((n) => !seen.has(n));
  if (missing.length) {
    issues.push(`examTechnique is missing an entry for: ${missing.join(", ")} - every assessment objective must be banded, including ones the piece didn't attempt`);
  }
  if (!checkString(parsed?.examSummary, 15, 400)) {
    issues.push("examSummary is missing, too short, or too long");
  } else if (FABRICATED_MARK_PATTERN.test(stripLengthFacts(parsed.examSummary))) {
    issues.push(`examSummary invents a raw mark, percentage or grade letter ("${parsed.examSummary}") - bands only, never a fabricated exam score`);
  }
}

// The name/description are fixed per GENRE (writingFrameworks.js), not
// tier - the genre comes from the prompt this piece was actually written
// for (see validateWritingPrompt's genre check above), falling back to the
// tier's default for a submission from before "genre" existed. The model
// can only get the NAME wrong (paraphrasing or swapping it for a different
// framework), so that's the one thing checked exactly. "example" only gets
// a length/distinctness check, same depth as other free-text fields, since
// judging whether an example genuinely demonstrates a framework isn't
// something a cheap deterministic check can do.
function validateFrameworkTip(parsed, tier, genre, submittedText, issues) {
  const fw = frameworkFor(genre, tier);
  if (!fw) return;
  const tip = parsed?.frameworkTip;
  if (!tip || tip.name !== fw.name) {
    issues.push(`frameworkTip.name must be exactly "${fw.name}" for this piece's genre`);
  }
  // Grounded in the student's OWN writing, the same "quote it, then rewrite
  // it" mechanic "highlights" uses - a generic demo the child never wrote
  // teaches less than seeing their own sentence actually improved.
  if (!checkString(tip?.quote, 3, 300)) {
    issues.push("frameworkTip.quote is missing or an unreasonable length");
  } else if (!normalizeForMatch(submittedText).includes(normalizeForMatch(tip.quote))) {
    issues.push("frameworkTip.quote does not appear verbatim in the student's submitted text");
  }
  if (!checkString(tip?.revision, 3, 700)) {
    issues.push("frameworkTip.revision is missing or an unreasonable length");
  } else if (checkString(tip?.quote, 1, 100000) && foldLookalikes(tip.revision) === foldLookalikes(tip.quote)) {
    issues.push("frameworkTip.revision is identical to its quote — it must actually rewrite the fragment, not repeat it");
  }
}

// Judges the whole piece, deliberately separate from - and allowed to
// disagree with - the single glow/grow pair (see overallScoreClause in
// prompt.js). Shown in Activity History, not blended into the mastery
// trend line (api/_lib/progressHistory.js), which tracks a different
// thing: per-skill glow/grow direction over time, not a holistic score.
function validateOverallScore(parsed, issues) {
  const score = parsed?.overallScore;
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    issues.push("overallScore must be an integer from 1 to 10");
  }
  if (!checkString(parsed?.scoreReason, 15, 300)) {
    issues.push("scoreReason is missing, too short, or too long");
  }
}

const SPELLING_GRAMMAR_TYPES = new Set(["spelling", "grammar", "punctuation"]);

// A dedicated, always-present spelling/grammar check (see
// spellingGrammarClause in prompt.js) - deliberately separate from
// "highlights", which keep typos IN their quotes on purpose. An empty array
// is a valid, expected result for a clean piece, so this only checks the
// SHAPE of whatever was returned, not that it's non-empty.
function validateSpellingGrammar(parsed, submittedText, issues) {
  const items = parsed?.spellingGrammar;
  if (!Array.isArray(items)) {
    issues.push("spellingGrammar must be an array (empty if the piece has no errors)");
    return;
  }
  if (items.length > 8) {
    issues.push("spellingGrammar must not have more than 8 items");
  }
  // The honest total, so a piece with 15 real errors can say "showing 8 of
  // 15" instead of silently implying the 8 shown are all there is (see
  // SpellingGrammarPanel in app.html). Must never read as fewer errors than
  // are actually listed - that would be a worse lie than not counting at all.
  const total = parsed?.spellingGrammarTotal;
  if (!Number.isInteger(total) || total < 0) {
    issues.push("spellingGrammarTotal must be a non-negative integer");
  } else if (total < items.length) {
    issues.push("spellingGrammarTotal cannot be smaller than the number of items actually listed");
  }
  const normalizedText = normalizeForMatch(submittedText);
  items.forEach((item, i) => {
    if (!checkString(item?.quote, 1, 200)) {
      issues.push(`spellingGrammar[${i}].quote is missing or an unreasonable length`);
    } else if (!normalizedText.includes(normalizeForMatch(item.quote))) {
      issues.push(`spellingGrammar[${i}].quote does not appear verbatim in the student's submitted text`);
    }
    if (!SPELLING_GRAMMAR_TYPES.has(item?.type)) {
      issues.push(`spellingGrammar[${i}].type must be "spelling", "grammar", or "punctuation"`);
    }
    if (!checkString(item?.correction, 1, 240)) {
      issues.push(`spellingGrammar[${i}].correction is missing or an unreasonable length`);
    } else if (checkString(item?.quote, 1, 100000) && foldLookalikes(item.correction) === foldLookalikes(item.quote)) {
      issues.push(`spellingGrammar[${i}].correction is identical to its quote — it must actually fix something`);
    }
  });
}

// "revisedStory", on every plan (see revisedStoryClause in prompt.js): the student's
// whole piece rewritten, corrected and improved. The checks are deliberately the
// mechanical ones a rewrite can fail visibly: it must really differ, keep the
// student's length (so it is still THEIR piece, not a new one), be properly
// capitalised and punctuated, and must not still contain a misspelling the
// spelling check itself listed.
const wordsOf = (t) => String(t).toLowerCase().match(/[a-z0-9À-ɏ']+/g) || [];
function validateRevisedStory(parsed, submittedText, issues, limits) {
  const story = parsed?.revisedStory;
  if (!checkString(story, 5, 20000)) {
    issues.push("revisedStory is missing or an unreasonable length");
    return;
  }
  const original = String(submittedText || "");
  const origCount = wordsOf(original).length;
  const count = wordsOf(story).length;
  // A very short original (a few sentences) naturally grows a little when every error is
  // fixed and a sentence is completed, so the upper limit has some give.
  const lim = limits || { min: Math.max(4, Math.floor(origCount * 0.6)), max: Math.ceil(origCount * 1.35) + 8 };
  if (count < lim.min || count > lim.max) {
    issues.push(`revisedStory length must be between ${lim.min} and ${lim.max} words (it is ${count}): the student's own position and ideas, corrected and improved, developed only as far as the instructions allow, not a different piece`);
  }
  if (foldLookalikes(story) === foldLookalikes(original)) {
    issues.push("revisedStory is identical to the student's text - it must be a corrected, improved version");
  }
  const trimmed = story.trim();
  if (/(^|[\s"“(])i(?=[\s',.!?;:)”"]|$)/.test(trimmed)) {
    issues.push('revisedStory still has a lowercase "i" - the pronoun must be capital I');
  }
  if (!/^["“'‘(]*[A-Z0-9À-Þ]/.test(trimmed)) {
    issues.push("revisedStory must start with a capital letter");
  }
  if (!/[.!?…"”')]$/.test(trimmed)) {
    issues.push("revisedStory must end with proper end punctuation");
  }
  // A misspelling the spelling check named must not survive in the rewrite.
  const storyWords = new Set(wordsOf(story));
  const items = Array.isArray(parsed?.spellingGrammar) ? parsed.spellingGrammar : [];
  items.forEach((item) => {
    if (item?.type !== "spelling" || !checkString(item?.quote, 1, 200) || !checkString(item?.correction, 1, 240)) return;
    const fixedWords = wordsOf(item.correction);
    const fixed = new Set(fixedWords);
    // A word that only gained or lost an ending (outweigh/outweighs, struggle/
    // struggled) is a grammar change, not a misspelling, and the same word can
    // legitimately stay in a rewrite that fixes the grammar another way.
    const inflection = (w) => fixedWords.some((f) => f !== w && (f.startsWith(w) || w.startsWith(f)) && Math.abs(f.length - w.length) <= 3);
    const stillThere = wordsOf(item.quote).filter((w) => w.length > 2 && !fixed.has(w) && !inflection(w) && storyWords.has(w));
    if (stillThere.length) issues.push(`revisedStory still contains the misspelling "${stillThere[0]}" that the spelling check lists - every error must be fixed in the rewrite`);
  });
}

// The spelling/grammar list is a secondary, mechanical section - one entry
// whose "quote" the model paraphrased instead of copying used to fail the
// ENTIRE feedback response (found live: a High School essay rejected 3 times
// running, "spellingGrammar[1].quote does not appear verbatim", alongside the
// exam-technique failure), leaving the student with nothing. An entry that
// can't be shown truthfully (its quote isn't in the text, or its "correction"
// changes nothing) is dropped instead, and the honest total is reduced by
// the same count, since a dropped entry was never a real error to count.
// validateSpellingGrammar still runs afterwards as a backstop.
// A "missing full stop" that is actually right there after the quoted fragment
// (the model quoted up to the word and "corrected" it by adding the mark that
// follows it in the text). Position-aware, so a real missing mark elsewhere is
// still kept; it is the same rule for every country and grade.
function addsPunctuationAlreadyThere(item, submittedText) {
  const quote = String(item.quote);
  const correction = String(item.correction);
  if (!correction.startsWith(quote)) return false;
  const added = correction.slice(quote.length).trim();
  if (!added || /[\p{L}\p{N}]/u.test(added)) return false;
  const text = String(submittedText);
  // Only when EVERY occurrence of the fragment is already followed by the mark;
  // if one occurrence really lacks it, the error is real and is kept.
  let from = 0;
  let seen = 0;
  for (;;) {
    const i = text.indexOf(quote, from);
    if (i === -1) return seen > 0;
    seen++;
    if (!text.slice(i + quote.length).trimStart().startsWith(added)) return false;
    from = i + 1;
  }
}

// A "grow" highlight whose suggested rewrite just repeats its quote, or restates wording that is
// elsewhere in the student's text, is dropped instead of failing the whole response (found live:
// one such suggestion rejected an entire Australian Year 3 story three times running). Only done
// while at least two highlights remain; otherwise the validator still reports it.
function dropRestatingHighlights(parsed, submittedText) {
  if (!parsed || !Array.isArray(parsed.highlights) || !submittedText) return parsed;
  const text = normalizeForMatch(submittedText);
  const bad = (h) => h && h.type === "grow" && checkString(h.quote, 1, 100000) && checkString(h.revision, 1, 100000) &&
    (foldLookalikes(h.revision) === foldLookalikes(h.quote) || revisionDuplicatesExistingText(h.revision, text, normalizeForMatch(h.quote)));
  const kept = parsed.highlights.filter((h) => !bad(h));
  if (kept.length >= 2 && kept.length < parsed.highlights.length) parsed.highlights = kept;
  return parsed;
}

// A highlight whose "quote" is a paraphrase, not the student's own words, cannot be shown against their text. One such
// highlight used to fail the whole response three times running (found live on a Year 11 essay: "highlights[4].quote does
// not appear verbatim"), so it is dropped and the rest kept, as long as at least two real ones remain.
function dropNonVerbatimHighlights(parsed, submittedText) {
  if (!parsed || !Array.isArray(parsed.highlights) || !submittedText) return parsed;
  const text = normalizeForMatch(submittedText);
  const real = (h) => h && checkString(h.quote, 3, 200) && text.includes(normalizeForMatch(h.quote));
  const kept = parsed.highlights.filter(real);
  if (kept.length >= 2 && kept.length < parsed.highlights.length) parsed.highlights = kept;
  return parsed;
}

// Words the spelling check lists as misspelled (in the quote, not in its fix).
function misspeltWords(parsed) {
  const out = new Set();
  for (const item of Array.isArray(parsed?.spellingGrammar) ? parsed.spellingGrammar : []) {
    if (item?.type !== "spelling" || typeof item.quote !== "string" || typeof item.correction !== "string") continue;
    const fixed = new Set(wordsOf(item.correction));
    for (const w of wordsOf(item.quote)) if (w.length > 2 && !fixed.has(w)) out.add(w);
  }
  return out;
}

// A "glow" highlight whose quote contains a word the spelling check says is
// misspelled would praise the very error listed beside it, so it is dropped.
// Premium framework labels: unknown parts and non-verbatim quotes are dropped, the rest ordered as they occur.
function repairResponses(parsed, genre, tier) {
  const fw = frameworkFor(genre, tier);
  if (!parsed || !fw) return parsed;
  RESP.composeModelResponse(parsed, fw);
  RESP.repairFrameworkLabels(parsed, fw, "revisedFramework", "revisedStory");
  RESP.sortByPosition(parsed, "revisedFramework", "revisedStory");
  return parsed;
}

function dropGlowsQuotingMisspellings(parsed) {
  if (!parsed || !Array.isArray(parsed.highlights)) return parsed;
  const bad = misspeltWords(parsed);
  if (!bad.size) return parsed;
  const kept = parsed.highlights.filter((h) => !(h && h.type === "glow" && typeof h.quote === "string" && wordsOf(h.quote).some((w) => bad.has(w))));
  if (kept.length > 0 && kept.length < parsed.highlights.length) parsed.highlights = kept;
  return parsed;
}

function dropInvalidSpellingGrammar(parsed, submittedText) {
  if (!parsed || !Array.isArray(parsed.spellingGrammar) || !submittedText) return parsed;
  const normalizedText = normalizeForMatch(submittedText);
  const kept = parsed.spellingGrammar.filter((item) =>
    checkString(item?.quote, 1, 200) && checkString(item?.correction, 1, 240) &&
    normalizedText.includes(normalizeForMatch(item.quote)) &&
    foldLookalikes(item.correction) !== foldLookalikes(item.quote) &&
    !addsPunctuationAlreadyThere(item, submittedText));
  const dropped = parsed.spellingGrammar.length - kept.length;
  if (dropped > 0) {
    parsed.spellingGrammar = kept;
    if (Number.isInteger(parsed.spellingGrammarTotal)) {
      parsed.spellingGrammarTotal = Math.max(kept.length, parsed.spellingGrammarTotal - dropped);
    }
  }
  return parsed;
}

// The per-question explanations on a graded reading attempt (see
// questionReviewClause in prompt.js). Deliberately lenient about COUNT: the
// UI simply shows an explanation for each question that has one, and a
// missing entry shouldn't reject feedback that is otherwise good (the same
// "one gap sinks everything" failure the exam-technique and spelling
// sections both hit) - the pre-numbered template in the prompt is what keeps
// the array complete in practice.
// The marking of the one short written answer. The model only says WHICH key ideas the student made;
// the server turns that into marks (one per idea, never above the question's marks), so a model can
// neither award more than the maximum nor contradict its own list. Nothing written scores 0.
function repairShortAnswer(parsed, shortQ, written) {
  if (!parsed || !shortQ) return parsed;
  const sa = parsed.shortAnswer;
  if (!sa || typeof sa !== "object") return parsed;
  const kp = Array.isArray(shortQ.keyPoints) ? shortQ.keyPoints : [];
  const blank = !(typeof written === "string" && written.trim().length >= 2);
  if (Array.isArray(sa.made) || blank) {
    const made = blank ? [] : [...new Set(sa.made.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= kp.length))].sort((x, y) => x - y);
    sa.made = made;
    sa.awarded = Math.min(shortQ.marks, made.length);
    sa.outOf = shortQ.marks;
    sa.hit = made.map((n) => kp[n - 1]);
    sa.missed = kp.filter((_, i) => !made.includes(i + 1));
    if (blank) sa.comment = "You did not write an answer to this one. Have a go next time, even a short answer earns marks.";
  }
  // Which parts of the answer-building framework (RACE or CER) the answer used: for the student's information only.
  const fw = require("./questionTypes").answerFramework(shortQ.framework);
  if (fw) {
    const names = fw.parts.map(([n]) => n);
    const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z]/g, "");
    const said = Array.isArray(sa.structure) ? new Set(sa.structure.map(norm)) : null;
    if (blank) sa.parts = names.map((name) => ({ name, used: false }));
    else if (said) sa.parts = names.map((name) => ({ name, used: said.has(norm(name)) }));
    else delete sa.parts;
    delete sa.structure;
  }
  return parsed;
}
function validateShortAnswer(parsed, shortQ, issues) {
  if (!shortQ) return;
  const sa = parsed?.shortAnswer;
  if (!sa || typeof sa !== "object") { issues.push("shortAnswer is missing"); return; }
  if (!Array.isArray(sa.made)) issues.push("shortAnswer.made must be a list of the numbers of the key ideas the student made");
  if (!checkString(sa.comment, 10, 450)) issues.push("shortAnswer.comment is missing, too short, or too long");
}

function validateQuestionReview(parsed, issues) {
  const items = parsed?.questionReview;
  if (!Array.isArray(items) || items.length < 1 || items.length > 10) {
    issues.push("questionReview must be an array with one explanation per question");
    return;
  }
  const seen = new Set();
  items.forEach((item, i) => {
    if (!Number.isInteger(item?.n) || item.n < 1 || item.n > 10) {
      issues.push(`questionReview[${i}].n must be the question number (an integer)`);
    } else if (seen.has(item.n)) {
      issues.push(`questionReview[${i}].n repeats question ${item.n}`);
    } else {
      seen.add(item.n);
    }
    if (!checkString(item?.explanation, 10, 400)) issues.push(`questionReview[${i}].explanation is missing, too short, or too long`);
  });
}

// Runs before validation on reading feedback: keeps only entries that refer
// to a real question (once each), and drops an "evidence" quote that is not
// actually in the passage. Presenting a paraphrase as a quote from the text
// would be misleading, but that's not worth failing the whole response for -
// the explanation next to it can still stand on its own.
function sanitizeQuestionReview(parsed, passageText, questionCount) {
  if (!parsed || !Array.isArray(parsed.questionReview)) return parsed;
  const normalizedPassage = passageText ? normalizeForMatch(passageText) : null;
  const seen = new Set();
  parsed.questionReview = parsed.questionReview.filter((item) => {
    if (!Number.isInteger(item?.n) || item.n < 1 || (questionCount && item.n > questionCount) || seen.has(item.n)) return false;
    seen.add(item.n);
    return true;
  }).map((item) => {
    if (typeof item.evidence === "string" && normalizedPassage && !normalizedPassage.includes(normalizeForMatch(item.evidence))) {
      const { evidence, ...rest } = item;
      return rest;
    }
    return item;
  });
  return parsed;
}

// The last line of defence for what a plan is sold: after validation and
// before the feedback is stored or sent, delete every section this plan (or
// this kind of exercise) doesn't include. The prompt already doesn't ask for
// them, but a model can over-deliver anyway - and every panel in the app is
// driven by whether its data is PRESENT, so a stray overallScore on a Core
// account, an examTechnique block on Free, or a framework spotlight on a
// reading attempt would just render. Which sections exist is the server's
// decision, not the model's.
function stripUngrantedSections(parsed, { capabilities, kind }) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const caps = capabilities || {};
  const drop = (...keys) => keys.forEach((k) => { delete parsed[k]; });

  // Retired features; nothing renders them any more.
  drop("commitOptions", "followUp");

  if (!caps.deepFeedback) drop("growNext", "modelResponse", "modelFramework", "revisedFramework", "shortAnswer");
  if (!caps.examTechnique) drop("examTechnique", "examSummary");

  if (kind === "reading") {
    // Reading has no free-text submission of the student's own to quote from.
    drop("highlights", "frameworkTip", "overallScore", "scoreReason", "spellingGrammar", "spellingGrammarTotal", "revisedStory", "modelResponse", "modelFramework", "revisedFramework");
  } else {
    drop("questionReview", "readingStrategy", "shortAnswer");
    if (caps.overallScore === false) drop("overallScore", "scoreReason");
    if (caps.spellingGrammar === false) drop("spellingGrammar", "spellingGrammarTotal");
  }
  return parsed;
}

function validateFeedback(parsed, { tier, standardsList, targetNames, submittedText, readingScore, capabilities, genre, lengthLevel, lengthInfo, examTargetNames, shortQuestion }) {
  const issues = [];
  if (lengthInfo && !lengthLevel) lengthLevel = lengthInfo.level;
  if ((lengthLevel === "thin" || lengthLevel === "minimal") && checkString(parsed?.grow, 1, 100000) && !growDevelops(parsed.grow)) {
    issues.push("grow must be about developing this very short piece (adding the next reason, example or detail), not only polishing its wording");
  }
  const caps = capabilities || {};

  if (!checkString(parsed?.glow, 20, 600)) issues.push("glow is missing, too short, or too long");
  if (!checkString(parsed?.grow, 20, 600)) issues.push("grow is missing, too short, or too long");

  if (readingScore === 0 && checkString(parsed?.glow, 1, 100000) && ZERO_SCORE_FABRICATION_PATTERN.test(parsed.glow)) {
    issues.push(`glow fabricates comprehension the student didn't demonstrate on a 0-correct attempt ("${parsed.glow}") - it must praise real effort without claiming they engaged with, noticed, or understood anything from the passage`);
  }

  if (!Array.isArray(parsed?.vocab) || parsed.vocab.length !== 2) {
    issues.push("vocab must be an array of exactly 2 items");
  } else {
    parsed.vocab.forEach((v, i) => {
      if (!checkString(v?.term, 1, 50)) issues.push(`vocab[${i}].term is missing or too long`);
      if (!checkString(v?.definition, 10, 240)) issues.push(`vocab[${i}].definition is missing, too short, or too long`);
      if (!checkString(v?.example, 10, 240)) {
        issues.push(`vocab[${i}].example is missing, too short, or too long`);
      } else if (checkString(v?.term, 1, 100000) && !new RegExp(v.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(v.example)) {
        issues.push(`vocab[${i}].example does not actually use the term "${v.term}"`);
      }
    });
  }

  if (checkString(parsed?.glow, 1, 100000) && checkString(parsed?.grow, 1, 100000)) {
    const combined = `${parsed.glow} ${parsed.grow}`;
    const avg = avgWordsPerSentence(combined);
    const cap = MAX_AVG_WORDS_PER_SENTENCE[tier] || 30;
    // The model is told to stay under the cap; the check allows a small overshoot,
    // because a piece a couple of words over is still age-appropriate and a retry for
    // it just costs time (the first quality runs showed 15 to 20 words against 14 and 18).
    if (avg > cap + SENTENCE_LENGTH_TOLERANCE) issues.push(`sentences are too long for this age tier (avg ${avg.toFixed(1)} words/sentence, expected under ${cap})`);

    // A 0-correct glow can only honestly praise effort, so it cannot also tie
    // to a comprehension standard the student did not demonstrate.
    if (readingScore !== 0 && !mentionsAStandard(parsed.glow, standardsList)) {
      issues.push("glow does not appear to reference the specific curriculum standard it was given");
    }
  }

  if (!matchesATarget(parsed?.glowTarget, targetNames)) {
    issues.push(`glowTarget must exactly match one of the given skill area names: ${(targetNames || []).join(", ")}`);
  }
  if (!matchesATarget(parsed?.growTarget, targetNames)) {
    issues.push(`growTarget must exactly match one of the given skill area names: ${(targetNames || []).join(", ")}`);
  }

  // Only writing feedback carries a submittedText to check highlights
  // against — reading has no free-text submission of the student's own to
  // quote from.
  if (submittedText) {
    if (!Array.isArray(parsed?.highlights) || parsed.highlights.length < 2 || parsed.highlights.length > 10) {
      issues.push("highlights must be an array of 2-10 items");
    } else {
      const normalizedText = normalizeForMatch(submittedText);
      parsed.highlights.forEach((h, i) => {
        if (!checkString(h?.quote, 3, 200)) {
          issues.push(`highlights[${i}].quote is missing or an unreasonable length`);
        } else if (!normalizedText.includes(normalizeForMatch(h.quote))) {
          issues.push(`highlights[${i}].quote does not appear verbatim in the student's submitted text — it must be an exact substring, not a paraphrase`);
        }
        if (h?.type !== "glow" && h?.type !== "grow") issues.push(`highlights[${i}].type must be "glow" or "grow"`);
        if (!checkString(h?.note, 5, 200)) issues.push(`highlights[${i}].note is missing or an unreasonable length`);
        // "grow" highlights must show the fix applied to the student's own
        // words, not just describe it — the whole point of this field. A
        // revision identical (ignoring case/whitespace) to the original
        // quote means the model didn't actually rewrite anything.
        if (h?.type === "grow") {
          if (!checkString(h?.revision, 3, 300)) {
            issues.push(`highlights[${i}].revision is missing or an unreasonable length (required for type "grow")`);
          } else if (checkString(h?.quote, 1, 100000) && foldLookalikes(h.revision) === foldLookalikes(h.quote)) {
            issues.push(`highlights[${i}].revision is identical to its quote — it must actually rewrite the fragment, not repeat it`);
          } else if (checkString(h?.quote, 1, 100000) && revisionDuplicatesExistingText(h.revision, normalizedText, normalizeForMatch(h.quote))) {
            issues.push(`highlights[${i}].revision restates wording that already appears elsewhere in the student's text — since it's spliced in place of the quote only, this would duplicate that text in the final story`);
          } else if ((tier === "middle" || tier === "high") && /\b(like how|similar to how|just like|much like)\b/i.test(h.revision)) {
            // Prompt instructions alone weren't enough here - a retest of the
            // formal-tone fix caught the model swapping first-person "like
            // how I" for third-person "similar to how [interest]", still an
            // out-of-place analogy spliced into a formal essay. Enforced
            // here rather than left to hoping the model follows the prompt.
            issues.push(`highlights[${i}].revision contains an interest-based analogy ("${h.revision}") - for middle/high tiers, revision must be pure formal academic writing with no analogy of any kind; the analogy belongs only in the "grow" field`);
          }
        }
      });
    }
    validateFrameworkTip(parsed, tier, genre, submittedText, issues);
    // Premium-only (api/_lib/plans.js). Skipped only when the plan explicitly
    // says false; callers with no plan info keep the full checks.
    if (caps.overallScore !== false) validateOverallScore(parsed, issues);
    // Every plan gets the corrected rewrite of the student's piece.
    validateRevisedStory(parsed, submittedText, issues, lengthInfo ? RESP.revisedLimits(lengthInfo, RESP.wordCount(submittedText)) : undefined);
    // Premium: the model response and the framework labels for both responses.
    if (caps.deepFeedback) {
      const fw = frameworkFor(genre, tier);
      if (fw) {
        RESP.validateResponses(parsed, { fw, assessment: lengthInfo || assessLength({ text: submittedText, tier, country: undefined, gradeLabel: undefined }), submittedText }, issues);
      }
    }
    if (caps.spellingGrammar !== false) {
      validateSpellingGrammar(parsed, submittedText, issues);
    }
  }

  if (caps.deepFeedback) {
    if (!checkString(parsed?.growNext, 20, 600)) {
      issues.push("growNext is missing, too short, or too long");
    } else if (checkString(parsed?.grow, 1, 100000) && normalizeForMatch(parsed.growNext) === normalizeForMatch(parsed.grow)) {
      issues.push("growNext is identical to grow - it must be a genuinely harder, different next step");
    } else if (checkString(parsed?.grow, 1, 100000) && wordOverlap(parsed.growNext, parsed.grow) >= 0.7) {
      issues.push("growNext is mostly the same words as grow - it must be a genuinely harder next step, not a rewording of the main grow");
    } else if (GROW_NEXT_ANALOGY.test(parsed.growNext)) {
      // A forced comparison ("like how animals in a pack...") made a real
      // step read as filler, so this field never carries one.
      issues.push("growNext contains an analogy or comparison - it must be a plain, concrete action with no analogy of any kind");
    } else {
      // A step is only useful if the student can see where to apply it, so it
      // must point at their own work: a verbatim quote for writing, or a quote
      // / a named question, paragraph or sentence for reading.
      const quotes = [...parsed.growNext.matchAll(/["“]([^"”]{4,160})["”]/g)].map((m) => m[1]);
      if (submittedText) {
        const haystack = normalizeForMatch(submittedText);
        if (!quotes.some((q) => haystack.includes(normalizeForMatch(q)))) {
          issues.push("growNext must quote a short fragment (3 to 10 words) exactly as it appears in the student's own text, and say what to do with it");
        }
      } else if (!quotes.length && !/\b(question|paragraph|passage|sentence)\b/i.test(parsed.growNext)) {
        issues.push("growNext must point to something specific in the student's work (a quoted phrase, or a named question, paragraph or sentence)");
      }
    }
  }

  // caps.examTechnique arriving here is already tier-resolved by submit.js -
  // the plan can grant it while the student's tier has no banded objectives.
  if (caps.examTechnique) {
    validateExamTechnique(parsed, examTargetNames || targetNames, issues, submittedText);
  }

  // Reading feedback only (readingScore is undefined for writing).
  if (readingScore !== undefined) {
    validateQuestionReview(parsed, issues);
    validateShortAnswer(parsed, shortQuestion, issues);
    TECH.validateReadingStrategy(parsed, tier, issues);
  }

  return { ok: issues.length === 0, issues };
}

// Approximate word-count bounds per tier for an AI-generated reading
// passage — wide enough to allow natural variation, tight enough to catch
// the model producing something wildly too short/long for the age group.
const PASSAGE_WORD_BOUNDS = { early: [40, 160], elementary: [100, 290], middle: [160, 400], high: [220, 520] };

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Structural checks for an AI-generated reading passage + questions. Can't
// verify the "correct" answer is actually correct (that would need a second
// model call), but catches the failure modes that matter most: wrong shape,
// a passage way off-length for the age group, or an out-of-range answer
// index that would silently break grading.
// The passage and its questions. With a template, the questions must follow its styles exactly
// (see api/_lib/questionTypes.js); without one, the original five multiple-choice questions.
function validatePassage(parsed, { tier, template, textType }) {
  const issues = [];

  if (!checkString(parsed?.title, 2, 100)) issues.push("title is missing or an unreasonable length");
  if (!checkString(parsed?.skill, 2, 100)) issues.push("skill is missing or an unreasonable length");
  if (!checkString(parsed?.passage, 20, 3000)) {
    issues.push("passage is missing or an unreasonable length");
  } else {
    const [min0, max] = PASSAGE_WORD_BOUNDS[tier] || [20, 400];
    const min = textType && (textType.lines || textType.visual) ? 25 : min0; // a poem, or a short text that comes with data, is shorter than prose
    const words = wordCount(parsed.passage);
    if (words < min || words > max) issues.push(`passage is ${words} words, expected roughly ${min}-${max} for this age tier`);
  }

  if (textType && textType.visual) require("./visualText").validateVisual(parsed?.visual, textType.visual, issues);
  if (textType && textType.two) {
    const text = typeof parsed?.passage === "string" ? parsed.passage : "";
    const m = text.match(/^\s*Text A:[^\n]*\n([\s\S]*?)\n\s*Text B:[^\n]*\n([\s\S]*)$/);
    if (!m) issues.push('passage must hold two texts: a line "Text A: <title>", its paragraphs, a blank line, then a line "Text B: <title>" and its paragraphs');
    else if (wordCount(m[1]) < 25 || wordCount(m[2]) < 25) issues.push("each of the two texts must be at least 25 words");
  }
  require("./questionTypes").validateQuestions(parsed?.questions, { template, passage: parsed?.passage }, issues);

  return { ok: issues.length === 0, issues };
}

// Structural check for an AI-generated writing prompt — deliberately loose
// on content (there's no "correct answer" to a creative prompt), just
// catches the model returning something malformed or absurdly short/long.
function validateWritingPrompt(parsed, { tier }) {
  const issues = [];
  if (!checkString(parsed?.title, 2, 100)) issues.push("title is missing or an unreasonable length");
  if (!checkString(parsed?.prompt, 10, 400)) issues.push("prompt is missing, too short, or too long");
  // Drives which named writing framework this piece is later taught with
  // (see writingFrameworks.js) - must be one of the real, known genres, not
  // an invented or paraphrased one, or frameworkForGenre() would silently
  // fail to find it and fall back to the tier default anyway.
  if (!VALID_GENRES.includes(parsed?.genre)) {
    issues.push(`genre must be exactly one of: ${VALID_GENRES.join(", ")}`);
  }
  return { ok: issues.length === 0, issues };
}

module.exports = { dropNonVerbatimHighlights, validateExamTechnique, repairShortAnswer, dropRestatingHighlights, repairResponses, dropGlowsQuotingMisspellings, repairZeroScoreGlow, repairReadingExamEvidence, validateFeedback, validatePassage, validateWritingPrompt, resolveTarget, dropInvalidSpellingGrammar, sanitizeQuestionReview, stripUngrantedSections, MAX_AVG_WORDS_PER_SENTENCE };
