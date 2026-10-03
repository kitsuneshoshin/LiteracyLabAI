// Builds the free printable reading worksheets: a hub, one web page per sheet (passage,
// questions, collapsed answer key, PDF links) and the print-only HTML that the PDF script
// turns into the worksheet and answer-key PDFs.
//
// Only sheets marked `published: true` in scripts/worksheets-content*.js are built, so a
// draft can never reach the live site by accident.
//
// Everything that differs between countries (wording, ages, paper size, standards codes,
// spelling locale) lives in REGION below, so adding a country is data, not new code.
//
//   node scripts/build-learn.js           writes the pages (it calls this module)
//   node scripts/build-worksheet-pdfs.js  writes the PDFs with headless Chrome

const { SHEETS } = require("./worksheets-content");
const { GRADE_MAPPED_TARGETS } = require("../api/_lib/masteryTargets");

const SITE = "https://www.literacylabai.com";
const DEFAULT_ADDED = "2026-10-03";
const COPYRIGHT = "Free to print and copy for your own family or classroom. Please do not sell or republish.";

const REGION = {
  uk: {
    slug: "uk", short: "UK", gradeWord: "Year", gradeNoun: "year", locale: "en-GB", lang: "en-GB", paper: "A4",
    unit: "mark", infoText: "Information text", ageOf: (n) => [n + 4, n + 5],
    levels: "Years 3 to 6", order: 1, countryKey: "🇬🇧 United Kingdom",
    standards: "The codes in brackets are the reading content domains from the national curriculum test framework.",
  },
  us: {
    slug: "us", short: "US", gradeWord: "Grade", gradeNoun: "grade", locale: "en-US", lang: "en-US", paper: "Letter",
    unit: "point", infoText: "Informational text", ageOf: (n) => [n + 5, n + 6],
    levels: "Grades 3 to 6", order: 2, countryKey: "🇺🇸 United States",
    standards: "The codes in brackets are Common Core State Standards for English Language Arts (reading). Standards vary by state, so check what your child's school uses.",
  },
  australia: {
    slug: "australia", short: "Australia", gradeWord: "Year", gradeNoun: "year", locale: "en-AU", lang: "en-AU", paper: "A4",
    unit: "mark", infoText: "Information text", ageOf: (n) => [n + 5, n + 6],
    levels: "Years 3 to 6", order: 3, countryKey: "🇦🇺 Australia",
    standards: "Schools and states deliver the Australian Curriculum (version 9) in different ways, so check what your child's school uses.",
  },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const regionOf = (s) => REGION[s.region];
const yearNum = (label) => Number(String(label).match(/(\d+)$/)[1]);
const yearSlug = (label) => String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
// How a level is named in titles, pins and prose: "Year 4" in the UK, "4th Grade" in the US.
const levelName = (s) => (s.region === "us" ? `${ordinal(yearNum(s.year))} Grade` : s.region === "australia" ? `Australian ${s.year}` : s.year);
// Hub anchors: UK "year-3" and US "grade-3" are unique already; Australia needs its own so it does not clash with the UK.
const anchorFor = (s) => (s.region === "australia" ? `australia-${yearSlug(s.year)}` : yearSlug(s.year));
const joinAnd = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
const ageRange = (s) => { const [a, b] = regionOf(s).ageOf(yearNum(s.year)); return `ages ${a} to ${b}`; };
const MINUTES = { 3: 15, 4: 20, 5: 25, 6: 30 };
const minutesFor = (s) => MINUTES[yearNum(s.year)] || 20;
const wordCount = (s) => s.passage.map((p) => p.p).join(" ").split(/\s+/).filter(Boolean).length;
const totalMarks = (s) => s.questions.reduce((a, q) => a + q.marks, 0);
const unitWord = (s, n) => `${regionOf(s).unit}${n === 1 ? "" : "s"}`;
const kindLabel = (s) => (s.kind === "story" ? "Story" : regionOf(s).infoText);

// Plain-English skill for each question type, with the curriculum code where we are certain.
// UK: the national test framework's content domains. US: Common Core reading standards,
// where RL is literature (stories) and RI is informational text.
const SKILL = {
  retrieval: "Finding information",
  vocabulary: "Word meaning",
  summary: "Summarizing",
  inference: "Inference",
  quote: "Quoting from the text",
  explain: "Explaining from the text",
  order: "Sequencing events",
  language: "Language choices",
  opinion: "Giving a view with evidence",
};
const UK_CODE = { retrieval: "2b", vocabulary: "2a", summary: "2c", inference: "2d" };
function skillCode(type, s) {
  if (s.region === "uk") return UK_CODE[type] || null;
  if (s.region === "australia") return null; // one comprehension focus per year, linked once on the page
  const n = yearNum(s.year);
  const p = s.kind === "story" ? "RL" : "RI";
  if (type === "retrieval") return `${p}.${n}.1`;
  if (type === "vocabulary" || type === "language") return `${p}.${n}.4`;
  if (type === "summary") return `${p}.${n}.2`;
  if (type === "inference" && n >= 4) return `${p}.${n}.1`;
  if (type === "quote" && n >= 5) return `${p}.${n}.1`;
  return null;
}
const skillName = (type, s) => (s.region !== "us" && type === "summary" ? "Summarising" : SKILL[type]);
// The one curriculum link for countries that do not code every question type (Australia).
function curriculumLink(s) {
  const t = ((GRADE_MAPPED_TARGETS[regionOf(s).countryKey] || {})[s.year] || []).find((x) => x.name === s.target);
  return t ? `${t.name} (${t.standard.split(" · ")[0]})` : null;
}
const skillLabel = (type, s) => { const c = skillCode(type, s); return c ? `${skillName(type, s)} (${c})` : skillName(type, s); };

// Search results show about 160 characters, so cut at a word boundary rather than mid-word.
const fitDescription = (d) => (d.length <= 160 ? d : d.slice(0, 157).replace(/\s+\S*$/, "") + "...");

const published = () => SHEETS.filter((s) => s.published);
const dir = (s) => `${s.region}/${yearSlug(s.year)}/${s.id}`;
const pagePath = (s) => `learn/worksheets/${dir(s)}/index.html`;
const pageUrl = (s) => `${SITE}/learn/worksheets/${dir(s)}/`;
const pdfUrl = (s, answers) => `/learn/worksheets/${dir(s)}/${s.id}${answers ? "-answers" : ""}.pdf`;
const pdfPath = (s, answers) => `learn/worksheets/${dir(s)}/${s.id}${answers ? "-answers" : ""}.pdf`;
const hubUrl = () => `${SITE}/learn/worksheets/`;
const hubPath = () => "learn/worksheets/index.html";
const added = (s) => s.added || DEFAULT_ADDED;
// Sitemap dates: a sheet's own date, and the hub changes whenever any sheet is added.
function lastmodForUrl(u) {
  const list = published();
  const sheet = list.find((s) => pageUrl(s) === u);
  if (sheet) return added(sheet);
  return list.map(added).sort().pop() || DEFAULT_ADDED;
}
const isWorksheetUrl = (u) => u.startsWith(`${SITE}/learn/worksheets/`);

// A question string is a stem plus optional extra lines (list items or options).
function splitQuestion(q) {
  const [stem, ...rest] = q.q.split("\n");
  return { stem, rest };
}
const isBoxList = (rest) => rest.length > 0 && rest.every((l) => l.startsWith("•"));

const EXTRA_CSS = `
  .meta{ font-family:"Lexend",sans-serif; font-size:13.5px; color:var(--ink-soft); display:flex; flex-wrap:wrap; gap:6px 16px; margin:0 0 18px; }
  .meta b{ color:var(--ink); font-weight:600; }
  .dl{ display:flex; flex-wrap:wrap; gap:10px; margin:0 0 22px; }
  .btn.alt{ background:transparent; color:var(--cyan); border:1.5px solid var(--cyan); }
  @media (pointer:coarse), (max-width:640px){ .dl .btn, .cta .btn{ display:inline-flex; align-items:center; min-height:48px; } }
  .passage{ background:var(--surface); border:1px solid var(--border-soft); border-radius:14px; padding:22px 24px; margin:0 0 22px; }
  .passage h2{ font-size:17px; margin:18px 0 6px; }
  .passage h2:first-child{ margin-top:0; }
  .passage p:last-child{ margin-bottom:0; }
  .qs{ list-style:none; padding:0; counter-reset:q; }
  .qs>li{ counter-increment:q; background:var(--surface); border:1px solid var(--border-soft); border-radius:12px; padding:14px 18px; margin:0 0 10px; }
  .qs>li::before{ content:counter(q) "."; font-family:"Lexend",sans-serif; font-weight:700; margin-right:6px; }
  .qs .marks{ font-family:"Lexend",sans-serif; font-size:12px; color:var(--ink-faint); white-space:nowrap; }
  .qs .opt{ display:block; margin:2px 0 0 18px; }
  details.key{ background:var(--surface); border:1px solid var(--border-soft); border-radius:12px; padding:4px 18px; margin:0 0 14px; }
  details.key summary{ cursor:pointer; font-family:"Lexend",sans-serif; font-weight:700; padding:12px 0; min-height:44px; }
  .ans{ margin:0 0 14px; padding-bottom:12px; border-bottom:1px solid var(--border-soft); }
  .ans:last-child{ border-bottom:0; margin-bottom:0; }
  .ans .why{ color:var(--ink-soft); margin:4px 0 0; }
  .wa{ background:var(--surface); border-left:4px solid var(--gold); border-radius:10px; padding:14px 18px; margin:0 0 14px; }
`;

const marksText = (s, n) => `${n} ${unitWord(s, n)}`;

function questionsHtml(s) {
  return `<ol class="qs">${s.questions.map((q) => {
    const { stem, rest } = splitQuestion(q);
    return `<li>${esc(stem)} <span class="marks">(${marksText(s, q.marks)})</span>${rest.map((l) => `<span class="opt">${esc(l)}</span>`).join("")}</li>`;
  }).join("")}</ol>`;
}

function answerKeyHtml(s) {
  return s.questions.map((q, i) => `<div class="ans"><p><b>${i + 1}.</b> ${esc(q.answer)} <span class="marks">(${marksText(s, q.marks)})</span></p><p class="why small"><b>${esc(skillLabel(q.type, s))}.</b> ${esc(q.why)}</p></div>`).join("");
}

function passageHtml(s) {
  return s.passage.map((p) => `${p.h ? `<h2>${esc(p.h)}</h2>` : ""}<p>${esc(p.p)}</p>`).join("");
}

function sheetCtaHtml(s) {
  const r = regionOf(s);
  return `<h2>Now try the writing task</h2>
<div class="wa"><p><b>${esc(s.writeAfter)}</b></p><p class="small">Aim for ${yearNum(s.year) === 3 ? "five to eight" : "eight to twelve"} sentences. Read it back aloud together and fix anything that does not sound right.</p></div>
<section class="cta">
  <h2>Want feedback on your child's own writing?</h2>
  <p>You mark the worksheet yourself with the answer key. LiteracyLab AI is different: it reads what your child has written and gives specific feedback, such as what worked, one thing to try next, and a corrected version, matched to their ${r.gradeNoun}. The Free plan includes 3 pieces a month and needs no card.</p>
  <p><a class="btn" href="/app.html?utm_source=learn&amp;utm_medium=worksheet&amp;utm_campaign=worksheet-${esc(s.id)}">Try it free</a></p>
</section>`;
}

function buildSheetPage(s, ctx, siblings) {
  const { layout, breadcrumbLd } = ctx;
  const r = regionOf(s);
  const lvl = levelName(s);
  // A title that already ends in ? or ! reads better with a dash than a colon.
  const join = /[?!]$/.test(s.title) ? " –" : ":";
  const title = `${s.title}${join} free ${lvl} reading comprehension worksheet (printable PDF)`;
  // Long titles fall back to shorter wording so the page title stays readable in search results.
  const trimmed = [title, `${s.title}${join} free ${lvl} reading worksheet (PDF)`, `${s.title}${join} free ${lvl} worksheet`].find((t) => t.length <= 72) || `${s.title} | ${lvl} worksheet`;
  const description = fitDescription(`${s.blurb} Free printable PDF with answers.`);
  const crumbs = [["Home", `${SITE}/`], ["Guides", `${SITE}/learn/`], ["Worksheets", hubUrl()], [`${r.short} ${s.year}`, `${hubUrl()}#${anchorFor(s)}`], [s.title, pageUrl(s)]];
  const skills = [...new Set(s.questions.map((q) => skillLabel(q.type, s)))];
  const [a, b] = r.ageOf(yearNum(s.year));
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "LearningResource", name: trimmed, description, url: pageUrl(s), inLanguage: r.lang, learningResourceType: "Worksheet", educationalLevel: s.year, typicalAgeRange: `${a}-${b}`, teaches: "Reading comprehension", isAccessibleForFree: true, dateModified: added(s), author: { "@type": "Organization", name: "LiteracyLab AI" }, publisher: { "@type": "Organization", name: "LiteracyLab AI", url: SITE } },
    breadcrumbLd(crumbs),
  ] };
  const more = siblings.length ? `<h2>More ${esc(s.year)} worksheets</h2><ul>${siblings.map((o) => `<li><a href="/learn/worksheets/${dir(o)}/">${esc(o.title)}</a></li>`).join("")}</ul>` : "";
  const body = `<div class="crumbs"><a href="/">Home</a> › <a href="/learn/">Guides</a> › <a href="/learn/worksheets/">Worksheets</a> › ${esc(s.title)}</div>
<h1>${esc(s.title)}</h1>
<p class="lead">${esc(s.blurb)}</p>
<p class="meta"><span><b>${esc(s.year)}</b> (${esc(ageRange(s))}${r.slug === "us" ? "" : ", " + r.short})</span><span>${kindLabel(s)}</span><span>About ${minutesFor(s)} minutes</span><span>${marksText(s, totalMarks(s))}</span><span>${wordCount(s)} words</span></p>
<div class="dl"><a class="btn" href="${pdfUrl(s)}" download>Download the worksheet (PDF)</a><a class="btn alt" href="${pdfUrl(s, true)}" download>Download the answers (PDF)</a></div>
<h2>Read the passage</h2>
<div class="passage">${passageHtml(s)}</div>
<h2>Answer the questions</h2>
${questionsHtml(s)}
<details class="key"><summary>Answer key for parents and teachers</summary>${answerKeyHtml(s)}</details>
<h2>What this ${r.slug === "us" ? "practices" : "practises"}</h2>
<p>${esc(skills.join(", "))}. ${curriculumLink(s) && r.slug === "australia" ? `This sheet links to ${esc(curriculumLink(s))}. ` : ""}${esc(r.standards)} ${r.unit === "point" ? "Points" : "Marks"} and answers are a guide: accept any sensible answer that is backed up by the text.</p>
${sheetCtaHtml(s)}
${more}
<p class="small">${esc(COPYRIGHT)} The passage and questions were written for LiteracyLab AI.</p>`;
  return layout({ title: trimmed, description, canonical: pageUrl(s), jsonld, body, css: EXTRA_CSS });
}

