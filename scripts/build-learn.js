// Builds the /learn/ guide pages: one for every year group in every region the
// app supports (about 70), a page per region, and a hub. Everything on them comes
// from the same curriculum data the app uses (api/_lib/masteryTargets.js and
// writingLimits.js) plus the plain-English text in scripts/learn-content.js, so a
// page can never say something the product itself does not.
//
//   node scripts/build-learn.js      rewrites learn/ and sitemap.xml
//
// The files are committed, and a test fails if they ever differ from what this
// script produces, so the pages and their source cannot drift apart.

const fs = require("node:fs");
const path = require("node:path");
const { GRADE_MAPPED_TARGETS } = require("../api/_lib/masteryTargets");
const { GRADE_WORD_TARGETS } = require("../api/_lib/writingLimits");
const { TARGET_GUIDE, TIER_INFO } = require("./learn-content");
const WS = require("./worksheets-pages");

const ROOT = path.join(__dirname, "..");
const SITE = "https://www.literacylabai.com";
const LASTMOD = "2026-10-02";

// The app's own list of years per region and where each stage of schooling starts
// (app.html GRADE_DATA); a test checks these stay identical to the app's.
const GRADE_DATA = {
  "🇬🇧 United Kingdom": { grades: ["Reception", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"], tiers: [3, 7, 10, 14] },
  "🇺🇸 United States": { grades: ["Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"], tiers: [3, 6, 9, 13] },
  "🇦🇺 Australia": { grades: ["Foundation", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6", "Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12"], tiers: [3, 7, 10, 13] },
  "🇨🇦 Canada": { grades: ["Kindergarten", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"], tiers: [3, 6, 9, 13] },
  "🇦🇪 UAE & GCC Hubs": { grades: ["Cambridge Primary 1", "Cambridge Primary 2", "Cambridge Primary 3", "Cambridge Primary 4", "Cambridge Primary 5", "Cambridge Primary 6", "Lower Secondary 7", "Lower Secondary 8", "Lower Secondary 9", "IGCSE Year 10", "IGCSE Year 11", "AS Level (Yr 12)", "A Level (Yr 13)"], tiers: [3, 6, 9, 13] },
  "🇸🇬 Singapore & SE Asia": { grades: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "O-Level / IGCSE Yr 4", "O-Level / IGCSE Yr 5", "IB Diploma Yr 1", "IB Diploma Yr 2"], tiers: [3, 6, 9, 13] },
  "🌐 Global ESL Mode": { grades: ["A1 Beginner", "A2 Elementary", "B1 Intermediate", "B2 Upper-Intermediate", "C1 Advanced", "C2 Proficient"], tiers: [1, 2, 4, 6] },
};
const TIER_KEYS = ["early", "elementary", "middle", "high"];
function tierForGrade(country, grade) {
  const d = GRADE_DATA[country];
  const idx = d.grades.indexOf(grade);
  const t = d.tiers;
  if (idx < t[0]) return "early";
  if (idx < t[1]) return "elementary";
  if (idx < t[2]) return "middle";
  return "high";
}

const num = (label) => Number((String(label).match(/(\d+)\s*$/) || [])[1]);
const REGIONS = [
  {
    key: "🇬🇧 United Kingdom", slug: "uk", flag: "🇬🇧", name: "the UK", short: "UK", subject: "English",
    curriculum: "England's National Curriculum and GCSE English",
    note: "This guide follows England's National Curriculum. Scotland, Wales and Northern Ireland have their own curricula, so check your school's guidance.",
    ages: (g) => (/^Year (\d+)$/.test(g) ? [num(g) + 4, num(g) + 5] : null),
  },
  {
    key: "🇺🇸 United States", slug: "us", flag: "🇺🇸", name: "the US", short: "US", subject: "English Language Arts",
    curriculum: "the Common Core State Standards for English Language Arts",
    note: "Many US states use the Common Core or standards based on it, and some use their own. Check your state's standards and your school's guidance.",
    ages: (g) => (g === "Kindergarten" ? [5, 6] : /^Grade (\d+)$/.test(g) ? [num(g) + 5, num(g) + 6] : null),
  },
  {
    key: "🇦🇺 Australia", slug: "australia", flag: "🇦🇺", name: "Australia", short: "Australia", subject: "English",
    curriculum: "the Australian Curriculum (version 9.0), set by ACARA",
    note: "States and territories adapt the Australian Curriculum, so check how your school delivers it.",
    ages: (g) => (g === "Foundation" ? [5, 6] : /^Year (\d+)$/.test(g) ? [num(g) + 5, num(g) + 6] : null),
  },
  {
    key: "🇨🇦 Canada", slug: "canada", flag: "🇨🇦", name: "Canada (Ontario)", short: "Canada", subject: "English (Language)",
    curriculum: "the Ontario Curriculum for Language",
    note: "Each Canadian province sets its own curriculum. This guide follows Ontario; check your own province's guidance.",
    ages: (g) => (/^Grade (\d+)$/.test(g) ? [num(g) + 5, num(g) + 6] : null),
  },
  {
    key: "🇦🇪 UAE & GCC Hubs", slug: "uae-gcc", flag: "🇦🇪", name: "the UAE and the Gulf", short: "UAE & Gulf", subject: "English",
    curriculum: "Cambridge Primary, Lower Secondary and IGCSE English",
    note: "Schools in the Gulf follow many curricula (British, American, IB, national). This guide covers the Cambridge pathway, so check what your school uses.",
    ages: (g) => (/^(Cambridge Primary|Lower Secondary) (\d+)$/.test(g) ? [num(g) + 4, num(g) + 5] : /^IGCSE Year (10|11)$/.test(g) ? [num(g) + 4, num(g) + 5] : null),
  },
  {
    key: "🇸🇬 Singapore & SE Asia", slug: "singapore", flag: "🇸🇬", name: "Singapore and South-East Asia", short: "Singapore & SE Asia", subject: "English",
    curriculum: "Cambridge Primary, Lower Secondary and IGCSE / O-Level English",
    note: "This guide follows the Cambridge pathway used by many international schools. Singapore's Ministry of Education sets its own English syllabus for local schools, so check with your school.",
    ages: (g) => (/^Primary (\d+)$/.test(g) ? [num(g) + 6, num(g) + 7] : /^Secondary (\d+)$/.test(g) ? [num(g) + 12, num(g) + 13] : /^O-Level \/ IGCSE Yr (4|5)$/.test(g) ? [num(g) + 11, num(g) + 12] : null),
  },
  {
    key: "🌐 Global ESL Mode", slug: "english-learners", flag: "🌐", name: "English learners worldwide", short: "English learners", subject: "English as a second language",
    curriculum: "the CEFR (Common European Framework of Reference for Languages)",
    note: "CEFR levels describe what a learner can do in a language, not their age or school year, so these pages are organised by level.",
    ages: () => null,
  },
];

// Flag emoji show as two letters (GB, US...) on Windows, so countries use small flag
// images, the same ones the homepage uses. The globe is a plain symbol and renders everywhere.
const FLAG_CC = { uk: "gb", us: "us", australia: "au", canada: "ca", "uae-gcc": "ae", singapore: "sg" };
function flagHtml(r) {
  const cc = FLAG_CC[r.slug];
  if (!cc) return `<span class="flag-globe" aria-hidden="true">${r.flag}</span> `;
  return `<img class="flag" src="https://flagcdn.com/20x15/${cc}.png" srcset="https://flagcdn.com/40x30/${cc}.png 2x" width="20" height="15" alt="" loading="lazy"> `;
}

const slugify = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

// "Year 7" + "Year 9" -> "Years 7–9", "IGCSE Year 10" + "IGCSE Year 11" -> "IGCSE Years 10–11".
function compressRange(first, last) {
  const a = first.match(/^(.*?)(\d+)(.*)$/), b = last.match(/^(.*?)(\d+)(.*)$/);
  if (a && b && a[1] === b[1] && a[3] === b[3]) return `${a[1].trim()}s ${a[2]}–${b[2]}${a[3]}`;
  return `${first} to ${last}`;
}

// Consecutive years that share exactly the same focus areas in the curriculum data
// (for example England's Years 7 to 9, or US Grades 9 and 10) become ONE page, so
// the site never has two near-identical pages for years the curriculum treats as one.
function groupsFor(region) {
  const by = GRADE_MAPPED_TARGETS[region.key];
  const groups = [];
  Object.entries(by).forEach(([grade, targets]) => {
    const sig = JSON.stringify(targets);
    const last = groups[groups.length - 1];
    if (last && last.sig === sig) last.grades.push(grade);
    else groups.push({ sig, grades: [grade], targets });
  });
  return groups.map((g) => {
    const first = g.grades[0], lastG = g.grades[g.grades.length - 1];
    const ages = [region.ages(first), region.ages(lastG)];
    const range = ages[0] && ages[1] ? [ages[0][0], ages[1][1]] : null;
    const words = g.grades.map((x) => (GRADE_WORD_TARGETS[region.key] || {})[x]).filter(Boolean);
    return {
      region, grades: g.grades, targets: g.targets,
      label: g.grades.length === 1 ? first : compressRange(first, lastG),
      slug: g.grades.length === 1 ? slugify(first) : `${slugify(first)}-to-${slugify(lastG)}`,
      tier: tierForGrade(region.key, first),
      ages: range,
      words: words.length ? [Math.min(...words), Math.max(...words)] : null,
    };
  });
}

const urlFor = {
  hub: () => `${SITE}/learn/`,
  prompts: () => `${SITE}/learn/prompts/`,
  region: (r) => `${SITE}/learn/${r.slug}/`,
  page: (g) => `${SITE}/learn/${g.region.slug}/${g.slug}/`,
};
const pathFor = {
  hub: () => "learn/index.html",
  prompts: () => "learn/prompts/index.html",
  region: (r) => `learn/${r.slug}/index.html`,
  page: (g) => `learn/${g.region.slug}/${g.slug}/index.html`,
};

const ageText = (g) => (g.ages ? (g.ages[0] === g.ages[1] ? `age ${g.ages[0]}` : `ages ${g.ages[0]}–${g.ages[1]}`) : null);
const wordsText = (g) => (g.words ? (g.words[0] === g.words[1] ? `about ${g.words[0]} words` : `about ${g.words[0]} to ${g.words[1]} words`) : null);
const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const CSS = `
  :root{ --bg:#F1F1EF; --surface:#FFFFFF; --surface-2:#E5E5E2; --border:#D3D3CF; --border-soft:#DEDEDB; --ink:#212121; --ink-soft:#5A5A56; --ink-faint:#6B6B66; --cyan:#7A3B45; --gold:#8C7040; --btn-ink:#FFFFFF; }
  @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){ --bg:#161513; --surface:#1E1B18; --surface-2:#26221D; --border:#37322B; --border-soft:#2C2721; --ink:#EDE9E2; --ink-soft:#B3AB9C; --ink-faint:#9A9284; --cyan:#C4776E; --gold:#C9A050; --btn-ink:#161513; } }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--bg); color:var(--ink); font-family:"Lexend", ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
  .nav{ position:sticky; top:0; z-index:10; background:color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter:blur(8px); border-bottom:1px solid var(--border-soft); }
  .nav-inner{ max-width:820px; margin:0 auto; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .brand{ font-weight:700; font-size:15px; text-decoration:none; color:var(--ink); }
  .brand span{ color:var(--cyan); }
  .nav a.try{ font-size:13.5px; font-weight:700; text-decoration:none; background:var(--cyan); color:var(--btn-ink); padding:8px 14px; border-radius:999px; white-space:nowrap; }
  .doc{ max-width:760px; margin:0 auto; padding:36px 24px 72px; }
  .crumbs{ font-size:13px; color:var(--ink-faint); margin-bottom:14px; }
  .crumbs a{ color:var(--ink-soft); }
  h1{ font-size:30px; line-height:1.2; font-weight:800; letter-spacing:-0.01em; margin:0 0 10px; }
  h2{ font-size:20px; font-weight:700; margin:34px 0 10px; letter-spacing:-0.01em; }
  h3{ font-size:16px; font-weight:700; margin:0 0 6px; }
  p, li{ font-family:"Source Serif 4", Georgia, serif; font-size:16px; line-height:1.7; }
  p{ margin:0 0 14px; }
  ul, ol{ padding-left:22px; margin:0 0 14px; }
  li{ margin-bottom:6px; }
  .lead{ font-size:17.5px; color:var(--ink-soft); }
  .card{ background:var(--surface); border:1px solid var(--border-soft); border-radius:14px; padding:18px 20px; margin:0 0 14px; }
  .card .ref{ font-family:"Lexend",sans-serif; font-size:12px; color:var(--ink-faint); margin:0 0 8px; }
  .card p{ margin:0 0 8px; }
  .card .home{ margin:0; color:var(--ink-soft); }
  .card .home b{ font-family:"Lexend",sans-serif; font-size:12px; letter-spacing:.04em; text-transform:uppercase; color:var(--gold); }
  .cta{ background:var(--surface); border:1.5px solid var(--cyan); border-radius:16px; padding:22px 24px; margin:36px 0 8px; }
  .cta h2{ margin:0 0 8px; }
  .btn{ display:inline-block; background:var(--cyan); color:var(--btn-ink); font-weight:700; font-size:15px; padding:12px 20px; border-radius:999px; text-decoration:none; }
  .small{ font-size:13.5px; color:var(--ink-faint); font-family:"Lexend",sans-serif; line-height:1.55; }
  .grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:10px; padding:0; list-style:none; }
  .grid li{ margin:0; }
  .grid a{ display:block; background:var(--surface); border:1px solid var(--border-soft); border-radius:12px; padding:12px 14px; text-decoration:none; color:var(--ink); font-family:"Lexend",sans-serif; font-size:14px; font-weight:600; }
  .flag{ vertical-align:-1px; margin-right:6px; border-radius:2px; }
  .flag-globe{ margin-right:2px; }
  .grid a small{ display:block; font-weight:400; color:var(--ink-faint); font-size:12.5px; margin-top:2px; }
  a{ color:var(--cyan); }
  .tool{ background:var(--surface); border:1px solid var(--border-soft); border-radius:16px; padding:20px; margin:18px 0 8px; }
  .tool .row{ display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-bottom:16px; }
  .tool label{ display:block; font-family:"Lexend",sans-serif; font-size:12.5px; font-weight:600; color:var(--ink-soft); margin-bottom:5px; }
  .tool select{ width:100%; font:inherit; font-family:"Lexend",sans-serif; font-size:14px; padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:var(--bg); color:var(--ink); }
  .tool select:focus-visible, .tool button:focus-visible, .btn:focus-visible, a:focus-visible{ outline:2px solid var(--cyan); outline-offset:2px; }
  .pg-prompt{ font-family:"Source Serif 4", Georgia, serif; font-size:22px; line-height:1.45; margin:6px 0 8px; min-height:3.2em; }
  .tool .acts{ display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
  .tool button{ font:inherit; font-family:"Lexend",sans-serif; font-size:14px; font-weight:700; padding:10px 18px; border-radius:999px; cursor:pointer; border:1.5px solid var(--cyan); }
  .tool .primary{ background:var(--cyan); color:var(--btn-ink); }
  .tool .ghost{ background:transparent; color:var(--cyan); }
  .pn{ display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; margin:22px 0 0; font-family:"Lexend",sans-serif; font-size:14px; }
  /* Touch targets: at least 44px tall for anything tappable on a phone. */
  @media (pointer:coarse), (max-width:640px){
    .nav-inner{ padding-block:8px; }
    .brand{ display:inline-block; padding:12px 0; }
    .nav a.try{ display:inline-flex; align-items:center; min-height:44px; padding:0 18px; }
    .crumbs a{ display:inline-block; padding:14px 4px; margin:-14px 0; }
    .pn a{ display:inline-block; padding:13px 4px; }
    .tool select, .tool button{ min-height:48px; }
    .grid a{ min-height:48px; }
    footer a{ display:inline-block; padding:12px 4px; }
  }
  footer{ max-width:760px; margin:0 auto; padding:0 24px 48px; font-size:13px; color:var(--ink-faint); font-family:"Lexend",sans-serif; }
  footer a{ color:var(--ink-soft); }
`;

function layout({ title, description, canonical, jsonld, body, script, css }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="LiteracyLab AI">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&amp;family=Source+Serif+4:ital,wght@0,400;0,600;1,400&amp;display=swap" rel="stylesheet">
<style>${CSS}${css || ""}</style>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script src="/analytics.js"></script>
</head>
<body>
<div class="nav"><div class="nav-inner">
  <a class="brand" href="/">LiteracyLab <span>AI</span></a>
  <a class="try" href="/app.html?utm_source=learn&amp;utm_medium=seo&amp;utm_campaign=nav">Try it free</a>
</div></div>
<main class="doc">
${body}
</main>
<footer>
  <p class="small">LiteracyLab AI gives children curriculum-aligned writing and reading feedback. <a href="/">Home</a> · <a href="/learn/">All guides</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></p>
  <p class="small">These guides are general information based on published curriculum documents. They are not a substitute for your school's own guidance, and LiteracyLab AI is not affiliated with any exam board or curriculum body.</p>
</footer>
${script ? `<script>
${script}
</script>
` : ""}</body>
</html>
`;
}

function breadcrumbLd(items) {
  return { "@type": "BreadcrumbList", itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })) };
}

function ctaBlock(campaign, heading) {
  return `<section class="cta">
  <h2>${esc(heading)}</h2>
  <p>LiteracyLab AI reads a child's own writing and gives specific feedback: what worked, one thing to try next, and a corrected version, matched to their year and curriculum. The Free plan includes 3 pieces a month and needs no card.</p>
  <p><a class="btn" href="/app.html?utm_source=learn&amp;utm_medium=seo&amp;utm_campaign=${esc(campaign)}">Try it free</a></p>
</section>`;
}

function buildPage(g, groups, idx) {
  const r = g.region;
  const info = TIER_INFO[g.tier];
  const ages = ageText(g);
  const words = wordsText(g);
  const isEsl = r.slug === "english-learners";
  const titleBase = isEsl ? `${g.label} English: what learners can do and how to practise` : `${g.label} ${r.subject} (${r.short}): what children learn and how to help`;
  const mid = `${g.label} ${r.subject} (${r.short}): what's taught and how to help`;
  const title = isEsl || titleBase.length <= 68 ? titleBase : mid.length <= 68 ? mid : `${g.label} ${r.subject} (${r.short}): what's taught`;
  const names = g.targets.map((t) => t.name);
  const trimmedDesc = (isEsl
    ? `What a ${g.label} learner can do in reading and writing, explained in plain English, with practice prompts and tips for learners and parents.`
    : `What ${g.label} children in ${r.name} learn in ${r.subject === "English" ? "English" : r.subject}${ages ? ` (${ages})` : ""}: a plain-English guide with practice prompts for parents.`);

  const intro = isEsl
    ? `<p class="lead">At CEFR ${esc(g.label)} level, a learner is working towards three skills in reading and writing. This guide explains each one in plain English, with something to try at home and practice prompts you can use today.</p>`
    : `<p class="lead">${esc(g.label)} children in ${esc(r.name)} ${ages ? `are usually ${esc(ages.replace(/^ages? /, "aged "))} and ` : ""}are working on three main things in reading and writing, following ${esc(r.curriculum)}. This guide explains each one in plain English, with something to try at home and practice prompts you can use today.</p>`;

  const cards = g.targets.map((t) => {
    const guide = TARGET_GUIDE[t.name];
    return `<div class="card">
  <h3>${esc(t.name)}</h3>
  <p class="ref">Curriculum reference: ${esc(t.standard)}</p>
  <p>${esc(guide.what)}</p>
  <p class="home"><b>Try at home</b><br>${esc(guide.home)}</p>
</div>`;
  }).join("\n");

  const offset = hash(`${r.slug}/${g.slug}`) % info.prompts.length;
  const prompts = [0, 1, 2].map((k) => info.prompts[(offset + k) % info.prompts.length]);
  const length = `<p>A good target for a ${esc(info.label)} piece at this level is ${esc(info.length)}${words ? `, which is ${esc(words)} when practising in LiteracyLab AI` : ""}. Short and regular beats long and rare: one carefully improved piece teaches more than three rushed ones.</p>`;

  const faq = [
    [`How much should a ${isEsl ? "learner at this level" : g.label + " child"} write?`, `${capFirst(info.length)}${words ? `, or ${words}` : ""} is a sensible target for practice. Quality matters more than length.`],
    [`What are the main skills at this level?`, `${names.join("; ")}. Each is explained above with something to try at home.`],
    [`How do I know if my child is on track?`, `Compare their writing with the three focus areas above and ask their teacher for a view. A tool such as LiteracyLab AI can show, for each piece, what worked and the next step, but your child's teacher knows their progress best.`],
  ].map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("");

  const prev = groups[idx - 1], next = groups[idx + 1];
  const nav = `<div class="pn"><span>${prev ? `<a href="/learn/${r.slug}/${prev.slug}/">← ${esc(prev.label)}</a>` : ""}</span><span>${next ? `<a href="/learn/${r.slug}/${next.slug}/">${esc(next.label)} →</a>` : ""}</span></div>`;

  const crumbs = [["Home", `${SITE}/`], ["Guides", urlFor.hub()], [r.short, urlFor.region(r)], [g.label, urlFor.page(g)]];
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "Article", headline: title, description: trimmedDesc, url: urlFor.page(g), inLanguage: "en", dateModified: LASTMOD, author: { "@type": "Organization", name: "LiteracyLab AI" }, publisher: { "@type": "Organization", name: "LiteracyLab AI", url: SITE } },
    breadcrumbLd(crumbs),
  ] };

  const wsSheets = WS.published().filter((s) => s.region === r.slug && s.year === g.label);
  const wsLink = wsSheets.length ? `<p class="small">Free reading practice: <a href="/learn/worksheets/${r.slug}/${WS.yearSlug(g.label)}/${wsSheets[0].id}/">${esc(wsSheets[0].title)}</a> (printable worksheet with answers)${wsSheets.length > 1 ? `, or <a href="/learn/worksheets/#${WS.yearSlug(g.label)}">see all ${wsSheets.length} ${esc(g.label)} worksheets</a>` : ""}.</p>` : "";
  const body = `<div class="crumbs"><a href="/">Home</a> › <a href="/learn/">Guides</a> › <a href="/learn/${r.slug}/">${esc(r.short)}</a> › ${esc(g.label)}</div>
<h1>${esc(title)}</h1>
${intro}
<h2>What ${isEsl ? "this level" : esc(g.label)} focuses on</h2>
${cards}
<h2>How much should they write?</h2>
${length}
<h2>Three practice prompts to try this week</h2>
<ol>${prompts.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
<p class="small">Want more? <a href="/learn/prompts/?stage=${g.tier}">Try the free prompt generator</a> for this age group.</p>${wsLink}
<h2>Common questions</h2>
${faq}
<h2>How to give feedback at home</h2>
<ul>${info.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
${ctaBlock(`${r.slug}-${g.slug}`, `Get feedback on ${isEsl ? "a piece of writing" : esc(g.label) + " writing"}`)}
<p class="small">${esc(r.note)}</p>
<h2>Other levels</h2>
${nav}
<p class="small"><a href="/learn/${r.slug}/">All ${esc(r.short)} guides</a> · <a href="/learn/">All regions</a></p>`;

  return layout({ title, description: trimmedDesc, canonical: urlFor.page(g), jsonld, body });
}

function buildRegion(r, groups) {
  const title = `${r.short} English guides by year: what children learn and how to help`.slice(0, 70);
  const description = `Plain-English guides to what children in ${r.name} learn in reading and writing at each year, based on ${r.curriculum}, with practice prompts for parents.`.slice(0, 158);
  const crumbs = [["Home", `${SITE}/`], ["Guides", urlFor.hub()], [r.short, urlFor.region(r)]];
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", name: title, description, url: urlFor.region(r), inLanguage: "en", dateModified: LASTMOD },
    breadcrumbLd(crumbs),
  ] };
  const items = groups.map((g) => `<li><a href="/learn/${r.slug}/${g.slug}/">${esc(g.label)}<small>${esc(ageText(g) ? ageText(g).replace(/^a/, "A") : g.targets[0].name)}</small></a></li>`).join("\n");
  const body = `<div class="crumbs"><a href="/">Home</a> › <a href="/learn/">Guides</a> › ${esc(r.short)}</div>
<h1>${flagHtml(r)}${esc(r.short)}: English guides by ${r.slug === "english-learners" ? "level" : "year"}</h1>
<p class="lead">${r.slug === "english-learners" ? "Choose a CEFR level" : `Choose a year for a plain-English guide to the reading and writing skills children work on in ${esc(r.name)}`}, based on ${esc(r.curriculum)}.</p>
<ul class="grid">
${items}
</ul>
${ctaBlock(`${r.slug}-hub`, "See it work on real writing")}
<p class="small">${esc(r.note)}</p>`;
  return layout({ title, description, canonical: urlFor.region(r), jsonld, body });
}

