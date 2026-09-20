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
  });
}

// Only worth alerting on genuinely unexpected server failures (500s) - a
// 4xx like "already submitted" or "limit reached" is expected control flow,
// not something breaking in production, and would just be noise here.
function captureIfUnexpected(err) {
  ensureInit();
  if (!process.env.SENTRY_DSN) return;
  const status = err.statusCode || 500;
  if (status >= 500) Sentry.captureException(err);
}

module.exports = { captureIfUnexpected };
