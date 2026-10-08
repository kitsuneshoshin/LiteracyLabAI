// Reads the site's Google Analytics numbers through the free Analytics Data API, signed in as a
// read-only service account (GA_SERVICE_ACCOUNT_JSON) on one property (GA_PROPERTY_ID). Plain fetch and
// node:crypto only, so it needs no packages and can be unit tested with a stand-in fetch.
const crypto = require("node:crypto");

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const b64url = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

// A short-lived sign-in token, from a signed request (a JWT) that only the key's holder can make.
async function getAccessToken(creds, fetchImpl = fetch, nowSec = Math.floor(Date.now() / 1000)) {
  const header = b64url({ alg: "RS256", typ: "JWT" });
  const claims = b64url({ iss: creds.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3000 });
  const signature = crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(creds.private_key).toString("base64url");
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${signature}` }).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw gaError(`Google would not sign in (${res.status}): ${body.error_description || body.error || "unknown error"}`);
  return body.access_token;
}

function gaError(message) {
  const err = new Error(message);
  err.statusCode = 502;
  return err;
}

function parseCreds(raw) {
  let creds;
  try { creds = JSON.parse(raw); } catch (e) { throw gaError("GA_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the whole downloaded key file."); }
  if (!creds || !creds.client_email || !creds.private_key) throw gaError("GA_SERVICE_ACCOUNT_JSON is missing client_email or private_key.");
  return creds;
}

async function runReport(token, propertyId, body, fetchImpl = fetch) {
  const res = await fetchImpl(`https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw gaError(`Google Analytics refused the report (${res.status}): ${(data.error && data.error.message) || "unknown error"}`);
  return data;
}

// Rows come back as { dimensionValues: [{value}], metricValues: [{value}] }; this turns them into plain objects.
function rowsOf(report, dims, mets) {
  return (report.rows || []).map((r) => {
    const o = {};
    dims.forEach((d, i) => { o[d] = r.dimensionValues[i].value; });
    mets.forEach((m, i) => { o[m] = Number(r.metricValues[i].value) || 0; });
    return o;
  });
}

const METRICS = ["activeUsers", "newUsers", "sessions", "screenPageViews", "engagedSessions", "eventCount", "keyEvents"];

// Headline numbers for the last 7 and 28 days, the daily trend, and the top sources, pages and countries.
async function fetchSummary({ rawCreds, propertyId, fetchImpl = fetch, nowSec }) {
  if (!rawCreds || !propertyId) throw gaError("GA_SERVICE_ACCOUNT_JSON and GA_PROPERTY_ID must both be set.");
  const token = await getAccessToken(parseCreds(rawCreds), fetchImpl, nowSec);
  const run = (b) => runReport(token, propertyId, b, fetchImpl);
  const metrics = METRICS.map((name) => ({ name }));
  const [headline, daily, sources, pages, countries] = await Promise.all([
    run({ dateRanges: [{ startDate: "7daysAgo", endDate: "today", name: "last7" }, { startDate: "28daysAgo", endDate: "today", name: "last28" }], metrics }),
    run({ dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }], orderBys: [{ dimension: { dimensionName: "date" } }] }),
    run({ dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }, { name: "activeUsers" }], orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 8 }),
    run({ dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }], orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 10 }),
    run({ dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], dimensions: [{ name: "country" }], metrics: [{ name: "activeUsers" }], orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 8 }),
  ]);
  // With two date ranges the API adds a "dateRange" dimension to each row.
  const periods = {};
  for (const r of headline.rows || []) {
    const name = r.dimensionValues[0].value;
    periods[name] = {};
    METRICS.forEach((m, i) => { periods[name][m] = Number(r.metricValues[i].value) || 0; });
  }
  return {
    checkedAt: new Date(((nowSec || Math.floor(Date.now() / 1000))) * 1000).toISOString(),
    last7: periods.last7 || null,
    last28: periods.last28 || null,
    daily: rowsOf(daily, ["date"], ["activeUsers", "sessions"]),
    sources: rowsOf(sources, ["sessionDefaultChannelGroup"], ["sessions", "activeUsers"]),
    pages: rowsOf(pages, ["pagePath"], ["screenPageViews", "activeUsers"]),
    countries: rowsOf(countries, ["country"], ["activeUsers"]),
  };
}

module.exports = { fetchSummary, getAccessToken, parseCreds, runReport, rowsOf };