function buildHub(regionGroups) {
  const title = "English guides for parents by country and year | LiteracyLab AI";
  const description = "Plain-English guides to what children learn in reading and writing in the UK, US, Australia, Canada, the Gulf, Singapore and for English learners, year by year.";
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", name: title, description, url: urlFor.hub(), inLanguage: "en", dateModified: LASTMOD },
    breadcrumbLd([["Home", `${SITE}/`], ["Guides", urlFor.hub()]]),
  ] };
  const items = regionGroups.map(({ region: r, groups }) => `<li><a href="/learn/${r.slug}/">${flagHtml(r)}${esc(r.short)}<small>${groups.length} guides</small></a></li>`).join("\n");
  const body = `<div class="crumbs"><a href="/">Home</a> › Guides</div>
<h1>English guides for parents, by country and year</h1>
<p class="lead">What is my child expected to learn in reading and writing this year, and how can I help at home? Pick your country to find a plain-English guide for every year, built from the published curriculum.</p>
<ul class="grid">
${items}
</ul>
<p>Looking for something to write about? Try the <a href="/learn/prompts/">free writing prompt generator</a>: choose an age group, a topic and a kind of writing.</p>${WS.published().length ? `<p>Want reading practice? Download our <a href="/learn/worksheets/">free printable reading comprehension worksheets</a> for ${WS.levelsText()}, with answer keys.</p>` : ""}
${ctaBlock("hub", "Get feedback on your child's writing")}
<p class="small">General information based on published curriculum documents. Always check your school's own guidance.</p>`;
  return layout({ title, description, canonical: urlFor.hub(), jsonld, body });
}

