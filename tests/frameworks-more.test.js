const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const TECH = require("../api/_lib/techniques");
const QT = require("../api/_lib/questionTypes");
const { standardsFor } = require("../api/_lib/curriculum");
const { targetsForGrade } = require("../api/_lib/masteryTargets");
const { frameworkFor } = require("../api/_lib/writingFrameworks");
const { buildWritingPrompt, buildReadingPrompt } = require("../api/_lib/prompt");
const { repairShortAnswer, validatePassage } = require("../api/_lib/validate");
const { did, loadHandler, call } = require("./harness");

// The extra teaching frameworks: AFOREST (persuasive devices) in writing, RACE and CER (building a written answer) in
// reading, and the Frayer card (definition, characteristics, example, non-example) for vocabulary.

const COUNTRY = "🇬🇧 United Kingdom";
const GRADE = { early: "Year 2", elementary: "Year 5", middle: "Year 8", high: "Year 11" };
const TEXT = "Everyone should recycle! Did you know that 90 percent of litter can be recycled? It is safe, smart and simple. Big bold bins help us all.";

// ------------------------------------------------------------ AFOREST

test("the seven devices are named and explained once, here, with letters that spell AFOREST", () => {
  assert.deepEqual(TECH.PERSUASIVE_DEVICES.map(([n]) => n), ["Alliteration", "Facts", "Opinion", "Rhetorical question", "Emotive language", "Statistics", "Triple"]);
  assert.equal(TECH.PERSUASIVE_DEVICES.map(([n]) => n[0]).join(""), "AFOREST");
  assert.ok(TECH.PERSUASIVE_DEVICES.every(([, m]) => m.length > 15));
});

test("AFOREST applies to persuasive pieces from Elementary up, and to nothing else", () => {
  for (const tier of ["elementary", "middle", "high"]) assert.equal(TECH.devicesApply("persuasive", tier), true, tier);
  assert.equal(TECH.devicesApply("persuasive", "early"), false, "an Early Years child has Opinion and Reason");
  for (const g of ["narrative", "descriptive", "analytical"]) assert.equal(TECH.devicesApply(g, "middle"), false, g);
  assert.equal(TECH.devicesApply("nonsense", "high"), true, "an unknown genre falls back to the tier's default, which is persuasive at High School");
  assert.equal(TECH.devicesApply(undefined, "elementary"), false, "Elementary's default is narrative");
  assert.equal(TECH.devicesApply("persuasive", undefined), false);
});

function writingArgs(tier, genre, plan = "premium") {
  const targets = targetsForGrade(COUNTRY, GRADE[tier], tier).targets;
  const { capabilitiesFor } = require("../api/_lib/plans");
  return { tier, country: COUNTRY, gradeLabel: GRADE[tier], interest: "space", prompt: "Persuade your reader.", text: TEXT, capabilities: capabilitiesFor(plan), targets, targetNames: targets.map((t) => t.name), genre };
}

test("a persuasive piece's prompt asks for the device check, with the exact names, and other genres do not", () => {
  for (const plan of ["free", "core", "premium"]) {
    const p = buildWritingPrompt(writingArgs("middle", "persuasive", plan));
    assert.match(p, /PERSUASIVE DEVICES \(AFOREST\)/, plan);
    for (const [n] of TECH.PERSUASIVE_DEVICES) assert.ok(p.includes(`"${n}"`), `${plan}: ${n}`);
    assert.match(p, /^ {2}"deviceCheck":/m);
    const shape = p.slice(p.lastIndexOf("exactly this shape:") + 19).trim();
    assert.doesNotMatch(shape, /,\s*\n\s*}/); assert.doesNotMatch(shape, /,\s*,/);
  }
  for (const [tier, genre] of [["early", "persuasive"], ["middle", "narrative"], ["elementary", "descriptive"], ["high", "analytical"]]) {
    const p = buildWritingPrompt(writingArgs(tier, genre));
    assert.doesNotMatch(p, /AFOREST|deviceCheck/, `${tier}/${genre}`);
  }
});

test("Premium's split puts the device check with the coaching, never the assessment or rewrites", () => {
  const { splitPrompts } = require("../api/_lib/prompt");
  const parts = splitPrompts(writingArgs("high", "persuasive"));
  assert.match(parts.core.prompt, /deviceCheck/);
  assert.doesNotMatch(parts.assess.prompt, /deviceCheck|AFOREST/);
  assert.doesNotMatch(parts.responses.prompt, /deviceCheck|AFOREST/);
  assert.equal(require("../api/_lib/splitGenerate").partOf("deviceCheck is wrong"), "core");
});

