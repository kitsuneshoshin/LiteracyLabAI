// Builds the free printable reading worksheets: a hub, one web page per sheet (passage,
// questions, collapsed answer key, PDF links) and the print-only HTML that the PDF script
// turns into the worksheet and answer-key PDFs.
//
// Only sheets marked `published: true` in scripts/worksheets-content*.js are built, so a
// draft can never reach the live site by accident.
//
//   node scripts/build-learn.js           writes the pages (it calls this module)
//   node scripts/build-worksheet-pdfs.js  writes the PDFs with headless Chrome

const { SHEETS } = require("./worksheets-content");

const SITE = "https://www.literacylabai.com";
const WS_LASTMOD = "2026-10-03";
const COPYRIGHT = "Free to print and copy for your own family or classroom. Please do not sell or republish.";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const yearNum = (label) => Number(String(label).match(/(\d+)$/)[1]);
const yearSlug = (label) => `year-${yearNum(label)}`;
const ageRange = (label) => `ages ${yearNum(label) + 4} to ${yearNum(label) + 5}`;
const MINUTES = { 3: 15, 4: 20, 5: 25, 6: 30 };
const minutesFor = (label) => MINUTES[yearNum(label)] || 20;
const wordCount = (s) => s.passage.map((p) => p.p).join(" ").split(/\s+/).filter(Boolean).length;
const totalMarks = (s) => s.questions.reduce((a, q) => a + q.marks, 0);

// Plain-English skill for each question type. The codes are the national curriculum test
// framework's reading content domains; only the four we are certain of are labelled.
const SKILL = {
  retrieval: { name: "Finding information", code: "2b" },
  vocabulary: { name: "Word meaning", code: "2a" },
  summary: { name: "Summarising", code: "2c" },
  inference: { name: "Inference", code: "2d" },
  explain: { name: "Explaining from the text" },
  order: { name: "Sequencing events" },
  language: { name: "Language choices" },
  opinion: { name: "Giving a view with evidence" },
};
const skillLabel = (t) => (SKILL[t].code ? `${SKILL[t].name} (${SKILL[t].code})` : SKILL[t].name);

// Search results show about 160 characters, so cut at a word boundary rather than mid-word.
const fitDescription = (d) => (d.length <= 160 ? d : d.slice(0, 157).replace(/\s+\S*$/, "") + "...");

const published = () => SHEETS.filter((s) => s.published);
const pagePath = (s) => `learn/worksheets/${s.region}/${yearSlug(s.year)}/${s.id}/index.html`;
const pageUrl = (s) => `${SITE}/learn/worksheets/${s.region}/${yearSlug(s.year)}/${s.id}/`;
const pdfUrl = (s, answers) => `/learn/worksheets/${s.region}/${yearSlug(s.year)}/${s.id}/${s.id}${answers ? "-answers" : ""}.pdf`;
const pdfPath = (s, answers) => `learn/worksheets/${s.region}/${yearSlug(s.year)}/${s.id}/${s.id}${answers ? "-answers" : ""}.pdf`;
const hubUrl = () => `${SITE}/learn/worksheets/`;
const hubPath = () => "learn/worksheets/index.html";

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

function questionsHtml(s) {
  return `<ol class="qs">${s.questions.map((q) => {
    const { stem, rest } = splitQuestion(q);
    return `<li>${esc(stem)} <span class="marks">(${q.marks} mark${q.marks > 1 ? "s" : ""})</span>${rest.map((l) => `<span class="opt">${esc(l)}</span>`).join("")}</li>`;
  }).join("")}</ol>`;
}

function answerKeyHtml(s) {
  return s.questions.map((q, i) => `<div class="ans"><p><b>${i + 1}.</b> ${esc(q.answer)} <span class="marks">(${q.marks} mark${q.marks > 1 ? "s" : ""})</span></p><p class="why small"><b>${esc(skillLabel(q.type))}.</b> ${esc(q.why)}</p></div>`).join("");
}

function passageHtml(s) {
  return s.passage.map((p) => `${p.h ? `<h2>${esc(p.h)}</h2>` : ""}<p>${esc(p.p)}</p>`).join("");
}