function buildPromptsPage() {
  const gen = fs.readFileSync(path.join(__dirname, "prompt-generator.js"), "utf8").replace(/\r\n/g, "\n");
  const pageJs = fs.readFileSync(path.join(__dirname, "prompt-page.js"), "utf8").replace(/\r\n/g, "\n");
  // The browser does not need the node export block.
  const genForBrowser = gen.slice(0, gen.indexOf("if (typeof module"));
  const title = "Free writing prompt generator for kids and teens (no sign-up)";
  const description = "Free writing prompts for ages 5 to 18: choose an age group, a topic and a kind of writing, and get a prompt to try. No sign-up, and nothing is stored.";
  const crumbs = [["Home", `${SITE}/`], ["Guides", urlFor.hub()], ["Writing prompts", urlFor.prompts()]];
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebApplication", name: "Free writing prompt generator", url: urlFor.prompts(), applicationCategory: "EducationalApplication", operatingSystem: "Any", inLanguage: "en", description, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }, publisher: { "@type": "Organization", name: "LiteracyLab AI", url: SITE } },
    breadcrumbLd(crumbs),
  ] };
  const fallback = ["early", "elementary", "middle", "high"].map((k) => `<h3>${esc(PG_STAGE_LABEL[k])}</h3>
<ul>${TIER_INFO[k].prompts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`).join("\n");
  const body = `<div class="crumbs"><a href="/">Home</a> › <a href="/learn/">Guides</a> › Writing prompts</div>
<h1>Free writing prompt generator</h1>
<p class="lead">Stuck for something to write about? Choose an age group, a topic your child likes and a kind of writing, and get a prompt to try. It is free, needs no sign-up, and nothing you choose is stored.</p>
<section class="tool" aria-label="Prompt generator">
  <div class="row">
    <div><label for="pg-stage">Age group</label><select id="pg-stage"></select></div>
    <div><label for="pg-type">Kind of writing</label><select id="pg-type"></select></div>
    <div><label for="pg-interest">Topic they like</label><select id="pg-interest"></select></div>
  </div>
  <p class="pg-prompt" id="pg-prompt" aria-live="polite">Loading a prompt…</p>
  <p class="small" id="pg-meta"></p>
  <div class="acts">
    <button type="button" class="primary" id="pg-new">Give me another</button>
    <button type="button" class="ghost" id="pg-copy">Copy prompt</button>
  </div>
  <p class="small" id="pg-status" role="status"></p>
</section>
<noscript><p>The generator needs JavaScript. Here are some prompts to try instead.</p>${fallback}</noscript>
<h2>How to use a prompt</h2>
<ul>
  <li>Let your child read the prompt aloud and say what they would write before they start.</li>
  <li>Keep it short and regular. One carefully improved piece teaches more than three rushed ones.</li>
  <li>Praise one specific thing they did well, then pick one thing to improve next time.</li>
</ul>
<h2>Make it count</h2>
<p>A prompt is the start. The real learning comes from feedback on what a child actually wrote. Our <a href="/learn/">year-by-year guides</a> explain what children are working on at each age, so you know what to look for.</p>
${ctaBlock("prompt-tool", "Get feedback on what they write")}
<p class="small">Prompts are picked from a fixed list of ideas written by us. Nothing a visitor chooses is saved, and no writing is collected on this page.</p>`;
  return layout({ title, description, canonical: urlFor.prompts(), jsonld, body, script: genForBrowser + "\n" + pageJs });
}
const PG_STAGE_LABEL = { early: "Ages 5–7 (early years)", elementary: "Ages 8–10 (primary)", middle: "Ages 11–13 (middle years)", high: "Ages 14–18 (senior years)" };

