const test = require("node:test");
const assert = require("node:assert/strict");
const { refreshMetricsCache } = require("../api/_lib/metricsCache");

function fakeDb() {
  const rows = {};
  return { rows, from: (t) => ({ upsert: async (row) => { assert.equal(t, "site_metrics"); rows[row.key] = row.data; return { error: null }; } }) };
}

test("saves both sources, each on its own row", async () => {
  const db = fakeDb();
  const r = await refreshMetricsCache({
    supabase: db, env: { GA_SERVICE_ACCOUNT_JSON: "{}", GA_PROPERTY_ID: "1" }, defaultSite: "https://www.example.com/",
    fetchSummary: async () => ({ visitors: 5 }),
    fetchSearchSummary: async ({ siteUrl }) => ({ site: siteUrl, totals: { clicks: 2 } }),
  });
  assert.deepEqual(r.saved, ["ga", "gsc"]);
  assert.equal(db.rows.ga.available, true); assert.equal(db.rows.ga.visitors, 5);
  assert.equal(db.rows.gsc.site, "https://www.example.com/");
});

test("a Google refusal or missing settings is saved as an explanation, and one source failing does not stop the other", async () => {
  const db = fakeDb();
  await refreshMetricsCache({
    supabase: db, env: { GA_SERVICE_ACCOUNT_JSON: "{}" }, defaultSite: "s",
    fetchSummary: async () => { throw new Error("no"); },
    fetchSearchSummary: async () => { throw new Error("API is off"); },
  });
  assert.equal(db.rows.ga.available, false); assert.match(db.rows.ga.reason, /GA_PROPERTY_ID/);
  assert.equal(db.rows.gsc.available, false); assert.match(db.rows.gsc.reason, /API is off/);
  const none = fakeDb();
  await refreshMetricsCache({ supabase: none, env: {}, fetchSummary: async () => ({}), fetchSearchSummary: async () => ({}) });
  assert.match(none.rows.gsc.reason, /GA_SERVICE_ACCOUNT_JSON/);
});
