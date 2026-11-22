const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const I18N = require("../app-i18n.js");

// Word Dash (the vocabulary game) and the flashcard/quiz screens show these pieces of text. Every language the app is
// translated into must have all of them, or a family reading in that language sees a mix of their language and English.
// (Spelling out the list here means adding a new line to the game without translating it fails this test.)
const ROOT = path.join(__dirname, "..");
const APP = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
const KEYS = [
  "Day streak: {n0}", "No streak yet", "Days in a row with a round played", "Covers one missed day", "Streak freezes: {n0}",
  "Collect at least 4 words to unlock the game.", "Today's round is done. Play more to hatch more Word Pals.",
  "A streak freeze will cover yesterday. Play today to keep your streak.", "Play today to keep your streak going.",
  "Play a quick round to start your streak.", "Every Word Pal collected!", "Next Word Pal", "{n0} / {n1} coins",
  "Coins towards the next Word Pal", "Play Word Dash", "Play again", "My Word Pals ({n0}/{n1})", "My Word Pals",
  "Answer words to earn coins. Every {n0} coins hatches a new Word Pal. Rare and epic pals are harder to find.",
  "Not found yet", "Common", "Rare", "Epic", "Collect at least 4 words with meanings to play Word Dash.", "{n0} out of 3 stars",
  "Perfect round!", "Great round!", "Good going!", "Keep dashing!", "Right", "Best combo", "Coins", "Perfect round bonus: +{n0} coins",
  "A new Word Pal hatched: {0}!", "A streak freeze covered a missed day, so your streak is safe.",
  "You earned a streak freeze. It covers one missed day.", "One more day!", "One more round", "Done", "Quit", "Round progress",
  "Build a combo", "{n0} in a row", "Which word fills the gap?", "Which word fits this meaning?", "Spell the word", "Second chance",
  "Your spelling", "Letters to use", "Undo", "Clear", "Not quite. You will see this word again soon.",
  "Not quite. That word will come back for a second chance.", "Nice!", "Spot on!", "Brilliant!", "You got it!", "Yes!", "Smart!",
  "Finish the round", "Next word", "Flashcards, a quick quiz and Word Dash, a game that hatches pets as you learn.",
  "Nice work", "You knew them all", "Show the word", "Perfect score", "Good going", "Keep practising", "New quiz", "Next question",
  "See my results", "Hide known words", "Show known words ({n0})", "Definition", "Characteristics", "Example", "Not an example",
  "Word card for {0}",
  // already translated before the game, still shown by it
  "Words to revisit", "Back", "Which meaning fits?",
];
const uiCodes = I18N.LANGUAGES.map((l) => l.code).filter((c) => c !== "en");
const dictionary = (code) => JSON.parse(fs.readFileSync(path.join(ROOT, "app-i18n", code + ".json"), "utf8")).strings;
const norm = I18N.norm;

test("every language has a translation for every line of Word Dash and the flashcard and quiz screens", () => {
  assert.ok(uiCodes.length >= 10);
  for (const code of uiCodes) {
    const have = new Set(Object.keys(dictionary(code)).map(norm));
    const missing = KEYS.filter((k) => !have.has(norm(k)));
    assert.deepEqual(missing, [], code + " is missing " + missing.length + " line(s)");
  }
});

test("each translation keeps the numbers and names of its English line, and the game's own name is never translated", () => {
  const ph = (s) => (s.match(/\{n?\d\}/g) || []).map((p) => p.replace("n", "")).sort().join();
  for (const code of uiCodes) {
    const d = dictionary(code);
    const byNorm = new Map(Object.keys(d).map((k) => [norm(k), d[k]]));
    for (const k of KEYS) {
      const v = byNorm.get(norm(k));
      assert.equal(typeof v, "string", code + ": " + k + " should be plain text");
      assert.equal(ph(v), ph(k), code + ": placeholders differ for " + k);
      if (/Word Dash/.test(k)) assert.ok(v.includes("Word Dash"), code + ": the name Word Dash must stay as it is in: " + k);
    }
  }
});

test("a line the game builds from a number is translated from a whole piece of text, so the translator can match it", () => {
  // These are written as one string in app.html (not "{count}" next to " words"), which is what lets the lookup find them.
  for (const needle of ['"Day streak: " + ', '"Streak freezes: " + ', '" in a row"', '"Perfect round bonus: +" + ', '"A new Word Pal hatched: " + ', '"My Word Pals (" + ']) {
    assert.ok(APP.includes(needle), "app.html no longer builds " + needle + " as a single piece of text");
  }
  const d = I18N.compile({ "Day streak: {n0}": "Seria dni: {n0}", "{n0} in a row": "{n0} z rzędu" });
  assert.equal(I18N.translate(d, "Day streak: 5", new Intl.PluralRules("pl")), "Seria dni: 5");
  assert.equal(I18N.translate(d, "3 in a row", new Intl.PluralRules("pl")), "3 z rzędu");
});
