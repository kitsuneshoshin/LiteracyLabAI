const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// The vocabulary practice rules live in app.html (one in-browser script), so they are copied out of the
// source and run here: how a word moves up and down the ladder, which words a flashcard round starts with,
// and that a blocked or corrupted browser store never breaks practice.
const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const start = APP.indexOf("const VOCAB_BOXES = ");
const end = APP.indexOf("function MasteryPips");
assert.ok(start > 0 && end > start, "the vocabulary helpers are in app.html");
function load(localStorage) {
  return new Function("localStorage", APP.slice(start, end) + "\nreturn { VOCAB_BOXES, vocabNextBox, vocabTermKey, vocabBoxOf, vocabDeck, loadVocabBoxes, saveVocabBoxes };")(localStorage);
}
const memory = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; };

test("a word you know climbs one step at a time to the top and stays there; one you miss drops back to the start", () => {
  const V = load(memory());
  assert.equal(V.vocabNextBox(0, true), 1);
  assert.equal(V.vocabNextBox(1, true), 2);
  assert.equal(V.vocabNextBox(2, true), 3);
  assert.equal(V.vocabNextBox(3, true), 3, "the top step is the ceiling");
  for (const b of [0, 1, 2, 3]) assert.equal(V.vocabNextBox(b, false), 0);
  assert.equal(V.vocabNextBox(undefined, true), 1);
  assert.equal(V.vocabNextBox("2", true), 1, "a garbled step is treated as new");
});

test("a word is found whatever its capitals or spacing, and an unknown or garbled step counts as new", () => {
  const V = load(memory());
  const boxes = { queue: 2, stall: 7, price: -1, gate: "3" };
  assert.equal(V.vocabBoxOf(boxes, "  Queue "), 2);
  assert.equal(V.vocabBoxOf(boxes, "stall"), 0);
  assert.equal(V.vocabBoxOf(boxes, "price"), 0);
  assert.equal(V.vocabBoxOf(boxes, "gate"), 0);
  assert.equal(V.vocabBoxOf(boxes, "missing"), 0);
  assert.equal(V.vocabBoxOf(undefined, "x"), 0);
});

test("a flashcard round starts with the words that need the most work, newest first within a step, and stops at the round size", () => {
  const V = load(memory());
  const words = ["a", "b", "c", "d", "e"].map((term) => ({ term })); // newest first, as the server sends them
  const deck = V.vocabDeck(words, { a: 3, b: 0, c: 1, d: 0, e: 2 }, 4);
  assert.deepEqual(deck.map((w) => w.term), ["b", "d", "c", "e"]);
  assert.deepEqual(V.vocabDeck(words, {}, 3).map((w) => w.term), ["a", "b", "c"]);
  assert.deepEqual(V.vocabDeck([], {}), []);
  assert.deepEqual(V.vocabDeck(undefined, {}), []);
});

test("progress is remembered per learner on this device, and a blocked or corrupted store never breaks practice", () => {
  const store = memory();
  const V = load(store);
  V.saveVocabBoxes("kid1", { queue: 2 });
  assert.deepEqual(V.loadVocabBoxes("kid1"), { queue: 2 });
  assert.deepEqual(V.loadVocabBoxes("kid2"), {}, "another learner starts fresh");
  store._m["ll_vocab_boxes_bad"] = "{not json";
  assert.deepEqual(V.loadVocabBoxes("bad"), {});
  store._m["ll_vocab_boxes_arr"] = "[1,2]";
  assert.deepEqual(V.loadVocabBoxes("arr"), {});
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const B = load(blocked);
  assert.deepEqual(B.loadVocabBoxes("kid1"), {});
  assert.doesNotThrow(() => B.saveVocabBoxes("kid1", { a: 1 }));
});

test("the word trick travels with each word from the server to the vocabulary page", () => {
  const history = fs.readFileSync(path.join(__dirname, "..", "api", "history.js"), "utf8");
  assert.match(history, /trick: v\.trick/);
});
