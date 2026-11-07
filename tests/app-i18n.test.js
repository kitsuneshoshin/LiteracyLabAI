const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const I18N = require("../app-i18n.js");
const { LANGUAGES: FEEDBACK_LANGUAGES } = require("../api/_lib/languages");

// The app's own text is translated on screen by app-i18n.js, from a dictionary per language. These tests pin how the lookup
// behaves and keep each dictionary well-formed; the page itself is checked in a real browser.

const ROOT = path.join(__dirname, "..");
const APP = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");
const uiCodes = I18N.LANGUAGES.map((l) => l.code).filter((c) => c !== "en");
const dictionary = (code) => JSON.parse(fs.readFileSync(path.join(ROOT, "app-i18n", code + ".json"), "utf8")).strings;
const plural = new Intl.PluralRules("pl");

test("a piece of text is replaced by its translation, with the spaces around it kept and extra spaces inside it ignored", () => {
  const d = I18N.compile({ "Save changes": "Zapisz zmiany" });
  assert.equal(I18N.translate(d, "Save changes", plural), "Zapisz zmiany");
  assert.equal(I18N.translate(d, "  Save   changes\n ", plural), "  Zapisz zmiany\n ");
  assert.equal(I18N.translate(d, "Save", plural), null, "only whole pieces of text match");
  assert.equal(I18N.translate(d, "Save changes now", plural), null);
});

test("text with no letters, and text that is not in the dictionary, is left alone", () => {
  const d = I18N.compile({ "Go": "Idź" });
  for (const t of ["", "   ", "12", "—", "🇬🇧", "Fronted Adverbials"]) assert.equal(I18N.translate(d, t, plural), null, JSON.stringify(t));
});

test("a changing part is filled in; a numeric part matches only numbers", () => {
  const d = I18N.compile({ "Across {n0} pieces": "Z {n0} prac", "Hello, {0}": "Cześć, {0}", "{n0} / {n1} words": "{n0} / {n1} słów" });
  assert.equal(I18N.translate(d, "Across 14 pieces", plural), "Z 14 prac");
  assert.equal(I18N.translate(d, "Across many pieces", plural), null);
  assert.equal(I18N.translate(d, "Hello, Maya Rose", plural), "Cześć, Maya Rose");
  assert.equal(I18N.translate(d, "1 / 1,500 words", plural), "1 / 1,500 słów");
  assert.equal(I18N.translate(d, "A words", plural), null);
});

test("the most specific pattern wins", () => {
  const d = I18N.compile({ "{0}'s target mastery": "Cele — {0}", "{0}'s target mastery — {1}": "Cele — {0} — {1}" });
  assert.equal(I18N.translate(d, "Maya's target mastery — Year 5", plural), "Cele — Maya — Year 5");
  assert.equal(I18N.translate(d, "Maya's target mastery", plural), "Cele — Maya");
});

test("Polish plural forms follow the number", () => {
  const d = I18N.compile({ "{n0} words": { one: "{n0} słowo", few: "{n0} słowa", many: "{n0} słów", other: "{n0} słowa" } });
  const t = (n) => I18N.translate(d, n + " words", plural);
  assert.deepEqual([1, 2, 4, 5, 12, 22, 25, 100].map(t), ["1 słowo", "2 słowa", "4 słowa", "5 słów", "12 słów", "22 słowa", "25 słów", "100 słów"]);
});

test("a changing part that is itself in the dictionary is translated too, and anything else stays as it was", () => {
  const d = I18N.compile({ "High School": "Liceum", "{0} · Ages {1}": "{0} · wiek {1}" });
  assert.equal(I18N.translate(d, "High School · Ages 14–18", plural), "Liceum · wiek 14–18");
  assert.equal(I18N.translate(d, "Gaming Club · Ages 9", plural), "Gaming Club · wiek 9");
});

test("every dictionary is well formed: text or plural forms, no empty values, placeholders only from the key", () => {
  assert.ok(uiCodes.length >= 1);
  for (const code of uiCodes) {
    const entries = dictionary(code);
    assert.ok(Object.keys(entries).length > 300, code + ": too few entries");
    for (const [key, value] of Object.entries(entries)) {
      const forms = typeof value === "string" ? [value] : Object.values(value);
      assert.ok(forms.length && forms.every((f) => typeof f === "string" && f.trim()), `${code}: empty translation for "${key}"`);
      if (typeof value === "object") assert.ok(value.other, `${code}: plural entry without "other": ${key}`);
      const inKey = new Set((key.match(/\{n?\d\}/g) || []).map((p) => p.replace("n", "")));
      for (const f of forms) for (const p of f.match(/\{n?\d\}/g) || []) assert.ok(inKey.has(p.replace("n", "")), `${code}: "${key}" uses ${p} which its English does not have`);
      assert.ok(!/[\u0000-\u0008]/.test(key + forms.join("")), code + ": stray control character in " + key);
    }
  }
});

