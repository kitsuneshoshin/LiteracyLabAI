// Subject-line A/B test for the emails with enough volume to learn from. Half of the parents who get one of
// these emails see the original subject (A) and half see the alternative (B). The half is chosen from the
// parent's id and the email name, so the same parent always lands in the same half and nothing needs to be
// stored. Results come from the open rates Resend reports per subject (see emailStats.js).
const crypto = require("node:crypto");

const SUBJECT_B = {
  "free-welcome": "Your LiteracyLab AI account is ready: start with one short piece",
  "free-nudge": "Your child's first piece is waiting",
  "free-limit": "Three pieces done: here's what comes next",
  "free-weekly-lite": "Your child's week: pieces, words and one next step",
};

function variantFor(key, profileId) {
  if (!SUBJECT_B[key]) return null;
  const h = crypto.createHash("sha256").update(`${key}:${profileId}`).digest();
  return h[0] % 2 === 0 ? "A" : "B";
}

// Returns the email with the B subject when this parent is in half B. Only the subject line changes.
function applyVariant(key, profileId, built) {
  const variant = variantFor(key, profileId);
  if (variant === "B") return { ...built, subject: SUBJECT_B[key], variant };
  return variant ? { ...built, variant } : built;
}

module.exports = { SUBJECT_B, variantFor, applyVariant };
