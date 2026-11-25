const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Boss Battle turns the parts of a child's own piece that the feedback flagged as a Grow (each with a suggested rewrite) into
// bosses. Its rules live in app.html, so they are copied out of the source and run here: which highlights become bosses, how
// an edit is judged, and how the coins add up. Nothing is marked by an AI.
const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const s = APP.indexOf("// ---- Boss Battle rules (start)"), e = APP.indexOf("// ---- Boss Battle rules (end)");
assert.ok(s > 0 && e > s, "the Boss Battle rules are in app.html");
const B = new Function(APP.slice(s, e) + "\nreturn { BOSS_MAX, BOSS_COINS, bossNorm, bossContext, bossList, bossJudge, bossTotals };")();

const STORY = "Last summer we went to the beach. me and my dad built a huge sandcastle with a moat and four towers and we put shells on top. then the tide came in and washed it all away. It was sad but we laughed.";
const hl = (quote, revision, type = "grow", note = "A note.") => ({ quote, revision, type, note });

test("only a Grow with a different rewrite becomes a boss, in the order it appears in the story", () => {
  const list = B.bossList(STORY, [
    hl("then the tide came in", "Then the tide came in"),
    hl("It was sad but we laughed.", "It was sad but we laughed.", "glow"),
    hl("me and my dad", "My dad and I"),
    hl("went to the beach", "went to the beach"),
    hl("huge sandcastle", ""),
    hl("not in the story at all", "Something else"),
    hl("four towers", "four towers", "grow"),
    { quote: "shells", type: "grow", note: "no rewrite" },
  ]);
  assert.deepEqual(list.map((b) => b.quote), ["me and my dad", "then the tide came in"]);
  assert.deepEqual(list.map((b) => b.revision), ["My dad and I", "Then the tide came in"]);
  assert.ok(list.every((b) => b.note === "A note."));
  assert.deepEqual(B.bossList("", [hl("a", "b")]), []);
  assert.deepEqual(B.bossList(STORY, null), []);
  assert.deepEqual(B.bossList(STORY, [null, {}, { type: "grow" }]), []);
});

test("a boss keeps the child's own wording and capitals, even when the feedback quoted it in another case", () => {
  const [b] = B.bossList(STORY, [hl("ME AND MY DAD", "My dad and I")]);
  assert.equal(b.quote, "me and my dad");
});

test("overlapping flags keep the first, very long ones are left out, and a battle has at most five bosses", () => {
  const overlap = B.bossList(STORY, [hl("me and my dad built", "My dad and I built"), hl("my dad built a huge", "my dad built a big")]);
  assert.deepEqual(overlap.map((b) => b.quote), ["me and my dad built"]);
  const long = "x ".repeat(120) + "end";
  assert.deepEqual(B.bossList(long, [hl(long, "short")]), [], "too long to edit in a box");
  const many = "one two three four five six seven eight nine ten.";
  const flags = ["one", "two", "three", "four", "five", "six", "seven"].map((w) => hl(w, w.toUpperCase()));
  assert.equal(B.bossList(many, flags).length, B.BOSS_MAX);
  assert.equal(B.BOSS_MAX, 5);
});

test("each boss shows a little of the story around it, cut at a word edge", () => {
  const [tide] = B.bossList(STORY, [hl("then the tide came in", "Then the tide came in")]);
  assert.ok(tide.before.startsWith("… ") && tide.before.length <= 62, "a long lead-in is cut: " + tide.before);
  assert.ok(!tide.before.slice(2).startsWith(" ") && /^\S/.test(tide.before.slice(2)), "and starts on a whole word");
  assert.equal(tide.after, "and washed it all away. It was sad but we laughed.", "a short ending is kept whole");
  const [dad] = B.bossList(STORY, [hl("me and my dad", "My dad and I")]);
  assert.equal(dad.before, "Last summer we went to the beach.", "a short lead-in is kept whole");
  assert.ok(dad.after.endsWith(" …") && dad.after.length <= 62 && !dad.after.slice(0, -2).endsWith(" "), "a long ending is cut at a word: " + dad.after);
  const [first] = B.bossList(STORY, [hl("Last summer", "Last summer,")]);
  assert.equal(first.before, "", "nothing before the first words");
  assert.equal(B.bossContext("short bit ", true), "short bit", "no stray space where the boss begins");
  assert.equal(B.bossContext(" short bit", false), "short bit");
  assert.equal(B.bossContext("", false), "");
});

