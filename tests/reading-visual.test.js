const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const QT = require("../api/_lib/questionTypes");
const { normalizeVisual, validateVisual, describeVisual } = require("../api/_lib/visualText");
const { buildReadingPassagePrompt, buildReadingPrompt } = require("../api/_lib/prompt");
const { validatePassage } = require("../api/_lib/validate");
const { did, loadHandler, call } = require("./harness");

// Reading practice on data texts (a table or bar chart with a short text) and on two texts side by side, and the page
// marking the line of evidence in the passage.

const COUNTRY = "🇬🇧 United Kingdom";
const GRADE = { elementary: "Year 5", middle: "Year 8", high: "Year 11" };
const TABLE = { type: "table", title: "Pets at Oakfield School", headers: ["Pet", "Pupils"], rows: [["Dog", "12"], ["Cat", "9"], ["Fish", "5"]] };
const CHART = { type: "chart", title: "Votes for the class trip", unit: "votes", items: [{ label: "Zoo", value: 14 }, { label: "Museum", value: 9 }, { label: "Beach", value: 17 }] };
const CORE = "Mia set up her stall by the gate at nine. By ten, only two people had stopped, and both only looked. She moved the sign closer to the road and wrote the price in bigger letters. Soon a queue had formed, and by noon every cake was gone.";
const filler = (n) => Array.from({ length: n }, (_, i) => ["gently", "slowly", "again", "outside", "morning", "market"][i % 6]).join(" ") + ".";

// ------------------------------------------------------------ the data itself

test("a table or chart is checked for the right shape, size and sense", () => {
  const issues = (v, kind) => { const out = []; validateVisual(v, kind, out); return out; };
  assert.deepEqual(issues(TABLE, "table"), []);
  assert.deepEqual(issues(CHART, "chart"), []);
  assert.ok(issues(CHART, "table").some((i) => /must be a table/.test(i)), "the wrong kind");
  assert.ok(issues(null, "chart").length);
  assert.ok(issues({ ...TABLE, headers: ["Only one"] }, "table").some((i) => /headers/.test(i)));
  assert.ok(issues({ ...TABLE, headers: ["Pet", "Pet"] }, "table").some((i) => /repeated column/.test(i)));
  assert.ok(issues({ ...TABLE, rows: TABLE.rows.slice(0, 2) }, "table").some((i) => /rows must be 3 to 7/.test(i)));
  assert.ok(issues({ ...TABLE, rows: [...TABLE.rows.slice(0, 2), ["Fish"]] }, "table").some((i) => /rows\[2\]/.test(i)), "a short row");
  assert.ok(issues({ ...TABLE, rows: [["Dog", "1"], ["Dog", "2"], ["Cat", "3"]] }, "table").some((i) => /repeats a row label/.test(i)));
  assert.ok(issues({ ...TABLE, title: "" }, "table").some((i) => /title/.test(i)));
  assert.ok(issues({ ...CHART, items: CHART.items.slice(0, 2) }, "chart").some((i) => /3 to 7 bars/.test(i)));
  assert.ok(issues({ ...CHART, unit: "" }, "chart").some((i) => /unit/.test(i)));
  assert.ok(issues({ ...CHART, items: [{ label: "A", value: -1 }, ...CHART.items.slice(1)] }, "chart").some((i) => /value/.test(i)));
  assert.ok(issues({ ...CHART, items: [{ label: "A", value: "many" }, ...CHART.items.slice(1)] }, "chart").some((i) => /value/.test(i)));
  assert.ok(issues({ ...CHART, items: CHART.items.map((it) => ({ ...it, value: 0 })) }, "chart").some((i) => /all zero/.test(i)));
  assert.ok(issues({ ...CHART, items: [{ label: "Zoo", value: 1 }, { label: "zoo", value: 2 }, { label: "Beach", value: 3 }] }, "chart").some((i) => /repeats a bar/.test(i)));
});

