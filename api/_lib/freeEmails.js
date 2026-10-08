// The Free-plan lifecycle emails: WHO gets WHICH email today (pickEmail), and
// what each one says (buildFreeEmail). Both are pure so they can be tested
// without a database or a mail provider. The daily job (emailJob.js) feeds
// pickEmail the facts and sends whatever it returns.

const { buildEmail, SITE } = require("./emailTemplate");

const DAY = 86400000;
const NEXT_STEP_CAP_DAYS = 2; // no two non-essential emails within 2 days
const MIN_GAP_MS = 20 * 3600000; // and never two emails of any kind within 20 hours

const RATED_EMAILS = ["free-welcome", "free-weekly-lite"];
const FREE_EMAIL_KEYS =["free-welcome", "free-limit", "free-2-of-3", "free-reset", "free-first-followup", "free-nudge", "free-weekly-lite"];

const pad = (n) => String(n).padStart(2, "0");
function monthKey(d) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; }
function prevMonthKey(d) { return monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))); }
// The Monday (UTC) that starts the week containing d: the key for "once a week".
function weekKey(d) {
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

/**
 * facts: {
 *   createdAt: Date, usedThisMonth: number, completedTotal: number,
 *   firstCompletedAt: Date|null, completedLast7d: number,
 *   sent: { [dedupeKey]: Date }   // everything already sent to this parent
 * }
 * Returns { key, dedupeKey } for the ONE email to send today, or null.
 * One email per parent per run, in priority order; everything except the
 * welcome and the limit notice respects a 2-day quiet gap since the last email.
 */
function pickEmail(facts, now) {
  const sent = facts.sent || {};
  const has = (k) => Object.prototype.hasOwnProperty.call(sent, k);
  const m = monthKey(now);
  const ageDays = (now - facts.createdAt) / DAY;
  const lastSent = Object.values(sent).reduce((max, d) => (d > max ? d : max), new Date(0));
  const quiet = now - lastSent < NEXT_STEP_CAP_DAYS * DAY;
  // At most one email a day to anyone, even the essential ones: a second run the
  // same day (a retry, a manual check) must never send a second email.
  if (now - lastSent < MIN_GAP_MS) return null;

  // Essential: welcome (only for genuinely new accounts, never a back-fill)
  if (!has("free-welcome") && ageDays <= 3) return { key: "free-welcome", dedupeKey: "free-welcome" };
  // Essential: they hit the limit and can't continue
  if (facts.usedThisMonth >= 3 && !has(`free-limit:${m}`)) return { key: "free-limit", dedupeKey: `free-limit:${m}` };

  if (quiet) return null;

  if (facts.usedThisMonth === 2 && !has(`free-2-of-3:${m}`) && !has(`free-limit:${m}`)) {
    return { key: "free-2-of-3", dedupeKey: `free-2-of-3:${m}` };
  }
  if (now.getUTCDate() <= 5 && has(`free-limit:${prevMonthKey(now)}`) && !has(`free-reset:${m}`) && facts.usedThisMonth === 0) {
    return { key: "free-reset", dedupeKey: `free-reset:${m}` };
  }
  if (facts.completedTotal >= 1 && facts.firstCompletedAt && !has("free-first-followup")) {
    const since = (now - facts.firstCompletedAt) / DAY;
    if (since >= 1 && since <= 6) return { key: "free-first-followup", dedupeKey: "free-first-followup" };
  }
  if (facts.completedTotal === 0 && !has("free-nudge") && ageDays >= 2 && ageDays <= 14) {
    return { key: "free-nudge", dedupeKey: "free-nudge" };
  }
  const wk = weekKey(now);
  if (now.getUTCDay() === 1 && facts.completedLast7d >= 1 && !has(`free-weekly-lite:${wk}`)) {
    return { key: "free-weekly-lite", dedupeKey: `free-weekly-lite:${wk}` };
  }
  return null;
}

const s = (n, one, many) => (n === 1 ? one : many);

const CONTENT = {
  "free-welcome": () => ({
    subject: "Welcome to LiteracyLab AI: your first piece takes about 10 minutes",
    preheader: "Pick a year level, choose what they love, and get feedback made for them.",
    heading: "Welcome to LiteracyLab AI",
    paragraphs: [
      "Thanks for setting up an account. LiteracyLab AI reads your child's writing or checks their reading, matches it to their real school curriculum, and gives feedback that builds on what they already do well.",
      "Your free plan includes 3 pieces a month. Every one comes with a Glow, a Grow, highlights and new vocabulary.",
    ],
    steps: [
      { title: "Set up your learner", text: "Choose their year group, country and interests. It takes about two minutes." },
      { title: "Write or read", text: "Pick a writing prompt or a reading passage matched to their age." },
      { title: "Read the feedback", text: "See what went well (the Glow), one clear next step (the Grow), and new words to try." },
    ],
    cta: { label: "Start the first piece", url: SITE + "/app.html" },
    note: "Tip: the feedback is written for your child to read too, so sit together for the first one.",
    reason: "You're receiving this because you created a LiteracyLab AI account.",
  }),
  "free-nudge": () => ({
    subject: "Ready for the first piece?",
    preheader: "It takes about 10 minutes, and your first feedback is free.",
    heading: "The first piece takes about 10 minutes",
    paragraphs: [
      "You set up your LiteracyLab AI account, and the first piece is waiting.",
      "Choose a writing prompt or a reading passage matched to your child's age, and you'll get feedback that builds on what they already do well.",
    ],
    cta: { label: "Start the first piece", url: SITE + "/app.html" },
    note: "Your free plan includes 3 pieces a month. No card needed.",
    reason: "You're receiving this because you created a LiteracyLab AI account and haven't started a piece yet.",
  }),
  "free-first-followup": () => ({
    subject: "One step to try in the next piece",
    preheader: "Every piece of feedback ends with one Grow. Here's how to use it.",
    heading: "One step to try in the next piece",
    paragraphs: [
      "Every piece of feedback ends with a Grow: one specific step. Ask your child to read it again and try it in their next piece.",
      "Working on one step at a time is what makes writing and reading improve, and it keeps practice short and encouraging.",
    ],
    cta: { label: "Start the next piece", url: SITE + "/app.html" },
    reason: "You're receiving this because your child completed their first piece on LiteracyLab AI.",
  }),
  "free-2-of-3": () => ({
    subject: "2 of your 3 free pieces are used",
    preheader: "One left this month. Here's how to make it count.",
    heading: "One free piece left this month",
    paragraphs: [
      "You've used 2 of your 3 free pieces this month. The last one is there whenever you're ready.",
      "To get the most from it, pick the kind of piece your child finds hardest. The Grow will focus on the skill that helps them most.",
    ],
    cta: { label: "Use the last free piece", url: SITE + "/app.html" },
    note: "Free pieces reset on the 1st of every month.",
    reason: "You're receiving this because you're on the LiteracyLab AI Free plan.",
  }),
  "free-limit": () => ({
    subject: "You've used your 3 free pieces this month",
    preheader: "Your free pieces come back on the 1st. Or keep going now with Core.",
    heading: "You've used your 3 free pieces this month",
    paragraphs: [
      "Nice work: three pieces done. Your free pieces reset on the 1st of next month.",
      "If you'd like to keep going now, Core gives unlimited pieces, a 26-week progress trend, anonymous ranking within their year group, the vocabulary bank with self-test quizzes, and your full activity history.",
    ],
    cta: { label: "See the Core plan", url: SITE + "/app.html" },
    note: "Core is 9.99 a month in your local currency. Cancel any time.",
    reason: "You're receiving this because you're on the LiteracyLab AI Free plan.",
  }),
  "free-reset": () => ({
    subject: "Your 3 free pieces are back",
    preheader: "A new month, a fresh set of free pieces.",
    heading: "Your 3 free pieces are back",
    paragraphs: [
      "It's a new month, so you have 3 fresh free pieces.",
      "Last month you used all three. A short piece each week is a good pace: regular practice is what makes the Glow and Grow feedback add up.",
    ],
    cta: { label: "Start a new piece", url: SITE + "/app.html" },
    reason: "You're receiving this because you're on the LiteracyLab AI Free plan.",
  }),
  "free-weekly-lite": (stats) => ({
    subject: "This week on LiteracyLab AI",
    preheader: `${stats.pieces} ${s(stats.pieces, "piece", "pieces")} and ${stats.words} words this week.`,
    heading: "This week's learning",
    paragraphs: [
      `This week: ${stats.pieces} ${s(stats.pieces, "piece", "pieces")} completed${stats.words ? `, ${stats.words} words written` : ""}.`,
      // The skill names come from the curriculum, never from what the child wrote.
      ...(stats.glow ? [`What went well: ${stats.glow}.`] : []),
      ...(stats.grow ? [`Next skill to work on: ${stats.grow}.`] : []),
      "Regular practice makes the biggest difference, and you're building it.",
    ],
    meters: Number.isFinite(stats.days) ? [{ label: "Days practised", value: `${Math.min(7, stats.days)} of 7`, pct: (Math.min(7, stats.days) / 7) * 100 }] : [],
    cta: { label: "Keep it going", url: SITE + "/app.html" },
    note: "With Core you'd also see the 26-week progress trend, how they rank in their year group, and their full activity history.",
    reason: "You're receiving this weekly summary because you're on the LiteracyLab AI Free plan.",
    bcc: ["support@literacylabai.com"],
  }),
};

/**
 * ctx: { token, address, stats: { pieces, words } }
 * Returns { subject, html, text, bcc }.
 */
function buildFreeEmail(key, ctx) {
  const make = CONTENT[key];
  if (!make) throw new Error(`Unknown Free email: ${key}`);
  const c = make(ctx.stats || { pieces: 0, words: 0 });
  const built = buildEmail({
    subject: c.subject,
    preheader: c.preheader,
    heading: c.heading,
    paragraphs: c.paragraphs,
    steps: c.steps,
    meters: c.meters,
    cta: c.cta,
    note: c.note,
    campaign: key.replace(/-/g, "_"),
    reason: c.reason,
    unsubscribeUrl: `${SITE}/unsubscribe?t=${ctx.token}`,
    feedbackUrl: `${SITE}/feedback?e=${encodeURIComponent(key)}&t=${ctx.token}`,
    // Only the welcome and the weekly summary ask "Was this email useful?"; on the
    // rest, a rating row would feel like a survey, so they only carry the footer line.
    feedbackStyle: RATED_EMAILS.includes(key) ? "row" : undefined,
    address: ctx.address,
  });
  return { subject: built.subject, html: built.html, text: built.text, bcc: c.bcc };
}

module.exports = { pickEmail, buildFreeEmail, FREE_EMAIL_KEYS, monthKey, prevMonthKey, weekKey };
