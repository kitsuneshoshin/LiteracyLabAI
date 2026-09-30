// The two emails Supabase Auth sends itself: confirm your email at sign-up, and
// reset your password. Supabase sends these from its own servers, so they cannot
// come from our code. Instead this builds the branded HTML to paste into
// Supabase (Authentication > Email Templates); {{ .ConfirmationURL }} is
// Supabase's own placeholder for the one-time link and is filled in by Supabase.
//
// The committed copies in supabase/email-templates/ are what gets pasted, and a
// test keeps them identical to what this file produces.

const { buildEmail } = require("./emailTemplate");

const LINK = "{{ .ConfirmationURL }}";

// Supabase sends these two emails itself, so the postal address in their footer
// is typed into the templates rather than read from settings. It must be the same
// address as the EMAIL_POSTAL_ADDRESS setting used by every other email.
const AUTH_EMAIL_ADDRESS = "PO Box 123, Tokyo Central Post Office, Chiyoda-ku, Tokyo 100-8994, Japan";

function buildAuthEmails(address) {
  const confirm = buildEmail({
    subject: "Confirm your LiteracyLab AI email",
    preheader: "One click and your account is ready.",
    heading: "Confirm your email",
    paragraphs: [
      "Thanks for creating a LiteracyLab AI account. Please confirm your email address to finish setting it up.",
      "The link works once and expires after a short while.",
    ],
    cta: { label: "Confirm my email", url: LINK },
    note: "If you didn't create an account, you can safely ignore this email.",
    reason: "You're receiving this because this email address was used to create a LiteracyLab AI account.",
    address,
  });
  const reset = buildEmail({
    subject: "Reset your LiteracyLab AI password",
    preheader: "Use this link to choose a new password.",
    heading: "Reset your password",
    paragraphs: [
      "We received a request to reset the password on your LiteracyLab AI account. Choose a new one with the button below.",
      "The link works once and expires after a short while.",
    ],
    cta: { label: "Choose a new password", url: LINK },
    note: "If you didn't ask for this, you can safely ignore this email. Your password won't change.",
    reason: "You're receiving this because a password reset was requested for this LiteracyLab AI account.",
    address,
  });
  return { confirm, reset };
}

module.exports = { buildAuthEmails, LINK, AUTH_EMAIL_ADDRESS };
