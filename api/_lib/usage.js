const FREE_MONTHLY_CAP = 3;

// Counts submissions server-side, in the current calendar month, for this
// account — this is the number that actually gates access. The client-side
// count shown in the header is just a mirror of this, never the source of truth.
async function getMonthlyUsage(supabase, profileId) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .gte("created_at", monthStart);
  if (error) throw error;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", profileId)
    .single();
  if (profileErr) throw profileErr;

  const cap = profile.plan === "pro" ? Infinity : FREE_MONTHLY_CAP;
  return { used: count || 0, cap, plan: profile.plan };
}

module.exports = { getMonthlyUsage, FREE_MONTHLY_CAP };
