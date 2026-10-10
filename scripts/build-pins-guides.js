// Makes Pinterest pin images (1000x1500) for the exam and parent guide pages (NAPLAN, SATs, 11+, IGCSE, Common Core,
// AI safety), plus pins-guides.txt with each pin's title, description, link and board, ready to paste.
//
//   node scripts/build-pins-guides.js [output folder]
//
// Same look as the worksheet pins (scripts/build-pins.js). Every line on a pin is something the page really says; no
// guarantees, no scores promised. The folder is outside the repo because pins are marketing material, not site files.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const OUT = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(os.homedir(), "OneDrive", "Documents", "LiteracyLab-pinterest");
const findChrome = () => [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => p && fs.existsSync(p));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const WINE = "#7A3B45", GREEN = "#3F4A3D";

const PINS = [
  {
    id: "naplan-writing-practice", bg: WINE, tag: "Parent guide", kicker: "NAPLAN writing practice", title: "Years 3, 5, 7 and 9", what: "Story and persuasive practice, with feedback on every piece",
    card: ["Story and persuasive prompts", "One strength, one next step", "Free reading worksheets too", "Free plan, no card"],
    board: "NAPLAN and Australian Writing Help",
    pinTitle: "NAPLAN Writing Practice at Home: Years 3, 5, 7 and 9",
    description: "How to practise NAPLAN writing at home: story and persuasive pieces, feedback on one thing at a time, and free reading worksheets with answers. A practice guide, not a NAPLAN score. #naplan #naplanwriting #australianparents #homeschoolaustralia #writingpractice",
  },
  {
    id: "ks2-sats-reading-practice", bg: GREEN, tag: "Parent guide", kicker: "KS2 SATs reading practice", title: "Year 6 reading, made simple", what: "Free worksheets and online passages that explain every answer",
    card: ["Free printable worksheets", "Answer keys included", "Every answer explained online", "Free plan, no card"],
    board: "KS2 SATs and 11+ English Practice",
    pinTitle: "KS2 SATs Reading Practice: Free Worksheets and Online Practice",
    description: "KS2 SATs reading practice for Year 6: free printable worksheets with answer keys, plus online passages that explain every answer with the line from the text. Not an official paper. #ks2sats #sats #year6 #readingcomprehension #homeschooluk",
  },
  {
    id: "11-plus-english-practice", bg: WINE, tag: "Parent guide", kicker: "11+ English practice", title: "Building the skills at home", what: "Comprehension, vocabulary and writing, with feedback",
    card: ["Comprehension and inference", "Vocabulary bank and quiz", "Feedback on every piece of writing", "Free plan, no card"],
    board: "KS2 SATs and 11+ English Practice",
    pinTitle: "11+ English Practice at Home: Comprehension, Vocabulary and Writing",
    description: "11+ English practice for parents: build comprehension, vocabulary and writing skills at home with free worksheets and feedback on every piece. Formats vary by area, so check each school's guidance. #11plus #11pluspreparation #11plusenglish #year5 #homeeducation",
  },
  {
    id: "igcse-english-first-language-writing-feedback", bg: GREEN, tag: "Parent guide", kicker: "IGCSE English First Language", title: "Writing feedback that teaches", what: "A strength, a next step and a corrected version of each piece",
    card: ["Glow and Grow on every piece", "Corrected, improved version", "Exam-style bands on Premium", "A guide, not an exam mark"],
    board: "IGCSE and Exam Writing Help",
    pinTitle: "IGCSE English First Language Writing Feedback for Students",
    description: "Feedback for IGCSE and O-Level English writing: a strength, a next step and a corrected version of each piece, with exam-style bands on Premium. Not affiliated with Cambridge and not an exam mark. #igcse #igcseenglish #cambridge #olevel #exampreparation",
  },
  {
    id: "common-core-writing-feedback-for-parents", bg: WINE, tag: "Parent guide", kicker: "Common Core writing", title: "Opinion, informative, narrative", what: "What to look for, and how to give feedback at home",
    card: ["The three kinds of writing", "One strength, one next step", "Free reading worksheets, Grades 3 to 6", "Free plan, no card"],
    board: "Common Core Writing for Parents",
    pinTitle: "Common Core Writing Feedback for Parents, Grades K to 12",
    description: "Common Core writing explained for parents: opinion, informative and narrative pieces, how to give useful feedback at home, and free reading worksheets for Grades 3 to 6. Your state may use its own standards. #commoncore #writingtips #homeschool #elementaryteacher #parenting",
  },
  {
    id: "ai-writing-coach-for-kids", bg: GREEN, tag: "Parent guide", kicker: "AI writing coach for kids", title: "Is it safe? What parents should know", what: "Straight answers about AI and your child's writing",
    card: ["Parent-managed accounts", "It never writes the story", "Not used to train public AI", "Delete your data any time"],
    board: "AI and Kids Writing: What Parents Should Know",
    pinTitle: "AI Writing Coach for Kids: Is It Safe? What Parents Should Know",
    description: "Is an AI writing coach safe for children? Parent-managed accounts, writing never sold or used to train public AI models, the AI never writes the story, and you can delete data any time. #aiforkids #parenting #screentime #edtech #writingskills",
  },
];