test("what a model sends loosely is tidied: numbers in cells become text, numeric text in a chart becomes a number", () => {
  const t = normalizeVisual({ type: "table", title: " Pets ", headers: ["Pet", 2026], rows: [["Dog", 12], ["Cat", 9], ["Fish", 5]] });
  assert.deepEqual(t.headers, ["Pet", "2026"]);
  assert.deepEqual(t.rows[0], ["Dog", "12"]);
  assert.equal(t.title, "Pets");
  const c = normalizeVisual({ type: "chart", title: "Votes", unit: "votes", items: [{ label: "Zoo", value: "14" }, { label: "Beach", value: 17 }, { label: "Museum", value: "x" }] });
  assert.equal(c.items[0].value, 14);
  assert.ok(Number.isNaN(c.items[2].value), "nonsense stays nonsense, so it is refused rather than guessed");
  assert.equal(normalizeVisual(null), null);
  assert.equal(normalizeVisual("x"), "x");
  const issues = []; validateVisual(normalizeVisual({ ...CHART, items: [{ label: "Zoo", value: "14" }, { label: "Beach", value: "17" }, { label: "Museum", value: "9" }] }), "chart", issues);
  assert.deepEqual(issues, []);
});

test("the marking model is shown the data as plain text", () => {
  assert.equal(describeVisual(TABLE), "Table: Pets at Oakfield School\nPet | Pupils\nDog | 12\nCat | 9\nFish | 5");
  assert.equal(describeVisual(CHART), "Bar chart: Votes for the class trip (votes)\nZoo: 14\nMuseum: 9\nBeach: 17");
  assert.equal(describeVisual(null), ""); assert.equal(describeVisual({ type: "x" }), "");
});

// ------------------------------------------------------------ the kinds of text and their questions

test("data texts and two-text passages are offered from Elementary up, never to Early Years, and are reachable", () => {
  for (const tier of ["elementary", "middle", "high"]) {
    const types = QT.TEXT_TYPES[tier];
    assert.ok(types.some((t) => t.visual === "table"), tier + " table");
    assert.ok(types.some((t) => t.visual === "chart"), tier + " chart");
    assert.ok(types.some((t) => t.two), tier + " two texts");
    const seen = new Set();
    for (let i = 0; i < 600; i++) seen.add(QT.pickTextType(tier, (() => { let s = i * 7919 + 13; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })()).name);
    assert.equal(seen.size, types.length, tier + ": every kind is reachable");
  }
  assert.ok(!QT.TEXT_TYPES.early.some((t) => t.visual || t.two));
});

test("data texts ask multiple choice and true/false/not given; two texts add 'which line proves it' straight after a multiple choice", () => {
  for (const tier of ["elementary", "middle", "high"]) {
    for (const list of QT.TEMPLATES_DATA[tier]) {
      assert.equal(list.length, 5);
      assert.ok(list.every((s) => s === "mc" || s === "tfng"), tier + " data: " + list);
      assert.ok(list.includes("tfng") && list.includes("mc"));
    }
    for (const list of QT.TEMPLATES_TWO[tier]) {
      assert.equal(list.length, 5);
      assert.ok(list.every((s) => ["mc", "tfng", "evidence"].includes(s)), tier + " two: " + list);
      list.forEach((s, i) => { if (s === "evidence") assert.equal(list[i - 1], "mc", "the quote question follows a multiple choice"); });
    }
  }
  const rng = () => 0;
  assert.deepEqual(QT.pickTemplate("middle", rng, { visual: "table" }), QT.TEMPLATES_DATA.middle[0]);
  assert.deepEqual(QT.pickTemplate("middle", rng, { two: true }), QT.TEMPLATES_TWO.middle[0]);
  assert.deepEqual(QT.pickTemplate("middle", rng), QT.TEMPLATES.middle[0], "an ordinary text is unchanged");
  assert.deepEqual(QT.pickTemplate("early", rng, undefined), QT.TEMPLATES.early[0]);
  assert.deepEqual(QT.pickTemplate("early", rng, { visual: "table" }), QT.TEMPLATES_DATA.elementary[0], "a tier with no list of its own falls back sensibly");
});

