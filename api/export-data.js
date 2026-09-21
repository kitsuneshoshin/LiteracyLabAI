const { getSupabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireUser, sendError } = require("./_lib/auth");

// Returns every piece of personal data this account holds, as one JSON
// file the browser downloads. privacy.html promises this as a self-service
// right ("export a copy... in a portable format, on request"); before this
// endpoint existed that promise had no supporting code - a parent asking for
// their data would have needed a human to hand-assemble it from Supabase.
module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed." });
    }
    const user = await requireUser(req);
    const supabase = getSupabaseAdmin();

    const [{ data: profile }, { data: children }, { data: submissions }, { data: commitments }] = await Promise.all([
      supabase.from("profiles").select("id, email, plan, created_at").eq("id", user.id).maybeSingle(),
      supabase.from("child_profiles").select("*").eq("profile_id", user.id),
      supabase.from("submissions").select("*").eq("profile_id", user.id),
      supabase.from("commitments").select("*").eq("profile_id", user.id),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      account: profile || null,
      children: children || [],
      submissions: submissions || [],
      commitments: commitments || [],
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="literacylab-data-export-${user.id}.json"`);
    return res.status(200).send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    sendError(res, err);
  }
};
