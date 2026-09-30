// Every email that is not a Free-plan lifecycle email: Core and Premium
// lifecycle, billing, and the "we miss you" emails that apply to everyone.
// Like freeEmails.js it is pure: pickPaidEmail / pickSharedEmail decide WHO gets
// WHAT from plain facts, and buildPaidEmail writes each message.
//
// Two kinds of email, handled differently (see isTransactional):
//  - Lifecycle (weekly report, milestones, upgrade idea, we-miss-you, win-back):
//    optional. They carry an unsubscribe link and are never sent to someone who
//    unsubscribed.
//  - Transactional (welcome to a paid plan, payment failed, cancellation,
//    learners paused): about the customer's own purchase or account. They are
//    sent regardless of the unsubscribe choice and have no unsubscribe link.

const { buildEmail, SITE } = require("./emailTemplate");

const DAY = 86400000;
const QUIET_DAYS = 2;

const pad = (n) => String(n).padStart(2, "0");
const monthKey = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
function weekKey(d) {
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}

const TRANSACTIONAL = ["core-welcome", "prem-welcome", "prem-paused", "bill-failed", "bill-cancel"];
const isTransactional = (key) => TRANSACTIONAL.includes(key);

// ---------------------------------------------------------------- who gets what

/**
 * facts: { tier: "core"|"premium", createdAt, completedTotal, completedLast7d,
 *          examAgeLast14d: boolean (a Middle/High School piece was finished recently),
 *          lastActivityAt: Date|null, sent: { [dedupeKey]: Date } }
 * Returns { key, dedupeKey } or null. Welcome emails are not picked here: they
 * are sent the moment Stripe confirms the purchase.
 */
function pickPaidEmail(facts, now) {
  const sent = facts.sent || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(sent, k);
  const lastSent = Object.values(sent).reduce((max, d) => (d > max ? d : max), new Date(0));
  if (now - lastSent < QUIET_DAYS * DAY) return null;

  if (facts.completedTotal >= 25 && !has("milestone-25")) return { key: "milestone-25", dedupeKey: "milestone-25" };
  if (facts.completedTotal >= 10 && !has("milestone-10")) return { key: "milestone-10", dedupeKey: "milestone-10" };
  if (facts.tier === "core" && facts.examAgeLast14d && facts.completedTotal >= 2 && !has("core-to-premium")) {
    return { key: "core-to-premium", dedupeKey: "core-to-premium" };
  }
  const wk = weekKey(now);
  if (now.getUTCDay() === 1 && facts.completedLast7d >= 1) {
    const key = facts.tier === "premium" ? "prem-digest" : "core-weekly";
    if (!has(`${key}:${wk}`)) return { key, dedupeKey: `${key}:${wk}` };
  }
  return null;
}

/**
 * Emails that apply across plans: "we miss you" and the win-back.
 * facts adds: plan ("free" for the win-back), completedTotal, lastActivityAt, createdAt, sent.
 */
function pickSharedEmail(facts, now) {
  const sent = facts.sent || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(sent, k);
  const lastSent = Object.values(sent).reduce((max, d) => (d > max ? d : max), new Date(0));
  if (now - lastSent < QUIET_DAYS * DAY) return null;

  // Win-back: they cancelled 30 to 120 days ago and have not come back.
  if (facts.plan === "free" && !has("bill-winback")) {
    const cancelKey = Object.keys(sent).find((k) => k.startsWith("bill-cancel:"));
    if (cancelKey) {
      const since = (now - sent[cancelKey]) / DAY;
      if (since >= 30 && since <= 120) return { key: "bill-winback", dedupeKey: "bill-winback" };
    }
  }
  // Re-engage someone who used it, then went quiet for 2 weeks (at most once a month).
  const ageDays = (now - facts.createdAt) / DAY;
  const last = facts.lastActivityAt || facts.createdAt;
  if (facts.completedTotal >= 1 && ageDays >= 14 && (now - last) / DAY >= 14 && !has(`all-inactive:${monthKey(now)}`)) {
    return { key: "all-inactive", dedupeKey: `all-inactive:${monthKey(now)}` };
  }
  return null;
}

// ---------------------------------------------------------------- what each says

const s = (n, one, many) => (n === 1 ? one : many);
const LIFECYCLE_REASON = (plan) => `You're receiving this because you have a LiteracyLab AI ${plan} plan.`;
const ACCOUNT_REASON = "You're receiving this because of your LiteracyLab AI account.";

function readingLine(st) {
  return st.readingAvg == null ? null : `Reading comprehension average: ${st.readingAvg}%.`;
}
function focusLines(st) {
  return [
    ...(st.glow ? [`What went well: ${st.glow}.`] : []),
    ...(st.grow ? [`Next skill to work on: ${st.grow}.`] : []),
  ];
}

