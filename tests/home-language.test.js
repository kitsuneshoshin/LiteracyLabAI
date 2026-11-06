const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { LANGUAGES, translatableLanguage } = require("../api/_lib/languages");
const T = require("../api/_lib/translateFeedback");

// Feedback in a family's home language: the English feedback stays the source of truth, and only the sentences that
// explain it are translated. These tests pin what is and is not allowed to change.

const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const start = APP.indexOf("const HOME_LANGUAGES = ");
const end = APP.indexOf("/* Minimal line-icon set");
assert.ok(start > 0 && end > start, "the home-language helpers are in app.html");
const client = new Function("navigator", APP.slice(start, end) + "\nreturn { HOME_LANGUAGES, homeLanguage, homeLanguageInfo, guessHomeLanguage, applyTranslations };");

const feedback = {
  glow: 'You wrote "the dark forest was really scary" which builds tension.',
  grow: "Try opening with a fronted adverbial.",
  glowTarget: "Fronted Adverbials",
  growTarget: "Fronted Adverbials",
  vocab: [{ term: "ominous", definition: "giving the feeling that something bad will happen", example: "The ominous clouds gathered.", trick: "Look inside the word." }],
  highlights: [
    { quote: "the dark forest was really scary", type: "glow", note: "Great tension." },
    { quote: "the trees looked spooky", type: "grow", note: "Open with a time word.", revision: "Without warning, the trees looked spooky." },
  ],
  revisedStory: "A whole corrected story.",
  spellingGrammar: [{ quote: "teh", type: "spelling", correction: "the" }],
  overallScore: 6,
  scoreReason: "Vivid but rushed.",
};

test("the browser's language list and the server's list offer exactly the same languages", () => {
  const c = client(undefined);
  assert.deepEqual(c.HOME_LANGUAGES.map((l) => l.code), LANGUAGES.map((l) => l.code));
  assert.deepEqual(c.HOME_LANGUAGES.map((l) => l.native), LANGUAGES.map((l) => l.native));
  assert.deepEqual(c.HOME_LANGUAGES.map((l) => l.dir), LANGUAGES.map((l) => l.dir));
});

test("English is never translated, and an unknown code is refused", () => {
  assert.equal(translatableLanguage("en"), null);
  assert.equal(translatableLanguage("xx"), null);
  assert.equal(translatableLanguage(undefined), null);
  assert.equal(translatableLanguage("PL").code, "pl", "capitals do not matter");
});

test("only the explanatory sentences are collected; the student's words, quotes, revisions, targets and vocabulary words are not", () => {
  const paths = T.collectTranslatable(feedback).map((i) => i.path).sort();
  assert.deepEqual(paths, ["glow", "grow", "highlights.0.note", "highlights.1.note", "scoreReason", "vocab.0.definition", "vocab.0.trick"].sort());
});

test("the prompt asks for the right language and carries every sentence, numbered", () => {
  const items = T.collectTranslatable(feedback);
  const prompt = T.buildTranslationPrompt(translatableLanguage("pl"), items);
  assert.match(prompt, /into Polish/);
  assert.match(prompt, /"1":/);
  assert.match(prompt, new RegExp('"' + items.length + '":'));
  assert.match(prompt, /Copy it EXACTLY/);
});

test("a translation that loses a quoted fragment of the student's writing is dropped, the rest kept", () => {
  const items = T.collectTranslatable({ glow: 'Napisałeś "the dark forest was really scary" i to buduje napięcie.', grow: "Spróbuj." });
  const kept = T.acceptTranslations(items, { 1: 'Napisałeś "ciemny las był bardzo straszny" i to buduje napięcie.', 2: "Spróbuj jeszcze raz." });
  assert.equal(kept.glow, undefined, "the English quote was translated, so that sentence stays English");
  assert.equal(kept.grow, "Spróbuj jeszcze raz.");
  const ok = T.acceptTranslations(items, { 1: 'Napisałeś „the dark forest was really scary” i to buduje napięcie.' });
  assert.ok(ok.glow, "curly or low quotation marks around the untouched English are fine");
});

test("empty, missing, non-text and absurdly long answers are dropped", () => {
  const items = T.collectTranslatable({ glow: "Well done.", grow: "Try again." });
  assert.deepEqual(T.acceptTranslations(items, { 1: "  ", 2: 42 }), {});
  assert.deepEqual(T.acceptTranslations(items, { 1: "x".repeat(5000) }), {});
  assert.deepEqual(T.acceptTranslations(items, null), {});
  assert.deepEqual(T.acceptTranslations(items, "nonsense"), {});
});

