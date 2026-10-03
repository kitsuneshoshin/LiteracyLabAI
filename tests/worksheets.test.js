// The free reading worksheets: content quality for every sheet (drafts too), and that only
// published sheets reach the site, with working pages, PDFs, sitemap entries and honest claims.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const W = require("../scripts/worksheets-pages");
const { buildAll } = require("../scripts/build-learn");
const { GRADE_MAPPED_TARGETS } = require("../api/_lib/masteryTargets");

const ROOT = path.join(__dirname, "..");
const SHEETS = W.SHEETS;
const TYPES = ["retrieval", "vocabulary", "inference", "explain", "order", "summary", "language", "opinion"];
const norm = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const passageText = (s) => s.passage.map((p) => (p.h ? p.h + " " : "") + p.p).join(" ");
const sentences = (s) => s.passage.map((p) => p.p).join(" ").split(/(?<=[.!?])["”]?\s+/).filter(Boolean);
// Quoted text that is deliberately NOT from the passage: a definition used in a question,
// an alternative answer we accept, or a worked example of a good answer.
const NOT_FROM_PASSAGE = ["flew up smoothly and powerfully", "wax tablets", "wonderful", "An owl has big eyes that let in lots of light, so it can see in the dark."];
const SENTENCE_CAP = { 3: 12, 4: 15, 5: 17, 6: 20 };
const WORDS = { 3: [150, 240], 4: [170, 270], 5: [260, 400], 6: [300, 480] };

test("there are twelve sheets, three for each of UK Years 3 to 6, with unique ids", () => {
  assert.equal(SHEETS.length, 12);
  assert.equal(new Set(SHEETS.map((s) => s.id)).size, 12);
  for (const y of [3, 4, 5, 6]) assert.equal(SHEETS.filter((s) => W.yearNum(s.year) === y).length, 3, `Year ${y}`);
  for (const s of SHEETS) {
    assert.equal(s.region, "uk");
    assert.match(s.id, /^[a-z0-9-]+$/);
  }
});

test("every sheet is complete: eight questions, answers, reasons, marks, a writing task and a real curriculum focus", () => {
  for (const s of SHEETS) {
    assert.equal(s.questions.length, 8, `${s.id}: eight questions`);
    assert.ok(s.passage.length >= 4, `${s.id}: passage`);
    assert.ok(s.blurb.length >= 60 && s.blurb.length <= 150, `${s.id}: blurb length ${s.blurb.length}`);
    assert.ok(s.writeAfter && s.writeAfter.length > 30, `${s.id}: writing task`);
    const names = (GRADE_MAPPED_TARGETS["🇬🇧 United Kingdom"][s.year] || []).map((t) => t.name);
    assert.ok(names.includes(s.target), `${s.id}: "${s.target}" is a real ${s.year} focus area`);
    for (const q of s.questions) {
      assert.ok(TYPES.includes(q.type), `${s.id}: type ${q.type}`);
      assert.ok(Number.isInteger(q.marks) && q.marks >= 1 && q.marks <= 3, `${s.id}: marks`);
      assert.ok(q.q.length > 15 && q.answer.length >= 1 && q.why.length > 30, `${s.id}: "${q.q.slice(0, 30)}" is thin`);
    }
  }
});

test("a sheet's id matches its title, so the web address always says what the sheet is", () => {
  const slug = (t) => t.toLowerCase().replace(/[‘’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  for (const s of SHEETS) assert.equal(s.id, slug(s.title), `${s.id} vs "${s.title}"`);
});

test("multiple-choice questions have options A to D, a valid single-letter answer, and the right answer is not always the same letter", () => {
  const letters = [];
  for (const s of SHEETS) {
    for (const q of s.questions.filter((x) => /\nA\./.test(x.q))) {
      assert.ok(/^[A-D]$/.test(q.answer) || /^\d = [A-C],/.test(q.answer) || /^[A-C]$/.test(q.answer), `${s.id}: multiple-choice answer "${q.answer}"`);
      if (/^[A-D]$/.test(q.answer)) {
        letters.push(q.answer);
        for (const l of ["A.", "B.", "C."]) assert.ok(q.q.includes(`\n${l}`), `${s.id}: option ${l}`);
      }
    }
  }
  assert.ok(letters.length >= 2 && new Set(letters).size > 1, `answers should vary: ${letters}`);
});

test("each sheet really practises the skill it is tagged with, and mixes question types", () => {
  for (const s of SHEETS) {
    const count = (types) => s.questions.filter((q) => types.includes(q.type)).length;
    if (W.yearNum(s.year) <= 4) assert.ok(count(["inference", "explain", "opinion"]) >= 2, `${s.id}: at least two inference-style questions`);
    else assert.ok(count(["summary"]) >= 1, `${s.id}: a summary question`);
    assert.ok(count(["retrieval"]) >= 1, `${s.id}: some retrieval`);
    assert.ok(new Set(s.questions.map((q) => q.type)).size >= 4, `${s.id}: at least four question types`);
    const marks = W.totalMarks(s);
    assert.ok(marks >= 10 && marks <= 16, `${s.id}: ${marks} marks`);
  }
});

test("passages are the right length and reading level for the year", () => {
  for (const s of SHEETS) {
    const y = W.yearNum(s.year);
    const words = W.wordCount(s);
    assert.ok(words >= WORDS[y][0] && words <= WORDS[y][1], `${s.id}: ${words} words is outside ${WORDS[y]}`);
    const avg = words / sentences(s).length;
    assert.ok(avg <= SENTENCE_CAP[y], `${s.id}: average sentence ${avg.toFixed(1)} words is too long for Year ${y}`);
  }
});

test("everything quoted in a question or answer is really in the passage, and copy-the-word answers are single words from it", () => {
  for (const s of SHEETS) {
    const p = norm(passageText(s));
    for (const q of s.questions) {
      for (const text of [q.q, q.answer]) {
        for (const m of text.match(/“[^”]+”/g) || []) {
          const raw = m.slice(1, -1);
          if (NOT_FROM_PASSAGE.includes(raw)) continue;
          assert.ok(p.includes(norm(raw).replace(/[.,!?]$/, "")), `${s.id}: quoted "${raw}" is not in the passage`);
        }
      }
      if (q.type === "vocabulary" && /find and copy/i.test(q.q)) {
        assert.ok(/^[A-Za-z']+$/.test(q.answer), `${s.id}: copy-the-word answer must be one word`);
        assert.ok(p.includes(q.answer.toLowerCase()), `${s.id}: "${q.answer}" is not in the passage`);
      }
    }
  }
});

test("British spelling and clean typography throughout", () => {
  for (const s of SHEETS) {
    const all = JSON.stringify(s);
    assert.ok(!/\b\w*(ize|izes|ized|izing|ization|color|favorite|neighbor|gray|center)\b/i.test(all.replace(/\b(size|sizes|prize|prizes)\b/gi, "")), `${s.id}: American spelling`);
    assert.ok(!/ {2}/.test(passageText(s)), `${s.id}: double space`);
    assert.ok(!/(^|\s)'|"/.test(s.passage.map((p) => p.p).join(" ")), `${s.id}: straight quotes in the passage (use curly quotes)`);
    assert.ok(!/\bTODO\b|lorem/i.test(all), `${s.id}: placeholder text`);
  }
});

test("no passage sentence is repeated across sheets, so sheets cannot be copies of each other", () => {
  const seen = new Map();
  for (const s of SHEETS) {
    for (const sentence of sentences(s)) {
      if (sentence.split(" ").length < 6) continue;
      assert.ok(!seen.has(sentence) || seen.get(sentence) === s.id, `"${sentence.slice(0, 40)}" appears in ${seen.get(sentence)} and ${s.id}`);
      seen.set(sentence, s.id);
    }
  }
});

// ------------------------------------------------------------------ what reaches the site
const { files, urls } = buildAll();
const publishedSheets = W.published();

test("only published sheets are built, and drafts can never reach the site", () => {
  assert.ok(publishedSheets.length >= 1);
  for (const s of SHEETS) {
    const built = files[W.pagePath(s)] !== undefined;
    assert.equal(built, !!s.published, `${s.id}: built=${built} but published=${!!s.published}`);
    assert.equal(fs.existsSync(path.join(ROOT, W.pagePath(s))), !!s.published, `${s.id}: file on disk matches published flag`);
    assert.equal(urls.includes(W.pageUrl(s)), !!s.published, `${s.id}: sitemap entry matches published flag`);
  }
});

test("each published sheet has both PDFs, committed and valid", () => {
  for (const s of publishedSheets) {
    for (const answers of [false, true]) {
      const file = path.join(ROOT, W.pdfPath(s, answers));
      assert.ok(fs.existsSync(file), `${s.id}: missing ${answers ? "answers" : "worksheet"} PDF (run node scripts/build-worksheet-pdfs.js)`);
      const buf = fs.readFileSync(file);
      assert.equal(buf.subarray(0, 5).toString(), "%PDF-", `${s.id}: not a PDF`);
      assert.ok(buf.length > 20000 && buf.length < 400000, `${s.id}: PDF size ${buf.length}`);
    }
  }
});

test("each sheet page has the passage, every question, an answer key, PDF links, the writing task and an honest free-trial call to action", () => {
  for (const s of publishedSheets) {
    const html = files[W.pagePath(s)];
    for (const p of s.passage) assert.ok(html.includes(p.p.replace(/&/g, "&amp;").replace(/"/g, "&quot;")) || html.includes(p.p), `${s.id}: passage text`);
    assert.equal((html.match(/<ol class="qs">[\s\S]*?<\/ol>/)[0].match(/<li>/g) || []).length, 8, `${s.id}: eight questions on the page`);
    assert.match(html, /Answer key for parents and teachers/);
    assert.ok(html.includes(`href="${W.pdfUrl(s)}"`) && html.includes(`href="${W.pdfUrl(s, true)}"`), `${s.id}: PDF links`);
    assert.ok(html.includes(s.writeAfter.replace(/'/g, "&#39;")) || html.includes(s.writeAfter), `${s.id}: writing task`);
    assert.match(html, /utm_medium=worksheet&amp;utm_campaign=worksheet-/);
    assert.match(html, /You mark the worksheet yourself/, "says plainly that the tool gives feedback on writing, not on these answers");
    assert.ok(!/noindex/.test(html));
    assert.match(html, /"@type":"LearningResource"/);
    assert.match(html, /isAccessibleForFree/);
  }
});

test("the worksheets hub lists every published sheet, and nothing else", () => {
  const hub = files[W.hubPath()];
  for (const s of SHEETS) assert.equal(hub.includes(`/${s.id}/`), !!s.published, `${s.id} on the hub`);
});

test("the guides link to the worksheets and the sitemap lists them", () => {
  assert.ok(files["learn/index.html"].includes('href="/learn/worksheets/"'), "guide hub links to the worksheets");
  const sitemap = files["sitemap.xml"];
  assert.ok(sitemap.includes(W.hubUrl()));
  for (const s of publishedSheets) assert.ok(sitemap.includes(`<loc>${W.pageUrl(s)}</loc>`), `${s.id} in sitemap`);
  // each published year's UK guide links to its worksheet
  for (const y of new Set(publishedSheets.map((s) => s.year))) {
    const key = Object.keys(files).find((k) => k === `learn/uk/${W.yearSlug(y)}/index.html`);
    assert.ok(key, `UK ${y} guide exists`);
    assert.ok(files[key].includes(`/learn/worksheets/uk/${W.yearSlug(y)}/`), `${y} guide links to a worksheet`);
  }
});

test("the print pages carry the writing task, answer lines and a copyright line, and the answer key has every answer", () => {
  for (const s of SHEETS) {
    const ws = W.printWorksheetHtml(s);
    assert.ok(ws.includes("Name:") && ws.includes("Writing task:") && /class="line"/.test(ws));
    // Answers may legitimately echo the passage, so look for them only after it.
    const afterPassage = ws.slice(ws.indexOf("</div>", ws.indexOf('class="passage"')));
    assert.ok(s.questions.every((q) => q.answer.length < 30 || !afterPassage.includes(q.answer.slice(0, 30))), `${s.id}: the student sheet must not contain the answers`);
    const key = W.printAnswersHtml(s);
    for (const q of s.questions) assert.ok(key.includes(q.answer.slice(0, 20).replace(/&/g, "&amp;").replace(/"/g, "&quot;")) || key.includes(q.answer.slice(0, 12)), `${s.id}: answer present in key`);
    assert.match(ws, /Free to print and copy/);
  }
});
