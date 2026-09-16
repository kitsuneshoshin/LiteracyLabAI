const { getSupabaseAdmin } = require("./supabaseAdmin");

// Verifies the bearer token from the Authorization header against Supabase Auth
// and returns the authenticated user. Every data-touching endpoint must call
// this first — the service-role client bypasses RLS, so this check is the
// only thing standing between a request and someone else's data.
async function requireUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    const err = new Error("Missing Authorization bearer token.");
    err.statusCode = 401;
    throw err;
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error("Invalid or expired session.");
    err.statusCode = 401;
    throw err;
  }
  return data.user;
}

function sendError(res, err) {
  const status = err.statusCode || 500;
  console.error(err);
  res.status(status).json({ error: err.message || "Internal server error." });
}

module.exports = { requireUser, sendError };
