const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { fetchSearchSummary, rowsOf, SCOPE } = require("../api/_lib/gscReport");
const { loadHandler, call } = require("./harness");

const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const CREDS = JSON.stringify({ client_email: "ga-reader@p.iam.gserviceaccount.com", private_key: privateKey });

const r = (keys, clicks, impressions, ctr, position) => ({ keys, clicks, impressions, ctr, position });

function fakeGoogle() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith("https://oauth2.googleapis.com/token")) return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
    assert.equal(init.headers.Authorization, "Bearer tok");
    const body = JSON.parse(init.body);
    const dim = (body.dimensions || [])[0];
    if (!dim) return { ok: true, json: async () => ({ rows: [{ clicks: 12, impressions: 340, ctr: 0.0353, position: 14.26 }] }) };
    if (dim === "date") return { ok: true, json: async () => ({ rows: [r(["2026-10-01"], 1, 30, 0.033, 15), r(["2026-10-02"], 2, 41, 0.049, 12)] }) };
    if (dim === "query") return { ok: true, json: async () => ({ rows: [r(["naplan writing practice"], 3, 80, 0.0375, 9.04)] }) };
    if (dim === "page") return { ok: true, json: async () => ({ rows: [r(["https://www.literacylabai.com/learn/naplan-writing-practice/"], 3, 80, 0.0375, 9)] }) };
    if (dim === "country") return { ok: true, json: async () => ({ rows: [r(["aus"], 8, 200, 0.04, 11)] }) };
    return { ok: true, json: async () => ({ rows: [r(["MOBILE"], 7, 150, 0.0466, 12)] }) };
  };
  return { calls, fetchImpl };
}

test("sign-in uses the read-only Search Console scope", async () => {
  const g = fakeGoogle();
  await fetchSearchSummary({ rawCreds: CREDS, fetchImpl: g.fetchImpl, nowSec: 1790000000 });
  const form = new URLSearchParams(g.calls[0].init.body);
  const claims = JSON.parse(Buffer.from(form.get("assertion").split(".")[1], "base64url"));
  assert.equal(claims.scope, "https://www.googleapis.com/auth/webmasters.readonly");
  assert.equal(SCOPE, claims.scope);
});

test("summary: totals, trend, the searches that bring people in, pages, countries and devices, with rates as percentages", async () => {
  const g = fakeGoogle();
  const s = await fetchSearchSummary({ rawCreds: CREDS, fetchImpl: g.fetchImpl, nowSec: 1790000000 });
  assert.deepEqual(s.totals, { clicks: 12, impressions: 340, ctr: 3.5, position: 14.3 });
  assert.deepEqual(s.daily[1], { date: "2026-10-02", clicks: 2, impressions: 41, ctr: 4.9, position: 12 });
  assert.equal(s.queries[0].query, "naplan writing practice"); assert.equal(s.queries[0].position, 9); assert.equal(s.queries[0].ctr, 3.8);
  assert.match(s.pages[0].page, /naplan-writing-practice/);
  assert.equal(s.countries[0].country, "aus"); assert.equal(s.devices[0].device, "MOBILE");
  // the property is the www address, and the 28-day window ends two days back (Search Console runs behind)
  const reqs = g.calls.slice(1);
  assert.ok(reqs.every((c) => c.url === "https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent("https://www.literacylabai.com/") + "/searchAnalytics/query"));
  const body = JSON.parse(reqs[0].init.body);
  const days = (Date.parse(body.endDate) - Date.parse(body.startDate)) / 86400000;
  assert.equal(days, 27);
  const today = new Date(1790000000 * 1000); today.setUTCDate(today.getUTCDate() - 2);
  assert.equal(body.endDate, today.toISOString().slice(0, 10));
});

test("a setup gap is explained in plain words, and an empty site gives zeros, not an error", async () => {
  const refuse = async (url) => (String(url).includes("oauth2") ? { ok: true, json: async () => ({ access_token: "t" }) } : { ok: false, status: 403, json: async () => ({ error: { message: "User does not have sufficient permission for site" } }) });
  await assert.rejects(() => fetchSearchSummary({ rawCreds: CREDS, fetchImpl: refuse }), /refused the request \(403\).*Add the service account as a user/);
  await assert.rejects(() => fetchSearchSummary({ rawCreds: "" }), /must be set/);
  const empty = async (url) => (String(url).includes("oauth2") ? { ok: true, json: async () => ({ access_token: "t" }) } : { ok: true, json: async () => ({}) });
  const s = await fetchSearchSummary({ rawCreds: CREDS, fetchImpl: empty, nowSec: 1790000000 });
  assert.deepEqual(s.totals, { clicks: 0, impressions: 0, ctr: 0, position: 0 });
  assert.deepEqual(s.queries, []);
  assert.deepEqual(rowsOf({}, ["a"]), []);
});

test("gsc endpoint: closed to the public, and explains how to switch it on until the settings exist", async () => {
  const saved = { c: process.env.CRON_SECRET, k: process.env.GA_SERVICE_ACCOUNT_JSON };
  process.env.CRON_SECRET = "s"; delete process.env.GA_SERVICE_ACCOUNT_JSON;
  try {
    const h = loadHandler("email.js", {});
    assert.equal((await call(h, { method: "GET", query: { action: "gsc" }, headers: {} })).statusCode, 401);
    assert.equal((await call(h, { method: "POST", query: { action: "gsc" }, headers: { authorization: "Bearer s" } })).statusCode, 405);
    const res = await call(h, { method: "GET", query: { action: "gsc" }, headers: { authorization: "Bearer s" } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.available, false);
    assert.match(res.body.reason, /GA_SERVICE_ACCOUNT_JSON/);
  } finally {
    for (const [k, v] of [["CRON_SECRET", saved.c], ["GA_SERVICE_ACCOUNT_JSON", saved.k]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
