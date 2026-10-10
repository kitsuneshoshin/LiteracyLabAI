// The "spelling, punctuation and grammar" target on a learner's progress page used to fill in only when the AI happened to
// choose it as the Glow or the Grow. Premium writing already gets a full spelling and grammar check, so that check now
// counts too: few errors for the length is a strength, many is a next step. Free and Core have no itemised check, so
// they are unchanged. The target is found by name because each curriculum words it differently.
const NAME = /spelling|punctuation|grammar|conventions|technical accuracy/i;
const MIN_WORDS = 15;
const STRONG_PER_100 = 2; // at most this many errors per 100 words: a strength
const WEAK_PER_100 = 5; // at least this many: a next step

function conventionsTarget(targets) {
  const hits = (targets || []).filter((t) => NAME.test(t.name));
  return hits.length === 1 ? hits[0].name : null;
}

// "g", "n" or null for one saved piece of writing.
function conventionsOutcome(submission) {
  const fb = (submission && submission.feedback) || {};
  const total = fb.spellingGrammarTotal;
  const words = Number(submission && submission.word_count);
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(words) || words < MIN_WORDS) return null;
  const per100 = (total / words) * 100;
  if (per100 <= STRONG_PER_100) return "g";
  if (per100 >= WEAK_PER_100) return "n";
  return null;
}

module.exports = { conventionsTarget, conventionsOutcome, STRONG_PER_100, WEAK_PER_100, MIN_WORDS };
