// How well a learner knows each vocabulary word, kept on the account so it follows them between
// devices. The page keeps its own copy too (and works without this); this is what lets a second
// device pick up where the first left off. One row per learner and word: a box from 0 (new) to 3
// (known) and when it last changed. The newest change always wins, so an old device that comes back
// online cannot undo newer progress. The table is in supabase/schema.sql.

const MAX_UPDATES = 100;
const MAX_TERM = 80;
const MAX_BOX = 3;
const CLOCK_SLACK_MS = 60 * 1000;

const cleanTerm = (t) => (typeof t === "string" ? t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TERM) : "");

// What the page may send: up to 100 changes, each a word, a box 0-3 and the time it happened.
// Anything malformed is dropped, a time in the future is pulled back, and repeats keep the newest.
function sanitizeUpdates(updates, now = Date.now()) {
  if (!Array.isArray(updates)) return [];
  const byTerm = new Map();
  for (const u of updates.slice(0, MAX_UPDATES)) {
    if (!u || typeof u !== "object") continue;
    const term = cleanTerm(u.term);
    if (!term || !Number.isInteger(u.box) || u.box < 0 || u.box > MAX_BOX) continue;
    let at = Number(u.at);
    if (!Number.isFinite(at) || at <= 0) at = now;
    at = Math.min(at, now + CLOCK_SLACK_MS);
    const prev = byTerm.get(term);
    if (!prev || at >= prev.at) byTerm.set(term, { term, box: u.box, at });
  }
  return [...byTerm.values()];
}

// { term: { box, at } } for one learner. A missing table or any read problem gives an empty map, never an
// error: the vocabulary page must keep working from the device's own copy.
async function readVocabProgress(supabase, profileId, childId) {
  try {
    const { data, error } = await supabase
      .from("vocab_progress")
      .select("term, box, updated_at")
      .eq("profile_id", profileId)
      .eq("child_id", childId)
      .limit(5000);
    if (error) throw error;
    const out = {};
    for (const r of data || []) {
      const at = Date.parse(r.updated_at);
      if (r && typeof r.term === "string" && Number.isInteger(r.box) && r.box >= 0 && r.box <= MAX_BOX) out[r.term] = { box: r.box, at: Number.isFinite(at) ? at : 0 };
    }
    return out;
  } catch (err) {
    console.warn("Vocabulary progress could not be read:", err && err.message);
    return {};
  }
}

// Saves the changes that are newer than what is stored. Returns how many rows were written.
async function writeVocabProgress(supabase, profileId, childId, updates) {
  const clean = sanitizeUpdates(updates);
  if (clean.length === 0) return 0;
  const { data: existing, error } = await supabase
    .from("vocab_progress")
    .select("term, updated_at")
    .eq("profile_id", profileId)
    .eq("child_id", childId)
    .in("term", clean.map((u) => u.term));
  if (error) throw error;
  const have = new Map((existing || []).map((r) => [r.term, Date.parse(r.updated_at)]));
  const rows = clean
    .filter((u) => !(have.has(u.term) && have.get(u.term) >= u.at))
    .map((u) => ({ child_id: childId, profile_id: profileId, term: u.term, box: u.box, updated_at: new Date(u.at).toISOString() }));
  if (rows.length === 0) return 0;
  const { error: upErr } = await supabase.from("vocab_progress").upsert(rows, { onConflict: "child_id,term" });
  if (upErr) throw upErr;
  return rows.length;
}

module.exports = { sanitizeUpdates, readVocabProgress, writeVocabProgress, cleanTerm, MAX_UPDATES };