function sheetCtaHtml(s) {
  return `<h2>Now try the writing task</h2>
<div class="wa"><p><b>${esc(s.writeAfter)}</b></p><p class="small">Aim for ${s.year === "Year 3" ? "five to eight" : "eight to twelve"} sentences. Read it back aloud together and fix anything that does not sound right.</p></div>
<section class="cta">
  <h2>Want feedback on your child's own writing?</h2>
  <p>You mark the worksheet yourself with the answer key. LiteracyLab AI is different: it reads what your child has written and gives specific feedback, such as what worked, one thing to try next, and a corrected version, matched to their year. The Free plan includes 3 pieces a month and needs no card.</p>
  <p><a class="btn" href="/app.html?utm_source=learn&amp;utm_medium=worksheet&amp;utm_campaign=worksheet-${esc(s.id)}">Try it free</a></p>
</section>`;
}

function buildSheetPage(s, ctx, siblings) {
  const { layout, breadcrumbLd } = ctx;
  const title = `${s.title}: free ${s.year} reading comprehension worksheet (printable PDF)`;
  const trimmed = title.length <= 72 ? title : `${s.title}: free ${s.year} reading worksheet (PDF)`;
  const description = fitDescription(`${s.blurb} Free printable PDF with answers.`);
  const crumbs = [["Home", `${SITE}/`], ["Guides", `${SITE}/learn/`], ["Worksheets", hubUrl()], [s.year, `${hubUrl()}#${yearSlug(s.year)}`], [s.title, pageUrl(s)]];
  const skills = [...new Set(s.questions.map((q) => skillLabel(q.type)))];
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "LearningResource", name: trimmed, description, url: pageUrl(s), inLanguage: "en-GB", learningResourceType: "Worksheet", educationalLevel: s.year, typicalAgeRange: `${yearNum(s.year) + 4}-${yearNum(s.year) + 5}`, teaches: "Reading comprehension", isAccessibleForFree: true, dateModified: WS_LASTMOD, author: { "@type": "Organization", name: "LiteracyLab AI" }, publisher: { "@type": "Organization", name: "LiteracyLab AI", url: SITE } },
    breadcrumbLd(crumbs),
  ] };
  const more = siblings.length ? `<h2>More ${esc(s.year)} worksheets</h2><ul>${siblings.map((o) => `<li><a href="/learn/worksheets/${o.region}/${yearSlug(o.year)}/${o.id}/">${esc(o.title)}</a></li>`).join("")}</ul>` : "";
  const body = `<div class="crumbs"><a href="/">Home</a> › <a href="/learn/">Guides</a> › <a href="/learn/worksheets/">Worksheets</a> › ${esc(s.title)}</div>
<h1>${esc(s.title)}</h1>
<p class="lead">${esc(s.blurb)}</p>
<p class="meta"><span><b>${esc(s.year)}</b> (${esc(ageRange(s.year))})</span><span>${s.kind === "story" ? "Story" : "Information text"}</span><span>About ${minutesFor(s.year)} minutes</span><span>${totalMarks(s)} marks</span><span>${wordCount(s)} words</span></p>
<div class="dl"><a class="btn" href="${pdfUrl(s)}" download>Download the worksheet (PDF)</a><a class="btn alt" href="${pdfUrl(s, true)}" download>Download the answers (PDF)</a></div>
<h2>Read the passage</h2>
<div class="passage">${passageHtml(s)}</div>
<h2>Answer the questions</h2>
${questionsHtml(s)}
<details class="key"><summary>Answer key for parents and teachers</summary>${answerKeyHtml(s)}</details>
<h2>What this practises</h2>
<p>${esc(skills.join(", "))}. The codes in brackets are the reading content domains from the national curriculum test framework. Marks and answers are a guide: accept any sensible answer that is backed up by the text.</p>
${sheetCtaHtml(s)}
${more}
<p class="small">${esc(COPYRIGHT)} The passage and questions were written for LiteracyLab AI.</p>`;
  return layout({ title: trimmed, description, canonical: pageUrl(s), jsonld, body, css: EXTRA_CSS });
}

