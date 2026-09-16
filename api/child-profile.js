const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");

// One child profile per account for now (the UI is single-learner). GET
// creates a default row on first call so the front end never has to handle
// a "no profile yet" state; POST updates whichever fields are provided.
module.exports = async function handler(req, res) {
  try {
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    if (req.method === "GET") {
      let { data, error } = await supabase
        .from("child_profiles")
        .select("*")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        const { data: created, error: insertErr } = await supabase
          .from("child_profiles")
          .insert({ profile_id: user.id })
          .select("*")
          .single();
        if (insertErr) throw insertErr;
        data = created;
      }
      return res.status(200).json({ profile: data });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const allowed = ["display_name", "country", "grade_idx", "interests", "confidence_writing", "confidence_reading", "motivation"];
      const patch = {};
      for (const key of allowed) if (key in body) patch[key] = body[key];
      patch.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("child_profiles")
        .update(patch)
        .eq("profile_id", user.id)
        .select("*")
        .single();
      if (error) throw error;
      return res.status(200).json({ profile: data });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    sendError(res, err);
  }
};