test("the passage prompt asks for the data, in the right shape, and for the questions to need it", () => {
  const table = QT.TEXT_TYPES.middle.find((t) => t.visual === "table");
  const chart = QT.TEXT_TYPES.high.find((t) => t.visual === "chart");
  const two = QT.TEXT_TYPES.elementary.find((t) => t.two);
  const p = (tier, type) => buildReadingPassagePrompt({ tier, country: COUNTRY, gradeLabel: GRADE[tier], textType: type, template: QT.pickTemplate(tier, () => 0, type) });
  const pt = p("middle", table), pc = p("high", chart), p2 = p("elementary", two);
  assert.match(pt, /"visual", a table/); assert.match(pt, /^ {2}"visual": \{ "type": "table"/m); assert.match(pt, /at least two questions must need numbers from the table/i);
  assert.match(pc, /"visual", a bar chart/); assert.match(pc, /^ {2}"visual": \{ "type": "chart"/m); assert.match(pc, /need numbers from the chart/i);
  assert.match(pt, /about 60-140 words/);
  assert.match(p2, /Text A: <a short title>/); assert.match(p2, /Text B: <a short title>/); assert.match(p2, /need both texts/);
  assert.doesNotMatch(p2, /"visual"/);
  const plain = p("middle", { name: "short story" });
  assert.doesNotMatch(plain, /"visual"|Text A:/);
  for (const prompt of [pt, pc, p2, plain]) {
    const body = prompt.slice(prompt.lastIndexOf("exactly this shape:") + 19).trim();
    assert.ok(body.startsWith("{") && body.endsWith("}"));
    assert.doesNotMatch(body, /,\s*\n\s*}/); assert.doesNotMatch(body, /,\s*,/);
  }
});

function passageCheck(parsed, tier, type) {
  const template = QT.pickTemplate(tier, () => 0, type);
  const qs = QT.normalizeQuestions(template.map((s) => (s === "tfng" ? { q: "The first group was the biggest one.", correct: 0 } : s === "evidence" ? { q: "Which line best supports your answer to the question before?", options: ["Mia set up her stall by the gate at nine.", "By ten, only two people had stopped, and both only looked.", "She moved the sign closer to the road and wrote the price in bigger letters.", "Soon a queue had formed, and by noon every cake was gone."], correct: 0 } : { q: "What happened at ten o'clock?", options: ["Only two people stopped", "A queue formed", "The cakes were gone", "Mia went home"], correct: 0 })), template, Math.random, tier);
  return validatePassage({ title: "Pets", skill: "Reading data", questions: qs, ...parsed }, { tier, template, textType: type });
}

test("a data text is refused without its data, or with the wrong or broken data, and accepted with it", () => {
  const type = QT.TEXT_TYPES.middle.find((t) => t.visual === "table");
  const passage = CORE + " " + filler(120);
  assert.deepEqual(passageCheck({ passage, visual: TABLE }, "middle", type).issues, []);
  assert.ok(passageCheck({ passage }, "middle", type).issues.some((i) => /visual must be a table/.test(i)), "no data");
  assert.ok(passageCheck({ passage, visual: CHART }, "middle", type).issues.some((i) => /visual must be a table/.test(i)), "wrong kind");
  assert.ok(passageCheck({ passage, visual: { ...TABLE, rows: [["Dog"], ["Cat"], ["Fish"]] } }, "middle", type).issues.some((i) => /visual\.rows/.test(i)));
  const short = CORE.split(" ").slice(0, 40).join(" ") + ".";
  assert.deepEqual(passageCheck({ passage: short, visual: TABLE }, "middle", type).issues.filter((i) => /passage is/.test(i)), [], "a short text with data is fine: the data is the rest");
  const plain = { name: "short story", lines: false };
  assert.ok(passageCheck({ passage: short }, "middle", plain).issues.some((i) => /passage is/.test(i)), "an ordinary text that short is not");
});

test("two texts must really be two texts, each with something in it", () => {
  const type = QT.TEXT_TYPES.middle.find((t) => t.two);
  const two = `Text A: The stall\n${CORE}\n\nText B: The customer\n${filler(130)}`;
  assert.deepEqual(passageCheck({ passage: two }, "middle", type).issues, []);
  assert.ok(passageCheck({ passage: CORE + " " + filler(120) }, "middle", type).issues.some((i) => /must hold two texts/.test(i)), "one text only");
  assert.ok(passageCheck({ passage: `Text A: One\n${CORE}\n\nText B: Two\nToo short.` }, "middle", type).issues.some((i) => /each of the two texts/.test(i)));
  assert.ok(passageCheck({ passage: `Text B: Two\n${CORE}\n\nText A: One\n${filler(80)}` }, "middle", type).issues.some((i) => /must hold two texts/.test(i)), "in the wrong order");
});

// ------------------------------------------------------------ through the generator

async function generate(tier, pickType, answer) {
  const stored = [];
  const real = Math.random;
  // make the kind of text deterministic: the nth entry of this tier's list
  const list = QT.TEXT_TYPES[tier];
  const wanted = list.findIndex(pickType);
  let calls = 0;
  const h = loadHandler("reading-passage.js", {
    plan: "premium", used: 0,
    db: (q) => {
      if (q.table === "child_profiles" && did(q, "maybeSingle")) return { data: { id: "c1" }, error: null };
      if (q.table === "child_profiles") return { data: [{ id: "c1", display_name: "Kid", created_at: "2026-09-01T00:00:00Z" }], error: null };
      if (q.table === "profiles") return { data: { active_child_id: "c1", active_child_set_at: null }, error: null };
      if (did(q, "insert")) return { data: { id: "pass-new" }, error: null };
      const upd = q.ops.find(([n]) => n === "update");
      if (upd) stored.push(upd[1]);
      return { data: null, error: null };
    },
    generate: async (prompt) => { calls++; return { parsed: JSON.parse(JSON.stringify(answer(prompt, calls))), modelUsed: "stub" }; },
  });
  Math.random = () => (wanted + 0.5) / list.length; // picks the wanted type; the template pick then uses index 0 of one-item lists or the first of several
  try {
    const res = await call(h, { method: "POST", body: { tier, country: COUNTRY, gradeLabel: GRADE[tier], interest: "space", childId: "c1" } });
    return { res, stored: stored[0], calls };
  } finally { Math.random = real; }
}
const RAWQ = {
  mc: () => ({ q: "What happened at ten o'clock?", options: ["Only two people stopped", "A queue formed", "The cakes were gone", "Mia went home"], correct: 0 }),
  tfng: () => ({ q: "The queue formed before the sign was moved.", correct: 1 }),
  evidence: () => ({ q: "Which line best supports your answer to the question before?", options: ["By ten, only two people had stopped, and both only looked.", "Mia set up her stall by the gate at nine.", "She moved the sign closer to the road and wrote the price in bigger letters.", "Soon a queue had formed, and by noon every cake was gone."], correct: 0 }),
  order: () => ({ q: "Put these events in the order they happen.", steps: ["Mia set up her stall", "Only two people stopped", "She moved the sign", "A queue formed"] }),
  match: () => ({ q: "Match each word to its meaning as it is used in the passage.", pairs: [{ word: "stall", meaning: "a table where things are sold" }, { word: "queue", meaning: "a line of people waiting" }, { word: "price", meaning: "what something costs" }, { word: "gate", meaning: "an opening in a fence" }] }),
  cloze: (tier) => ({ q: "Choose the best word for each gap.", text: "Soon a ___ had formed, and by noon every cake was ___.".replace(tier === "middle" ? "" : " , ", ""), blanks: [{ answer: "queue", wrong: ["storm", "puddle", "melody"] }, { answer: "gone", wrong: ["warm", "tiny", "loud"] }] }),
  short: (tier) => ({ q: "Why did Mia move her sign?", keyPoints: ["more people to notice", "only two had stopped", "a bigger price was clearer"].slice(0, QT.SHORT_MARKS[tier] || 2), modelParts: QT.answerFramework(QT.SHORT_FRAMEWORK[tier] || "RACE").parts.map(([n]) => ({ part: n, text: n + ": Mia moved her sign for a reason." })) }),
};
const styleOf = (prompt) => [...prompt.matchAll(/^Question \d+ - ([^:]+):/gm)].map((m) => Object.keys(QT.STYLE_LABEL).find((k) => QT.STYLE_LABEL[k] === m[1]));
const fakeAnswer = (extra) => (prompt) => ({ title: "At Oakfield", skill: "Reading data", passage: extra.passage, ...(extra.visual ? { visual: extra.visual } : {}), questions: styleOf(prompt).map((s) => RAWQ[s](/Elementary/.test(prompt) ? "elementary" : /Middle School/.test(prompt) ? "middle" : "high")) });

test("a data text is generated with its table, kept with the passage, and sent to the page with the questions", async () => {
  const { res, stored } = await generate("middle", (t) => t.visual === "table", fakeAnswer({ passage: CORE + " " + filler(120), visual: TABLE }));
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.textType, "data table");
  assert.deepEqual(res.body.visual, TABLE);
  assert.deepEqual(stored.content.generatedPassage.visual, TABLE, "kept for marking and for showing again");
  assert.ok(res.body.questions.every((q) => ["mc", "tfng", "short"].includes(q.type)), res.body.questions.map((q) => q.type).join());
});