test("a device only counts as used when its quote is really in the student's text; anything wrong is dropped, never an error", () => {
  const good = () => ({ deviceCheck: {
    used: [
      { device: "rhetorical question", quote: "Did you know that 90 percent of litter can be recycled?" },
      { device: "Triple", quote: "safe, smart and simple" },
      { device: "Triple", quote: "safe, smart and simple" },                    // repeat
      { device: "Alliteration", quote: "Big bold bins" },
      { device: "Facts", quote: "the sea is full of plastic" },                 // not in the text
      { device: "Made up device", quote: "Everyone should recycle" },           // not a device
      { device: "Opinion", quote: "" },                                          // no quote
      null, "x",
    ],
    tryNext: { device: "Emotive language", idea: "Add a feeling word to your first sentence, such as heartbreaking, so the reader cares." },
  } });
  const p = good();
  TECH.repairDevices(p, TEXT);
  assert.deepEqual(p.deviceCheck.used.map((u) => u.device), ["Rhetorical question", "Triple", "Alliteration"], "capitalised properly, repeats and untrue claims gone");
  assert.equal(p.deviceCheck.tryNext.device, "Emotive language");
  assert.equal(p.deviceCheck.devices.length, 7);
  assert.deepEqual(p.deviceCheck.devices.map((d) => d.letter).join(""), "AFOREST");
  // a suggestion for a device that was already used, or with no idea, is dropped
  for (const bad of [{ device: "Triple", idea: "Use a triple again somewhere else." }, { device: "Emotive language", idea: "" }, { device: "Nope", idea: "Do something clever here please." }, "x", null]) {
    const q = good(); q.deviceCheck.tryNext = bad; TECH.repairDevices(q, TEXT);
    assert.ok(!q.deviceCheck.tryNext, JSON.stringify(bad));
  }
  // nothing left: the card is not shown at all
  for (const dc of [{ used: [{ device: "Facts", quote: "not in the text at all" }] }, null, "x", [], { used: "nope" }]) {
    const q = { deviceCheck: dc, glow: "kept" }; TECH.repairDevices(q, TEXT);
    assert.ok(!("deviceCheck" in q), JSON.stringify(dc));
    assert.equal(q.glow, "kept");
  }
  const none = { glow: "x" }; assert.deepEqual(TECH.repairDevices(none, TEXT), { glow: "x" });
});

// ---- through the endpoint

