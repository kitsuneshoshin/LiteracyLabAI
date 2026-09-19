const FREE_MONTHLY_CAP = 3;

// A dev/QA bypass, separate from real billing state (profiles.plan). Set
// ADMIN_EMAILS in Vercel to a comma-separated list of emails that should
// never hit the free-tier cap, without marking their account as an actual
// paying "pro" customer (which would mix test usage into billing/plan
// semantics and Stripe's eventual source of truth for that field).
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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
    .select("plan, email")
    .eq("id", profileId)
    .single();
  if (profileErr) throw profileErr;

  const isAdmin = ADMIN_EMAILS.includes((profile.email || "").toLowerCase());
  const cap = isAdmin || profile.plan === "pro" ? Infinity : FREE_MONTHLY_CAP;
  return { used: count || 0, cap, plan: isAdmin ? "admin" : profile.plan };
}

module.exports = { getMonthlyUsage, FREE_MONTHLY_CAP };