// "UK Years 3 to 6 and US Grades 3 to 6", built from the countries that have published sheets.
function levelsText() {
  const regions = [...new Set(published().map((s) => s.region))].sort((x, y) => REGION[x].order - REGION[y].order);
  return joinAnd(regions.map((k) => `${REGION[k].short} ${REGION[k].levels}`));
}

function levelsSummary(list) {
  const regions = [...new Set(list.map((s) => s.region))].sort((x, y) => REGION[x].order - REGION[y].order);
  return regions.map((k) => `${REGION[k].short} ${REGION[k].levels.replace(" to ", "–")}`);
}

function buildHubPage(ctx) {
  const { layout, breadcrumbLd } = ctx;
  const list = published();
  const regions = [...new Set(list.map((s) => s.region))].sort((x, y) => REGION[x].order - REGION[y].order);
  const names = levelsSummary(list);
  const title = regions.length > 2 ? "Free reading comprehension worksheets for the UK, US and Australia" : regions.length > 1 ? `Free reading comprehension worksheets: ${joinAnd(names)}` : "Free printable reading comprehension worksheets, Years 3 to 6 (UK)";
  const description = regions.length > 2
    ? "Free printable reading comprehension worksheets for UK Years 3 to 6, US Grades 3 to 6 and Australian Years 3 to 6, with original passages and answer keys in PDF."
    : regions.length > 1
      ? "Free printable reading comprehension worksheets for UK Years 3 to 6 and US Grades 3 to 6, with original passages, questions and answer keys in PDF. No sign-up."
      : "Free printable reading comprehension worksheets for UK Years 3 to 6: original passages, questions and answer keys, in PDF. No sign-up needed.";
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", name: title, description, url: hubUrl(), inLanguage: "en", dateModified: lastmodForUrl(hubUrl()) },
    breadcrumbLd([["Home", `${SITE}/`], ["Guides", `${SITE}/learn/`], ["Worksheets", hubUrl()]]),
  ] };
  const sections = regions.map((k) => {
    const r = REGION[k];
    const rl = list.filter((s) => s.region === k);
    const years = [...new Set(rl.map((s) => s.year))].sort((x, y) => yearNum(x) - yearNum(y));
    return `<h2 class="region" id="${k}">${esc(r.short)} worksheets: ${esc(r.levels)}</h2>\n` + years.map((y) => {
      const sample = rl.find((s) => s.year === y);
      return `<h3 id="${anchorFor(sample)}">${esc(y)} (${esc(ageRange(sample))})</h3>
<ul class="grid">${rl.filter((s) => s.year === y).map((s) => `<li><a href="/learn/worksheets/${dir(s)}/">${esc(s.title)}<small>${kindLabel(s)} · ${marksText(s, totalMarks(s))}</small></a></li>`).join("")}</ul>`;
    }).join("\n");
  }).join("\n");
  const guides = joinAnd(regions.map((k) => `<a href="/learn/${k}/">${REGION[k].gradeNoun}-by-${REGION[k].gradeNoun} ${REGION[k].short} guides</a>`));
  const body = `<div class="crumbs"><a href="/">Home</a> › <a href="/learn/">Guides</a> › Worksheets</div>
<h1>Free printable reading comprehension worksheets</h1>
<p class="lead">Original passages with questions and a full answer key, written for ${esc(joinAnd(levelsSummary(list)))}. Read online or print the PDF. Each one builds the reading skills children are tested on, and there is no sign-up.</p>
${sections}
<h2>How to use them</h2>
<ul>
  <li>Let your child read the passage twice, then answer the questions in their own words.</li>
  <li>Mark with the answer key, but accept any sensible answer that is backed up by the text.</li>
  <li>Talk about one answer that went well and one to try again. Praise the evidence they used.</li>
</ul>
<p>Looking for something to write about instead? Try the <a href="/learn/prompts/">free writing prompt generator</a>, or read our ${guides} to see what children are working on.</p>
${ctx.ctaBlock("worksheets-hub", "Get feedback on your child's writing")}
<p class="small">${esc(COPYRIGHT)}</p>`;
  return layout({ title, description, canonical: hubUrl(), jsonld, body, css: EXTRA_CSS });
}

