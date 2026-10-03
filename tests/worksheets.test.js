// The free reading worksheets (UK Years 3 to 6 and US Grades 3 to 6): content quality for every
// sheet (drafts too), and that only published sheets reach the site, with working pages, PDFs,
// sitemap entries and honest claims. Country-specific rules are checked per country.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const W = require("../scripts/worksheets-pages");
const { buildAll } = require("../scripts/build-learn");
const { GRADE_MAPPED_TARGETS } = require("../api/_lib/masteryTargets");

const ROOT = path.join(__dirname, "..");
const SHEETS = W.SHEETS;
const TYPES = ["retrieval", "vocabulary", "inference", "explain", "order", "summary", "language", "opinion", "quote"];
const COUNTRY_KEY = Object.fromEntries(Object.entries(W.REGION).map(([k, r]) => [k, r.countryKey]));
const PER_LEVEL = { uk: 3, us: 2, australia: 2 };
const norm = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
const passageText = (s) => s.passage.map((p) => (p.h ? p.h + " " : "") + p.p).join(" ");
const sentences = (s) => s.passage.map((p) => p.p).join(" ").split(/(?<=[.!?])["”]?\s+/).filter(Boolean);
const of = (region) => SHEETS.filter((s) => s.region === region);
// Quoted text that is deliberately NOT from the passage: a definition used in a question,
// an alternative answer we accept, or a worked example of a good answer.
const NOT_FROM_PASSAGE = ["flew up smoothly and powerfully", "wax tablets", "wonderful", "An owl has big eyes that let in lots of light, so it can see in the dark."];
// A UK Year 4 child (8 to 9) reads at about a US Grade 3 level, so the bands step up accordingly.
const SENTENCE_CAP = { uk: { 3: 12, 4: 15, 5: 17, 6: 20 }, us: { 3: 15, 4: 17, 5: 19, 6: 20 }, australia: { 3: 15, 4: 17, 5: 19, 6: 20 } };
const WORDS = { uk: { 3: [150, 240], 4: [170, 270], 5: [260, 400], 6: [300, 480] }, us: { 3: [170, 270], 4: [250, 380], 5: [280, 420], 6: [300, 480] }, australia: { 3: [170, 270], 4: [250, 380], 5: [280, 420], 6: [300, 480] } };

test("the sheets: UK Years 3 to 6 (three each), US Grades 3 to 6 and Australian Years 3 to 6 (two each), all with unique ids", () => {
  assert.equal(SHEETS.length, 12 + 8 + 8);
  assert.equal(new Set(SHEETS.map((s) => s.id)).size, SHEETS.length);
  for (const region of ["uk", "us", "australia"]) {
    for (const y of [3, 4, 5, 6]) assert.equal(of(region).filter((s) => W.yearNum(s.year) === y).length, PER_LEVEL[region], `${region} ${y}`);
    for (const s of of(region)) assert.equal(s.year, `${W.REGION[region].gradeWord} ${W.yearNum(s.year)}`, `${s.id}: level label`);
  }
  for (const s of SHEETS) assert.match(s.id, /^[a-z0-9-]+$/);
});

test("every sheet is complete: eight questions, answers, reasons, points, a writing task and a real curriculum focus", () => {
  for (const s of SHEETS) {
    assert.equal(s.questions.length, 8, `${s.id}: eight questions`);
    assert.ok(s.passage.length >= 4, `${s.id}: passage`);
    assert.ok(s.blurb.length >= 60 && s.blurb.length <= 150, `${s.id}: blurb length ${s.blurb.length}`);
    assert.ok(s.writeAfter && s.writeAfter.length > 30, `${s.id}: writing task`);
    const names = (GRADE_MAPPED_TARGETS[COUNTRY_KEY[s.region]][s.year] || []).map((t) => t.name);
    assert.ok(names.includes(s.target), `${s.id}: "${s.target}" is a real ${s.region} ${s.year} focus area`);
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

test("multiple-choice questions have options A to D or A to C, a valid single-letter answer, and the right answer is not always the same letter", () => {
  const letters = [];
  for (const s of SHEETS) {
    for (const q of s.questions.filter((x) => /\nA\./.test(x.q))) {
      assert.ok(/^[A-D]$/.test(q.answer) || /^\d = [A-C],/.test(q.answer), `${s.id}: multiple-choice answer "${q.answer}"`);
      if (/^[A-D]$/.test(q.answer)) {
        letters.push(q.answer);
        for (const l of ["A.", "B.", "C."]) assert.ok(q.q.includes(`\n${l}`), `${s.id}: option ${l}`);
        assert.ok(q.q.includes(`\n${q.answer}.`), `${s.id}: the answer letter ${q.answer} is one of the options`);
      }
    }
  }
  assert.ok(letters.length >= 4 && new Set(letters).size >= 3, `answers should vary: ${letters}`);
});

test("UK sheets practise the skill they are tagged with, and every sheet mixes question types", () => {
  for (const s of SHEETS) {
    const count = (types) => s.questions.filter((q) => types.includes(q.type)).length;
    assert.ok(count(["retrieval"]) >= 1, `${s.id}: some retrieval`);
    assert.ok(new Set(s.questions.map((q) => q.type)).size >= 4, `${s.id}: at least four question types`);
    const marks = W.totalMarks(s);
    assert.ok(marks >= 10 && marks <= 16, `${s.id}: ${marks} points`);
    if (s.region !== "uk") continue;
    if (W.yearNum(s.year) <= 4) assert.ok(count(["inference", "explain", "opinion"]) >= 2, `${s.id}: at least two inference-style questions`);
    else assert.ok(count(["summary"]) >= 1, `${s.id}: a summary question`);
  }
});

test("US sheets practise their grade's Common Core reading focus (the app's own focus area for that grade)", () => {
  for (const s of of("us")) {
    const count = (types) => s.questions.filter((q) => types.includes(q.type)).length;
    const n = W.yearNum(s.year);
    if (n === 3) assert.ok(count(["retrieval"]) >= 3, `${s.id}: Grade 3 refers explicitly to the text, so at least three find-it questions`);
    if (n === 4) assert.ok(count(["inference"]) >= 3, `${s.id}: Grade 4 is inference, so at least three inference questions`);
    if (n === 5) assert.ok(count(["quote"]) >= 2, `${s.id}: Grade 5 quotes accurately, so at least two quote questions`);
    if (n === 6) {
      assert.ok(count(["quote"]) >= 1, `${s.id}: Grade 6 cites evidence, so a quote question`);
      assert.ok(count(["inference", "explain"]) >= 2, `${s.id}: Grade 6 needs evidence-based inference or explanation`);
      assert.ok(s.questions.filter((q) => /cite|evidence|quote/i.test(q.q)).length >= 3, `${s.id}: at least three questions ask for evidence`);
    }
    assert.ok(count(["summary"]) >= 1, `${s.id}: a summary or main-idea question`);
  }
});

test("Australian sheets practise comprehension strategies: finding, inferring, word meaning, language or prediction, and summarising", () => {
  for (const s of of("australia")) {
    const count = (types) => s.questions.filter((q) => types.includes(q.type)).length;
    assert.ok(count(["retrieval"]) >= 1, `${s.id}: finding information`);
    assert.ok(count(["inference", "explain"]) >= 2, `${s.id}: at least two questions that need the reader to infer or explain`);
    assert.ok(count(["vocabulary"]) >= 1, `${s.id}: word meaning`);
    assert.ok(count(["summary"]) >= 1, `${s.id}: summarising`);
    assert.ok(count(["language", "opinion", "order", "quote"]) >= 1, `${s.id}: language, prediction, sequencing or quoting`);
  }
});

test("quote questions ask for quotation marks and their model answers are real, exact quotes from the passage", () => {
  for (const s of SHEETS) {
    const p = norm(passageText(s));
    for (const q of s.questions.filter((x) => x.type === "quote")) {
      assert.ok(/quotation marks|quote|exact/i.test(q.q), `${s.id}: quote question should say what to copy`);
      const quotes = q.answer.match(/“[^”]+”/g) || [];
      assert.ok(quotes.length >= 1, `${s.id}: the model answer to a quote question needs a “quote”`);
      for (const m of quotes) assert.ok(p.includes(norm(m.slice(1, -1)).replace(/[.,!?]$/, "")), `${s.id}: ${m} is not exact`);
    }
  }
});

test("passages are the right length and reading level for the grade", () => {
  for (const s of SHEETS) {
    const y = W.yearNum(s.year);
    const words = W.wordCount(s);
    const [lo, hi] = WORDS[s.region][y];
    assert.ok(words >= lo && words <= hi, `${s.id}: ${words} words is outside ${lo}-${hi}`);
    const avg = words / sentences(s).length;
    assert.ok(avg <= SENTENCE_CAP[s.region][y], `${s.id}: average sentence ${avg.toFixed(1)} words is too long for ${s.year}`);
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

test("British spelling in UK sheets, American spelling in US sheets, and clean typography in all", () => {
  // Words that are British-only (or American-only). "size" and "prize" end in -ize in both.
  const AMERICAN = /\b\w*(ize|izes|ized|izing|ization|color|favorite|neighbor|gray|center)\b/i;
  const BRITISH = /\b(colour\w*|favour\w*|neighbour\w*|grey\w*|centre\w*|metre\w*|litre\w*|realis\w*|organis\w*|recognis\w*|summaris\w*|practis\w*|travell\w*|labour\w*|honour\w*|behaviour\w*|cheque|pyjamas|mum|mummy|grandad|tyre|kerb|plough|storey|learnt|spelt|whilst|towards|programme|jewellery|aluminium|mould|cosy)\b/i;
  for (const s of SHEETS) {
    const all = JSON.stringify(s).replace(/\b(size|sizes|prize|prizes)\b/gi, "");
    if (s.region !== "us") assert.ok(!AMERICAN.test(all) && !/\bmom\b/i.test(all), `${s.id}: American spelling in a ${s.region} sheet`);
    else {
      assert.ok(!BRITISH.test(all), `${s.id}: British spelling in a US sheet: ${(all.match(BRITISH) || [])[0]}`);
      assert.ok(!/\b(Mr|Mrs|Ms|Dr)\s/.test(passageText(s)), `${s.id}: US titles take a period (Mr. Mrs. Ms. Dr.)`);
    }
    assert.ok(!/ {2}/.test(passageText(s)), `${s.id}: double space`);
    assert.ok(!/(^|\s)'|"/.test(s.passage.map((p) => p.p).join(" ")), `${s.id}: straight quotes in the passage (use curly quotes)`);
    assert.ok(!/\bTODO\b|lorem/i.test(all), `${s.id}: placeholder text`);
  }
});

test("US dates and numbers follow American usage", () => {
  for (const s of of("us")) {
    const text = JSON.stringify(s);
    assert.ok(!/\b\d{1,2}(st|nd|rd|th)? (January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(text), `${s.id}: write dates as Month Day (July 20), not 20 July`);
  }
});

test("UK and Australian dates are written day first (20 July), never the American way", () => {
  for (const s of SHEETS.filter((x) => x.region !== "us")) {
    const text = JSON.stringify(s);
    assert.ok(!/\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/.test(text), `${s.id}: write dates day first, as in 8 June 1951`);
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

test("character names are not reused across stories, so a family reading several sheets does not see the same child twice", () => {
  const stories = SHEETS.filter((s) => s.kind === "story");
  const owner = new Map();
  for (const s of stories) {
    // First word of a sentence is skipped, so only names mid-sentence or in dialogue tags count.
    const names = new Set((s.passage.map((p) => p.p).join(" ").match(/(?<=[a-z,] )[A-Z][a-z]{2,}\b/g) || []).filter((w) => !["Mrs", "The", "Then", "Soon", "Now", "She", "He", "They", "Maple", "Park", "Oregon", "Japan", "Yokohama", "Saturday", "Hawks", "Wick", "London", "Pudding"].includes(w)));
    for (const n of names) {
      if (owner.has(n) && owner.get(n) !== s.id) assert.fail(`${n} appears in both ${owner.get(n)} and ${s.id}`);
      owner.set(n, s.id);
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

test("each published sheet has both PDFs, committed, valid and on the right paper size (A4 for UK, Letter for US)", () => {
  const SIZES = { A4: [595, 842], Letter: [612, 792] };
  for (const s of publishedSheets) {
    for (const answers of [false, true]) {
      const file = path.join(ROOT, W.pdfPath(s, answers));
      assert.ok(fs.existsSync(file), `${s.id}: missing ${answers ? "answers" : "worksheet"} PDF (run node scripts/build-worksheet-pdfs.js)`);
      const buf = fs.readFileSync(file);
      assert.equal(buf.subarray(0, 5).toString(), "%PDF-", `${s.id}: not a PDF`);
      assert.ok(buf.length > 20000 && buf.length < 400000, `${s.id}: PDF size ${buf.length}`);
      const box = buf.toString("latin1").match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
      assert.ok(box, `${s.id}: PDF has no page size`);
      const [w, h] = SIZES[W.regionOf(s).paper];
      assert.ok(Math.abs(Number(box[1]) - w) < 2 && Math.abs(Number(box[2]) - h) < 2, `${s.id}: page is ${box[1]}x${box[2]}, expected ${W.regionOf(s).paper} (${w}x${h})`);
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
    assert.ok(html.includes(`"inLanguage":"${W.regionOf(s).lang}"`), `${s.id}: structured data language`);
  }
});

test("page wording matches the country: points and Common Core (US), marks and the national framework (UK), marks and the Australian Curriculum (Australia)", () => {
  for (const s of publishedSheets) {
    const html = files[W.pagePath(s)];
    const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    if (s.region === "us") {
      assert.match(text, /\d+ points?\b/, `${s.id}: points`);
      assert.ok(!/\b\d+ marks?\b/.test(text), `${s.id}: a US page should not say marks`);
      assert.match(text, /Common Core State Standards/);
      assert.match(text, /What this practices/);
      assert.match(text, /matched to their grade/);
      assert.match(text, /Informational text|Story/);
      assert.ok(!/\bRL\.\d|RI\.\d/.test(text) || /\((RL|RI)\.\d\.\d\)/.test(text), `${s.id}: standards codes look right`);
    } else if (s.region === "australia") {
      assert.match(text, /\d+ marks?\b/, `${s.id}: marks`);
      assert.ok(!/\b\d+ points?\b/.test(text), `${s.id}: an Australian page should not say points`);
      assert.match(text, /This sheet links to Comprehension Strategies \(AC9E[3-6]LY05\)/);
      assert.match(text, /Australian Curriculum \(version 9\)/);
      assert.match(text, /What this practises/);
      assert.match(text, /matched to their year/);
      assert.ok(!/Common Core|national curriculum test framework/.test(text), `${s.id}: wrong curriculum named`);
    } else {
      assert.match(text, /\d+ marks?\b/, `${s.id}: marks`);
      assert.ok(!/\b\d+ points?\b/.test(text), `${s.id}: a UK page should not say points`);
      assert.match(text, /national curriculum test framework/);
      assert.match(text, /What this practises/);
      assert.match(text, /matched to their year/);
    }
  }
});

test("Common Core and UK skill codes: stories use RL, informational text uses RI, and only skills we are sure of are labelled", () => {
  const us = (kind, grade, type) => W.skillCode(type, { region: "us", kind, year: `Grade ${grade}` });
  assert.equal(us("story", 4, "retrieval"), "RL.4.1");
  assert.equal(us("non-fiction", 4, "retrieval"), "RI.4.1");
  assert.equal(us("story", 3, "vocabulary"), "RL.3.4");
  assert.equal(us("non-fiction", 6, "summary"), "RI.6.2");
  assert.equal(us("story", 5, "quote"), "RL.5.1");
  assert.equal(us("story", 3, "inference"), null, "Grade 3 has no inference standard, so no code");
  assert.equal(us("story", 4, "inference"), "RL.4.1");
  assert.equal(us("story", 3, "order"), null);
  assert.equal(us("story", 6, "opinion"), null);
  const uk = (type) => W.skillCode(type, { region: "uk", kind: "story", year: "Year 4" });
  assert.deepEqual(["retrieval", "vocabulary", "summary", "inference", "order"].map(uk), ["2b", "2a", "2c", "2d", null]);
  const au = (type) => W.skillCode(type, { region: "australia", kind: "story", year: "Year 4" });
  assert.deepEqual(["retrieval", "vocabulary", "summary", "inference"].map(au), [null, null, null, null], "Australia is linked once per sheet, not per question");
  assert.equal(W.curriculumLink({ region: "australia", year: "Year 5", target: "Comprehension Strategies" }), "Comprehension Strategies (AC9E5LY05)");
});

test("the worksheets hub lists every published sheet, in country sections, and nothing else", () => {
  const hub = files[W.hubPath()];
  for (const s of SHEETS) assert.equal(hub.includes(`/${s.id}/`), !!s.published, `${s.id} on the hub`);
  for (const region of new Set(publishedSheets.map((s) => s.region))) assert.ok(hub.includes(`id="${region}"`), `${region} section`);
  const present = [...new Set(publishedSheets.map((s) => s.region))].sort((x, y) => W.REGION[x].order - W.REGION[y].order);
  if (present.length > 1) {
    for (const k of present) assert.ok(hub.includes(`${W.REGION[k].short} ${W.REGION[k].levels.replace(" to ", "\u2013")}`), `${k} named in the hub intro`);
    const at = present.map((k) => hub.indexOf(`id="${k}"`));
    assert.deepEqual([...at].sort((x, y) => x - y), at, "country sections in order: UK, US, Australia");
  }
  for (const s of publishedSheets) assert.ok(hub.includes(`id="${W.anchorFor(s)}"`), `${s.year} anchor`);
  const ids = [...hub.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, `hub ids must be unique (Australian Year 3 must not clash with UK Year 3): ${ids}`);
});

test("the guides link to the worksheets and the sitemap lists them with their own dates", () => {
  assert.ok(files["learn/index.html"].includes('href="/learn/worksheets/"'), "guide hub links to the worksheets");
  assert.ok(files["learn/index.html"].includes(W.levelsText()), "the guide hub names the countries that have sheets");
  const sitemap = files["sitemap.xml"];
  assert.ok(sitemap.includes(W.hubUrl()));
  for (const s of publishedSheets) {
    assert.ok(sitemap.includes(`<loc>${W.pageUrl(s)}</loc>`), `${s.id} in sitemap`);
    const entry = sitemap.match(new RegExp(`<loc>${W.pageUrl(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>\\s*<lastmod>([^<]+)</lastmod>`));
    assert.equal(entry[1], W.added(s), `${s.id}: sitemap date is the sheet's own date`);
  }
  // each published level's own country guide links to its worksheet
  for (const { region, year } of new Map(publishedSheets.map((s) => [`${s.region}/${s.year}`, s])).values()) {
    const key = `learn/${region}/${W.yearSlug(year)}/index.html`;
    assert.ok(files[key], `${region} ${year} guide exists`);
    assert.ok(files[key].includes(`/learn/worksheets/${region}/${W.yearSlug(year)}/`), `${region} ${year} guide links to a worksheet`);
  }
});

test("the print pages carry the writing task, answer lines, the right paper size and a copyright line, and the answer key has every answer", () => {
  for (const s of SHEETS) {
    const ws = W.printWorksheetHtml(s);
    assert.ok(ws.includes("Name:") && ws.includes("Writing task:") && /class="line"/.test(ws));
    assert.ok(ws.includes(`size:${W.regionOf(s).paper};`), `${s.id}: @page size ${W.regionOf(s).paper}`);
    // Answers may legitimately echo the passage, so look for them only after it.
    const afterPassage = ws.slice(ws.indexOf("</div>", ws.indexOf('class="passage"')));
    assert.ok(s.questions.every((q) => q.answer.length < 30 || !afterPassage.includes(q.answer.slice(0, 30))), `${s.id}: the student sheet must not contain the answers`);
    const key = W.printAnswersHtml(s);
    for (const q of s.questions) assert.ok(key.includes(q.answer.slice(0, 20).replace(/&/g, "&amp;").replace(/"/g, "&quot;")) || key.includes(q.answer.slice(0, 12)), `${s.id}: answer present in key`);
    assert.match(ws, /Free to print and copy/);
    assert.ok(ws.includes(`(${W.marksText(s, s.questions[0].marks)})`), `${s.id}: print uses ${W.regionOf(s).unit}s`);
    assert.ok(ws.includes(`lang="${W.regionOf(s).lang}"`));
  }
});

test("the matching and multiple-choice print layouts give one answer slot per item", () => {
  const rain = SHEETS.find((s) => s.id === "where-does-rain-come-from");
  const html = W.printWorksheetHtml(rain);
  assert.match(html, /1 = <span[^>]*><\/span>[\s\S]*2 = <span[^>]*><\/span>[\s\S]*3 = <span/);
});

test("pins respect Pinterest's limits and match the country: title 100, description 500, board name 50, tracked link", () => {
  const pins = require("../scripts/build-pins");
  const boards = new Map();
  for (const s of SHEETS) {
    const title = pins.pinTitle(s), desc = pins.pinDescription(s), board = pins.pinBoard(s), link = pins.pinLink(s);
    assert.ok(title.length <= 100, `${s.id}: pin title ${title.length}`);
    assert.ok(desc.length <= 500, `${s.id}: pin description ${desc.length}`);
    assert.ok(board.length <= 50, `${s.id}: board name "${board}" is ${board.length}`);
    assert.match(link, /^https:\/\/www\.literacylabai\.com\/learn\/worksheets\/(uk|us|australia)\/[a-z0-9-]+\/[a-z0-9-]+\/\?utm_source=pinterest&utm_medium=social&utm_campaign=pin-/);
    assert.ok(link.includes(`/${s.region}/`) && link.includes(`/${s.id}/`));
    assert.ok((desc.match(/#\w+/g) || []).length >= 3 && (desc.match(/#\w+/g) || []).length <= 6, `${s.id}: hashtags`);
    if (s.region === "us") {
      assert.match(title, /Free \dth Grade|Free 3rd Grade/);
      assert.match(desc, /#commoncore/);
      assert.ok(!/practise|revision|homeschooluk|ks2|\bUK\b|colour/i.test(desc), `${s.id}: US pin has UK wording`);
    } else if (s.region === "australia") {
      assert.match(title, /^Free Australian Year [3-6] Reading Comprehension: /);
      assert.match(desc, /#homeschoolaustralia/);
      assert.ok(!/commoncore|homeschooluk|ks2|homework, review|\bUK\b/i.test(desc), `${s.id}: Australian pin has UK or US wording`);
      assert.ok(pins.pinBoard(s).startsWith("Australian Year "), "Australian boards are named so they do not clash with the UK boards");
    } else {
      assert.match(desc, /#homeschooluk/);
      assert.ok(!/commoncore|homework, review/i.test(desc), `${s.id}: UK pin has US wording`);
    }
    boards.set(board, (boards.get(board) || 0) + 1);
  }
  assert.equal(boards.size, 12, "one board per country and year: UK, US and Australia, Years/Grades 3-6");
});

test("answer keys mirror the question: every put-in-order answer uses exactly the listed steps in a clear 1-to-n order", () => {
  const clean = (t) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  for (const s of SHEETS) {
    for (const q of s.questions.filter((x) => x.type === "order")) {
      const items = q.q.split("\n").slice(1).map((l) => clean(l.replace(/^•\s*/, "")));
      const ans = q.answer.split(/\s*\d\.\s*/).filter(Boolean).map(clean);
      assert.deepEqual([...ans].sort(), [...items].sort(), `${s.id}: the answer must use the listed steps word for word`);
      assert.deepEqual([...q.answer.matchAll(/(\d)\./g)].map((m) => Number(m[1])), items.map((_, i) => i + 1), `${s.id}: numbered 1 to ${items.length}`);
    }
  }
});

test("a multiple-choice question never gives the answer away by length: the right option is not the only longest one", () => {
  for (const s of SHEETS) {
    for (const q of s.questions.filter((x) => /\nA\./.test(x.q) && /^[A-D]$/.test(x.answer))) {
      const opts = q.q.split("\n").slice(1).filter((l) => /^[A-D]\./.test(l));
      const lens = opts.map((l) => l.length);
      const max = Math.max(...lens);
      const correct = opts.find((l) => l.startsWith(q.answer + "."));
      assert.ok(!(correct.length === max && lens.filter((n) => n === max).length === 1), `${s.id}: the correct option "${correct.slice(0, 40)}…" is the only longest one`);
    }
  }
});

test("no doubled words, unbalanced quotation marks or stray spaces in any sheet", () => {
  for (const s of SHEETS) {
    for (const t of [...s.passage.map((p) => p.p), ...s.questions.flatMap((q) => [q.q, q.answer, q.why]), s.blurb, s.writeAfter]) {
      assert.ok(!/\b([A-Za-z]{2,})\s+\1\b/i.test(t), `${s.id}: doubled word in "${t.slice(0, 50)}…"`);
      assert.equal((t.match(/“/g) || []).length, (t.match(/”/g) || []).length, `${s.id}: unbalanced quotes in "${t.slice(0, 50)}…"`);
      assert.ok(!/\s[,.;:!?]/.test(t) && t === t.trim(), `${s.id}: stray space in "${t.slice(0, 50)}…"`);
    }
    for (const p of s.passage) assert.match(p.p.trim(), /[.!?”]$/, `${s.id}: a paragraph ends without punctuation`);
  }
});
