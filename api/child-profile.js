const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");
const { getMonthlyUsage } = require("./_lib/usage");
const { ACTIVE_CHANGE_DAYS, lockedChildIds, nextActiveChangeAt, loadLearnerState } = require("./_lib/learnerAccess");

// Supports multiple learners per account (a household can have more than
// one child). GET lists every child profile for this account, creating a
// first default one if there are none yet, so the front end never has to
// handle an empty state. POST with a childId updates that specific child
// (ownership-checked); POST without one creates a new child. DELETE removes
// one (and, via the FK's on delete cascade, every submission/commitment
// tied to it — a genuinely destructive action, so the UI must confirm
// before calling this).
module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      let { data, error } = await supabase
        .from("child_profiles")
        .select("*")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      if (!data || data.length === 0) {
        const { data: created, error: insertErr } = await supabase
          .from("child_profiles")
          .insert({ profile_id: user.id })
          .select("*")
          .single();
        if (insertErr) throw insertErr;
        data = [created];
      }

      // Tell the app which learners are paused after a downgrade (see
      // _lib/learnerAccess.js), so it can show it before a child tries.
      const { capabilities } = await getMonthlyUsage(supabase, user.id);
      const { activeChildId, activeChildSetAt } = await loadLearnerState(supabase, user.id);
      const locked = lockedChildIds(data, capabilities.maxLearners, activeChildId);
      const nextChange = nextActiveChangeAt(activeChildSetAt);
      return res.status(200).json({
        profiles: data.map((c) => ({ ...c, locked: locked.has(c.id) })),
        maxLearners: capabilities.maxLearners,
        activeChildId: activeChildId || null,
        activeChangeAvailableAt: nextChange ? nextChange.toISOString() : null,
      });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

      // Choose which learner stays usable when the account holds more
      // learners than the plan covers. Limited to once per ACTIVE_CHANGE_DAYS
      // so switching back and forth can't stand in for Premium.
      if (body.makeActive && body.childId) {
        const { children, activeChildId, activeChildSetAt } = await loadLearnerState(supabase, user.id);
        if (!children.some((c) => c.id === body.childId)) {
          return res.status(404).json({ error: "Learner not found for this account." });
        }
        if (activeChildId === body.childId) return res.status(200).json({ activeChildId });
        const next = nextActiveChangeAt(activeChildSetAt);
        if (next) {
          return res.status(429).json({
            error: `You can change your active learner once every ${ACTIVE_CHANGE_DAYS} days. The next change is available on ${next.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}.`,
            code: "active_change_cooldown",
            availableAt: next.toISOString(),
          });
        }
        const { error } = await supabase.from("profiles")
          .update({ active_child_id: body.childId, active_child_set_at: new Date().toISOString() })
          .eq("id", user.id);
        if (error) throw error;
        return res.status(200).json({ activeChildId: body.childId });
      }
      const allowed = ["display_name", "country", "grade_idx", "interests", "confidence_writing", "confidence_reading", "motivation", "onboarded", "avatar_id"];
      const patch = {};
      for (const key of allowed) if (key in body) patch[key] = body[key];

      if (body.childId) {
        // Update an existing child - ownership is enforced by scoping the
        // update to profile_id as well as id, not just trusting the id
        // the client sent.
        patch.updated_at = new Date().toISOString();
        const { data, error } = await supabase
          .from("child_profiles").update(patch).eq("id", body.childId).eq("profile_id", user.id).select("*").maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Learner not found for this account." });
        return res.status(200).json({ profile: data });
      }

      // No childId: create a new learner (the "+ Add another learner" flow).
      // How many learners an account may hold is a plan capability now, so
      // it's read from the same source of truth every other gate uses.
      const { count, error: countErr } = await supabase
        .from("child_profiles").select("id", { count: "exact", head: true }).eq("profile_id", user.id);
      if (countErr) throw countErr;
      const { capabilities } = await getMonthlyUsage(supabase, user.id);
      if ((count || 0) >= capabilities.maxLearners) {
        return res.status(402).json({
          error: capabilities.maxLearners === 1
            ? "Your plan covers one learner. Upgrade to Premium to add up to six."
            : `You can have up to ${capabilities.maxLearners} learners on one account.`,
          upgradeTo: capabilities.maxLearners === 1 ? "premium" : null,
        });
      }

      const { data, error } = await supabase
        .from("child_profiles").insert({ profile_id: user.id, ...patch }).select("*").single();
      if (error) throw error;
      return res.status(200).json({ profile: data });
    }

    if (req.method === "DELETE") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      if (!body.childId) return res.status(400).json({ error: "childId is required." });

      const { count, error: countErr } = await supabase
        .from("child_profiles").select("id", { count: "exact", head: true }).eq("profile_id", user.id);
      if (countErr) throw countErr;
      if ((count || 0) <= 1) {
        return res.status(400).json({ error: "Every account needs at least one learner - add a new one before removing this one." });
      }

      const { data, error } = await supabase
        .from("child_profiles").delete().eq("id", body.childId).eq("profile_id", user.id).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Learner not found for this account." });
      return res.status(200).json({ deleted: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    await sendError(res, err);
  }
};
