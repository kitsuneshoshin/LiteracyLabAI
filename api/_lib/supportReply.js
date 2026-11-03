// A reply to a customer who wrote to support, in the same branded shell as every
// other LiteracyLab AI email (see emailTemplate.js). It is a one-to-one reply, so
// it has no unsubscribe link, and it opens with a greeting rather than a heading.

const { buildEmail } = require("./emailTemplate");
const { AUTH_EMAIL_ADDRESS } = require("./authEmails");

const SIGN_OFF = "LiteracyLab AI Team";

/**
 * Two ways to write the body. Either give `blocks` (pieces in the order you want them) or the simple form
 * (paragraphs, then bullets, steps, a button and a tip box). Text may use **bold**, [label](https://link),
 * bare https links and line breaks.
 *
 * @param {object} r
 * @param {string} r.subject
 * @param {string} [r.name]            first name for the greeting; "Hello," when unknown
 * @param {object[]} [r.blocks]        each { p } | { bullets } | { steps } | { note } | { cta: {label,url} }
 * @param {string[]} [r.paragraphs]
 * @param {string[]} [r.bullets]
 * @param {(string|{title,text})[]} [r.steps]  a step is a string, or a title with optional explanation
 * @param {{label,url}} [r.cta]
 * @param {string} [r.note]            the tinted tip box
 * @returns {{subject, html, text}}
 */
function buildSupportReply(r) {
  const greeting = r.name ? `Hi ${r.name},` : "Hello,";
  const first = r.blocks ? (r.blocks.find((b) => b && b.p != null) || {}).p : r.paragraphs && r.paragraphs[0];
  const shared = {
    subject: r.subject,
    preheader: r.preheader || (first ? String(first).replace(/\*\*/g, "").slice(0, 110) : r.subject),
    rich: true,
    reason: "You're receiving this because you contacted LiteracyLab AI support. Just reply to this email and it reaches us directly.",
    address: AUTH_EMAIL_ADDRESS,
    signOff: SIGN_OFF,
  };
  if (r.blocks) return buildEmail({ ...shared, blocks: [{ p: greeting }, ...r.blocks] });
  return buildEmail({ ...shared, paragraphs: [greeting, ...(r.paragraphs || [])], bullets: r.bullets, steps: r.steps, cta: r.cta, note: r.note });
}

module.exports = { buildSupportReply, SIGN_OFF };