function buildWorksheetFiles(ctx) {
  const files = {};
  const urls = [];
  const list = published();
  if (!list.length) return { files, urls };
  files[hubPath()] = buildHubPage(ctx);
  urls.push(hubUrl());
  for (const s of list) {
    const siblings = list.filter((o) => o.region === s.region && o.year === s.year && o.id !== s.id);
    files[pagePath(s)] = buildSheetPage(s, ctx, siblings);
    urls.push(pageUrl(s));
  }
  return { files, urls };
}

// ------------------------------------------------------------------ print HTML (for the PDFs)
// US printers use Letter paper, so US sheets are Letter and everything else is A4.
const printCss = (s) => `
  @page{ size:${regionOf(s).paper}; margin:16mm 16mm 18mm; @bottom-center{ content:"Free from literacylabai.com/learn/worksheets/ · ${COPYRIGHT}"; font-family:Arial,sans-serif; font-size:7.5pt; color:#555; } }
  *{ box-sizing:border-box; }
  body{ font-family:Georgia,"Times New Roman",serif; font-size:12pt; line-height:1.55; color:#111; margin:0; }
  h1{ font-family:Arial,Helvetica,sans-serif; font-size:21pt; margin:0 0 4px; }
  h2{ font-family:Arial,Helvetica,sans-serif; font-size:13pt; margin:14px 0 6px; }
  .top{ display:flex; justify-content:space-between; font-family:Arial,sans-serif; font-size:10.5pt; margin-bottom:10px; }
  .top span{ display:inline-block; min-width:60mm; border-bottom:1px solid #111; padding-bottom:2px; }
  .sub{ font-family:Arial,sans-serif; font-size:10pt; color:#444; margin:0 0 10px; }
  .passage{ border:1px solid #bbb; border-radius:6px; padding:10px 14px; margin-bottom:12px; }
  .passage p{ margin:0 0 8px; }
  .passage h2{ margin:10px 0 4px; font-size:11.5pt; }
  .q{ page-break-inside:avoid; margin:0 0 12px; }
  .q p{ margin:0 0 3px; }
  .num{ font-family:Arial,sans-serif; font-weight:bold; }
  .mk{ font-family:Arial,sans-serif; font-size:9.5pt; color:#444; }
  .line{ border-bottom:1px solid #777; height:8.5mm; }
  .opt{ margin:1px 0 1px 8mm; }
  .box{ display:inline-block; width:7mm; height:7mm; border:1.3px solid #111; vertical-align:middle; margin-right:3mm; }
  .answerbox{ margin-top:3px; font-family:Arial,sans-serif; font-size:10.5pt; }
  .answerbox span{ display:inline-block; width:35mm; border-bottom:1px solid #111; }
  .wa{ border:1.5px dashed #555; border-radius:6px; padding:8px 12px; margin-top:10px; page-break-inside:avoid; }
  .foot{ margin-top:12px; font-family:Arial,sans-serif; font-size:9pt; color:#555; text-align:center; }
  .ans{ margin:0 0 8px; page-break-inside:avoid; }
  .ans p{ margin:0 0 2px; }
  .why{ font-family:Arial,sans-serif; font-size:9.5pt; color:#444; }
`;

