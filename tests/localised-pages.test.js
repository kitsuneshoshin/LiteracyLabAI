const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildAll, LANGS } = require("../scripts/build-localised");
const { findUnits } = require("../scripts/i18n/html-units");

// The translated homepages are built from index.html and a dictionary per language (scripts/build-localised.js). These tests keep
// them honest: nothing left untranslated, no broken markup or links, and the file in the repo is what the build produces.

const ROOT = path.join(__dirname, "..");
const lf = (s) => s.replace(/\r\n/g, "\n");
const read = (rel) => lf(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const built = buildAll();
const english = read("index.html");

// Names and terms that are the same in every language.
const SAME_IN_ANY_LANGUAGE = new Set([
  "UK National Curriculum", "US Common Core &amp; AP", "New Zealand Curriculum &amp; NCEA", "Australian Curriculum", "Ontario Curriculum",
  "Fronted Adverbials", "Early Readers", "Elementary", "Middle School", "High School", "Free", "Core", "Premium", "LiteracyLab AI", "LiteracyLab", "AI",
  "ominous", "© 2026 LiteracyLab AI", "Free<span><span class=\"js-price\" data-tier=\"free\">$0</span></span>", "Australia", "Start", "India", "Hong Kong",
]);

test("every sentence on the English homepage has a translation, and no translation is left over from a sentence that was removed", () => {
  assert.deepEqual(built.problems, [], "run `node scripts/build-localised.js` and add what it lists to scripts/i18n/<lang>.json");
  for (const lang of LANGS) {
    const dict = JSON.parse(read("scripts/i18n/" + lang.dict));
    const live = new Set(findUnits(english).map((u) => u.key));
    const stale = Object.keys(dict.html).filter((k) => !live.has(k));
    assert.deepEqual(stale, [], lang.code + ": translations for text that is no longer on the page");
  }
});

test("each committed translated page is exactly what the build produces (rebuild after editing index.html)", () => {
  for (const [rel, html] of Object.entries(built.files)) {
    assert.equal(read(rel), lf(html), rel + " is out of date: run `node scripts/build-localised.js`");
  }
});

test("a translation keeps the markup of the sentence it replaces: same tags, same links, same classes", () => {
  const tags = (s) => (s.match(/<[^>]+>/g) || []).join("");
  for (const lang of LANGS) {
    const dict = JSON.parse(read("scripts/i18n/" + lang.dict));
    for (const [en, tr] of Object.entries(dict.html)) assert.equal(tags(tr), tags(en), lang.code + ": markup changed in a translation of: " + en.slice(0, 60));
  }
});

test("nothing is left in English on the translated page except names that do not translate", () => {
  for (const lang of LANGS) {
    const page = built.files[lang.code + "/index.html"];
    const en = new Set(findUnits(english).map((u) => u.key));
    const names = new Set(["English", ...LANGS.map((l) => l.native)]);
    const left = [...new Set(findUnits(page).map((u) => u.key))].filter((k) => en.has(k) && !SAME_IN_ANY_LANGUAGE.has(k) && !names.has(k));
    assert.deepEqual(left, [], lang.code + ": still in English");
  }
});

test("the translated page declares its language, its own address and the alternates, and so does the English page", () => {
  for (const lang of LANGS) {
    const page = built.files[lang.code + "/index.html"];
    assert.match(page, new RegExp(`<html lang="${lang.code}">`));
    assert.ok(page.includes(`<link rel="canonical" href="https://www.literacylabai.com/${lang.code}/">`));
    assert.ok(page.includes(`<meta property="og:url" content="https://www.literacylabai.com/${lang.code}/">`));
    assert.ok(page.includes(`<meta property="og:locale" content="${lang.locale}">`));
    for (const doc of [english, page]) {
      assert.ok(doc.includes(`<link rel="alternate" hreflang="${lang.code}" href="https://www.literacylabai.com/${lang.code}/">`), "alternate for " + lang.code);
      assert.ok(doc.includes('<link rel="alternate" hreflang="en" href="https://www.literacylabai.com/">'));
      assert.ok(doc.includes('<link rel="alternate" hreflang="x-default" href="https://www.literacylabai.com/">'));
    }
    assert.ok(english.includes(`<a href="/${lang.code}/" hreflang="${lang.code}" lang="${lang.code}">${lang.native}</a>`), "the English page links to the translation");
    assert.ok(page.includes(`<a href="/" hreflang="en" lang="en">English</a>`), "and the translation links back");
    assert.ok(!page.includes(`<a href="/${lang.code}/" hreflang`), "a page does not link to itself");
    for (const other of LANGS.filter((l) => l !== lang)) assert.ok(page.includes(`<a href="/${other.code}/" hreflang="${other.code}" lang="${other.code}">${other.native}</a>`), `${lang.code} links to ${other.code}`);
  }
});

test("every link on the translated page works from one folder down: files exist and #anchors are on the page", () => {
  for (const lang of LANGS) {
    const page = built.files[lang.code + "/index.html"];
    const ids = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    for (const m of page.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      const url = m[1];
      if (/^(https?:|mailto:|tel:|data:)/.test(url)) continue;
      if (url.startsWith("#")) { assert.ok(ids.has(url.slice(1)), "anchor " + url + " has nothing to point at"); continue; }
      assert.ok(url.startsWith("/"), "a relative link would break one folder down: " + url);
      const file = url.split("#")[0].split("?")[0];
      const target = path.join(ROOT, file.endsWith("/") ? file + "index.html" : file);
      assert.ok(fs.existsSync(target) || file === "/" + lang.code + "/", "broken link " + url);
    }
  }
});

test("the workspace links carry the language, so sign-up starts on it", () => {
  for (const lang of LANGS) {
    const page = built.files[lang.code + "/index.html"];
    assert.ok(!/href="\/?app\.html"/.test(page), "a link to the app without the language");
    assert.ok((page.match(new RegExp(`href="/app\\.html\\?lang=${lang.code}"`, "g")) || []).length >= 3);
  }
});

test("the FAQ structured data is the visible FAQ, in the page's language", () => {
  for (const lang of LANGS) {
    const page = built.files[lang.code + "/index.html"];
    const ld = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const faq = ld.find((d) => d["@type"] === "FAQPage");
    const visible = (page.match(/<details class="faq-item"/g) || []).length;
    assert.ok(visible >= 10);
    assert.equal(faq.mainEntity.length, visible);
    assert.equal(faq.inLanguage, lang.code);
    assert.ok(!/\b(What|How|Can|Will|Is|Are) (is|do|does|I|my|it|you)\b/.test(faq.mainEntity.map((q) => q.name).join(" ")), "questions are translated");
    assert.equal(ld.find((d) => d["@type"] === "WebSite").inLanguage, lang.code);
  }
});

test("the language pages are in the sitemap, and the pages the build does not translate stay English-only and say so", () => {
  const sitemap = read("sitemap.xml");
  for (const lang of LANGS) {
    assert.ok(sitemap.includes(`<loc>https://www.literacylabai.com/${lang.code}/</loc>`));
    const page = built.files[lang.code + "/index.html"];
    assert.ok(page.includes(lang.englishOnly), `${lang.code}: links to the English-only privacy policy and guides say so`);
  }
});

test("each language's page uses its own cookie banner text", () => {
  const analytics = read("analytics.js");
  for (const lang of LANGS) assert.ok(analytics.includes(`    ${lang.code}: { label:`), `${lang.code} has banner text in analytics.js`);
});
