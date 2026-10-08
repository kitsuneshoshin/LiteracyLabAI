const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { fetchSummary, getAccessToken, parseCreds, rowsOf } = require("../api/_lib/gaReport");
const { loadHandler, call } = require("./harness");

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const CREDS = JSON.stringify({ client_email: "ga-reader@p.iam.gserviceaccount.com", private_key: privateKey });

const row = (dims, mets) => ({ dimensionValues: dims.map((value) => ({ value })), metricValues: mets.map((value) => ({ value: String(value) })) });

function fakeGoogle() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith("https://oauth2.googleapis.com/token")) return { ok: true, status: 200, json: async () => ({ access_token: "tok" }) };
    const body = JSON.parse(init.body);
    assert.equal(init.headers.Authorization, "Bearer tok");
    if (body.dateRanges.length === 2) return { ok: true, json: async () => ({ rows: [row(["last7"], [10, 6, 14, 40, 9]), row(["last28"], [30, 22, 55, 160, 33])] }) };
    const dim = body.dimensions[0].name;
    if (dim === "date") return { ok: true, json: async () => ({ rows: [row(["20261001"], [3, 4]), row(["20261002"], [5, 6])] }) };
    if (dim === "sessionDefaultChannelGroup") return { ok: true, json: async () => ({ rows: [row(["Direct"], [30, 20]), row(["Organic Search"], [12, 9])] }) };
    if (dim === "pagePath") return { ok: true, json: async () => ({ rows: [row(["/"], [90, 40])] }) };
    return { ok: true, json: async () => ({ rows: [row(["Australia"], [18])] }) };
  };
  return { calls, fetchImpl };
}

test("sign-in: the request to Google is a properly signed token for the read-only scope", async () => {
  const g = fakeGoogle();
  const token = await getAccessToken(JSON.parse(CREDS), g.fetchImpl, 1000);
  assert.equal(token, "tok");
  const form = new URLSearchParams(g.calls[0].init.body);
  assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
  const [h, c, sig] = form.get("assertion").split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "RS256", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(c, "base64url"));
  assert.equal(claims.iss, "ga-reader@p.iam.gserviceaccount.com");
  assert.equal(claims.scope, "https://www.googleapis.com/auth/analytics.readonly");
  assert.equal(claims.aud, "https://oauth2.googleapis.com/token");
  assert.equal(claims.exp - claims.iat, 3000);
  assert.ok(crypto.createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, "base64url")), "signature checks out against the key");
});

test("summary: headline numbers for 7 and 28 days, the daily trend, sources, pages and countries", async () => {
  const g = fakeGoogle();
  const s = await fetchSummary({ rawCreds: CREDS, propertyId: "556212809", fetchImpl: g.fetchImpl, nowSec: 1790000000 });
  assert.equal(s.last7.activeUsers, 10); assert.equal(s.last7.sessions, 14); assert.equal(s.last28.screenPageViews, 160);
  assert.deepEqual(s.daily, [{ date: "20261001", activeUsers: 3, sessions: 4 }, { date: "20261002", activeUsers: 5, sessions: 6 }]);
  assert.equal(s.sources[0].sessionDefaultChannelGroup, "Direct");
  assert.equal(s.pages[0].pagePath, "/");
  assert.equal(s.countries[0].country, "Australia");
  assert.ok(g.calls.slice(1).every((c) => c.url === "https://analyticsdata.googleapis.com/v1beta/properties/556212809:runReport"));
});

test("summary: a refusal from Google is reported in plain words, and bad settings are caught before any call", async () => {
  const refuse = async (url) => (String(url).includes("oauth2") ? { ok: true, json: async () => ({ access_token: "t" }) } : { ok: false, status: 403, json: async () => ({ error: { message: "User does not have sufficient permissions" } }) });
  await assert.rejects(() => fetchSummary({ rawCreds: CREDS, propertyId: "1", fetchImpl: refuse }), /refused the report \(403\).*sufficient permissions/);
  await assert.rejects(() => fetchSummary({ rawCreds: CREDS, propertyId: "1", fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: "invalid_grant", error_description: "Invalid JWT Signature." }) }) }), /would not sign in.*Invalid JWT/);
  await assert.rejects(() => fetchSummary({ rawCreds: "", propertyId: "1" }), /must both be set/);
  assert.throws(() => parseCreds("not json"), /not valid JSON/);
  assert.throws(() => parseCreds("{}"), /missing client_email/);
  assert.deepEqual(rowsOf({}, ["a"], ["b"]), []);
});

test("ga endpoint: closed to the public, and explains how to switch it on until the settings exist", async () => {
  const saved = { c: process.env.CRON_SECRET, k: process.env.GA_SERVICE_ACCOUNT_JSON, p: process.env.GA_PROPERTY_ID };
  process.env.CRON_SECRET = "s"; delete process.env.GA_SERVICE_ACCOUNT_JSON; delete process.env.GA_PROPERTY_ID;
  try {
    const h = loadHandler("email.js", {});
    assert.equal((await call(h, { method: "GET", query: { action: "ga" }, headers: {} })).statusCode, 401);
    assert.equal((await call(h, { method: "POST", query: { action: "ga" }, headers: { authorization: "Bearer s" } })).statusCode, 405);
    const res = await call(h, { method: "GET", query: { action: "ga" }, headers: { authorization: "Bearer s" } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.available, false);
    assert.match(res.body.reason, /GA_SERVICE_ACCOUNT_JSON/);
  } finally {
    for (const [k, v] of [["CRON_SECRET", saved.c], ["GA_SERVICE_ACCOUNT_JSON", saved.k], ["GA_PROPERTY_ID", saved.p]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
});