test("a bar chart is generated too, with numbers given as text tidied into numbers", async () => {
  const loose = { ...CHART, items: CHART.items.map((it) => ({ ...it, value: String(it.value) })) };
  const { res } = await generate("high", (t) => t.visual === "chart", fakeAnswer({ passage: CORE + " " + filler(180), visual: loose }));
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.visual, CHART);
});

test("data that is wrong the first time is asked for again, and a broken run still ends in a usable passage or the plain error", async () => {
  let n = 0;
  const { res, calls } = await generate("middle", (t) => t.visual === "table", (prompt) => { n++; return fakeAnswer({ passage: CORE + " " + filler(120), visual: n === 1 ? { type: "table", title: "x", headers: ["a"], rows: [] } : TABLE })(prompt); });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(calls, 2);
  assert.deepEqual(res.body.visual, TABLE);
  const never = await generate("middle", (t) => t.visual === "table", fakeAnswer({ passage: CORE + " " + filler(120), visual: { type: "table" } }));
  assert.equal(never.res.statusCode, 502, "no usable data ever: the plain error, nothing left reserved");
  assert.equal(never.stored, undefined);
});

test("two texts are generated as one passage that holds both, and an ordinary passage carries no data", async () => {
  const two = `Text A: The stall\n${CORE}\n\nText B: The customer\n${filler(90)}`;
  const { res } = await generate("elementary", (t) => t.two, fakeAnswer({ passage: two }));
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.textType, "two short texts");
  assert.match(res.body.passage, /^Text A: The stall\n/m); assert.match(res.body.passage, /\nText B: The customer\n/);
  assert.equal(res.body.visual, null);
  const ordinary = await generate("middle", (t) => t.name === "short story", fakeAnswer({ passage: CORE + " " + filler(200) }));
  assert.equal(ordinary.res.statusCode, 200, JSON.stringify(ordinary.res.body));
  assert.equal(ordinary.res.body.visual, null);
});

