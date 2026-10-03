// Makes a Pinterest pin image (1000x1500) for every published worksheet, plus one text
// file with each pin's title, description, destination link and board, ready to paste.
//
//   node scripts/build-pins.js [output folder]
//
// The default folder is outside the repo (Documents/LiteracyLab-pinterest) because pins are
// marketing material, not part of the site. Chrome does the rendering.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const W = require("./worksheets-pages");

const OUT = process.argv[2] || path.join(os.homedir(), "OneDrive", "Documents", "LiteracyLab-pinterest");
const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find((p) => p && fs.existsSync(p));
if (!CHROME) { console.error("Chrome not found. Set CHROME_PATH."); process.exit(1); }

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const BG = { story: "#7A3B45", "non-fiction": "#3F4A3D" };

const pinTitle = (s) => `Free ${s.year} Reading Comprehension: ${s.title}`;
function pinDescription(s) {
  const kind = s.kind === "story" ? "short story" : "information text";
  return `Free printable ${s.year} reading comprehension worksheet (UK, ${W.ageRange(s.year)}). An original ${kind} with ${s.questions.length} questions and a full answer key. Download the PDF, no sign-up needed. Great for homework, revision or home learning. #readingcomprehension #${s.year.replace(" ", "").toLowerCase()} #freeprintable #homeschooluk #ks2english`;
}
const pinLink = (s) => `${W.pageUrl(s)}?utm_source=pinterest&utm_medium=social&utm_campaign=pin-${s.id}`;
// Pinterest limits board names to 50 characters; these match the boards on the account.
const pinBoard = (s) => `${s.year} Reading Comprehension Worksheets`;

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
  <div class="year">${esc(s.year)} reading comprehension</div>
  <h1>${esc(title)}</h1>
  <div class="what">${s.kind === "story" ? "A short story" : "An information text"} with ${s.questions.length} questions</div>
  <ul class="card"><li>Original passage</li><li>${s.questions.length} questions (${W.totalMarks(s)} marks)</li><li>Answer key included</li><li>Print the PDF, no sign-up</li></ul>
  <div class="foot">literacylabai.com/learn/worksheets</div>
  </body></html>`;
}

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pins-"));
const notes = ["LiteracyLab AI: Pinterest pins", "", "How to post: create the board named in each entry (once), then Create Pin, upload the image, paste the title, description and destination link. Post 1 to 2 a day, not all at once.", ""];
for (const s of W.published()) {
  const html = path.join(tmp, `${s.id}.html`);
  fs.writeFileSync(html, pinHtml(s));
  const png = path.join(OUT, `pin-${W.yearSlug(s.year)}-${s.id}.png`);
  const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${path.join(tmp, "profile")}`, `--screenshot=${png}`, "--window-size=1000,1500", "file:///" + html.replace(/\\/g, "/")], { encoding: "utf8", timeout: 60000 });
  if (!fs.existsSync(png)) { console.error("Failed:", s.id, r.stderr); process.exit(1); }
  notes.push(`---`, `Image: ${path.basename(png)}`, `Board: ${pinBoard(s)}`, `Title: ${pinTitle(s)}`, `Description: ${pinDescription(s)}`, `Link: ${pinLink(s)}`, "");
}
fs.writeFileSync(path.join(OUT, "pins.txt"), notes.join("\r\n"));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote ${W.published().length} pins and pins.txt to ${OUT}`);
