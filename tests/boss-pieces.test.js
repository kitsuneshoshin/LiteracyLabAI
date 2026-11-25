const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { BOSS_MAX, norm, countFixes } = require("../api/_lib/bossFixes");
const I18N = require("../app-i18n.js");

// Boss Battle on the Games tab: the learner's own past pieces that have sentences to fix. The activity list carries a small
// `fixes` count per piece (api/_lib/bossFixes.js); the page offers only those and works out the real bosses when one is opened.
const ROOT = path.join(__dirname, "..");
const APP = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
const s = APP.indexOf("// ---- Boss Battle rules (start)"), e = APP.indexOf("// ---- Boss Battle rules (end)");
const B = new Function(APP.slice(s, e) + "\nreturn { BOSS_MAX, bossNorm, bossList, bossPieces };")();

const hl = (quote, revision, type = "grow") => ({ quote, revision, type, note: "n" });

test("the server's count and the page's list follow the same rules, so a piece is offered exactly when it can be battled", () => {
  assert.equal(BOSS_MAX, B.BOSS_MAX);
  assert.equal(norm("It’s  “fine” "), B.bossNorm("It’s  “fine” "));
  const text = "me and my dad built a sandcastle. then the tide came in. We laughed a lot at the end of the day.";
  const cases = [
    [hl("me and my dad", "My dad and I"), hl("then the tide came in", "Then the tide came in")],
    [hl("me and my dad", "me and my dad"), hl("then", ""), hl("We laughed", "We laughed", "glow")],
    [hl("me and my dad", "  me   and my dad "), { quote: "x", type: "grow" }, null, {}],
    [hl("a sandcastle", "a big sandcastle"), hl("the tide", "The Tide"), hl("a lot", "much"), hl("the end", "the end of it"), hl("We", "They"), hl("built", "made")],
    [hl("x".repeat(230), "short")], [hl("me and my dad", "y".repeat(301))],
  ];
  for (const hls of cases) {
    // In the page a boss must also be found in the writing; here every quote is, so the two counts agree.
    const present = hls.filter((h) => h && h.quote && text.toLowerCase().includes(String(h.quote).toLowerCase()) || (h && String(h.quote || "").length > 220));
    const server = countFixes({ highlights: hls });
    const page = B.bossList(text, hls).length;
    assert.ok(page <= server, "the server's count is never lower than the real bosses: " + JSON.stringify([server, page]));
    if (present.length === hls.filter(Boolean).length) assert.ok(server >= page);
  }
  assert.equal(countFixes({ highlights: cases[0] }), 2);
  assert.equal(countFixes({ highlights: cases[1] }), 0, "same rewrite, empty rewrite and glows do not count");
  assert.equal(countFixes({ highlights: cases[3] }), BOSS_MAX, "at most five bosses");
  assert.equal(countFixes({ highlights: cases[4] }) + countFixes({ highlights: cases[5] }), 0, "too long to edit in a box");
  for (const bad of [null, undefined, {}, { highlights: "x" }, { highlights: [null] }]) assert.equal(countFixes(bad), 0);
});

test("the Games tab offers only writing pieces that can be battled, newest first, at most eight", () => {
  const recent = [
    { id: "a", kind: "writing", createdAt: "2026-11-20T01:00:00Z", wordCount: 80, fixes: 3 },
    { id: "r", kind: "reading", createdAt: "2026-11-19T01:00:00Z", fixes: 2 },
    { id: "n", kind: "writing", createdAt: "2026-11-18T01:00:00Z", wordCount: 50, fixes: 0 },
    { id: "m", kind: "writing", createdAt: "2026-11-17T01:00:00Z", wordCount: 60 },
    { id: "b", kind: "writing", createdAt: "2026-11-16T01:00:00Z", wordCount: 70, fixes: 9 },
    null, { kind: "writing", fixes: 1 },
  ];
  assert.deepEqual(B.bossPieces(recent), [
    { id: "a", createdAt: "2026-11-20T01:00:00Z", wordCount: 80, bosses: 3 },
    { id: "b", createdAt: "2026-11-16T01:00:00Z", wordCount: 70, bosses: 5 },
  ]);
  const many = Array.from({ length: 20 }, (_, i) => ({ id: "p" + i, kind: "writing", fixes: 1 }));
  assert.equal(B.bossPieces(many).length, 8);
  assert.equal(B.bossPieces(many)[0].id, "p0");
  assert.deepEqual(B.bossPieces(null), []);
  assert.deepEqual(B.bossPieces("x"), []);
});

test("wiring: the activity list carries the count, and the Games tab opens a past piece into a battle", () => {
  const history = fs.readFileSync(path.join(ROOT, "api", "history.js"), "utf8");
  assert.match(history, /const \{ countFixes \} = require\("\.\/_lib\/bossFixes"\);/);
  assert.match(history, /fixes: s\.kind === "writing" \? countFixes\(s\.feedback\) : 0,/);
  const ui = APP.slice(APP.indexOf("function BossPieces("), APP.indexOf("// Tell us what you think: a short form"));
  assert.match(ui, /const online = !!\(backendLive && childId && session\);/, "the list is fetched on every plan, not only the ones that save the game");
  assert.match(ui, /setPieces\(bossPieces\(d\.recent\)\);\s*if \(!canSync \|\| d\.vocabLocked\) return;/, "and the account sync stays behind its own plan gate");
  assert.match(ui, /submissionId=\$\{encodeURIComponent\(id\)\}/);
  assert.match(ui, /bossList\(d\.text, highlights\)\.length === 0\) setOpenError\("This piece has no sentences to battle\."\)/);
  assert.match(ui, /backLabel="Back"/, "the way back from the Games tab says Back");
  assert.match(ui, /middle=\{pieces === false \? null : <BossPieces /, "hidden when the history is not available (demo, signed out, offline)");
  assert.ok(!/isPaidPlan|LockedFeature|onSeePlans/.test(ui.slice(0, ui.indexOf("function BossBattle("))), "the Games tab card is not behind a plan");
  // Layout: pieces in one, two or three columns, tap targets at least 44px.
  assert.match(ui, /grid gap-2 md:grid-cols-2 xl:grid-cols-3/);
  assert.match(ui, /px-4 min-h-\[44px\]/);
});

test("every language has the lines the Boss Battle card shows", () => {
  const KEYS = ["Battle the sentences from your own pieces that need work.", "Your pieces with sentences to fix", "Bosses: {n0}", "Battle",
    "Finish a piece of writing and read its feedback to unlock boss battles here.", "Couldn't open that piece right now. Please try again.",
    "This piece has no sentences to battle.", "{n0} words", "Back", "Loading…"];
  const codes = I18N.LANGUAGES.map((l) => l.code).filter((c) => c !== "en");
  const ph = (x) => (x.match(/\{n?\d\}/g) || []).map((p) => p.replace("n", "")).sort().join();
  for (const code of codes) {
    const dict = JSON.parse(fs.readFileSync(path.join(ROOT, "app-i18n", code + ".json"), "utf8")).strings;
    const byNorm = new Map(Object.entries(dict).map(([k, v]) => [I18N.norm(k), v]));
    for (const k of KEYS) {
      const v = byNorm.get(I18N.norm(k));
      assert.ok(v, code + " is missing: " + k);
      if (typeof v === "string") assert.equal(ph(v), ph(k), code + ": placeholders differ for " + k);
    }
  }
});
