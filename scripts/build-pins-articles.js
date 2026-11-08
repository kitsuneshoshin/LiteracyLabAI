// Makes Pinterest pin images (1000x1500) for four parent articles (Story Mountain, PEEL, GCSE assessment
// objectives, using reading worksheets at home), plus pins-articles.txt with each pin's title, description, link and board, ready to paste.
//
//   node scripts/build-pins-articles.js [output folder]
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
    id: "story-mountain-explained", bg: WINE, tag: "Parent guide", kicker: "Story Mountain", title: "Plan a story in five steps", what: "A simple plan children aged about 7 to 12 can use",
    card: ["Opening, build-up, climax", "Resolution and ending", "A worked example", "A template to copy"],
    board: "Writing Help for Parents",
    pinTitle: "Story Mountain Explained: Plan a Story Step by Step",
    description: "What a Story Mountain is and how to use it: the five parts (opening, build-up, climax, resolution, ending), a worked example and a template to copy for children aged about 7 to 12. #storymountain #storywriting #primaryschool #writingtips #homeschool",
  },
  {
    id: "peel-and-peal-paragraphs-explained", bg: GREEN, tag: "Parent guide", kicker: "PEEL paragraphs", title: "Point, evidence, explain, link", what: "How to help a child build a clear paragraph",
    card: ["What each letter means", "A simple example", "Common mistakes to look for", "Free guide for parents"],
    board: "Writing Help for Parents",
    pinTitle: "PEEL Paragraphs Explained for Parents",
    description: "PEEL (and PEAL) paragraphs explained in plain language: what each letter stands for, an example and how to help your child at home. #peelparagraph #writingtips #essaywriting #parenting #english",
  },
  {
    id: "gcse-english-language-explained", bg: WINE, tag: "Parent guide", kicker: "GCSE English Language", title: "AO1 to AO6 explained", what: "What AO5 and AO6 mean and how the marks are split (AQA)",
    card: ["Reading and writing objectives", "Paper 1 and Paper 2", "Question-by-question guide", "How to help at home"],
    board: "IGCSE and Exam Writing Help",
    pinTitle: "GCSE English Language Assessment Objectives AO1 to AO6 (AQA)",
    description: "GCSE English Language assessment objectives explained: what AO5 and AO6 mean, how the papers are laid out and how to help at home. Based on the AQA specification; check your own exam board. #gcse #gcseenglish #aqa #ao5 #revision",
  },
  {
    id: "how-to-use-reading-worksheets-at-home", bg: GREEN, tag: "Parent guide", kicker: "Reading worksheets", title: "How to use them at home", what: "A calm ten-minute routine that builds understanding",
    card: ["Five simple steps", "How often and how long", "Checking answers kindly", "Free worksheets to try"],
    board: "Writing Help for Parents",
    pinTitle: "How to Use Reading Worksheets at Home: A Parent's Guide",
    description: "How to use free reading comprehension worksheets at home: how often, how long, how to check answers without a fight and what to do when your child finds them hard. #readingcomprehension #readingworksheets #homeschool #parenting #primaryschool",
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
  <div class="foot">literacylabai.com/learn/articles/${esc(p.id)}</div>
  </body></html>`;
}

const link = (p) => `https://www.literacylabai.com/learn/articles/${p.id}/?utm_source=pinterest&utm_medium=social&utm_campaign=pin-${p.id}`;

function main() {
  const CHROME = findChrome();
  if (!CHROME) { console.error("Chrome not found. Set CHROME_PATH."); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pins-"));
  const notes = ["LiteracyLab AI: Pinterest pins for the parent articles", "", "How to post: create the board named in each entry (once), then Create Pin, upload the image, paste the title, description and destination link. Post 1 a day, not all at once.", ""];
  for (const p of PINS) {
    const html = path.join(tmp, `${p.id}.html`);
    fs.writeFileSync(html, pinHtml(p));
    const png = path.join(OUT, `pin-article-${p.id}.png`);
    const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${path.join(tmp, "profile")}`, `--screenshot=${png}`, "--window-size=1000,1500", "file:///" + html.replace(/\\/g, "/")], { encoding: "utf8", timeout: 60000 });
    if (!fs.existsSync(png)) { console.error("Failed:", p.id, r.stderr); process.exit(1); }
    notes.push("---", `Image: ${path.basename(png)}`, `Board: ${p.board}`, `Title: ${p.pinTitle}`, `Description: ${p.description}`, `Link: ${link(p)}`, "");
  }
  fs.writeFileSync(path.join(OUT, "pins-articles.txt"), notes.join("\r\n"));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Wrote ${PINS.length} pins and pins-articles.txt to ${OUT}`);
}

if (require.main === module) main();
module.exports = { PINS };