function standardToken(tier) {
  const list = standardsFor(COUNTRY, tier, GRADE[tier]) || [];
  const skip = new Set(["the", "and", "for", "statutory", "english", "app", "year", "yr", "standard", "standards", "grade", "level", "aim", "aims", "programme", "study"]);
  for (const std of list) { const tok = (std.toLowerCase().match(/[a-z0-9.\-]+/g) || []).find((t) => t.length >= 3 && !skip.has(t)); if (tok) return tok; }
  return "";
}
function freeFeedback(tier, genre) {
  const targets = targetsForGrade(COUNTRY, GRADE[tier], tier).targets;
  const fw = frameworkFor(genre, tier);
  return {
    glow: `Your opening is clear and confident. It shows ${standardToken(tier)} well.`,
    grow: "Add one feeling word to the first sentence. It will make the reader care more.",
    vocab: [
      { term: "recycle", definition: "to turn old things into new things.", example: "We recycle our cans every week.", trick: "Re- means again, so recycle means use again.", characteristics: "reusing materials", nonExample: "putting rubbish in a landfill" },
      { term: "litter", definition: "rubbish left lying around.", example: "The park was full of litter.", trick: "Look inside: lit and ter.", characteristics: "untidy and unwanted", nonExample: "a neat bin of rubbish" },
    ],
    glowTarget: targets[0].name,
    growTarget: targets[1] ? targets[1].name : targets[0].name,
    highlights: [
      { quote: "Everyone should recycle!", type: "glow", note: "A strong, clear opening." },
      { quote: "Big bold bins help us all", type: "grow", note: "Say why the bins help.", revision: "Big bold bins help us all because they make recycling easy" },
    ],
    frameworkTip: { name: fw.name, quote: "Big bold bins help us all", revision: "Reason: big bold bins help us all because they make recycling easy." },
    revisedStory: "Everyone should recycle! Did you know that 90 percent of litter can be recycled? It is safe, smart and simple. Big, bold bins help us all.",
  };
}
function db(tier, genre, written) {
  const row = { id: "sub1", child_id: "c1", tier, country: COUNTRY, grade_label: GRADE[tier], interest: "football", content: { generatedPrompt: { prompt: "Persuade your reader.", genre } }, feedback: null };
  return (q) => {
    if (q.table !== "submissions") return { data: null, error: null };
    if (did(q, "single")) return { data: row, error: null };
    if (did(q, "is")) return { data: [{ id: "sub1" }], error: null };
    const upd = q.ops.find(([n]) => n === "update");
    if (upd && upd[1] && upd[1].feedback && !upd[1].feedback._pending) written.push(upd[1]);
    return { data: null, error: null };
  };
}
async function submit(plan, tier, genre, extra) {
  const was = process.env.PREMIUM_SPLIT; process.env.PREMIUM_SPLIT = "0"; // one combined reply: the split has its own tests
  const written = [];
  try {
    const h = loadHandler("submit.js", { plan, db: db(tier, genre, written), generate: async () => ({ parsed: JSON.parse(JSON.stringify({ ...freeFeedback(tier, genre), ...extra })), modelUsed: "stub" }) });
    const res = await call(h, { method: "POST", body: { kind: "writing", submissionId: "sub1", text: TEXT } });
    return { res, written };
  } finally { if (was === undefined) delete process.env.PREMIUM_SPLIT; else process.env.PREMIUM_SPLIT = was; }
}
const DEVICES = { deviceCheck: { used: [{ device: "Triple", quote: "safe, smart and simple" }, { device: "Facts", quote: "invented words nobody wrote" }], tryNext: { device: "Emotive language", idea: "Add a feeling word to your first sentence so the reader cares." } } };

test("through the endpoint: a persuasive piece gets the AFOREST card on Free and Core, with only the true devices (Premium shares the same repair; its prompts are covered above)", async () => {
  for (const plan of ["free", "core"]) {
    const { res, written } = await submit(plan, "elementary", "persuasive", DEVICES);
    assert.equal(res.statusCode, 200, plan + " " + JSON.stringify(res.body));
    const dc = res.body.feedback.deviceCheck;
    assert.deepEqual(dc.used.map((u) => u.device), ["Triple"], plan);
    assert.equal(dc.tryNext.device, "Emotive language");
    assert.equal(dc.devices.length, 7);
    assert.equal(written[0].feedback.deviceCheck.used.length, 1, "what is stored matches");
  }
});

test("through the endpoint: other genres never show the card, even if the model sent one, and a broken card never costs the feedback", async () => {
  const narrative = await submit("free", "elementary", "narrative", DEVICES);
  assert.equal(narrative.res.statusCode, 200, JSON.stringify(narrative.res.body));
  assert.ok(!("deviceCheck" in narrative.res.body.feedback));
  const broken = await submit("free", "elementary", "persuasive", { deviceCheck: "garbage" });
  assert.equal(broken.res.statusCode, 200, JSON.stringify(broken.res.body));
  assert.ok(!("deviceCheck" in broken.res.body.feedback));
  assert.ok(broken.res.body.feedback.glow);
  const early = await submit("free", "early", "persuasive", DEVICES);
  assert.ok(!("deviceCheck" in early.res.body.feedback), "an Early Years child gets Opinion and Reason, not AFOREST");
});

// ------------------------------------------------------------ the Frayer card

