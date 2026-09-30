// One entry point for "write email X", whichever file defines it, so the daily
// job, the Stripe webhook and the owner's test-copies action all build emails
// the same way.

const { buildFreeEmail, FREE_EMAIL_KEYS } = require("./freeEmails");
const { buildPaidEmail, PAID_EMAIL_KEYS, isTransactional } = require("./paidEmails");

const ALL_EMAIL_KEYS = [...FREE_EMAIL_KEYS, ...PAID_EMAIL_KEYS];

/** Returns { subject, html, text, bcc, transactional }. */
function buildAnyEmail(key, ctx) {
  if (FREE_EMAIL_KEYS.includes(key)) {
    const e = buildFreeEmail(key, ctx);
    return { ...e, transactional: false };
  }
  return buildPaidEmail(key, ctx);
}

// Realistic sample values for every field an email can use, so the owner's test
// copies show each email the way a real customer would see it.
function sampleContext(key) {
  const c = {
    stats: { pieces: 3, words: 420, glow: "Fronted Adverbials", grow: "Modal Verbs" },
    pieces: 3, words: 420, days: 3, readingAvg: 80, glow: "Fronted Adverbials", grow: "Modal Verbs",
    learners: [{ name: "Maya", pieces: 2, words: 300 }, { name: "Sam", pieces: 1, words: 120 }],
    total: 10, planLabel: "Core", endDate: "30 October 2026", maxLearners: 1, paused: 2,
  };
  if (key === "milestone-25") c.total = 25;
  if (key.startsWith("milestone-")) c.words = key === "milestone-25" ? 2600 : 1100;
  if (key === "prem-digest" || key === "prem-welcome" || key === "prem-paused") c.planLabel = "Premium";
  return c;
}

module.exports = { buildAnyEmail, ALL_EMAIL_KEYS, isTransactional, sampleContext };
