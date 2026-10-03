// Makes a Pinterest pin image (1000x1500) for every published worksheet, plus one text
// file with each pin's title, description, destination link and board, ready to paste.
//
//   node scripts/build-pins.js [output folder] [--region=us]
//
// The default folder is outside the repo (Documents/LiteracyLab-pinterest) because pins are
// marketing material, not part of the site. Chrome does the rendering. With --region=us (or
// uk) only that country's pins are made, and the notes go to pins-us.txt (pins-uk.txt).

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const W = require("./worksheets-pages");

const args = process.argv.slice(2);
const regionArg = (args.find((a) => a.startsWith("--region=")) || "").replace("--region=", "");
const OUT = args.find((a) => !a.startsWith("--")) || path.join(os.homedir(), "OneDrive", "Documents", "LiteracyLab-pinterest");
const findChrome = () => [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => p && fs.existsSync(p));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const BG = { story: "#7A3B45", "non-fiction": "#3F4A3D" };

const pinTitle = (s) => `Free ${W.levelName(s)} Reading Comprehension: ${s.title}`;
function pinDescription(s) {
  const kind = s.kind === "story" ? "short story" : s.region === "us" ? "informational text" : "information text";
  const [a, b] = W.regionOf(s).ageOf(W.yearNum(s.year));
  const base = `Free printable ${W.levelName(s)} reading comprehension worksheet (${s.region === "uk" ? "UK, " : ""}ages ${a} to ${b}). An original ${kind} with ${s.questions.length} questions and a full answer key. Download the PDF, no sign-up needed.`;
  if (s.region === "us") {
    return `${base} Great for homework, review or home learning. #readingcomprehension #${W.ordinal(W.yearNum(s.year))}grade #freeprintable #homeschool #commoncore`;
  }
  if (s.region === "australia") {
    return `${base} Great for homework, revision or home learning. #readingcomprehension #${s.year.replace(" ", "").toLowerCase()} #freeprintable #homeschoolaustralia #australiancurriculum`;
  }
  return `${base} Great for homework, revision or home learning. #readingcomprehension #${s.year.replace(" ", "").toLowerCase()} #freeprintable #homeschooluk #ks2english`;
}
const pinLink = (s) => `${W.pageUrl(s)}?utm_source=pinterest&utm_medium=social&utm_campaign=pin-${s.id}`;
// Pinterest limits board names to 50 characters; these match the boards on the account.
const pinBoard = (s) => `${W.levelName(s)} Reading Comprehension Worksheets`;

function pinHtml(s) {
  const bg = BG[s.kind] || BG.story;
  const title = s.title;
  const size = title.length > 30 ? 84 : 100;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  *{ box-sizing:border-box; margin:0; }
  body{ width:1000px; height:1500px; background:${bg}; color:#fff; font-family:"Segoe UI",Arial,sans-serif; display:flex; flex-direction:column; padding:70px; }
  .tag{ align-self:flex-start; background:#fff; color:${bg}; font-weight:800; font-size:34px; letter-spacing:.06em; padding:14px 28px; border-radius:999px; text-transform:uppercase; }
  .year{ margin-top:90px; font-size:64px; font-weight:700; opacity:.92; }
  h1{ font-family:Georgia,serif; font-size:${size}px; line-height:1.08; margin-top:18px; font-weight:700; }
  .what{ margin-top:46px; font-size:46px; line-height:1.3; opacity:.95; }
  .card{ margin-top:auto; background:#F1F1EF; color:#212121; border-radius:28px; padding:44px 50px; }
  .card li{ list-style:none; font-size:44px; line-height:1.5; font-weight:600; }
  .card li::before{ content:"\\2713"; color:${bg}; font-weight:800; margin-right:18px; }
  .foot{ margin-top:36px; font-size:40px; font-weight:700; text-align:center; letter-spacing:.02em; }
  </style></head><body>
  <div class="tag">Free printable</div>
  <div class="year">${esc(W.levelName(s))} reading comprehension</div>
  <h1>${esc(title)}</h1>
  <div class="what">${s.kind === "story" ? "A short story" : s.region === "us" ? "An informational text" : "An information text"} with ${s.questions.length} questions</div>
  <ul class="card"><li>Original passage</li><li>${s.questions.length} questions (${esc(W.marksText(s, W.totalMarks(s)))})</li><li>Answer key included</li><li>Print the PDF, no sign-up</li></ul>
  <div class="foot">literacylabai.com/learn/worksheets</div>
  </body></html>`;
}

function main() {
const CHROME = findChrome();
if (!CHROME) { console.error("Chrome not found. Set CHROME_PATH."); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pins-"));
const list = W.published().filter((s) => !regionArg || s.region === regionArg);
const notes = ["LiteracyLab AI: Pinterest pins", "", "How to post: create the board named in each entry (once), then Create Pin, upload the image, paste the title, description and destination link. Post 1 to 2 a day, not all at once.", ""];
for (const s of list) {
  const html = path.join(tmp, `${s.id}.html`);
  fs.writeFileSync(html, pinHtml(s));
  const png = path.join(OUT, `pin-${W.yearSlug(s.year)}-${s.id}.png`);
  const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${path.join(tmp, "profile")}`, `--screenshot=${png}`, "--window-size=1000,1500", "file:///" + html.replace(/\\/g, "/")], { encoding: "utf8", timeout: 60000 });
  if (!fs.existsSync(png)) { console.error("Failed:", s.id, r.stderr); process.exit(1); }
  notes.push(`---`, `Image: ${path.basename(png)}`, `Board: ${pinBoard(s)}`, `Title: ${pinTitle(s)}`, `Description: ${pinDescription(s)}`, `Link: ${pinLink(s)}`, "");
}
const notesFile = regionArg ? `pins-${regionArg}.txt` : "pins.txt";
fs.writeFileSync(path.join(OUT, notesFile), notes.join("\r\n"));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote ${list.length} pins and ${notesFile} to ${OUT}`);
}

if (require.main === module) main();

module.exports = { pinTitle, pinDescription, pinLink, pinBoard };
