const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Which sections of a result are open when it first appears. Every section starts closed, and nothing is remembered
// between visits, so a customer always meets a result the same way and opens what they want.
const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8").replace(/\r\n/g, "\n");

test("open or closed is not remembered between visits", () => {
  assert.ok(!APP.includes("ll_open_"), "no saved open/closed state");
  assert.ok(!APP.includes("readOpenChoice") && !APP.includes("saveOpenChoice"));
  assert.match(APP, /function Collapsible\([^)]*\)\{\s*\/\/[^\n]*\n\s*const \[openState, setOpenState\] = useState\(!!defaultOpen\);/);
});

// What is open on first view, read from the page source so the choices cannot drift from what was agreed.
function defaultOf(id) {
  const m = APP.match(new RegExp('<Collapsible id="' + id + '" defaultOpen=\\{([^}]+)\\}'));
  assert.ok(m, "section " + id + " has an id and a default");
  return m[1];
}

test("the writing result starts with every section closed; Open all sections opens them", () => {
  for (const id of ["responses", "spelling", "exam", "framework", "devices", "vocab"]) assert.equal(defaultOf(id), "false", id);
});

test("the reading result starts with every section closed; Open all sections opens them", () => {
  assert.equal(defaultOf("review"), "false", "owner asked for the review to start closed like the rest");
  assert.equal(defaultOf("strategy"), "false");
});

test("every folded section still says what is inside it, and there is an open-all button on both results", () => {
  for (const id of ["exam", "framework", "devices", "vocab", "strategy"]) {
    const i = APP.indexOf('<Collapsible id="' + id + '"');
    const head = APP.slice(i, APP.indexOf(">", APP.indexOf("teaser=", i) + 8) + 1);
    assert.match(head, /teaser=/, id + " has a summary line for when it is closed");
  }
  assert.equal((APP.match(/<ExpandAllBar \/>/g) || []).length, 2, "one in the writing result, one in the reading result");
  assert.match(APP, /ll-set-all-sections/);
});
