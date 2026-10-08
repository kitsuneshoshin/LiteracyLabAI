const { capabilitiesFor } = require("./plans");

const FREE_MONTHLY_CAP = 3;

// A piece is paid for the moment a prompt or passage is requested (a placeholder row is saved before the AI is asked,
// so two quick taps cannot slip past the limit). If the AI call fails with an error, the endpoints delete that row. But
// if the request is cut off before it can (the host's time limit, a crash), the placeholder would stay behind and
// count for ever. A placeholder that is still empty after this long can only be that case, because no generation takes
// anywhere near this long, so it no longer counts: the learner never received anything for it.
const ABANDONED_AFTER_MS = 3 * 60 * 1000;

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

  // Placeholders that never received a prompt or passage and never will (see above). Not deleted, only not counted.
  const { count: neverDelivered, error: staleErr } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .gte("created_at", monthStart)
    .lt("created_at", new Date(now.getTime() - ABANDONED_AFTER_MS).toISOString())
    .is("feedback", null)
    .is("content->generatedPrompt", null)
    .is("content->generatedPassage", null);
  if (staleErr) throw staleErr;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("plan, email")
    .eq("id", profileId)
    .single();
  if (profileErr) throw profileErr;

  const isAdmin = ADMIN_EMAILS.includes((profile.email || "").toLowerCase());
  const plan = isAdmin ? "admin" : profile.plan;
  const caps = capabilitiesFor(plan);
  return { used: Math.max(0, (count || 0) - (neverDelivered || 0)), cap: caps.monthlyCap, plan, capabilities: caps };
}

module.exports = { getMonthlyUsage, FREE_MONTHLY_CAP, ABANDONED_AFTER_MS };
