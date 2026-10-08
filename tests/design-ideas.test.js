const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildAnyEmail, sampleContext } = require("../api/_lib/emailAny");
const { buildEmail } = require("../api/_lib/emailTemplate");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const ctx = (extra) => ({ token: "t", address: "1 Example St", ...extra });

// ---------------------------------------------------------------- weekly email bars
test("a weekly email shows days practised and the reading average as simple bars, with the numbers as text too", () => {
  const e = buildAnyEmail("core-weekly", ctx({ ...sampleContext("core-weekly"), days: 3, readingAvg: 80 }));
  assert.match(e.html, /Days practised/);
  assert.match(e.html, /3 of 7/);
  assert.match(e.html, /Reading average/);
  assert.match(e.html, /width="43%"/, "3 of 7 days is 43% of the bar");
  assert.match(e.html, /width="80%"/);
  assert.match(e.text, /Days practised: 3 of 7/);
  assert.match(e.text, /Reading average: 80%/);
});

test("the bars are real data only: no reading average means no reading bar, and no days means no bars at all", () => {
  const noReading = buildAnyEmail("core-weekly", ctx({ ...sampleContext("core-weekly"), days: 2, readingAvg: null }));
  assert.match(noReading.html, /Days practised/);
  assert.doesNotMatch(noReading.html, /Reading average/);
  const none = buildEmail({ subject: "s", preheader: "p", heading: "h", paragraphs: ["x"], reason: "r", meters: [] });
  assert.doesNotMatch(none.html, /ll-tint" style="background/, "no empty bar block");
  const bad = buildEmail({ subject: "s", preheader: "p", heading: "h", paragraphs: ["x"], reason: "r", meters: [{ label: "A", value: "x", pct: NaN }, { label: "B", value: "200%", pct: 250 }, { label: "C", value: "0", pct: 0 }] });
  assert.doesNotMatch(bad.html, /A<\/span>/, "an unusable value is skipped");
  assert.match(bad.html, /width="100%"/, "a value over 100 is held at a full bar");
  assert.doesNotMatch(bad.html, /width="0%"/, "an empty bar draws nothing instead of a zero-width cell");
});

test("Premium household and Free weekly emails carry the bars too, and every kind still reads cleanly", () => {
  const prem = buildAnyEmail("prem-digest", ctx({ ...sampleContext("prem-digest"), days: 5, readingAvg: 60 }));
  assert.match(prem.html, /5 of 7/);
  const free = buildAnyEmail("free-weekly-lite", ctx({ stats: { pieces: 2, words: 200, glow: "A", grow: "B", days: 4 } }));
  assert.match(free.html, /4 of 7/);
  const freeNoDays = buildAnyEmail("free-weekly-lite", ctx({ stats: { pieces: 2, words: 200 } }));
  assert.doesNotMatch(freeNoDays.html, /Days practised/);
});

// ---------------------------------------------------------------- word of the day
function wordOfDay() {
  const a = APP.indexOf("const VOCAB_BOXES = 4;"), b = APP.indexOf("const vocabDeck =");
  return new Function(APP.slice(a, b) + "\nreturn { vocabWordOfDay, VOCAB_BOXES };")();
}
const W = (t) => ({ term: t, definition: "d" });

test("word of the day: the same word all day, a different one tomorrow, never a word already known", () => {
  const { vocabWordOfDay, VOCAB_BOXES } = wordOfDay();
  const words = [W("zeta"), W("alpha"), W("mid"), W("beta")];
  const first = vocabWordOfDay(words, {}, 20000);
  assert.equal(vocabWordOfDay(words, {}, 20000).term, first.term, "stable within a day");
  assert.equal(vocabWordOfDay([...words].reverse(), {}, 20000).term, first.term, "does not depend on list order");
  const seen = new Set([0, 1, 2, 3].map((d) => vocabWordOfDay(words, {}, 20000 + d).term));
  assert.equal(seen.size, 4, "cycles through every word");
  const known = { alpha: { box: VOCAB_BOXES - 1, at: 1 }, beta: { box: VOCAB_BOXES - 1, at: 1 } };
  for (let d = 0; d < 6; d++) assert.ok(["zeta", "mid"].includes(vocabWordOfDay(words, known, 20000 + d).term), "known words are skipped");
  assert.equal(vocabWordOfDay(words, { zeta: { box: 3 }, alpha: { box: 3 }, mid: { box: 3 }, beta: { box: 3 } }, 5), null, "nothing to show when every word is known");
  assert.equal(vocabWordOfDay([], {}, 5), null);
});

test("the Vocabulary tab shows the word of the day with a way to clear it, but not while searching", () => {
  assert.match(APP, /aria-label="Word of the day"/);
  assert.match(APP, /\{wordOfDay && !query\.trim\(\) && \(/);
  assert.match(APP, /setWordBox\(wordOfDay\.term, VOCAB_BOXES - 1\)/);
});

// ---------------------------------------------------------------- side by side with the model answer
test("a written answer sits beside its model answer on a wide screen, and each part is labelled", () => {
  assert.match(APP, /Your answer<\/div>/);
  assert.match(APP, /grid md:grid-cols-2 gap-3 mt-2 items-start/);
  assert.match(APP, /so compare it with the model answer beside it/);
  assert.match(APP, /A MODEL RESPONSE TO THE SAME TASK/);
  assert.match(APP, /grid md:grid-cols-2 gap-5 items-start/, "the writing 'at work' panel is side by side too");
});
