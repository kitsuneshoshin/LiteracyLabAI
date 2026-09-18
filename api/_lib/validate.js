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

// glowTarget/growTarget drive the real mastery computation in
// api/progress.js, so an exact (case-insensitive) match against the
// target list actually given to the model matters — a paraphrase would
// silently fail to aggregate into that student's per-skill history.
function matchesATarget(value, targetNames) {
  if (!targetNames || targetNames.length === 0) return true;
  if (typeof value !== "string") return false;
  const lower = value.trim().toLowerCase();
  return targetNames.some((n) => n.toLowerCase() === lower);
}

function validateFeedback(parsed, { tier, standardsList, targetNames }) {
  const issues = [];

  if (!checkString(parsed?.glow, 20, 600)) issues.push("glow is missing, too short, or too long");
  if (!checkString(parsed?.grow, 20, 600)) issues.push("grow is missing, too short, or too long");
  if (!checkString(parsed?.microMission, 10, 300)) issues.push("microMission is missing, too short, or too long");

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

  return { ok: issues.length === 0, issues };
}

module.exports = { validateFeedback };
