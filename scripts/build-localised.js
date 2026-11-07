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

// native: how the language names itself (the footer link). englishOnly: what the page says next to links to pages that are still English.
const LANGS = [
  { code: "pl", locale: "pl_PL", dict: "pl.json", native: "Polski", englishOnly: "(po angielsku)" },
  { code: "es", locale: "es_ES", dict: "es.json", native: "Español", englishOnly: "(en inglés)" },
  { code: "pt", locale: "pt_BR", dict: "pt.json", native: "Português", englishOnly: "(em inglês)" },
  { code: "ro", locale: "ro_RO", dict: "ro.json", native: "Română", englishOnly: "(în engleză)" },
  { code: "hi", locale: "hi_IN", dict: "hi.json", native: "हिन्दी", englishOnly: "(अंग्रेज़ी में)", fonts: "Noto+Sans+Devanagari:wght@400;500;600;700" },
  { code: "pa", locale: "pa_IN", dict: "pa.json", native: "ਪੰਜਾਬੀ", englishOnly: "(ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ)", fonts: "Noto+Sans+Gurmukhi:wght@400;500;600;700" },
  { code: "bn", locale: "bn_BD", dict: "bn.json", native: "বাংলা", englishOnly: "(ইংরেজিতে)", fonts: "Noto+Sans+Bengali:wght@400;500;600;700" },
  { code: "zh", locale: "zh_CN", dict: "zh.json", native: "中文", englishOnly: "（英文）", fonts: "Noto+Sans+SC:wght@400;500;700" },
  // dir "rtl" reads right to left: the page flips, home-rtl.css mirrors what the layout cannot, and fonts is the extra web font to load.
  { code: "ar", locale: "ar_AR", dict: "ar.json", native: "العربية", englishOnly: "(بالإنجليزية)", dir: "rtl", fonts: "Noto+Naskh+Arabic:wght@400;500;600;700" },
  { code: "ur", locale: "ur_PK", dict: "ur.json", native: "اردو", englishOnly: "(انگریزی میں)", dir: "rtl", fonts: "Noto+Nastaliq+Urdu:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;600" },
];

const switchLink = (l) => `<a href="/${l.code}/" hreflang="${l.code}" lang="${l.code}">${l.native}</a>`;
const ENGLISH_LINK = '<a href="/" hreflang="en" lang="en">English</a>';

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
  // In the footer's language list, a translated page links to English where its own language was, and keeps the others.
  let html = source.replace(switchLink(lang), ENGLISH_LINK);

  // Names of languages are the same on every page.
  const names = { English: "English" };
  for (const l of LANGS) names[l.native] = l.native;
  const applied = applyUnits(html, Object.assign(names, dict.html));
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

  // The "most popular" badge on the plans is text inside the page's CSS, so it is set here. A right-to-left language also
  // gets its fonts, its mirroring stylesheet and a flipped sentence demo.
  const extra = [`<style>.price-card.pro::before,.plan-table thead .col-best::before{content:${JSON.stringify(dict.popular)}}</style>`];
  // A left-to-right language in another script (Hindi, Chinese) gets its web font and home-fonts.css.
  if (lang.fonts && lang.dir !== "rtl") {
    extra.unshift(`<link href="https://fonts.googleapis.com/css2?family=${lang.fonts}&display=swap" rel="stylesheet">`, '<link rel="stylesheet" href="home-fonts.css?v=3">');
  }
  if (lang.dir === "rtl") {
    html = html.replace(`<html lang="${lang.code}">`, `<html lang="${lang.code}" dir="rtl">`);
    extra.unshift(`<link href="https://fonts.googleapis.com/css2?family=${lang.fonts}&display=swap" rel="stylesheet">`, '<link rel="stylesheet" href="home-rtl.css?v=3">');
    html = html.replace(/<figure class="plate">[\s\S]*?<\/figure>/, (fig) => fig
      .replace('<text class="child" x="16"', '<text class="child" x="544" direction="rtl"')
      .replace('<text class="child" x="16"', '<text class="child" x="544" direction="rtl"')
      .replace('<text class="child" x="16"', '<text class="child" x="544" direction="rtl"')
      .replace('<rect id="tagBg" class="tag-bg" x="16"', '<rect id="tagBg" class="tag-bg" x="454"')
      .replace('<text id="noteLabel" class="note-label" x="28"', '<text id="noteLabel" class="note-label" x="532" direction="rtl"')
      .replace('<text id="noteL1" class="note" x="16"', '<text id="noteL1" class="note" x="544" direction="rtl"')
      .replace('<text id="noteL2" class="note" x="16"', '<text id="noteL2" class="note" x="544" direction="rtl"'));
    // In right-to-left SVG text the start of a line is its right end, so each line is simply given the right edge as x. The label tag grows with its text from there.
    html = html.replace("tagBg.setAttribute('width', lab.getBBox().width + 24);", "tagBg.setAttribute('width', lab.getBBox().width + 24); tagBg.setAttribute('x', 544 - (lab.getBBox().width + 24));");
  }
  html = html.replace("</head>", extra.join("\n") + "\n</head>");

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
