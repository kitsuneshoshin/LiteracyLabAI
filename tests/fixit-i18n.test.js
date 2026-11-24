const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const I18N = require("../app-i18n.js");

// Fix It and the Games tab show these pieces of text. Every language the app is translated into must have all of them, or a
// family reading in that language sees a mix of their language and English. The sentences being practised, and the short
// reminder after each answer, are English on purpose: they are the thing being learned.
const ROOT = path.join(__dirname, "..");
const APP = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
const c0 = APP.indexOf("// ---- Fix It rules (start)"), c1 = APP.indexOf("// ---- Fix It rules (end)");
const SKILLS = new Function(APP.slice(c0, c1).replace(/const fixitShuffle[^\n]*\n/, "") + "\nreturn FIXIT_SKILLS;")();
const LABELS = [...new Set(Object.values(SKILLS).flatMap((s) => [s.label, s.labelUs].filter(Boolean)))];
const KEYS = [
  "Games", "Spot the mistake, then fix it. Every right answer earns coins for your Word Pals.", "Play Fix It", "Your skills",
  "Tap the word with the mistake", "Now choose the fix", "Read aloud", "Not quite. Here is the fixed sentence.",
  "This sentence will come back for a second chance.", "Next sentence", "Sentences to revisit", "Keep going!", ...LABELS,
  // already translated for Word Dash, shown again here
  "Day streak: {n0}", "No streak yet", "Play again", "My Word Pals ({n0}/{n1})", "Next Word Pal", "{n0} / {n1} coins", "Second chance",
  "New", "Learning", "Nearly there", "Know it", "Finish the round", "One more round", "Done", "Quit", "Build a combo", "{n0} in a row",
];
const uiCodes = I18N.LANGUAGES.map((l) => l.code).filter((c) => c !== "en");
const dictionary = (code) => JSON.parse(fs.readFileSync(path.join(ROOT, "app-i18n", code + ".json"), "utf8")).strings;
const norm = I18N.norm;

test("every language has a translation for every line of Fix It and the Games tab", () => {
  assert.ok(uiCodes.length >= 10);
  assert.ok(LABELS.length >= 15, "the skill names are picked up from the game");
  for (const code of uiCodes) {
    const have = new Set(Object.keys(dictionary(code)).map(norm));
    const missing = KEYS.filter((k) => !have.has(norm(k)));
    assert.deepEqual(missing, [], code + " is missing " + missing.length + " line(s)");
  }
});

test("the game's own name is never translated, and each translation keeps the numbers of its English line", () => {
  const ph = (s) => (s.match(/\{n?\d\}/g) || []).map((p) => p.replace("n", "")).sort().join();
  for (const code of uiCodes) {
    const byNorm = new Map(Object.entries(dictionary(code)).map(([k, v]) => [norm(k), v]));
    for (const k of KEYS) {
      const v = byNorm.get(norm(k));
      assert.equal(typeof v, "string", code + ": " + k + " should be plain text");
      assert.equal(ph(v), ph(k), code + ": placeholders differ for " + k);
      if (/Fix It/.test(k)) assert.ok(v.includes("Fix It"), code + ": the name Fix It must stay as it is in: " + k);
    }
  }
});

test("the screens write each line as one piece of text, so the translator can match it", () => {
  const ui = APP.slice(APP.indexOf("function GamesHub("), APP.indexOf("// Tell us what you think: a short form"));
  for (const needle of ['"Day streak: " + ', '"Streak freezes: " + ', '" in a row"', '"Perfect round bonus: +" + ', '"A new Word Pal hatched: " + ', '"My Word Pals (" + ',
    ">Spot the mistake, then fix it. Every right answer earns coins for your Word Pals.<", ">Not quite. Here is the fixed sentence.<", ">This sentence will come back for a second chance.<"]) {
    assert.ok(ui.includes(needle), "Fix It no longer writes " + needle + " as a single piece of text");
  }
  assert.ok(!/(?<![\w-])(text-left|text-right|ml-\d|mr-\d|pl-\d|pr-\d)\b/.test(ui), "Fix It keeps to direction-neutral layout");
});
