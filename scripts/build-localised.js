// Builds the translated copies of the homepage from the one English index.html and a dictionary per language.
//
//   node scripts/build-localised.js         writes pl/index.html
//
// Nothing here is copied by hand: the structure, styles, scripts and prices come from index.html, and only the words change.
// A sentence added to the English page has no translation yet, so the build lists it and tests/localised-pages.test.js fails
// until it is added to scripts/i18n/<lang>.json. Run this after every change to index.html.
const fs = require("fs");
const path = require("path");
const { applyUnits } = require("./i18n/html-units");

const ROOT = path.join(__dirname, "..");
const SITE = "https://www.literacylabai.com";

const LANGS = [
  { code: "pl", locale: "pl_PL", dict: "pl.json", switchTo: { href: "/", hreflang: "en", lang: "en", label: "English" } },
];

const SWITCH_LINK = '<a href="/pl/" hreflang="pl" lang="pl">Polski</a>';

// Visible FAQ -> the FAQPage structured data, so the markup search engines read always matches the page people read.
function faqFromHtml(html) {
  const items = [];
  const re = /<summary[^>]*>([\s\S]*?)<span class="faq-plus"><\/span>\s*<\/summary>\s*<div class="faq-a">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html))) items.push({ q: strip(m[1]), a: strip(m[2]) });
  return items;
}
const strip = (s) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

function translateJsonLd(html, lang, dict) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, body) => {
    const data = JSON.parse(body);
    if (data["@type"] === "FAQPage") {
      const faq = faqFromHtml(html);
      data.inLanguage = lang.code;
      data.mainEntity = faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }));
    } else {
      (function walk(node) {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== "object") return;
        for (const k of Object.keys(node)) {
          const v = node[k];
          if (typeof v === "string") {
            if (dict.json[v] !== undefined) node[k] = dict.json[v];
            else if (k === "inLanguage") node[k] = lang.code;
            else if (k === "url" && v === SITE + "/") node[k] = SITE + "/" + lang.code + "/";
          } else walk(v);
        }
      })(data);
    }
    return '<script type="application/ld+json">\n' + JSON.stringify(data, null, 2) + "\n</script>";
  });
}

function buildLanguage(lang, source) {
  const dict = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", lang.dict), "utf8"));
  // The language switch in the footer points the other way on the translated page.
  const s = lang.switchTo;
  let html = source.replace(SWITCH_LINK, `<a href="${s.href}" hreflang="${s.hreflang}" lang="${s.lang}">${s.label}</a>`);

  const applied = applyUnits(html, Object.assign({ [s.label]: s.label }, dict.html));
  html = applied.html;

  // Text inside the page's own scripts.
  const scriptMisses = [];
  html = html.replace(/<script(?![^>]*(?:ld\+json|\bsrc=))[^>]*>([\s\S]*?)<\/script>/g, (whole, body) => {
    let out = body;
    for (const [en, tr] of Object.entries(dict.script)) out = out.split(en).join(tr);
    return whole.replace(body, () => out);
  });
  for (const en of Object.keys(dict.script)) if (!source.includes(en)) scriptMisses.push(en);

  html = translateJsonLd(html, lang, dict);

  // Language, address and alternates.
  const url = `${SITE}/${lang.code}/`;
  html = html.replace('<html lang="en">', `<html lang="${lang.code}">`)
    .replace('<link rel="canonical" href="https://www.literacylabai.com/">', `<link rel="canonical" href="${url}">`)
    .replace('<meta property="og:url" content="https://www.literacylabai.com/">', `<meta property="og:url" content="${url}">\n<meta property="og:locale" content="${lang.locale}">`);

  // The page now lives one folder down, so every relative link becomes absolute. The workspace link carries the language, so
  // the sign-up form starts on it.
  html = html.replace(/href="app\.html"/g, `href="/app.html?lang=${lang.code}"`);
  html = html.replace(/\b(href|src)="(?![a-z][a-z0-9+.-]*:|\/|#|\?)([^"]*)"/gi, (m, attr, val) => `${attr}="/${val}"`);
  html = html.replace(/\bsrcset="(?![a-z][a-z0-9+.-]*:|\/)/gi, 'srcset="/');
  return { html, missing: applied.missing, scriptMisses };
}

function buildAll() {
  const source = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const files = {};
  const problems = [];
  for (const lang of LANGS) {
    const out = buildLanguage(lang, source);
    files[`${lang.code}/index.html`] = out.html;
    out.missing.forEach((k) => problems.push(`${lang.code}: no translation for "${k.slice(0, 90)}"`));
    out.scriptMisses.forEach((k) => problems.push(`${lang.code}: script text no longer in index.html: ${k.slice(0, 90)}`));
  }
  return { files, problems };
}

if (require.main === module) {
  const { files, problems } = buildAll();
  for (const [rel, html] of Object.entries(files)) {
    const full = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, html);
    console.log("wrote", rel);
  }
  if (problems.length) { console.error("\nNeeds attention:\n" + problems.join("\n")); process.exitCode = 1; }
}

module.exports = { buildAll, LANGS };
