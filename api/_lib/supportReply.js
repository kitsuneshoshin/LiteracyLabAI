// A reply to a customer who wrote to support, in the same branded shell as every
// other LiteracyLab AI email (see emailTemplate.js). It is a one-to-one reply, so
// it has no unsubscribe link, and it opens with a greeting rather than a heading.

const { buildEmail } = require("./emailTemplate");
const { AUTH_EMAIL_ADDRESS } = require("./authEmails");

const SIGN_OFF = "LiteracyLab AI Team";

/**
 * @param {object} r
 * @param {string} r.subject
 * @param {string} [r.name]          first name for the greeting; "Hello," when unknown
 * @param {string[]} r.paragraphs    plain text, escaped by the shell
 * @param {{title,text}[]} [r.steps] numbered steps shown under the paragraphs
 * @param {{label,url}} [r.cta]
 * @param {string} [r.note]          the tinted tip box
 * @returns {{subject, html, text}}
 */
function buildSupportReply(r) {
  return buildEmail({
    subject: r.subject,
    preheader: r.preheader || (r.paragraphs && r.paragraphs[0]) || r.subject,
    paragraphs: [r.name ? `Hi ${r.name},` : "Hello,", ...(r.paragraphs || [])],
    steps: r.steps,
    cta: r.cta,
    note: r.note,
    reason: "You're receiving this because you contacted LiteracyLab AI support. Just reply to this email and it reaches us directly.",
    address: AUTH_EMAIL_ADDRESS,
    signOff: SIGN_OFF,
  });
}

module.exports = { buildSupportReply, SIGN_OFF };