test("the marking prompt carries the data, so feedback can talk about the numbers", async () => {
  const q = QT.normalizeQuestions([{ q: "How many pupils have a dog?", options: ["12", "9", "5", "26"], correct: 0 }], ["mc"])[0];
  const withData = buildReadingPrompt({ tier: "middle", country: COUNTRY, gradeLabel: "Year 8", interest: "space", passageTitle: "Pets", passage: "Some pupils keep pets.", visual: TABLE, questions: [q], answers: [0], score: 1, totalQuestions: 1, targetNames: [], targets: [], capabilities: {} });
  assert.match(withData, /It came with this data/); assert.match(withData, /Dog \| 12/);
  const without = buildReadingPrompt({ tier: "middle", country: COUNTRY, gradeLabel: "Year 8", interest: "space", passageTitle: "Pets", passage: "Some pupils keep pets.", questions: [q], answers: [0], score: 1, totalQuestions: 1, targetNames: [], targets: [], capabilities: {} });
  assert.doesNotMatch(without, /came with this data/);
});

// ------------------------------------------------------------ the page

const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const a = APP.indexOf("function splitTwoTexts"), b = APP.indexOf("function PassageBody");
assert.ok(a > 0 && b > a);
const P = new Function(APP.slice(a, b) + "\nreturn { splitTwoTexts, quoteSpan, passageParagraphs };")();

