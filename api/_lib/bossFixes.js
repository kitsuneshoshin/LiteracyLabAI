// Boss Battle (the game that turns the parts of a child's own piece that the feedback flagged as a Grow, each with a suggested
// rewrite, into bosses) needs to know which past pieces have any. The activity list carries that as a small count so the Games
// tab can offer only the pieces that can be battled. The page decides the real bosses when a piece is opened (it also needs the
// writing to find each quote); this count follows the same rules without the text, so it can only be at least as high.
// The rules below must match bossNorm / bossList in app.html (tests/boss-pieces.test.js checks).

const BOSS_MAX = 5;

// Compared with spaces collapsed and curly quotes treated like straight ones, but with capitals and punctuation kept.
function norm(s) {
  return String(s == null ? "" : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

// How many bosses a piece's feedback could give (0 to BOSS_MAX), or 0 for anything that is not writing feedback.
function countFixes(feedback) {
  const highlights = feedback && Array.isArray(feedback.highlights) ? feedback.highlights : [];
  let n = 0;
  for (const h of highlights) {
    if (!h || h.type !== "grow" || !h.quote || typeof h.revision !== "string") continue;
    const revision = h.revision.trim();
    if (!revision || norm(revision) === norm(h.quote)) continue;
    if (String(h.quote).length > 220 || revision.length > 300) continue;
    n++;
  }
  return Math.min(BOSS_MAX, n);
}

module.exports = { BOSS_MAX, norm, countFixes };
