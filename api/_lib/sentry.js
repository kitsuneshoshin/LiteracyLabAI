// Error monitoring for the serverless API. A no-op everywhere until
// SENTRY_DSN is set in Vercel — nothing breaks if it's never configured,
// this just means errors are only visible in Vercel's own function logs
// (the status quo before this file existed).
const Sentry = require("@sentry/node");

let initialized = false;
function ensureInit() {
  if (initialized) return;
  initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || "development",
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: redactEvent,
  });
}

// Some error messages quote content verbatim - notably the AI quality-check
// failure in submit.js, which lists issues like: glow fabricates... ("<the
// generated feedback>"), and that feedback can quote the child's own
// writing. Children's writing must never leave our systems for an error
// tracker, so every double-quoted span is blanked before an event is sent.
// The error's shape (which check failed, where) survives; the content
// doesn't.
//
// Two passes. validate.js always wraps quoted content as ("..."), so each
// whole ("...") block is blanked first: a plain quote-matcher alone would
// pair the wrong marks whenever the child's writing itself contains
// quotation marks (dialogue is common in stories) and let the words between
// them through. The second pass catches any other quoted span.
const QUOTED_BLOCK = /\("[\s\S]*?"\)/g;
const QUOTED = /"[^"]*"/g;
function redact(text) {
  if (typeof text !== "string") return text;
  return text.replace(QUOTED_BLOCK, '("[redacted]")').replace(QUOTED, '"[redacted]"');
}
function redactEvent(event) {
  if (event.message) event.message = redact(event.message);
  for (const ex of (event.exception && event.exception.values) || []) ex.value = redact(ex.value);
  return event;
}

// Only worth alerting on genuinely unexpected server failures (500s) - a
// 4xx like "already submitted" or "limit reached" is expected control flow,
// not something breaking in production, and would just be noise here.
//
// Async on purpose, and callers must await it BEFORE sending their response.
// Sentry queues events and sends them in the background, but Vercel freezes
// a function the moment its response is sent - so an event still in the
// queue at that point is usually lost, and error monitoring would look
// configured while quietly missing most real failures. Flushing first costs
// at most FLUSH_TIMEOUT_MS, and only on a genuine 500, which is rare.
const FLUSH_TIMEOUT_MS = 2000;

async function captureIfUnexpected(err) {
  ensureInit();
  if (!process.env.SENTRY_DSN) return;
  const status = err.statusCode || 500;
  if (status < 500) return;
  Sentry.captureException(err);
  try {
    await Sentry.flush(FLUSH_TIMEOUT_MS);
  } catch (_) {
    // A monitoring outage must never turn into a second failure for the user.
  }
}

module.exports = { captureIfUnexpected, redact };
