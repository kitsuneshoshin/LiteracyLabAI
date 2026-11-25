const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const I18N = require("../app-i18n.js");

// Boss Battle shows these pieces of text. Every language the app is translated into must have all of them, or a family reading
// in that language sees a mix of their language and English. The child's own sentences and the feedback's notes stay as they
// are: they are the child's writing, and the thing being learned.
const ROOT = path.join(__dirname, "..");
const APP = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
const KEYS = [
  "Boss {n0} of {n1}", "Edit this part of your story to fix the problem", "Show hint", "Hide hint", "Strike!", "Change something before you strike.",
  "Direct hit! That is exactly the fix.", "Your fix", "Suggested fix", "Does your fix work too?", "Yes, mine works", "No, I'll use this one",
  "Next boss", "See my results", "Direct hits", "Back to my feedback", "Fix your own sentences",
  "Turn the parts of your story that need work into a boss. Fix them to win coins for your Word Pals.", "Start Boss Battle",
  "Good thinking. Remember this fix for next time.", "Boss health",
  // already translated for Word Dash and Fix It, shown again here
  "Right", "Coins", "Quit", "Play Fix It", "Perfect round!", "Great round!", "Good going!", "Keep going!", "Next Word Pal", "{n0} / {n1} coins",
  "Day streak: {n0}", "Nice!", "Spot on!", "Brilliant!", "You got it!", "Yes!", "Smart!", "{n0} out of 3 stars",
];
const uiCodes = I18N.LANGUAGES.map((l) => l.code).filter((c) => c !== "en");
const dictionary = (code) => JSON.parse(fs.readFileSync(path.join(ROOT, "app-i18n", code + ".json"), "utf8")).strings;
const norm = I18N.norm;

test("every language has a translation for every line of Boss Battle", () => {
  assert.ok(uiCodes.length >= 10);
  for (const code of uiCodes) {
    const have = new Set(Object.keys(dictionary(code)).map(norm));
    const missing = KEYS.filter((k) => !have.has(norm(k)));
    assert.deepEqual(missing, [], code + " is missing " + missing.length + " line(s)");
  }
});

test("each translation keeps the numbers of its English line, and the game's own name is never translated", () => {
  const ph = (s) => (s.match(/\{n?\d\}/g) || []).map((p) => p.replace("n", "")).sort().join();
  for (const code of uiCodes) {
    const byNorm = new Map(Object.entries(dictionary(code)).map(([k, v]) => [norm(k), v]));
    for (const k of KEYS) {
      const v = byNorm.get(norm(k));
      assert.equal(typeof v, "string", code + ": " + k + " should be plain text");
      assert.equal(ph(v), ph(k), code + ": placeholders differ for " + k);
      if (/Boss Battle/.test(k)) assert.ok(v.includes("Boss Battle"), code + ": the name Boss Battle must stay as it is in: " + k);
    }
  }
});

test("the screens write each line as one piece of text, so the translator can match it", () => {
  const ui = APP.slice(APP.indexOf("function dashFinishRound("), APP.indexOf("// Tell us what you think: a short form"));
  for (const needle of ['"Boss " + (idx + 1) + " of " + total', "Fix your own sentences<", "Start Boss Battle", "Strike!<", "Next boss", "Does your fix work too?<",
    "</span> Edit this part of your story to fix the problem<", ">Change something before you strike.<", ">Good thinking. Remember this fix for next time.<",
    "Turn the parts of your story that need work into a boss. Fix them to win coins for your Word Pals.<"]) {
    assert.ok(ui.includes(needle), "Boss Battle no longer writes " + needle + " as a single piece of text");
  }
  assert.ok(!/(?<![\w-])(text-left|text-right|ml-\d|mr-\d|pl-\d|pr-\d)\b/.test(ui), "Boss Battle keeps to direction-neutral layout");
});