test("an edit is judged as unchanged, exactly the suggested fix, or something else", () => {
  const boss = { quote: "me and my dad", revision: "My dad and I" };
  assert.equal(B.bossJudge("me and my dad", boss), "same");
  assert.equal(B.bossJudge("  me   and my dad ", boss), "same", "only spaces changed");
  assert.equal(B.bossJudge("", boss), "same");
  assert.equal(B.bossJudge("My dad and I", boss), "exact");
  assert.equal(B.bossJudge("  My  dad and I  ", boss), "exact", "extra spaces do not matter");
  assert.equal(B.bossJudge("my dad and I", boss), "other", "a capital matters");
  assert.equal(B.bossJudge("My dad and me", boss), "other");
  assert.equal(B.bossJudge("My dad and I.", boss), "other", "punctuation matters");
  assert.equal(B.bossNorm("It’s “fine”"), "It's \"fine\"", "curly quotes count as straight ones");
  assert.equal(B.bossJudge("It’s fine", { quote: "its fine", revision: "It's fine" }), "exact");
  assert.equal(B.bossNorm(null), "");
});

test("coins: a direct hit is worth most, a fix that works a little less, and learning the suggestion still earns something", () => {
  assert.deepEqual(B.BOSS_COINS, { exact: 15, works: 8, learn: 3 });
  const t = B.bossTotals(["exact", "works", "learn", "exact"]);
  assert.deepEqual(t, { outOf: 4, exact: 2, right: 3, coins: 41, bestCombo: 2 });
  assert.deepEqual(B.bossTotals(["exact", "exact", "exact"]), { outOf: 3, exact: 3, right: 3, coins: 45, bestCombo: 3 });
  assert.deepEqual(B.bossTotals(["learn", "learn"]), { outOf: 2, exact: 0, right: 0, coins: 6, bestCombo: 0 });
  assert.deepEqual(B.bossTotals(["bogus", "exact"]), { outOf: 1, exact: 1, right: 1, coins: 15, bestCombo: 1 });
  assert.deepEqual(B.bossTotals([]), { outOf: 0, exact: 0, right: 0, coins: 0, bestCombo: 0 });
  assert.deepEqual(B.bossTotals(null), { outOf: 0, exact: 0, right: 0, coins: 0, bestCombo: 0 });
});

test("Boss Battle is on the writing feedback for every plan, shares the Word Dash rewards, and is wired into the workspace", () => {
  assert.match(APP, /function BossBattleCard\(/);
  assert.match(APP, /const bossCount = onBattle \? bossList\(submittedText, feedback && feedback\.highlights\)\.length : 0;/);
  assert.match(APP, /\{bossCount > 0 && <BossBattleCard count=\{bossCount\} onStart=\{onBattle\} \/>\}/);
  assert.match(APP, /onBattle=\{\(\)=>setBattle\(true\)\}/);
  assert.match(APP, /exerciseType === "writing" && battle \? \(\s*<BossBattle text=\{text\} highlights=\{backendFeedback\?\.highlights\} plan=\{plan\}/);
  assert.match(APP, /useEffect\(\(\)=>\{ setBattle\(false\); \}, \[exerciseType, phase\]\);/, "a new piece or another tab closes the battle");
  assert.match(APP, /logEvent\("boss_start"/);
  assert.match(APP, /logEvent\("boss_round"/);
  const ui = APP.slice(APP.indexOf("function dashFinishRound("), APP.indexOf("// Tell us what you think: a short form"));
  assert.match(ui, /dashApplyRound\(dash, res, dashDay\(Date\.now\(\)\), Math\.random\)/, "the same egg, Word Pals and streak");
  assert.match(ui, /planMeta\(plan\)\.vocabBank/, "the account copy of the game is only saved on plans that keep it");
  assert.ok(!/onSeePlans|isPaidPlan|LockedFeature/.test(ui), "Boss Battle is not behind a plan");
  // The child's story is English text: never flipped or translated; counters and scores keep their order.
  assert.match(ui, /dir="ltr" lang="en" data-no-i18n=""/);
  assert.match(ui, /dir="ltr">\{value\}/);
  assert.match(ui, /min-h-\[48px\]/, "easy to tap");
});
