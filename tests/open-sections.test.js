const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Which sections of a result are open when it first appears, and that a learner's choice is remembered.
// The helpers are copied out of app.html (one in-browser script) and run here.
const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const a = APP.indexOf("function readOpenChoice"), b = APP.indexOf("// One button that opens or closes every section");
assert.ok(a > 0 && b > a);
const load = (storage) => new Function("localStorage", APP.slice(a, b) + "\nreturn { readOpenChoice, saveOpenChoice };")(storage);
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };

test("a section's own default applies until the learner chooses, and then their choice wins", () => {
  const st = mem(); const { readOpenChoice, saveOpenChoice } = load(st);
  assert.equal(readOpenChoice("exam", false), false);
  assert.equal(readOpenChoice("responses", true), true);
  saveOpenChoice("exam", true);
  assert.equal(readOpenChoice("exam", false), true, "opened once, stays open");
  saveOpenChoice("responses", false);
  assert.equal(readOpenChoice("responses", true), false, "closed once, stays closed");
  assert.equal(readOpenChoice("vocab", false), false, "other sections are untouched");
});

test("a section with no id, garbage in the store, or a blocked store just uses its default", () => {
  const st = mem(); const { readOpenChoice, saveOpenChoice } = load(st);
  assert.equal(readOpenChoice(undefined, true), true);
  assert.doesNotThrow(() => saveOpenChoice(undefined, true));
  assert.deepEqual(st.m, {}, "nothing saved without an id");
  st.m.ll_open_exam = "banana";
  assert.equal(readOpenChoice("exam", true), true);
  const blocked = load({ getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } });
  assert.equal(blocked.readOpenChoice("exam", true), true);
  assert.doesNotThrow(() => blocked.saveOpenChoice("exam", false));
});

// What is open on first view, read from the page source so the choices cannot drift from what was agreed.
function defaultOf(id) {
  const m = APP.match(new RegExp('<Collapsible id="' + id + '" defaultOpen=\\{([^}]+)\\}'));
  assert.ok(m, "section " + id + " has an id and a default");
  return m[1];
}

test("the writing result opens on what helps most and keeps the rest one tap away", () => {
  assert.equal(defaultOf("responses"), "true", "the rewrite and model response are what Premium is for");
  assert.equal(defaultOf("spelling"), "!clean", "spelling opens only when it found something");
  for (const id of ["exam", "framework", "devices", "vocab"]) assert.equal(defaultOf(id), "false", id);
});

test("the reading result keeps the question-by-question review open and folds the rest", () => {
  assert.equal(defaultOf("review"), "true");
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
