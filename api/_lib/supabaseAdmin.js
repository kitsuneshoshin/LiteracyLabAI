const { createClient } = require("@supabase/supabase-js");

// Service-role client: server-side only, never send this key to the browser.
// Bypasses Row Level Security, so every function using this MUST scope
// queries to the authenticated user itself (see requireUser in auth.js).
let client = null;
function getSupabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Vercel project env vars.");
  }
  client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return client;
}

module.exports = { getSupabaseAdmin };
