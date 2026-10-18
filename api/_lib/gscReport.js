// Reads the site's Google Search Console numbers (the searches that bring people to the site) through the free Search
// Console API, signed in as the SAME read-only service account as the Analytics feed (GA_SERVICE_ACCOUNT_JSON). The account
// must be added as a user on the Search Console property and the "Google Search Console API" must be switched on in the
// same Google Cloud project. Plain fetch and node:crypto only, like gaReport.js, so it is unit tested with a stand-in fetch.
const { getAccessToken, parseCreds } = require("./gaReport");

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const DEFAULT_SITE = "https://www.literacylabai.com/";

function gscError(message) {
  const err = new Error(message);
  err.statusCode = 502;
  return err;
}

const iso = (d) => d.toISOString().slice(0, 10);

async function query(token, siteUrl, body, fetchImpl = fetch) {
  const res = await fetchImpl(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && data.error.message) || "unknown error";
    const hint = res.status === 403 ? " Add the service account as a user on the Search Console property, and switch on the Search Console API in the same Google Cloud project." : "";
    throw gscError(`Search Console refused the request (${res.status}): ${msg}.${hint}`);
  }
  return data;
}

// Rows come back as { keys: [...], clicks, impressions, ctr, position }; this turns them into plain, rounded objects.
function rowsOf(report, keyNames) {
  return (report.rows || []).map((r) => {
    const o = {};
    keyNames.forEach((k, i) => { o[k] = (r.keys || [])[i]; });
    o.clicks = Number(r.clicks) || 0;
    o.impressions = Number(r.impressions) || 0;
    o.ctr = Math.round((Number(r.ctr) || 0) * 1000) / 10; // percent, one decimal
    o.position = Math.round((Number(r.position) || 0) * 10) / 10;
    return o;
  });
}

// The last 28 days that Search Console has finished (it runs about two days behind): totals, the daily trend, and the top
// searches, pages, countries and devices.
async function fetchSearchSummary({ rawCreds, siteUrl = DEFAULT_SITE, fetchImpl = fetch, nowSec }) {
  if (!rawCreds) throw gscError("GA_SERVICE_ACCOUNT_JSON must be set.");
  const token = await getAccessToken(parseCreds(rawCreds), fetchImpl, nowSec, SCOPE);
  const now = new Date(((nowSec || Math.floor(Date.now() / 1000))) * 1000);
  const end = new Date(now); end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 27);
  const range = { startDate: iso(start), endDate: iso(end) };
  const run = (extra) => query(token, siteUrl, { ...range, ...extra }, fetchImpl);
  const [totals, daily, queries, pages, countries, devices] = await Promise.all([
    run({}),
    run({ dimensions: ["date"], rowLimit: 40 }),
    run({ dimensions: ["query"], rowLimit: 25 }),
    run({ dimensions: ["page"], rowLimit: 15 }),
    run({ dimensions: ["country"], rowLimit: 8 }),
    run({ dimensions: ["device"], rowLimit: 3 }),
  ]);
  const t = rowsOf(totals, [])[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    checkedAt: now.toISOString(),
    site: siteUrl,
    range,
    totals: { clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position },
    daily: rowsOf(daily, ["date"]),
    queries: rowsOf(queries, ["query"]),
    pages: rowsOf(pages, ["page"]),
    countries: rowsOf(countries, ["country"]),
    devices: rowsOf(devices, ["device"]),
  };
}

module.exports = { fetchSearchSummary, rowsOf, query, SCOPE, DEFAULT_SITE };
