const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");

const MAX_CHILDREN_PER_ACCOUNT = 6; // sanity ceiling, not a pricing tier

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
      return res.status(200).json({ profiles: data });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const allowed = ["display_name", "country", "grade_idx", "interests", "confidence_writing", "confidence_reading", "motivation", "onboarded"];
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
      const { count, error: countErr } = await supabase
        .from("child_profiles").select("id", { count: "exact", head: true }).eq("profile_id", user.id);
      if (countErr) throw countErr;
      if ((count || 0) >= MAX_CHILDREN_PER_ACCOUNT) {
        return res.status(400).json({ error: `You can have up to ${MAX_CHILDREN_PER_ACCOUNT} learners on one account.` });
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
    sendError(res, err);
  }
};