test("the page splits two texts exactly as the server does, and shows an ordinary passage whole", () => {
  const two = `Text A: The stall\n${CORE}\n\nText B: The customer\nI waited ages. It was worth it.`;
  const parts = P.splitTwoTexts(two);
  assert.deepEqual(parts.map((t) => [t.label, t.title]), [["Text A", "The stall"], ["Text B", "The customer"]]);
  assert.equal(parts[0].body, CORE);
  assert.equal(parts[1].body, "I waited ages. It was worth it.");
  assert.equal(P.splitTwoTexts(CORE), null);
  assert.equal(P.splitTwoTexts(null), null);
  // the same rule as the server's: whatever the page splits, the server would have accepted, and the reverse
  const ok = [];
  validatePassage({ title: "T", skill: "S", passage: `Text A: One\n${CORE}\n\nText B: Two\n${CORE}`, questions: [] }, { tier: "middle", template: [], textType: { two: true } }).issues.forEach((i) => ok.push(i));
  assert.ok(!ok.some((i) => /must hold two texts/.test(i)));
  assert.ok(P.splitTwoTexts(`Text A: One\n${CORE}\n\nText B: Two\n${CORE}`));
});

test("a quote is found again whatever its capitals, punctuation or line breaks, and a quote that is not there is not marked", () => {
  const poem = "At dusk, the bus stop coughs up blue moths,\nand the streetlight learns my face by heart.\n\nI thought the night was a locked room.";
  const span = P.quoteSpan(poem, "THE STREETLIGHT learns my face by heart");
  assert.equal(poem.slice(span.start, span.end), "the streetlight learns my face by heart");
  const across = P.quoteSpan(poem, "blue moths and the streetlight");
  assert.equal(poem.slice(across.start, across.end), "blue moths,\nand the streetlight", "a quote that runs over a line break");
  assert.equal(P.quoteSpan(poem, "the river carried tin reflections"), null);
  assert.equal(P.quoteSpan(poem, ""), null); assert.equal(P.quoteSpan(poem, "!!!"), null); assert.equal(P.quoteSpan(null, "x"), null);
  assert.ok(P.quoteSpan("It's a lovely day, isn't it?", "isn't it"));
  assert.equal(P.quoteSpan("a.b", "a b").start, 0, "punctuation is not a barrier");
  assert.doesNotThrow(() => P.quoteSpan("text", "(((  [[[ *** ???"), "characters that mean something in a pattern are harmless");
  assert.doesNotThrow(() => P.quoteSpan("text", "a+b (c"));
});

test("the marked passage keeps its paragraphs, and marks only the quote, even across a paragraph break", () => {
  const text = "First paragraph here.\n\nSecond paragraph with the key line inside it.\n\nThird.";
  const span = P.quoteSpan(text, "the key line");
  const paras = P.passageParagraphs(text, span);
  assert.equal(paras.length, 3);
  assert.deepEqual(paras[1].map((s) => [s.text, s.mark]), [["Second paragraph with ", false], ["the key line", true], [" inside it.", false]]);
  assert.ok(paras[0].every((s) => !s.mark) && paras[2].every((s) => !s.mark));
  assert.equal(paras.map((p) => p.map((s) => s.text).join("")).join("\n\n"), text, "nothing lost or doubled");
  const over = P.passageParagraphs(text, P.quoteSpan(text, "inside it Third"));
  assert.ok(over[1].some((s) => s.mark) && over[2].some((s) => s.mark), "both halves of a quote that crosses paragraphs are marked");
  assert.deepEqual(P.passageParagraphs("One.\n\nTwo.", null).map((p) => p.length), [1, 1]);
  assert.deepEqual(P.passageParagraphs("", null), [[{ text: "", mark: false }]]);
});

test("the page shows the data, the two texts, and a 'Show in passage' button, and passes the data on", () => {
  assert.match(APP, /function VisualBlock/);
  assert.match(APP, /function PassageView/);
  assert.match(APP, /Show in passage/);
  assert.match(APP, /visual: result\.visual \|\| null/);
  assert.match(APP, /<PassageView bank=\{bank\} \/>/);
  assert.match(APP, /<PassageView bank=\{bank\} quote=\{shownQuote\} \/>/);
  assert.match(APP, /scrollIntoView/);
});
