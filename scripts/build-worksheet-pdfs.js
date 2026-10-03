// Writes the worksheet and answer-key PDFs for every published sheet, using headless
// Chrome to print the print-only HTML from scripts/worksheets-pages.js.
//
//   node scripts/build-worksheet-pdfs.js
//
// The PDFs are committed next to their pages. Chrome is only needed when a sheet changes.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { published, printWorksheetHtml, printAnswersHtml, pdfPath } = require("./worksheets-pages");

const ROOT = path.join(__dirname, "..");
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((p) => p && fs.existsSync(p));
if (!CHROME) { console.error("Chrome not found. Set CHROME_PATH."); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ws-pdf-"));
let made = 0;
for (const s of published()) {
  for (const answers of [false, true]) {
    const html = path.join(tmp, `${s.id}${answers ? "-answers" : ""}.html`);
    fs.writeFileSync(html, answers ? printAnswersHtml(s) : printWorksheetHtml(s));
    const out = path.join(ROOT, pdfPath(s, answers));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const r = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--user-data-dir=${path.join(tmp, "profile")}`, `--print-to-pdf=${out}`, "file:///" + html.replace(/\\/g, "/")], { encoding: "utf8", timeout: 60000 });
    if (r.status !== 0 || !fs.existsSync(out)) { console.error("Failed:", s.id, answers, r.stderr); process.exit(1); }
    made++;
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Wrote ${made} PDFs.`);
