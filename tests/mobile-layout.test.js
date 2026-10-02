const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Phone layout, checked from the source: the things that are easy to break and
// hard to notice without a phone. (The real rendering was also checked in a
// browser at 320, 375 and 414 pixels wide when this was built.)

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const INDEX = read("index.html");

function htmlFiles(dir = ROOT, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "api", "tests", "scripts", "supabase"].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) htmlFiles(full, out);
    else if (e.name.endsWith(".html")) out.push(path.relative(ROOT, full));
  }
  return out;
}

test("every page has a mobile viewport and does not block pinch-zoom (an accessibility requirement)", () => {
  const files = htmlFiles().filter((f) => !f.startsWith("supabase"));
  assert.ok(files.length > 80, "the guide pages are included");
  for (const f of files) {
    const meta = read(f).match(/<meta name="viewport" content="([^"]*)"/);
    assert.ok(meta, `${f}: no viewport meta`);
    assert.ok(/width=device-width/.test(meta[1]) && /initial-scale=1/.test(meta[1]), `${f}: ${meta[1]}`);
    assert.ok(!/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(meta[1]), `${f}: blocks zooming`);
  }
});

test("the plan comparison table: every answer is labelled with its plan and the table keeps its meaning for screen readers", () => {
  const a = INDEX.indexOf('<table class="plan-table"');
  const table = INDEX.slice(a, INDEX.indexOf("</table>", a));
  assert.match(table, /role="table"/);
  const rows = table.split(/<tr\b/).slice(1).filter((r) => /<td/.test(r));
  assert.ok(rows.length >= 15, `${rows.length} data rows`);
  for (const r of rows) {
    const labels = [...r.matchAll(/<td\b[^>]*data-label="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(labels, ["Free", "Core", "Premium"], "each row labels Free, Core, Premium in order");
    assert.equal((r.match(/<td\b/g) || []).length, 3);
    assert.match(r, /<th\b[^>]*role="rowheader"/);
  }
  assert.ok(!INDEX.includes("Scroll the table sideways"), "no 'swipe to see the rest' hint: nothing is hidden any more");
});

test("below 720px the comparison becomes compact cards: one grid row per feature, plan names shown, and nothing scrolls sideways", () => {
  const m = INDEX.match(/@media \(max-width: 720px\)\{([\s\S]*?)\n  \}\n/);
  assert.ok(m, "the 720px block exists");
  const css = m[1];
  assert.match(css, /\.plan-table-scroll\{[^}]*overflow:visible/);
  assert.match(css, /\.plan-table tr\{[^}]*display:grid[^}]*repeat\(3/);
  assert.match(css, /\.plan-table td::before\{[^}]*content:attr\(data-label\)/);
  assert.match(css, /\.plan-table th\[scope="row"\]\{[^}]*grid-column:1 \/ -1/);
  assert.match(css, /\.plan-table thead\{[^}]*position:absolute/, "the header row is kept for screen readers, hidden visually");
  assert.match(css, /tr\.wide\{[^}]*grid-template-columns:1fr/, "long answers stack one plan per line");
  assert.ok(/<tr role="row" class="wide">/.test(INDEX), "the long-answer row is marked");
});

test("touch targets: buttons, menu, tabs and footer links are at least 44px tall on a phone", () => {
  const m = INDEX.match(/@media \(pointer:coarse\), \(max-width: 640px\)\{([\s\S]*?)\n  \}\n/);
  assert.ok(m, "the touch-target block exists");
  const css = m[1];
  assert.match(css, /\.theme-toggle, \.nav-menu-toggle\{[^}]*width:44px;[^}]*height:44px/);
  assert.match(css, /\.btn, \.nav-cta \.btn\{[^}]*min-height:44px/);
  assert.match(css, /\.tier-tabs button\{[^}]*min-height:44px/);
  assert.match(css, /\.foot-links a\{[^}]*padding:14px/);
  const analytics = read("analytics.js");
  assert.equal((analytics.match(/padding:12px 18px/g) || []).length, 2, "the cookie buttons are 44px tall");
});

test("the phone header is one slim row: the theme toggle moves into the menu, and the toggle still works from there", () => {
  assert.match(INDEX, /\.nav-cta \.theme-toggle\{ display:none; \}/);
  assert.match(INDEX, /class="theme-toggle theme-toggle-menu"/);
  assert.match(INDEX, /document\.querySelectorAll\('\.theme-toggle'\)/, "every theme button is wired up");
  assert.match(INDEX, /<span class="nav-long">Launch workspace<\/span><span class="nav-short">Launch<\/span>/);
});

test("the privacy policy's data table stacks on phones instead of pushing the page sideways (layout only, no wording change)", () => {
  const p = read("privacy.html");
  const a = p.indexOf("<table");
  const table = p.slice(a, p.indexOf("</table>", a));
  const rows = table.split("<tr>").slice(1).filter((r) => /<td/.test(r));
  assert.ok(rows.length >= 5);
  for (const r of rows) assert.deepEqual([...r.matchAll(/data-label="([^"]*)"/g)].map((m) => m[1]), ["Category", "What we collect", "From whom"]);
  assert.match(p, /@media \(max-width: 640px\)\{[\s\S]*\.doc td::before\{[^}]*content:attr\(data-label\)/);
});

test("the guide pages and prompt generator use 44px touch targets and the in-app mastery list is not a sideways-scrolling table", () => {
  const build = read("scripts/build-learn.js");
  assert.match(build, /@media \(pointer:coarse\), \(max-width:640px\)\{[\s\S]*min-height:44px/);
  assert.match(build, /\.tool select, \.tool button\{ min-height:48px; \}/);
  const app = read("app.html");
  assert.ok(!app.includes("min-w-[420px]"), "no fixed-width table forcing a sideways scroll");
  assert.match(app, /role="table" aria-label="Curriculum target progress"/);
  assert.match(app, /hidden sm:grid grid-cols-\[1fr_10rem_7\.5rem\]/);
  assert.match(app, /grid grid-cols-1 sm:grid-cols-\[1fr_10rem_7\.5rem\]/, "rows stack on a phone and become columns from sm up");
});
