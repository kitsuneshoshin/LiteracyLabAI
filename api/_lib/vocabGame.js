// Word Dash (the vocabulary game) progress, kept on the account so coins, Word Pals and the streak follow a learner
// between devices. One row per learner holding the whole game as a small JSON object. The page keeps its own copy too
// (and works without this); the rules below are the same ones the page uses to join two copies, and a test proves they
// agree. Two devices never undo each other: pals are joined, counts take the larger, the streak comes from whichever
// device played most recently. The table is in supabase/schema.sql.

// Must match DASH_PALS in app.html (tests/vocab-game.test.js checks).
const PAL_IDS = ["fox", "penguin", "turtle", "frog", "bee", "hedgehog", "panda", "octopus", "owl", "butterfly", "dolphin", "lion", "trex", "dragon", "unicorn", "peacock"];
const DASH_EGG = 150;
const MAX_COUNT = 10000000;

const count = (v) => (Number.isFinite(v) && v > 0 ? Math.min(MAX_COUNT, Math.floor(v)) : 0);

// Whatever arrives (or is stored) is cleaned into the one shape, so a bad client can never store junk.
function sanitizeGame(v) {
  const s = v && typeof v === "object" && !Array.isArray(v) ? v : {};
  const pals = Array.isArray(s.pals) ? PAL_IDS.filter((id) => s.pals.includes(id)) : [];
  return {
    coins: count(s.coins), egg: Math.min(DASH_EGG - 1, count(s.egg)), pals,
    streak: count(s.streak), lastDay: Number.isFinite(s.lastDay) ? Math.min(MAX_COUNT, Math.floor(s.lastDay)) : -1,
    freezes: Math.min(2, count(s.freezes)), rounds: count(s.rounds), right: count(s.right),
    bestCombo: count(s.bestCombo), perfect: count(s.perfect),
  };
}

// Joins two copies of one learner's game. The copy with more rounds played is the base; pals from both are kept;
// counts take the larger; the streak (and its freezes) come from the copy that played most recently.
function mergeGame(a, b) {
  const A = sanitizeGame(a), B = sanitizeGame(b);
  const tie = A.rounds === B.rounds && A.lastDay === B.lastDay;
  const base = B.rounds > A.rounds || (B.rounds === A.rounds && B.lastDay > A.lastDay) ? B : A;
  const live = B.lastDay > A.lastDay || (B.lastDay === A.lastDay && B.streak > A.streak) ? B : A;
  const pals = PAL_IDS.filter((id) => A.pals.includes(id) || B.pals.includes(id));
  const m = Math.max;
  return {
    coins: m(A.coins, B.coins), egg: pals.length >= PAL_IDS.length ? 0 : tie ? m(A.egg, B.egg) : base.egg, pals,
    streak: live.streak, lastDay: live.lastDay, freezes: live.freezes,
    rounds: m(A.rounds, B.rounds), right: m(A.right, B.right), bestCombo: m(A.bestCombo, B.bestCombo), perfect: m(A.perfect, B.perfect),
  };
}

// The saved game for one learner, or null when there is none (or the table is missing / any read problem): the page
// must keep working from the device's own copy.
async function readVocabGame(supabase, profileId, childId) {
  try {
    const { data, error } = await supabase.from("vocab_game").select("state").eq("profile_id", profileId).eq("child_id", childId).maybeSingle();
    if (error) throw error;
    return data && data.state ? sanitizeGame(data.state) : null;
  } catch (err) {
    console.warn("Word Dash progress could not be read:", err && err.message);
    return null;
  }
}

// Joins what the page sent with what is stored, saves the result and returns it (so the page can show it). Null if it
// could not be saved: the device keeps its copy and tries again next time.
async function writeVocabGame(supabase, profileId, childId, incoming) {
  try {
    const stored = await readVocabGame(supabase, profileId, childId);
    const merged = stored ? mergeGame(stored, incoming) : sanitizeGame(incoming);
    const { error } = await supabase.from("vocab_game").upsert({ child_id: childId, profile_id: profileId, state: merged, updated_at: new Date().toISOString() }, { onConflict: "child_id" });
    if (error) throw error;
    return merged;
  } catch (err) {
    console.warn("Word Dash progress could not be saved:", err && err.message);
    return null;
  }
}

module.exports = { PAL_IDS, DASH_EGG, sanitizeGame, mergeGame, readVocabGame, writeVocabGame };