function printQuestion(s) {
  return (q, i) => {
    const { stem, rest } = splitQuestion(q);
    const optionLetters = rest.length && rest.some((l) => /^[A-D]\./.test(l));
    let work;
    if (isBoxList(rest)) {
      work = rest.map((l) => `<div class="opt"><span class="box"></span>${esc(l.replace(/^•\s*/, ""))}</div>`).join("");
    } else if (/^Match/i.test(stem)) {
      // "Match each word to its meaning": one answer slot per numbered item.
      const items = (rest[0].match(/\d+\./g) || []).map((n) => n.replace(".", ""));
      work = rest.map((l) => `<div class="opt">${esc(l)}</div>`).join("") + `<div class="answerbox">${items.map((n) => `${n} = <span style="width:14mm"></span>`).join("&nbsp;&nbsp;&nbsp;")}</div>`;
    } else if (optionLetters) {
      work = rest.map((l) => `<div class="opt">${esc(l)}</div>`).join("") + `<div class="answerbox">Answer: <span></span></div>`;
    } else if (rest.length) {
      work = rest.map((l) => `<div class="opt">${esc(l)}</div>`).join("") + `<div class="answerbox">Answers: <span></span> <span></span> <span></span></div>`;
    } else {
      const lines = q.marks <= 1 ? 1 : q.marks === 2 ? 2 : 4;
      work = Array.from({ length: lines }, () => `<div class="line"></div>`).join("");
    }
    return `<div class="q"><p><span class="num">${i + 1}.</span> ${esc(stem)} <span class="mk">(${marksText(s, q.marks)})</span></p>${work}</div>`;
  };
}