function pinHtml(p) {
  const size = p.title.length > 28 ? 84 : 100;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{ box-sizing:border-box; margin:0; }
  body{ width:1000px; height:1500px; background:${p.bg}; color:#fff; font-family:"Segoe UI",Arial,sans-serif; display:flex; flex-direction:column; padding:70px; }
  .tag{ align-self:flex-start; background:#fff; color:${p.bg}; font-weight:800; font-size:34px; letter-spacing:.06em; padding:14px 28px; border-radius:999px; text-transform:uppercase; }
  .year{ margin-top:90px; font-size:60px; font-weight:700; opacity:.92; }
  h1{ font-family:Georgia,serif; font-size:${size}px; line-height:1.08; margin-top:18px; font-weight:700; }
  .what{ margin-top:46px; font-size:46px; line-height:1.3; opacity:.95; }
  .card{ margin-top:auto; background:#F1F1EF; color:#212121; border-radius:28px; padding:44px 50px; }
  .card li{ list-style:none; font-size:44px; line-height:1.5; font-weight:600; }
  .card li::before{ content:"\\2713"; color:${p.bg}; font-weight:800; margin-right:18px; }
  .foot{ margin-top:36px; font-size:36px; font-weight:700; text-align:center; letter-spacing:.02em; }
  </style></head><body>
  <div class="tag">${esc(p.tag)}</div>
  <div class="year">${esc(p.kicker)}</div>
  <h1>${esc(p.title)}</h1>
  <div class="what">${esc(p.what)}</div>
  <ul class="card">${p.card.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
  <div class="foot">literacylabai.com/learn/${esc(p.id)}</div>
  </body></html>`;
}

const link = (p) => `https://www.literacylabai.com/learn/${p.id}/?utm_source=pinterest&utm_medium=social&utm_campaign=pin-${p.id}`;

function main() {
  const CHROME = findChrome();
  if (!CHROME) { console.error("Chrome not found. Set CHROME_PATH."); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pins-"));
  const notes = ["LiteracyLab AI: Pinterest pins for the guide pages", "", "How to post: create the board named in each entry (once), then Create Pin, upload the image, paste the title, description and destination link. Post 1 a day, not all at once.", ""];
  for (const p of PINS) {
    const html = path.join(tmp, `${p.id}.html`);
    fs.writeFileSync(html, pinHtml(p));
    const png = path.join(OUT, `pin-guide-${p.id}.png`);
    const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${path.join(tmp, "profile")}`, `--screenshot=${png}`, "--window-size=1000,1500", "file:///" + html.replace(/\\/g, "/")], { encoding: "utf8", timeout: 60000 });
    if (!fs.existsSync(png)) { console.error("Failed:", p.id, r.stderr); process.exit(1); }
    notes.push("---", `Image: ${path.basename(png)}`, `Board: ${p.board}`, `Title: ${p.pinTitle}`, `Description: ${p.description}`, `Link: ${link(p)}`, "");
  }
  fs.writeFileSync(path.join(OUT, "pins-guides.txt"), notes.join("\r\n"));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Wrote ${PINS.length} pins and pins-guides.txt to ${OUT}`);
}

if (require.main === module) main();
module.exports = { PINS };
