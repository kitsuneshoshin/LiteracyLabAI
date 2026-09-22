// Deterministic, cheap checks run on every LLM response before it ever
// reaches a child. Catches the model quietly ignoring an instruction -
// wrong shape, suspiciously generic text, or a syllabus citation that
// never actually shows up. Not a substitute for reading real output
// yourself occasionally (every submission's feedback is saved to
// submissions.feedback in Supabase for exactly that purpose).

const MAX_AVG_WORDS_PER_SENTENCE = { early: 14, elementary: 18, middle: 24, high: 32 };
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
const FABRICATED_MARK_PATTERN = /\b(\d{1,3}\s*(\/|out of)\s*\d{1,3}|\d{1,3}\s*%|grade\s*[A-E1-9][*+-]?\b)/i;

function validateExamTechnique(parsed, targetNames, issues) {
  const entries = parsed?.examTechnique;
  if (!Array.isArray(entries) || entries.length === 0) {
    issues.push("examTechnique must be an array with one entry per assessment objective");
    return;
  }
  const seen = new Set();
  entries.forEach((e, i) => {
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
    if (!checkString(e?.evidence, 5, 400)) issues.push(`examTechnique[${i}].evidence is missing or an unreasonable length`);
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
  } else if (FABRICATED_MARK_PATTERN.test(parsed.examSummary)) {
    issues.push(`examSummary invents a raw mark, percentage or grade letter ("${parsed.examSummary}") - bands only, never a fabricated exam score`);
  }
}

function validateFeedback(parsed, { tier, standardsList, targetNames, submittedText, readingScore, capabilities }) {
  const issues = [];
  const caps = capabilities || {};

  if (!checkString(parsed?.glow, 20, 600)) issues.push("glow is missing, too short, or too long");
  if (!checkString(parsed?.grow, 20, 600)) issues.push("grow is missing, too short, or too long");
  if (!checkString(parsed?.microMission, 10, 300)) issues.push("microMission is missing, too short, or too long");

  if (readingScore === 0 && checkString(parsed?.glow, 1, 100000) && ZERO_SCORE_FABRICATION_PATTERN.test(parsed.glow)) {
    issues.push(`glow fabricates comprehension the student didn't demonstrate on a 0-correct attempt ("${parsed.glow}") - it must praise real effort without claiming they engaged with, noticed, or understood anything from the passage`);
  }

  if (!Array.isArray(parsed?.vocab) || parsed.vocab.length !== 2) {
    issues.push("vocab must be an array of exactly 2 items");
  } else {
    parsed.vocab.forEach((v, i) => {
      if (!checkString(v?.term, 1, 50)) issues.push(`vocab[${i}].term is missing or too long`);
      if (!checkString(v?.definition, 10, 240)) issues.push(`vocab[${i}].definition is missing, too short, or too long`);
    });
  }

  if (!Array.isArray(parsed?.commitOptions) || parsed.commitOptions.length < 2 || parsed.commitOptions.length > 4) {
    issues.push("commitOptions must be an array of 2-4 short items");
  } else {
    parsed.commitOptions.forEach((opt, i) => {
      if (!checkString(opt, 5, 120)) issues.push(`commitOptions[${i}] is missing, too short, or too long`);
    });
  }

  if (checkString(parsed?.glow, 1, 100000) && checkString(parsed?.grow, 1, 100000)) {
    const combined = `${parsed.glow} ${parsed.grow}`;
    const avg = avgWordsPerSentence(combined);
    const cap = MAX_AVG_WORDS_PER_SENTENCE[tier] || 30;
    if (avg > cap) issues.push(`sentences are too long for this age tier (avg ${avg.toFixed(1)} words/sentence, expected under ${cap})`);

    if (!mentionsAStandard(parsed.glow, standardsList)) {
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
    if (!Array.isArray(parsed?.highlights) || parsed.highlights.length < 2 || parsed.highlights.length > 6) {
      issues.push("highlights must be an array of 2-6 items");
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
          } else if (checkString(h?.quote, 1, 100000) && normalizeForMatch(h.revision) === normalizeForMatch(h.quote)) {
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
  }

  if (caps.deepFeedback) {
    if (!checkString(parsed?.growNext, 20, 600)) {
      issues.push("growNext is missing, too short, or too long");
    } else if (checkString(parsed?.grow, 1, 100000) && normalizeForMatch(parsed.growNext) === normalizeForMatch(parsed.grow)) {
      issues.push("growNext is identical to grow - it must be a genuinely harder, different next step");
    }
  }

  // caps.examTechnique arriving here is already tier-resolved by submit.js -
  // the plan can grant it while the student's tier has no banded objectives.
  if (caps.examTechnique) {
    validateExamTechnique(parsed, targetNames, issues);
  }

  return { ok: issues.length === 0, issues };
}

// Approximate word-count bounds per tier for an AI-generated reading
// passage — wide enough to allow natural variation, tight enough to catch
// the model producing something wildly too short/long for the age group.
const PASSAGE_WORD_BOUNDS = { early: [20, 100], elementary: [60, 220], middle: [100, 320], high: [140, 450] };

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Structural checks for an AI-generated reading passage + questions. Can't
// verify the "correct" answer is actually correct (that would need a second
// model call), but catches the failure modes that matter most: wrong shape,
// a passage way off-length for the age group, or an out-of-range answer
// index that would silently break grading.
function validatePassage(parsed, { tier }) {
  const issues = [];

  if (!checkString(parsed?.title, 2, 100)) issues.push("title is missing or an unreasonable length");
  if (!checkString(parsed?.skill, 2, 100)) issues.push("skill is missing or an unreasonable length");
  if (!checkString(parsed?.passage, 20, 3000)) {
    issues.push("passage is missing or an unreasonable length");
  } else {
    const [min, max] = PASSAGE_WORD_BOUNDS[tier] || [20, 400];
    const words = wordCount(parsed.passage);
    if (words < min || words > max) issues.push(`passage is ${words} words, expected roughly ${min}-${max} for this age tier`);
  }

  if (!Array.isArray(parsed?.questions) || parsed.questions.length !== 3) {
    issues.push("questions must be an array of exactly 3 items");
  } else {
    parsed.questions.forEach((q, i) => {
      if (!checkString(q?.q, 5, 300)) issues.push(`questions[${i}].q is missing or an unreasonable length`);
      if (!Array.isArray(q?.options) || q.options.length !== 4) {
        issues.push(`questions[${i}].options must be an array of exactly 4 items`);
      } else {
        q.options.forEach((opt, oi) => {
          if (!checkString(opt, 1, 150)) issues.push(`questions[${i}].options[${oi}] is missing or an unreasonable length`);
        });
        const unique = new Set(q.options.map((o) => String(o).trim().toLowerCase()));
        if (unique.size !== q.options.length) issues.push(`questions[${i}].options has duplicate answer choices`);
      }
      if (!Number.isInteger(q?.correct) || q.correct < 0 || q.correct > 3) {
        issues.push(`questions[${i}].correct must be an integer from 0 to 3`);
      }
    });
  }

  return { ok: issues.length === 0, issues };
}

// Structural check for an AI-generated writing prompt — deliberately loose
// on content (there's no "correct answer" to a creative prompt), just
// catches the model returning something malformed or absurdly short/long.
function validateWritingPrompt(parsed, { tier }) {
  const issues = [];
  if (!checkString(parsed?.title, 2, 100)) issues.push("title is missing or an unreasonable length");
  if (!checkString(parsed?.prompt, 10, 400)) issues.push("prompt is missing, too short, or too long");
  return { ok: issues.length === 0, issues };
}

module.exports = { validateFeedback, validatePassage, validateWritingPrompt, resolveTarget, MAX_AVG_WORDS_PER_SENTENCE };
