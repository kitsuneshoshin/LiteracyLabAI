// Which learners may start NEW work under the account's current plan.
//
// A plan's learner limit (plans.js maxLearners) is enforced when a learner is
// added, but an account can end up above it later: a Premium family with four
// children who downgrades to Core, or cancels to Free, keeps all four. Their
// work stays saved and visible - nothing is deleted - but only as many
// learners as the plan covers can start new prompts or passages. The parent
// chooses which one ("the active learner"); upgrading again unlocks the rest.
//
// The active learner can only be changed once every ACTIVE_CHANGE_DAYS.
// Without that, a two-child family on Core could switch daily and get
// Premium's main benefit at Core's price.

const ACTIVE_CHANGE_DAYS = 30;

// children must be sorted oldest first. Returns the ids that are locked.
// With no active learner chosen yet, the oldest learners keep access, so a
// downgrade never locks everyone out before the parent has picked.
function lockedChildIds(children, maxLearners, activeChildId) {
  if (children.length <= maxLearners) return new Set();
  const allowed = new Set();
  if (children.some((c) => c.id === activeChildId)) allowed.add(activeChildId);
  for (const c of children) {
    if (allowed.size >= maxLearners) break;
    allowed.add(c.id);
  }
  return new Set(children.filter((c) => !allowed.has(c.id)).map((c) => c.id));
}

// Earliest time the active learner may be changed again, or null if it can
// be changed now. First-ever choice is always allowed.
function nextActiveChangeAt(activeChildSetAt, now = new Date()) {
  if (!activeChildSetAt) return null;
  const next = new Date(new Date(activeChildSetAt).getTime() + ACTIVE_CHANGE_DAYS * 86400000);
  return next > now ? next : null;
}

async function loadLearnerState(supabase, profileId) {
  const [{ data: children, error: childErr }, { data: profile, error: profileErr }] = await Promise.all([
    supabase.from("child_profiles").select("id, created_at").eq("profile_id", profileId).order("created_at", { ascending: true }),
    supabase.from("profiles").select("active_child_id, active_child_set_at").eq("id", profileId).single(),
  ]);
  if (childErr) throw childErr;
  if (profileErr) throw profileErr;
  return { children: children || [], activeChildId: profile && profile.active_child_id, activeChildSetAt: profile && profile.active_child_set_at };
}

// Throws a 402 the UI can act on if this learner is locked under the plan.
async function assertLearnerCanStartWork(supabase, profileId, childId, capabilities) {
  const { children, activeChildId } = await loadLearnerState(supabase, profileId);
  if (!lockedChildIds(children, capabilities.maxLearners, activeChildId).has(childId)) return;
  const err = new Error(
    `This learner is paused on your current plan, which covers ${capabilities.maxLearners === 1 ? "one learner" : `${capabilities.maxLearners} learners`}. ` +
    "Their work is all still saved. Make them your active learner, or upgrade to Premium to use every learner again."
  );
  err.statusCode = 402;
  err.code = "learner_locked";
  throw err;
}

module.exports = { ACTIVE_CHANGE_DAYS, lockedChildIds, nextActiveChangeAt, loadLearnerState, assertLearnerCanStartWork };
