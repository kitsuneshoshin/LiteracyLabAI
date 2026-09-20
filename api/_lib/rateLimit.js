// Stops a single account (including an "unlimited" Pro one, where the
// monthly usage cap in usage.js deliberately doesn't apply) from hammering
// an OpenAI-billed endpoint faster than any real student plausibly would.
// This is a distinct concern from the monthly free-tier cap: that limits
// how MANY submissions a free account gets; this limits how FAST any
// account can trigger billed AI calls, which matters even when the count
// itself is uncapped.
//
// Uses a simple count-then-insert against rate_limit_hits rather than a
// single atomic increment, so there's a small race window under adversarial
// concurrency (a burst of truly simultaneous requests could all read the
// same "under limit" count before any insert lands). That's an acceptable
// trade-off here — unlike the usage-cap race fixed in submit.js/
// writing-prompt.js/reading-passage.js, this only needs to make sustained
// hammering expensive/annoying, not be billing-exact.
async function checkRateLimit(supabase, profileId, bucket, { limit, windowSeconds }) {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await supabase
    .from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("bucket", bucket)
    .gte("created_at", windowStart);
  if (error) throw error;

  if ((count || 0) >= limit) {
    const err = new Error("You're sending requests faster than we allow. Please wait a moment and try again.");
    err.statusCode = 429;
    throw err;
  }

  const { error: insertErr } = await supabase.from("rate_limit_hits").insert({ profile_id: profileId, bucket });
  if (insertErr) throw insertErr;

  // Opportunistic cleanup instead of a separate cron job: piggyback on a
  // request that's already happening to delete this account's own old hits
  // (well outside any window this file uses), so the table doesn't grow
  // forever per active user. Fire-and-forget - never block the real request
  // on housekeeping.
  const staleBefore = new Date(Date.now() - 3600 * 1000).toISOString();
  supabase.from("rate_limit_hits").delete().eq("profile_id", profileId).lt("created_at", staleBefore)
    .then(({ error: cleanupErr }) => { if (cleanupErr) console.warn("Rate limit cleanup failed:", cleanupErr); });
}

module.exports = { checkRateLimit };