function printWorksheetHtml(s) {
  return `<!DOCTYPE html><html lang="${regionOf(s).lang}"><head><meta charset="UTF-8"><title>${esc(s.title)}</title><style>${printCss(s)}</style></head><body>
<div class="top"><div>Name: <span></span></div><div>Date: <span style="min-width:35mm"></span></div></div>
<h1>${esc(s.title)}</h1>
<p class="sub">${esc(s.year)} reading comprehension · ${kindLabel(s)} · ${marksText(s, totalMarks(s))} · About ${minutesFor(s)} minutes</p>
<div class="passage">${passageHtml(s)}</div>
${s.questions.map(printQuestion(s)).join("")}
<div class="wa"><b>Writing task:</b> ${esc(s.writeAfter)}<div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div>
</body></html>`;
}

function printAnswersHtml(s) {
  return `<!DOCTYPE html><html lang="${regionOf(s).lang}"><head><meta charset="UTF-8"><title>${esc(s.title)}: answers</title><style>${printCss(s)}</style></head><body>
<h1>${esc(s.title)}: answers</h1>
<p class="sub">${esc(s.year)} · ${marksText(s, totalMarks(s))}. Accept any sensible answer that is backed up by the text.</p>
${s.questions.map((q, i) => `<div class="ans"><p><span class="num">${i + 1}.</span> ${esc(q.answer)} <span class="mk">(${marksText(s, q.marks)})</span></p><p class="why">${esc(skillLabel(q.type, s))}. ${esc(q.why)}</p></div>`).join("")}
</body></html>`;
}

module.exports = {
  SHEETS, REGION, published, buildWorksheetFiles, printWorksheetHtml, printAnswersHtml,
  pagePath, pageUrl, pdfPath, pdfUrl, hubUrl, hubPath, yearSlug, yearNum, ageRange, wordCount, totalMarks, minutesFor,
  skillLabel, skillCode, curriculumLink, anchorFor, joinAnd, levelsText, levelName, ordinal, regionOf, kindLabel, marksText, lastmodForUrl, isWorksheetUrl, added,
};