test("Elementary and up are asked for the Frayer fields on every vocabulary word; Early Years are not", () => {
  assert.equal(TECH.frayerClause("early"), ""); assert.equal(TECH.frayerShape("early"), "");
  for (const tier of ["elementary", "middle", "high"]) {
    assert.match(TECH.frayerClause(tier), /characteristics/); assert.match(TECH.frayerClause(tier), /nonExample/);
    assert.match(TECH.frayerShape(tier), /"characteristics"[\s\S]*"nonExample"/);
  }
  for (const tier of ["early", "elementary", "high"]) {
    const w = buildWritingPrompt(writingArgs(tier, "narrative", "free"));
    assert.equal(/FRAYER WORD CARD/.test(w), tier !== "early", "writing " + tier);
    assert.equal((w.match(/"nonExample": "a short phrase/g) || []).length, tier === "early" ? 0 : 2, "both vocabulary items, " + tier);
    const questions = [0, 1, 2, 3, 4].map((i) => ({ type: "mc", q: "Question " + i + " about it?", options: ["a", "b", "c", "d"], correct: 0 }));
    const r = buildReadingPrompt({ tier, country: COUNTRY, gradeLabel: GRADE[tier], interest: "space", passageTitle: "T", passage: "A passage. ".repeat(20), questions, answers: [0, 0, 0, 0, 0], score: 5, totalQuestions: 5, targetNames: [], targets: [], capabilities: {} });
    assert.equal(/FRAYER WORD CARD/.test(r), tier !== "early", "reading " + tier);
    assert.equal((r.match(/"nonExample": "a short phrase/g) || []).length, tier === "early" ? 0 : 2, "reading shape " + tier);
  }
});

test("the Frayer fields are tidied and an odd one is dropped, never a reason to fail the feedback", () => {
  const p = { vocab: [
    { term: "a", definition: "d", characteristics: "  reusing materials. ", nonExample: "putting rubbish in a landfill." },
    { term: "b", definition: "d", characteristics: "x", nonExample: "y".repeat(300) },
    { term: "c", definition: "d", characteristics: 42, nonExample: null },
    { term: "d", definition: "d" },
    null,
  ] };
  TECH.repairFrayer(p);
  assert.deepEqual([p.vocab[0].characteristics, p.vocab[0].nonExample], ["reusing materials", "putting rubbish in a landfill"]);
  assert.deepEqual(Object.keys(p.vocab[1]).sort(), ["definition", "term"], "too short or too long: dropped");
  assert.deepEqual(Object.keys(p.vocab[2]).sort(), ["definition", "term"]);
  assert.deepEqual(Object.keys(p.vocab[3]).sort(), ["definition", "term"]);
  assert.deepEqual(TECH.repairFrayer({ glow: "x" }), { glow: "x" });
});

test("through the endpoint: the Frayer fields are delivered, and an odd one is dropped while the rest of the feedback stands", async () => {
  const { res } = await submit("core", "middle", "persuasive", { vocab: [
    { term: "recycle", definition: "to turn old things into new things.", example: "We recycle our cans every week.", trick: "Re- means again, so recycle means use again.", characteristics: "reusing materials", nonExample: "putting rubbish in a landfill" },
    { term: "litter", definition: "rubbish left lying around.", example: "The park was full of litter.", trick: "Look inside: lit and ter.", characteristics: "z", nonExample: "a neat bin of rubbish" },
  ] });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(res.body.feedback.vocab[0].characteristics, "reusing materials");
  assert.equal(res.body.feedback.vocab[1].characteristics, undefined);
  assert.equal(res.body.feedback.vocab[1].nonExample, "a neat bin of rubbish");
});

test("the vocabulary bank carries a word's card fields from the saved feedback to the page", async () => {
  const sub = { id: "s1", kind: "writing", tier: "middle", country: COUNTRY, score: null, total_questions: null, word_count: 20, created_at: "2026-10-05T10:00:00Z", feedback: { vocab: [{ term: "recycle", definition: "to reuse.", example: "We recycle.", trick: "Re- means again.", characteristics: "reusing materials", nonExample: "dumping rubbish" }] } };
  const h = loadHandler("history.js", { plan: "core", db: (q) => (q.table === "submissions" ? { data: [sub], error: null } : q.table === "vocab_progress" ? { data: [], error: null } : { data: null, error: null }) });
  const res = await call(h, { method: "GET", query: { childId: "c1" } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.vocabWords[0], { term: "recycle", definition: "to reuse.", example: "We recycle.", trick: "Re- means again.", characteristics: "reusing materials", nonExample: "dumping rubbish", createdAt: "2026-10-05T10:00:00Z" });
});

test("the page lays a word out as a four-box card and leaves out any box with nothing in it", () => {
  const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  const a = APP.indexOf("function frayerCells"), b = APP.indexOf("function FrayerCard");
  assert.ok(a > 0 && b > a);
  const { frayerCells } = new Function(APP.slice(a, b) + "\nreturn { frayerCells };")();
  assert.deepEqual(frayerCells({ definition: "d", characteristics: "c", example: "e", nonExample: "n" }).map(([l]) => l), ["Definition", "Characteristics", "Example", "Not an example"]);
  assert.deepEqual(frayerCells({ definition: "d", example: "e" }).map(([l]) => l), ["Definition", "Example"], "an older word has two boxes");
  assert.deepEqual(frayerCells({ definition: "  ", characteristics: null, example: 5 }), []);
  assert.deepEqual(frayerCells(null), []);
  assert.deepEqual(frayerCells({ definition: "  d  " }), [["Definition", "d"]]);
});

// ------------------------------------------------------------ RACE and CER

test("a written answer is built with RACE up to Middle School and CER at High School, defined once here", () => {
  assert.deepEqual(QT.SHORT_FRAMEWORK, { elementary: "RACE", middle: "RACE", high: "CER" });
  assert.deepEqual(QT.ANSWER_FRAMEWORKS.RACE.parts.map(([n]) => n), ["Restate", "Answer", "Cite", "Explain"]);
  assert.deepEqual(QT.ANSWER_FRAMEWORKS.CER.parts.map(([n]) => n), ["Claim", "Evidence", "Reasoning"]);
  assert.equal(QT.answerFramework("nope"), null);
});

function rawShort(tier, parts) {
  const fw = QT.answerFramework(QT.SHORT_FRAMEWORK[tier]);
  return { q: "Why did the writer do it?", keyPoints: ["the first idea", "the second idea", "the third idea"].slice(0, { elementary: 2, middle: 3, high: 3 }[tier]), modelParts: parts || fw.parts.map(([n]) => ({ part: n.toLowerCase(), text: `The ${n} sentence does its job well.` })) };
}

test("the model answer is written in the framework's parts, joined into the full answer, and the student sees only the steps", () => {
  for (const tier of ["elementary", "middle", "high"]) {
    const [q] = QT.normalizeQuestions([rawShort(tier)], ["short"], Math.random, tier);
    const fw = QT.answerFramework(QT.SHORT_FRAMEWORK[tier]);
    assert.equal(q.framework, fw.name);
    assert.deepEqual(q.modelParts.map((m) => m.part), fw.parts.map(([n]) => n), "names snapped to the right spelling");
    assert.equal(q.modelAnswer, q.modelParts.map((m) => m.text).join(" "));
    const issues = []; QT.validateQuestions([q], { template: ["short"] }, issues);
    assert.deepEqual(issues, [], tier);
    const pub = QT.publicQuestion(q);
    assert.equal(pub.framework.name, fw.name);
    assert.deepEqual(pub.framework.parts.map((p) => p.name), fw.parts.map(([n]) => n));
    assert.ok(pub.framework.parts.every((p) => p.meaning.length > 8));
    assert.ok(!("modelParts" in pub) && !("modelAnswer" in pub) && !("keyPoints" in pub), "the answer is not given away");
  }
});

test("a model answer with the wrong parts, in the wrong order, or with a part missing is refused", () => {
  const fw = QT.answerFramework("RACE");
  const mk = (parts) => { const [q] = QT.normalizeQuestions([rawShort("middle", parts)], ["short"], Math.random, "middle"); const issues = []; QT.validateQuestions([q], { template: ["short"] }, issues); return issues; };
  const ok = fw.parts.map(([n]) => ({ part: n, text: `A sentence for ${n}.` }));
  assert.deepEqual(mk(ok), []);
  assert.ok(mk(ok.slice(0, 3)).some((i) => /modelParts must be exactly 4 segments/.test(i)), "a part missing");
  assert.ok(mk([ok[1], ok[0], ok[2], ok[3]]).some((i) => /modelParts/.test(i)), "wrong order");
  assert.ok(mk(ok.map((m, k) => (k === 2 ? { ...m, part: "Quote" } : m))).some((i) => /modelParts/.test(i)), "a part that is not in RACE");
  assert.ok(mk(ok.map((m, k) => (k === 1 ? { ...m, text: "" } : m))).some((i) => /modelParts|modelAnswer/.test(i)), "an empty part");
});

test("the generator is told the exact parts to write, for the age", () => {
  const { buildReadingPassagePrompt } = require("../api/_lib/prompt");
  for (const [tier, names] of [["elementary", ["Restate", "Answer", "Cite", "Explain"]], ["middle", ["Restate", "Answer", "Cite", "Explain"]], ["high", ["Claim", "Evidence", "Reasoning"]]]) {
    const p = buildReadingPassagePrompt({ tier, country: COUNTRY, gradeLabel: GRADE[tier], textType: { name: "short story" }, template: ["mc", "mc", "mc", "mc", "mc", "short"] });
    assert.match(p, new RegExp(`exactly ${names.length} objects`), tier);
    for (const n of names) assert.ok(p.includes(`"part": "${n}"`), `${tier}: ${n}`);
    assert.match(p, tier === "high" ? /CER/ : /RACE/);
  }
});

test("marking notes which parts the answer used, for information only, and a blank answer used none", () => {
  const [q] = QT.normalizeQuestions([rawShort("middle")], ["short"], Math.random, "middle");
  const run = (sa, written) => { const p = { shortAnswer: sa }; repairShortAnswer(p, q, written); return p.shortAnswer; };
  const marked = run({ made: [1, 2], structure: ["restate", "Cite", "Rubbish"], comment: "A good answer overall, well done." }, "Because it mattered. They cite it.");
  assert.deepEqual(marked.parts, [{ name: "Restate", used: true }, { name: "Answer", used: false }, { name: "Cite", used: true }, { name: "Explain", used: false }]);
  assert.equal(marked.awarded, 2, "the marks come from the key ideas, not from the parts");
  assert.ok(!("structure" in marked));
  const none = run({ made: [1], comment: "A decent attempt at this one." }, "Something.");
  assert.ok(!("parts" in none), "no list from the model, nothing invented");
  assert.equal(none.awarded, 1);
  const blank = run({ made: [1, 2, 3], structure: ["Restate"], comment: "A decent attempt at this one." }, "  ");
  assert.equal(blank.awarded, 0);
  assert.ok(blank.parts.every((p) => !p.used));
  const all = run({ made: [], structure: ["Restate", "Answer", "Cite", "Explain"], comment: "Good structure but off topic." }, "Off topic but well structured.");
  assert.equal(all.awarded, 0, "good structure does not earn marks the ideas did not");
  assert.ok(all.parts.every((p) => p.used));
});

test("the marking prompt asks which RACE or CER parts were used, and says it changes no marks", () => {
  for (const tier of ["middle", "high"]) {
    const [q] = QT.normalizeQuestions([rawShort(tier)], ["short"], Math.random, tier);
    const mc = { type: "mc", q: "Q?", options: ["a", "b", "c", "d"], correct: 0 };
    const p = buildReadingPrompt({ tier, country: COUNTRY, gradeLabel: GRADE[tier], interest: "space", passageTitle: "T", passage: "A passage. ".repeat(20), questions: [mc, q], answers: [0, "Because it was good."], score: 1, totalQuestions: 1, targetNames: [], targets: [], capabilities: { deepFeedback: true } });
    assert.match(p, /"structure"/);
    assert.match(p, /never changes the marks/);
    assert.ok(p.includes(tier === "high" ? "Claim, Evidence, Reasoning" : "Restate, Answer, Cite, Explain"));
  }
});

test("the page shows the steps beside the question, the parts used after marking, and the model answer in its parts", () => {
  const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  assert.match(APP, /Build your answer with \{q\.framework\.name\}/);
  assert.match(APP, /marked\.parts\.map/);
  assert.match(APP, /q\.modelParts\.map/);
  assert.match(APP, /function DevicesPanel/);
  assert.match(APP, /<DevicesPanel feedback=\{feedback\} \/>/);
  assert.match(APP, /function FrayerCard/);
});

test("after marking, the page names the framework whether the question came as sent to the browser or as stored (found live: it said 'built with undefined')", () => {
  const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  const a = APP.indexOf("const qFwName"), b = APP.indexOf("\n", a);
  assert.ok(a > 0);
  const { qFwName } = new Function(APP.slice(a, b) + "\nreturn { qFwName };")();
  const [stored] = QT.normalizeQuestions([rawShort("high")], ["short"], Math.random, "high");
  assert.equal(typeof stored.framework, "string", "the revealed key carries the framework as a name");
  assert.equal(qFwName(stored), "CER");
  assert.equal(qFwName(QT.publicQuestion(stored)), "CER", "the question as first sent carries it as an object");
  assert.equal(qFwName({}), ""); assert.equal(qFwName(null), ""); assert.equal(qFwName({ framework: {} }), "");
  assert.doesNotMatch(APP, /built with " + q.framework.name/, "no place builds the label straight from q.framework.name");
});