function buildHubPage(ctx) {
  const { layout, breadcrumbLd } = ctx;
  const list = published();
  const title = "Free printable reading comprehension worksheets, Years 3 to 6 (UK)";
  const description = "Free printable reading comprehension worksheets for UK Years 3 to 6: original passages, questions and answer keys, in PDF. No sign-up needed.";
  const years = [...new Set(list.map((s) => s.year))].sort((a, b) => yearNum(a) - yearNum(b));
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", name: title, description, url: hubUrl(), inLanguage: "en-GB", dateModified: WS_LASTMOD },
    breadcrumbLd([["Home", `${SITE}/`], ["Guides", `${SITE}/learn/`], ["Worksheets", hubUrl()]]),
  ] };
  const groups = years.map((y) => `<h2 id="${yearSlug(y)}">${esc(y)} (${esc(ageRange(y))})</h2>
<ul class="grid">${list.filter((s) => s.year === y).map((s) => `<li><a href="/learn/worksheets/${s.region}/${yearSlug(s.year)}/${s.id}/">${esc(s.title)}<small>${s.kind === "story" ? "Story" : "Information text"} · ${totalMarks(s)} marks</small></a></li>`).join("")}</ul>`).join("\n");
  const body = `<div class="crumbs"><a href="/">Home</a> › <a href="/learn/">Guides</a> › Worksheets</div>
<h1>Free printable reading comprehension worksheets</h1>
<p class="lead">Original passages with questions and a full answer key, written for UK Years 3 to 6. Read online or print the PDF. Each one practises the reading skills children are tested on, and there is no sign-up.</p>
${groups}
<h2>How to use them</h2>
<ul>
  <li>Let your child read the passage twice, then answer the questions in their own words.</li>
  <li>Mark with the answer key, but accept any sensible answer that is backed up by the text.</li>
  <li>Talk about one answer that went well and one to try again. Praise the evidence they used.</li>
</ul>
<p>Looking for something to write about instead? Try the <a href="/learn/prompts/">free writing prompt generator</a>, or read our <a href="/learn/uk/">year-by-year UK guides</a> to see what children are working on.</p>
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
    const siblings = list.filter((o) => o.year === s.year && o.id !== s.id);
    files[pagePath(s)] = buildSheetPage(s, ctx, siblings);
    urls.push(pageUrl(s));
  }
  return { files, urls };
}

// ------------------------------------------------------------------ print HTML (for the PDFs)
const PRINT_CSS = `
  @page{ size:A4; margin:16mm 16mm 18mm; }
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

function printQuestion(q, i) {
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
  return `<div class="q"><p><span class="num">${i + 1}.</span> ${esc(stem)} <span class="mk">(${q.marks} mark${q.marks > 1 ? "s" : ""})</span></p>${work}</div>`;
}

function printWorksheetHtml(s) {
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"><title>${esc(s.title)}</title><style>${PRINT_CSS}</style></head><body>
<div class="top"><div>Name: <span></span></div><div>Date: <span style="min-width:35mm"></span></div></div>
<h1>${esc(s.title)}</h1>
<p class="sub">${esc(s.year)} reading comprehension · ${s.kind === "story" ? "Story" : "Information text"} · ${totalMarks(s)} marks · About ${minutesFor(s.year)} minutes</p>
<div class="passage">${passageHtml(s)}</div>
${s.questions.map(printQuestion).join("")}
<div class="wa"><b>Writing task:</b> ${esc(s.writeAfter)}<div class="line"></div><div class="line"></div><div class="line"></div><div class="line"></div></div>
<p class="foot">Free from literacylabai.com/learn/worksheets/ · ${esc(COPYRIGHT)}</p>
</body></html>`;
}

function printAnswersHtml(s) {
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"><title>${esc(s.title)}: answers</title><style>${PRINT_CSS}</style></head><body>
<h1>${esc(s.title)}: answers</h1>
<p class="sub">${esc(s.year)} · ${totalMarks(s)} marks. Accept any sensible answer that is backed up by the text.</p>
${s.questions.map((q, i) => `<div class="ans"><p><span class="num">${i + 1}.</span> ${esc(q.answer)} <span class="mk">(${q.marks} mark${q.marks > 1 ? "s" : ""})</span></p><p class="why">${esc(skillLabel(q.type))}. ${esc(q.why)}</p></div>`).join("")}
<p class="foot">Free from literacylabai.com/learn/worksheets/ · ${esc(COPYRIGHT)}</p>
</body></html>`;
}

module.exports = {
  SHEETS, published, buildWorksheetFiles, printWorksheetHtml, printAnswersHtml,
  pagePath, pageUrl, pdfPath, pdfUrl, hubUrl, hubPath, yearSlug, yearNum, ageRange, wordCount, totalMarks, minutesFor, skillLabel, WS_LASTMOD,
};
