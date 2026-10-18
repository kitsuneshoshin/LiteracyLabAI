// Keeps a daily copy of the Google Analytics and Search Console numbers in the site_metrics table, so the
// owner's dashboard can read them from the database instead of needing a signed-in browser.
// Each source is saved on its own; a setup gap is saved as { available:false, reason } so the dashboard can explain it.
// Site-wide statistics only, nothing about any customer.

async function collect(name, fn) {
  try {
    return { available: true, ...(await fn()) };
  } catch (err) {
    return { available: false, reason: String((err && err.message) || err), checkedAt: new Date().toISOString() };
  }
}

async function refreshMetricsCache({ supabase, env = process.env, fetchSummary, fetchSearchSummary, defaultSite }) {
  const out = {};
  const raw = env.GA_SERVICE_ACCOUNT_JSON;
  const gaMissing = "Add GA_SERVICE_ACCOUNT_JSON (the read-only service account key) and GA_PROPERTY_ID in Vercel.";
  out.ga = raw && env.GA_PROPERTY_ID
    ? await collect("ga", () => fetchSummary({ rawCreds: raw, propertyId: env.GA_PROPERTY_ID }))
    : { available: false, reason: gaMissing, checkedAt: new Date().toISOString() };
  out.gsc = raw
    ? await collect("gsc", () => fetchSearchSummary({ rawCreds: raw, siteUrl: env.GSC_SITE_URL || defaultSite }))
    : { available: false, reason: "Add GA_SERVICE_ACCOUNT_JSON (the read-only service account key) in Vercel.", checkedAt: new Date().toISOString() };

  const saved = [];
  for (const key of Object.keys(out)) {
    const { error } = await supabase.from("site_metrics").upsert({ key, data: out[key], updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) console.error("Saving site metrics failed:", key, error.message);
    else saved.push(key);
  }
  return { saved, available: { ga: out.ga.available, gsc: out.gsc.available } };
}

module.exports = { refreshMetricsCache };