function buildAll() {
  const files = {};
  const regionGroups = REGIONS.map((r) => ({ region: r, groups: groupsFor(r) }));
  files[pathFor.hub()] = buildHub(regionGroups);
  files[pathFor.prompts()] = buildPromptsPage();
  const urls = [urlFor.hub(), urlFor.prompts()];
  const ws = WS.buildWorksheetFiles({ layout, breadcrumbLd, ctaBlock });
  Object.assign(files, ws.files);
  urls.push(...ws.urls);
  regionGroups.forEach(({ region, groups }) => {
    files[pathFor.region(region)] = buildRegion(region, groups);
    urls.push(urlFor.region(region));
    groups.forEach((g, i) => { files[pathFor.page(g)] = buildPage(g, groups, i); urls.push(urlFor.page(g)); });
  });
  files["sitemap.xml"] = buildSitemap(urls);
  return { files, urls, regionGroups };
}

function buildSitemap(learnUrls) {
  const entry = (loc, lastmod, freq, pri) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${pri}</priority>\n  </url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` + [
    entry(`${SITE}/`, "2026-09-28", "weekly", "1.0"),
    ...learnUrls.map((u) => entry(u, WS.isWorksheetUrl(u) ? WS.lastmodForUrl(u) : LASTMOD, "monthly", u === urlFor.hub() ? "0.8" : u === urlFor.prompts() ? "0.8" : u.split("/").length <= 6 ? "0.7" : "0.6")),
    entry(`${SITE}/privacy.html`, "2026-09-26", "monthly", "0.3"),
    entry(`${SITE}/terms.html`, "2026-09-26", "monthly", "0.3"),
  ].join("\n") + "\n</urlset>\n";
}

if (require.main === module) {
  const { files } = buildAll();
  Object.entries(files).forEach(([rel, html]) => {
    const full = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, html);
  });
  console.log(`Wrote ${Object.keys(files).length} files.`);
}

module.exports = { buildAll, groupsFor, REGIONS, GRADE_DATA, tierForGrade, urlFor, pathFor, LASTMOD };
