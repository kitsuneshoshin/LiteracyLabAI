// Turns a child's stored vocab bank (see api/vocab-bank.js) into a
// multiple-choice self-test: "which definition is correct for this word?".
// Pure and DB-free so it can be unit tested without Supabase.

const MIN_TERMS_TO_QUIZ = 4;
const OPTIONS_PER_QUESTION = 4;

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Keeps only the newest entry per term (words is assumed newest-first, the
// order api/vocab-bank.js's query returns) - a word re-taught across
// several submissions shouldn't appear as a duplicate quiz question, and
// the most recent definition is the one most likely to still make sense
// given the student's current stated interest.
function dedupeByTerm(words) {
  const seen = new Set();
  const out = [];
  for (const w of words) {
    const key = w.term.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

// Builds up to `count` questions from a child's vocab history. Returns
// { available, questions } - "available" is the distinct-term count, so the
// caller can explain why fewer than `count` questions came back (or none at
// all, below MIN_TERMS_TO_QUIZ) rather than the UI just looking broken.
function buildQuiz(words, count = 5, rng = Math.random) {
  const distinct = dedupeByTerm(words || []);
  if (distinct.length < MIN_TERMS_TO_QUIZ) {
    return { available: distinct.length, minRequired: MIN_TERMS_TO_QUIZ, questions: [] };
  }

  const pool = shuffle(distinct, rng).slice(0, Math.min(count, distinct.length));
  const questions = pool.map((correct) => {
    const distractorPool = shuffle(distinct.filter((w) => w !== correct), rng)
      .slice(0, OPTIONS_PER_QUESTION - 1);
    const options = shuffle([correct, ...distractorPool], rng);
    return {
      term: correct.term,
      options: options.map((w) => w.definition),
      correctIndex: options.indexOf(correct),
    };
  });

  return { available: distinct.length, minRequired: MIN_TERMS_TO_QUIZ, questions };
}

module.exports = { buildQuiz, dedupeByTerm, MIN_TERMS_TO_QUIZ, OPTIONS_PER_QUESTION };