test("each translated language has a dictionary file, and is also a language the feedback translator offers", () => {
  for (const code of uiCodes) {
    assert.ok(fs.existsSync(path.join(ROOT, "app-i18n", code + ".json")), code + ": no dictionary");
    assert.ok(FEEDBACK_LANGUAGES.some((l) => l.code === code), code + ": not in api/_lib/languages.js");
  }
  assert.ok(I18N.LANGUAGES.some((l) => l.code === "en"));
});

test("the app loads the translation layer before its own script, and hands it the account's language", () => {
  const at = APP.indexOf('<script src="app-i18n.js"></script>');
  assert.ok(at > 0 && at < APP.indexOf('<script type="text/babel"'), "app-i18n.js loads before the app");
  assert.match(APP, /LLI18N\.accountLanguage\(homeLanguage\(session\)\)/, "signed in: the account's language is offered");
  assert.match(APP, /LLI18N\.remember\(e\.target\.value\)/, "sign-up remembers the language for the next visit");
  assert.match(APP, /window\.LLI18N && window\.LLI18N\.set\(code\)/, "the profile setting redraws the app in the new language");
});

test("the translation layer keeps the app's data and logic alone: it only touches text and a few attributes", () => {
  const src = fs.readFileSync(path.join(ROOT, "app-i18n.js"), "utf8");
  assert.match(src, /var ATTRS = \["title", "placeholder", "aria-label", "alt"\]/);
  assert.match(src, /tag === "TEXTAREA"/, "what a learner types is never touched");
  // The only value it ever sets is the option list of its own language switcher.
  assert.deepEqual((src.match(/\w+\.value\s*=/g) || []), ["o.value ="], "no form value of the app is ever written");
});

test("scripts the app's own fonts do not cover load a web font, with letter-spacing and capitals switched off", () => {
  const needs = I18N.LANGUAGES.filter((l) => ["hi", "zh", "pa", "bn"].includes(l.code));
  assert.equal(needs.length, 4);
  for (const l of needs) assert.ok(l.fonts && l.family, l.code + ": no font for its script");
  const src = fs.readFileSync(path.join(ROOT, "app-i18n.js"), "utf8");
  assert.match(src, /letter-spacing: 0 !important; text-transform: none !important/);
});

test("right-to-left languages flip the page, and the app keeps to direction-neutral layout so the flip is clean", () => {
  const rtl = I18N.LANGUAGES.filter((l) => l.rtl);
  assert.deepEqual(rtl.map((l) => l.code).sort(), ["ar", "ur"]);
  const src = fs.readFileSync(path.join(ROOT, "app-i18n.js"), "utf8");
  assert.match(src, /setAttribute\("dir", "rtl"\)/);
  assert.match(src, /app-rtl\.css/);
  assert.ok(fs.existsSync(path.join(ROOT, "app-rtl.css")));
  const css = fs.readFileSync(path.join(ROOT, "app-rtl.css"), "utf8");
  assert.match(css, /\.ll-flip/);
  assert.match(css, /unicode-bidi: plaintext/);
  // The app's own markup must not name left or right outright (use ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-inline-start),
  // or the flipped page would have things on the wrong side.
  const babel = APP.slice(APP.indexOf('<script type="text/babel"'));
  const physical = babel.match(/(?<![\w-])(text-left|text-right|ml-\d|mr-\d|pl-\d|pr-\d|-?left-\d|-?right-\d|border-l(?![\w])|border-r(?![\w])|rounded-l(?![gx\w])|rounded-r(?![\w]))[\w./-]*/g) || [];
  // left-1/2 (centring) and the pair left-0 right-0 (stretching across) are the same either way round.
  assert.deepEqual(physical.filter((t) => !["left-1/2", "left-0", "right-0"].includes(t)), [], "left/right-specific classes in the app");
  assert.ok(!/\b(borderLeft|borderRight|marginLeft|marginRight|paddingLeft|paddingRight)\s*:/.test(babel), "left/right-specific inline styles");
  assert.ok(babel.includes('const IconArrowRight = (p) => <Icon {...p} className={(p.className || "") + " ll-flip"}>'), "arrows are marked so they flip");
});