const CONTENT = {
  "core-welcome": () => ({
    subject: "Welcome to LiteracyLab AI Core",
    preheader: "Unlimited pieces, the progress chart and year-group ranking are on.",
    heading: "Welcome to Core",
    paragraphs: ["Thank you for upgrading. Everything in Core is switched on now, and your monthly limit is gone."],
    steps: [
      { title: "Unlimited pieces", text: "Write and read as much as you like, every month." },
      { title: "The 26-week progress chart", text: "Open the Parent & Student Dashboard to watch skills build week by week." },
      { title: "Anonymous ranking", text: "See how your learner compares with others in their year group, without any names." },
      { title: "The vocabulary bank", text: "Every new word collects in the Vocabulary tab, with a quick self-test quiz." },
    ],
    cta: { label: "Open the dashboard", url: SITE + "/app.html" },
    note: "You can manage or cancel your plan any time from the Account menu.",
    reason: ACCOUNT_REASON,
    transactional: true,
  }),
  "prem-welcome": () => ({
    subject: "Welcome to LiteracyLab AI Premium",
    preheader: "Up to 6 learners, exam-technique scoring and the spelling check are on.",
    heading: "Welcome to Premium",
    paragraphs: ["Thank you for choosing Premium. Everything is switched on, for the whole household."],
    steps: [
      { title: "Add your other learners", text: "Premium covers up to 6. Open Manage profile to add each one." },
      { title: "Exam-technique scoring", text: "For ages 11 and up, feedback is banded against real assessment objectives." },
      { title: "Spelling and grammar check, and a score out of 10", text: "Every writing piece gets both, with the reason for the score." },
      { title: "Extended feedback", text: "A second, harder next step after the main Grow." },
    ],
    cta: { label: "Add a learner", url: SITE + "/app.html" },
    note: "You can manage or cancel your plan any time from the Account menu.",
    reason: ACCOUNT_REASON,
    transactional: true,
  }),
  "prem-paused": (c) => ({
    subject: "Some learners are paused after your plan change",
    preheader: "Their work is safe. Here's how to choose who stays active.",
    heading: "Some learners are paused",
    paragraphs: [
      `Your plan now covers ${c.maxLearners} ${s(c.maxLearners, "learner", "learners")}, so ${c.paused} ${s(c.paused, "learner is", "learners are")} paused. Nothing has been deleted: all their work and history is still there.`,
      "You choose which learner stays active in Manage profile. You can change that choice once every 30 days. Upgrading again unlocks everyone straight away.",
    ],
    cta: { label: "Manage learners", url: SITE + "/app.html" },
    reason: ACCOUNT_REASON,
    transactional: true,
  }),
  "core-weekly": (c) => ({
    subject: "Your weekly progress report",
    preheader: `${c.pieces} ${s(c.pieces, "piece", "pieces")} and ${c.words} words this week.`,
    heading: "This week's progress",
    paragraphs: [
      `This week: ${c.pieces} ${s(c.pieces, "piece", "pieces")} completed${c.words ? `, ${c.words} words written` : ""}, on ${c.days} ${s(c.days, "day", "days")}.`,
      ...(readingLine(c) ? [readingLine(c)] : []),
      ...focusLines(c),
      "Your 26-week progress chart and year-group ranking are on the dashboard.",
    ],
    cta: { label: "See the progress chart", url: SITE + "/app.html" },
    reason: LIFECYCLE_REASON("Core"),
    bcc: ["support@literacylabai.com"],
    rated: true,
  }),
  "prem-digest": (c) => ({
    subject: "Your household's week on LiteracyLab AI",
    preheader: `${c.pieces} ${s(c.pieces, "piece", "pieces")} across ${c.learners.length} ${s(c.learners.length, "learner", "learners")} this week.`,
    heading: "Your household this week",
    paragraphs: [
      `Across the household: ${c.pieces} ${s(c.pieces, "piece", "pieces")} completed${c.words ? `, ${c.words} words written` : ""}.`,
      ...c.learners.map((l) => `${l.name}: ${l.pieces} ${s(l.pieces, "piece", "pieces")}, ${l.words} words.`),
      ...focusLines(c),
    ],
    cta: { label: "Open the dashboard", url: SITE + "/app.html" },
    reason: LIFECYCLE_REASON("Premium"),
    bcc: ["support@literacylabai.com"],
    rated: true,
  }),
  "core-to-premium": () => ({
    subject: "Ready for exam-technique scoring?",
    preheader: "Premium scores writing against real assessment objectives.",
    heading: "Ready for the next level?",
    paragraphs: [
      "Your learner has been writing at an age where exam technique starts to matter.",
      "Premium adds exam-technique scoring against the real assessment objectives for their year and region, a spelling and grammar check, a score out of 10 with the reason, extended feedback, and room for up to 6 learners.",
    ],
    cta: { label: "See the Premium plan", url: SITE + "/app.html" },
    note: "You can switch plans any time, and the change takes effect straight away.",
    reason: LIFECYCLE_REASON("Core"),
  }),
  "milestone-10": (c) => ({
    subject: "10 pieces done",
    preheader: "That's a real habit forming.",
    heading: "10 pieces completed",
    paragraphs: [
      `That's ${c.total} completed pieces on LiteracyLab AI${c.words ? `, with ${c.words} words written` : ""}. Regular practice is what builds skills, and you've made it a habit.`,
    ],
    cta: { label: "Keep going", url: SITE + "/app.html" },
    reason: LIFECYCLE_REASON(c.planLabel),
  }),
  "milestone-25": (c) => ({
    subject: "25 pieces done",
    preheader: "A big milestone.",
    heading: "25 pieces completed",
    paragraphs: [
      `That's ${c.total} completed pieces${c.words ? ` and ${c.words} words written` : ""}. Take a look at the progress chart to see how far the skills have come.`,
    ],
    cta: { label: "See the progress chart", url: SITE + "/app.html" },
    reason: LIFECYCLE_REASON(c.planLabel),
  }),
  "bill-failed": () => ({
    subject: "We couldn't take your LiteracyLab AI payment",
    preheader: "Please update your payment details to keep your plan.",
    heading: "Your payment didn't go through",
    paragraphs: [
      "We tried to take your latest LiteracyLab AI payment, but your card was declined or has expired.",
      "To keep your plan, please update your payment details: open the Account menu in the app and choose Manage payment details. It takes a minute.",
    ],
    cta: { label: "Open the app", url: SITE + "/app.html" },
    note: "If you've just updated your card, you can ignore this email.",
    reason: ACCOUNT_REASON,
    transactional: true,
  }),
  "bill-cancel": (c) => ({
    subject: "Your LiteracyLab AI subscription is cancelled",
    preheader: c.endDate ? `You keep your plan until ${c.endDate}.` : "Your subscription has ended.",
    heading: "Your subscription is cancelled",
    paragraphs: [
      c.endDate
        ? `You'll keep your plan until ${c.endDate}. After that your account moves to the Free plan, and all of your learners' work stays saved.`
        : "Your account has moved to the Free plan. All of your learners' work stays saved.",
      "If you have a moment, we'd really like to know why you're leaving. It helps us make LiteracyLab AI better.",
    ],
    cta: { label: "Tell us why", url: null },
    note: "Changed your mind? You can start a plan again any time from the Account menu.",
    reason: ACCOUNT_REASON,
    transactional: true,
    ctaIsFeedback: true,
  }),
  "bill-winback": () => ({
    subject: "We'd love to have you back",
    preheader: "Everything your learner did is still saved.",
    heading: "We'd love to have you back",
    paragraphs: [
      "It's been a month since you left. Everything your learner wrote and read is still saved, so you can pick up exactly where you stopped.",
      "If something wasn't right, we'd genuinely like to hear it, and you can start a plan again in a few clicks.",
    ],
    cta: { label: "See the plans", url: SITE + "/app.html" },
    reason: "You're receiving this because you previously had a LiteracyLab AI plan.",
  }),
  "all-inactive": () => ({
    subject: "It's been a little while",
    preheader: "One short piece is all it takes to pick it back up.",
    heading: "We miss you",
    paragraphs: [
      "It's been a couple of weeks since your last piece. Skills stick best with a little practice often, and a short piece takes about 10 minutes.",
      "Everything is saved exactly where you left it.",
    ],
    cta: { label: "Start a short piece", url: SITE + "/app.html" },
    reason: "You're receiving this because you have a LiteracyLab AI account.",
  }),
};