test("translateFeedback sends one request and returns the accepted sentences by path", async () => {
  let calls = 0;
  const generate = async (prompt) => {
    calls++;
    assert.match(prompt, /into Spanish/);
    // In the order the sentences appear in the feedback: glow, grow, vocab definition, vocab trick, two notes, score reason.
    return { parsed: { 1: 'Escribiste "the dark forest was really scary", lo que crea tensión.', 2: "Prueba a empezar con un adverbial.", 3: "que algo malo va a pasar", 4: "Mira dentro de la palabra.", 5: "Gran tensión.", 6: "Empieza con una palabra de tiempo.", 7: "Vívido pero apresurado." } };
  };
  const out = await T.translateFeedback(feedback, "es", generate);
  assert.equal(calls, 1);
  assert.equal(out.language, "es");
  assert.equal(out.translations["highlights.0.note"], "Gran tensión.");
  assert.equal(Object.keys(out.translations).length, 7);
});

test("an unavailable language is refused before any AI call", async () => {
  await assert.rejects(() => T.translateFeedback(feedback, "en", async () => { throw new Error("must not be called"); }), /isn't available/);
});

test("the app puts translations back by path and leaves everything else exactly as it was", () => {
  const c = client(undefined);
  const out = c.applyTranslations(feedback, { grow: "Spróbuj.", "highlights.1.note": "Zacznij od słowa czasu.", "vocab.0.definition": "daje wrażenie, że stanie się coś złego", "nonsense.0.x": "ignored", quote: "ignored" });
  assert.equal(out.grow, "Spróbuj.");
  assert.equal(out.highlights[1].note, "Zacznij od słowa czasu.");
  assert.equal(out.vocab[0].definition, "daje wrażenie, że stanie się coś złego");
  assert.equal(out.highlights[1].quote, feedback.highlights[1].quote, "the student's words are untouched");
  assert.equal(out.highlights[1].revision, feedback.highlights[1].revision);
  assert.equal(out.glowTarget, "Fronted Adverbials");
  assert.equal(out.vocab[0].term, "ominous");
  assert.equal(feedback.grow, "Try opening with a fronted adverbial.", "the original is never changed");
  assert.equal(c.applyTranslations(feedback, null), feedback);
});

test("the account's language is read from the sign-up choice, and English or anything unknown means no translation", () => {
  const c = client(undefined);
  const s = (language) => ({ user: { user_metadata: language === undefined ? {} : { language } } });
  assert.equal(c.homeLanguage(s("pl")), "pl");
  assert.equal(c.homeLanguage(s("en")), "");
  assert.equal(c.homeLanguage(s("xx")), "");
  assert.equal(c.homeLanguage(s(undefined)), "");
  assert.equal(c.homeLanguage(null), "");
});

test("the sign-up picker starts on the browser's language when we offer it", () => {
  assert.equal(client({ languages: ["pl-PL", "en-GB"] }).guessHomeLanguage(), "pl");
  assert.equal(client({ languages: ["fr-FR", "es-MX"] }).guessHomeLanguage(), "es", "the first language we offer wins");
  assert.equal(client({ languages: ["en-GB"] }).guessHomeLanguage(), "en");
  assert.equal(client({ languages: ["fr-FR"] }).guessHomeLanguage(), "en");
});

test("the sign-up form asks for the language, and the profile page can change it", () => {
  const signup = APP.slice(APP.indexOf("function AuthScreen"), APP.indexOf("function SetNewPassword"));
  assert.match(signup, /Language at home/);
  assert.match(signup, /language/);
  assert.match(APP, /auth\.updateUser\(\{ data: \{ language:/);
});

test("the translation request is a branch of an existing endpoint (the plan allows 12 functions) with its own rate limit", () => {
  const apiFiles = fs.readdirSync(path.join(__dirname, "..", "api")).filter((f) => f.endsWith(".js"));
  assert.ok(apiFiles.length <= 12, "a 13th function would fail the deployment; found " + apiFiles.length);
  const history = fs.readFileSync(path.join(__dirname, "..", "api", "history.js"), "utf8");
  assert.match(history, /body\.action === "translate"/);
  assert.match(history, /checkRateLimit\(supabase, user\.id, "translate"/);
  assert.match(history, /\.eq\("profile_id", user\.id\)/, "a piece is only ever read for its owner");
});