const PAID_EMAIL_KEYS = Object.keys(CONTENT);

/**
 * ctx: { token, address, ...the fields each email uses (see CONTENT) }
 * Returns { subject, html, text, bcc, transactional }.
 */
function buildPaidEmail(key, ctx) {
  const make = CONTENT[key];
  if (!make) throw new Error(`Unknown email: ${key}`);
  const c = make(ctx);
  const feedbackUrl = `${SITE}/feedback?e=${encodeURIComponent(key)}&t=${ctx.token}`;
  const cta = c.cta && c.ctaIsFeedback ? { label: c.cta.label, url: feedbackUrl + "&r=more" } : c.cta;
  const built = buildEmail({
    subject: c.subject,
    preheader: c.preheader,
    heading: c.heading,
    paragraphs: c.paragraphs,
    steps: c.steps,
    cta,
    note: c.note,
    campaign: key.replace(/-/g, "_"),
    reason: c.reason,
    unsubscribeUrl: c.transactional ? undefined : `${SITE}/unsubscribe?t=${ctx.token}`,
    feedbackUrl,
    feedbackStyle: c.rated ? "row" : undefined,
    address: ctx.address,
  });
  return { subject: built.subject, html: built.html, text: built.text, bcc: c.bcc, transactional: !!c.transactional };
}

module.exports = {
  pickPaidEmail, pickSharedEmail, buildPaidEmail, isTransactional,
  PAID_EMAIL_KEYS, TRANSACTIONAL, monthKey, weekKey,
};
