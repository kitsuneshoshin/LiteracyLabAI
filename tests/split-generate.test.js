const test = require("node:test");
const assert = require("node:assert/strict");
const { capabilitiesFor } = require("../api/_lib/plans");
const { targetsForGrade, examTargetsFor } = require("../api/_lib/masteryTargets");
const { standardsFor } = require("../api/_lib/curriculum");
const { frameworkFor, frameworkParts, DEFAULT_GENRE_BY_TIER } = require("../api/_lib/writingFrameworks");
const { assessLength } = require("../api/_lib/calibrate");
const RESP = require("../api/_lib/responses");
const { makeSplitGenerator, partOf, splitEnabled, RESPONSE_KEYS, ASSESS_KEYS } = require("../api/_lib/splitGenerate");
const { correctiveAddendum, splitPrompts, buildWritingPrompt } = require("../api/_lib/prompt");
const { did, loadHandler, call } = require("./harness");

// A Premium writing answer is asked for as three calls at once (the coaching, the assessment, and the long
// rewrites), and only the part that failed is asked again. These tests cover the joining and retrying, the
// prompts themselves, and the whole thing through api/submit.js with a stand-in model that answers each part
// the way the real one is asked to.

const COUNTRY = "🇬🇧 United Kingdom";
const TIERS = { early: "Year 2", elementary: "Year 5", middle: "Year 8", high: "Year 11" };
const EXAM_TIERS = new Set(["middle", "high"]);
const TEXT = "The dog ran fast. It saw a cat up in a tree. The end of the story was happy.";
const ALL_THREE = { core: { prompt: "CORE", maxTokens: 1 }, assess: { prompt: "ASSESS", maxTokens: 2 }, responses: { prompt: "RESP", maxTokens: 3 } };

// ------------------------------------------------------------ the joining and retrying

test("the three parts are asked at once, each with its own prompt and room, and every field comes only from its own call", async () => {
  const calls = [];
  const next = makeSplitGenerator(ALL_THREE, async (prompt, o) => {
    calls.push([prompt, o.maxTokens]);
    // each call also sends fields that belong to the others: they must be ignored
    if (prompt === "CORE") return { parsed: { glow: "g", revisedStory: "stray", overallScore: 1 }, modelUsed: "m" };
    if (prompt === "ASSESS") return { parsed: { overallScore: 7, spellingGrammar: [], glow: "stray2", modelFramework: ["stray"] }, modelUsed: "m" };
    return { parsed: { revisedStory: "rs", modelFramework: [1], glow: "stray3", examSummary: "stray" }, modelUsed: "m" };
  }, correctiveAddendum);
  const r = await next([]);
  assert.deepEqual(calls.map((c) => c[0]).sort(), ["ASSESS", "CORE", "RESP"]);
  assert.deepEqual(Object.fromEntries(calls), { CORE: 1, ASSESS: 2, RESP: 3 });
  assert.deepEqual(r.parsed, { glow: "g", overallScore: 7, spellingGrammar: [], revisedStory: "rs", modelFramework: [1] });
  assert.equal(r.modelUsed, "m");
});

test("a retry asks again only for the parts that failed, and tells each only its own problems", async () => {
  const calls = [];
  const next = makeSplitGenerator(ALL_THREE, async (prompt) => {
    calls.push(prompt);
    return { parsed: prompt.startsWith("CORE") ? { glow: "g" + calls.length } : prompt.startsWith("ASSESS") ? { overallScore: calls.length } : { revisedStory: "r" + calls.length }, modelUsed: "m" };
  }, correctiveAddendum);
  await next([]);
  calls.length = 0;
  const responsesOnly = await next(["modelFramework must label where each part appears", "revisedStory is missing"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^RESP/); assert.match(calls[0], /modelFramework must label/); assert.match(calls[0], /revisedStory is missing/);
  assert.equal(responsesOnly.parsed.glow, "g1", "the coaching that passed is kept");
  assert.equal(responsesOnly.parsed.overallScore, 2, "and so is the assessment");
  calls.length = 0;
  await next(["overallScore must be an integer from 1 to 10", "spellingGrammar[2].quote is not in the text"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^ASSESS/); assert.match(calls[0], /overallScore/); assert.match(calls[0], /spellingGrammar\[2\]/);
  calls.length = 0;
  await next(["glow is vague"]);
  assert.equal(calls.length, 1); assert.match(calls[0], /^CORE/);
  calls.length = 0;
  await next(["glow is vague", "modelResponse is too short", "examTechnique must have 3 entries"]);
  assert.equal(calls.length, 3, "problems in all three, all three asked again");
  const core = calls.find((c) => c.startsWith("CORE")), assess = calls.find((c) => c.startsWith("ASSESS")), resp = calls.find((c) => c.startsWith("RESP"));
  assert.match(core, /glow is vague/); assert.doesNotMatch(core, /modelResponse|examTechnique/);
  assert.match(assess, /examTechnique/); assert.doesNotMatch(assess, /glow is vague|modelResponse/);
  assert.match(resp, /modelResponse is too short/); assert.doesNotMatch(resp, /glow is vague|examTechnique/);
});

test("which part an issue belongs to, and where an issue goes when its part was not asked for", () => {
  for (const i of ["revisedStory is missing", "modelResponse is too short", "modelFramework must label", "revisedFramework must label"]) assert.equal(partOf(i), "responses", i);
  for (const i of ["overallScore must be an integer", "scoreReason is missing", "spellingGrammar[0].quote is wrong", "spellingGrammarTotal must be a number", "examTechnique must have 3 entries", "examSummary is missing"]) assert.equal(partOf(i), "assess", i);
  for (const i of ["glow is vague", "highlights[3].quote does not appear", "sentences are too long for this age tier", "growNext restates the grow", "frameworkTip.name is wrong", "vocab[0].example does not use the term"]) assert.equal(partOf(i), "core", i);
  assert.equal(partOf("overallScore must be an integer", ["core", "responses"]), "core", "a plan with no assessment part sends it to the coaching");
  assert.deepEqual(RESPONSE_KEYS, ["revisedStory", "revisedFramework", "modelResponse", "modelFramework"]);
  assert.deepEqual(ASSESS_KEYS, ["overallScore", "scoreReason", "spellingGrammarTotal", "spellingGrammar", "examTechnique", "examSummary"]);
});

test("with no assessment part (a plan without a score, spelling check or exam bands) it is two calls and nothing is lost", async () => {
  const seen = [];
  const next = makeSplitGenerator({ core: { prompt: "CORE" }, responses: { prompt: "RESP" } }, async (p) => { seen.push(p); return { parsed: p === "CORE" ? { glow: "g", overallScore: 5 } : { revisedStory: "r" }, modelUsed: "m" }; }, correctiveAddendum);
  const r = await next([]);
  assert.deepEqual(seen.sort(), ["CORE", "RESP"]);
  assert.deepEqual(r.parsed, { glow: "g", overallScore: 5, revisedStory: "r" });
});

test("a failure in any call is not hidden: it reaches the caller", async () => {
  const next = makeSplitGenerator(ALL_THREE, async (p) => { if (p === "ASSESS") throw new Error("the model broke"); return { parsed: {}, modelUsed: "m" }; }, correctiveAddendum);
  await assert.rejects(next([]), /the model broke/);
});

test("the split can be switched off in Vercel and is on by default", () => {
  const was = process.env.PREMIUM_SPLIT;
  try {
    delete process.env.PREMIUM_SPLIT; assert.equal(splitEnabled(), true);
    process.env.PREMIUM_SPLIT = "0"; assert.equal(splitEnabled(), false);
    process.env.PREMIUM_SPLIT = "1"; assert.equal(splitEnabled(), true);
  } finally { if (was === undefined) delete process.env.PREMIUM_SPLIT; else process.env.PREMIUM_SPLIT = was; }
});

// ------------------------------------------------------------ the prompts

function argsFor(tier, plan = "premium") {
  const targets = targetsForGrade(COUNTRY, TIERS[tier], tier).targets;
  return { tier, country: COUNTRY, gradeLabel: TIERS[tier], interest: "space", confidenceWriting: "growing", motivation: "grades", prompt: "Write a short story.", text: TEXT, capabilities: capabilitiesFor(plan), targets, targetNames: targets.map((t) => t.name), genre: DEFAULT_GENRE_BY_TIER[tier] };
}
const jsonShapeOf = (p) => JSON.parse(p.slice(p.lastIndexOf("\n{\n")).replace(/:\s*"[^"\n]*(\\"[^"\n]*)*"/g, ': "x"').replace(/\[\s*\{[\s\S]*?\}\s*\]/g, "[]").replace(/\{\s*"name"[\s\S]*?\}(?=\s*[,}])/, "{}"));

for (const tier of Object.keys(TIERS)) {
  test(`${tier}: each part's prompt asks only for its own fields, and the shape it shows is valid JSON`, () => {
    const parts = splitPrompts(argsFor(tier));
    assert.deepEqual(Object.keys(parts).sort(), ["assess", "core", "responses"]);
    const fieldsIn = (p) => [...p.slice(p.lastIndexOf("exactly this shape:")).matchAll(/^ {2}"([A-Za-z]+)":/gm)].map((m) => m[1]);
    const core = fieldsIn(parts.core.prompt), assess = fieldsIn(parts.assess.prompt), resp = fieldsIn(parts.responses.prompt);
    for (const f of ["glow", "grow", "vocab", "glowTarget", "growTarget", "highlights", "growNext", "frameworkTip"]) assert.ok(core.includes(f), `core asks for ${f}`);
    for (const f of [...ASSESS_KEYS, ...RESPONSE_KEYS]) assert.ok(!core.includes(f), `core does not ask for ${f}`);
    for (const f of ["overallScore", "scoreReason", "spellingGrammarTotal", "spellingGrammar"]) assert.ok(assess.includes(f), `assess asks for ${f}`);
    assert.equal(assess.includes("examTechnique"), EXAM_TIERS.has(tier));
    for (const f of ["glow", "grow", "highlights", ...RESPONSE_KEYS]) assert.ok(!assess.includes(f), `assess does not ask for ${f}`);
    assert.deepEqual(resp.filter((f) => !RESPONSE_KEYS.includes(f)), [], "the rewrite call asks for nothing but the rewrites");
    for (const f of RESPONSE_KEYS.filter((k) => k !== "modelResponse")) assert.ok(resp.includes(f), `responses asks for ${f}`);
    for (const k of ["core", "assess", "responses"]) {
      const body = parts[k].prompt.slice(parts[k].prompt.lastIndexOf("exactly this shape:") + 19).trim();
      assert.ok(body.startsWith("{") && body.endsWith("}"), k + " shape is a braced object");
      assert.doesNotMatch(body, /,\s*\n\s*}/, k + " shape has no trailing comma");
      assert.doesNotMatch(body, /,\s*,/, k + " shape has no doubled comma");
    }
    assert.ok(parts.core.prompt.includes(TEXT) && parts.assess.prompt.includes(TEXT) && parts.responses.prompt.includes(TEXT), "all three see the student's piece");
    assert.doesNotMatch(parts.core.prompt, /OVERALL SCORE \(required\)|SPELLING AND GRAMMAR CHECK|EXAM-TECHNIQUE SCORING|MODEL RESPONSE AND FRAMEWORK LABELS/);
    assert.match(parts.assess.prompt, /OVERALL SCORE \(required\)/); assert.match(parts.assess.prompt, /SPELLING AND GRAMMAR CHECK/);
    assert.equal(/EXAM-TECHNIQUE SCORING/.test(parts.assess.prompt), EXAM_TIERS.has(tier));
    assert.doesNotMatch(parts.assess.prompt, /FRAMEWORK SPOTLIGHT|MODEL RESPONSE|REVISED RESPONSE \(required\)/);
    assert.match(parts.responses.prompt, /MODEL RESPONSE AND FRAMEWORK LABELS/);
    assert.ok(parts.assess.prompt.length < parts.core.prompt.length && parts.responses.prompt.length < parts.core.prompt.length / 2);
  });
}

test("the combined prompt (everything in one call, used by Free and Core and when the split is off) is unchanged in what it asks for", () => {
  const p = buildWritingPrompt(argsFor("middle"));
  for (const f of ["glow", "grow", "vocab", "highlights", "growNext", "examTechnique", "frameworkTip", "overallScore", "scoreReason", "revisedStory", "modelFramework", "revisedFramework", "spellingGrammarTotal", "spellingGrammar"]) assert.match(p, new RegExp(`^ {2}"${f}":`, "m"), f);
  const shape = p.slice(p.lastIndexOf("exactly this shape:") + 19).trim();
  assert.doesNotMatch(shape, /,\s*\n\s*}/); assert.doesNotMatch(shape, /,\s*,/);
});

test("a plan without a score, spelling check or exam bands has no assessment prompt", () => {
  const caps = { ...capabilitiesFor("premium"), overallScore: false, spellingGrammar: false, examTechnique: false };
  const parts = splitPrompts({ ...argsFor("middle"), capabilities: caps });
  assert.deepEqual(Object.keys(parts).sort(), ["core", "responses"]);
});

// ------------------------------------------------------------ through the real endpoint

function standardToken(tier) {
  const list = standardsFor(COUNTRY, tier, TIERS[tier]) || [];
  const skip = new Set(["the", "and", "for", "statutory", "english", "app", "year", "yr", "standard", "standards", "grade", "level", "aim", "aims", "programme", "study"]);
  for (const std of list) {
    const tok = (std.toLowerCase().match(/[a-z0-9.\-]+/g) || []).find((t) => t.length >= 3 && !skip.has(t));
    if (tok) return tok;
  }
  return "";
}
function filler(n, seed) {
  return Array.from({ length: n }, (_, i) => { let k = i + seed * 37 + 1; let w = ""; while (k > 0) { w += "abcdefghijklmnopqrstuvwxyz"[k % 26]; k = Math.floor(k / 26); } return w + "ly"; });
}
// What a compliant model returns for each part.
function thirds(tier) {
  const caps = capabilitiesFor("premium");
  const targets = targetsForGrade(COUNTRY, TIERS[tier], tier).targets;
  const fw = frameworkFor(DEFAULT_GENRE_BY_TIER[tier], tier);
  const parts = frameworkParts(fw);
  const lim = RESP.modelLimits(assessLength({ text: TEXT, tier, country: COUNTRY, gradeLabel: TIERS[tier] }));
  const per = Math.max(3, Math.floor(lim.n / parts.length));
  const sentences = parts.map((pt, k) => { const w = filler(per, k + 1); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return w.join(" ") + "."; });
  const core = {
    glow: `Your opening is clear and confident. It shows ${standardToken(tier)} well.`,
    grow: "Add one describing word to the cat sentence. It will paint a clearer picture.",
    vocab: [
      { term: "describe", definition: "to say what something is like.", example: "Please describe the cat in the tree." },
      { term: "climax", definition: "the most exciting part of a story.", example: "The climax came when the cat jumped." },
    ],
    glowTarget: targets[0].name,
    growTarget: targets[1] ? targets[1].name : targets[0].name,
    highlights: [
      { quote: "The dog ran fast", type: "glow", note: "A clear, strong opening." },
      { quote: "It saw a cat up in a tree", type: "grow", note: "Add a describing word here.", revision: "It spotted a tiny grey cat high up in a tree" },
    ],
    frameworkTip: { name: fw.name, quote: "The end of the story was happy", revision: "Ending: everyone smiled as the story settled into a happy close." },
    growNext: "Once that feels natural, rework \"The dog ran fast\" so it opens with where or when.",
  };
  const assess = {
    overallScore: 6, scoreReason: "Clear structure but very short sentences throughout.",
    spellingGrammarTotal: 1, spellingGrammar: [{ quote: "The end of the story was happy", type: "grammar", correction: "The ending of the story was happy" }],
  };
  if (caps.examTechnique && EXAM_TIERS.has(tier)) {
    assess.examTechnique = examTargetsFor(targets, "writing").map((t) => ({ criterion: t.name, band: 2, descriptor: "Developing", evidence: "The dog ran fast", toNextBand: "Add one more developed sentence to show this clearly." }));
    assess.examSummary = "Accurate, fluent writing would gain the most marks next.";
  }
  const responses = {
    revisedStory: "The dog ran fast. It spotted a tiny grey cat high up in a tree. The end of the story was happy.",
    modelFramework: parts.map((pt, k) => ({ part: pt.name, text: sentences[k], note: "This sentence does the job of " + pt.name + " clearly." })),
    revisedFramework: [{ part: parts[0].name, text: "The dog ran fast.", note: "This sentence opens the response clearly." }],
  };
  return { core, assess, responses };
}

function submissionDb(tier, written) {
  const row = { id: "sub1", child_id: "c1", tier, country: COUNTRY, grade_label: TIERS[tier], interest: "football", content: { generatedPrompt: { prompt: "Write a short story.", genre: DEFAULT_GENRE_BY_TIER[tier] } }, feedback: null };
  return (q) => {
    if (q.table !== "submissions") return { data: null, error: null };
    if (did(q, "single")) return { data: row, error: null };
    if (did(q, "is")) return { data: [{ id: "sub1" }], error: null };
    const upd = q.ops.find(([n]) => n === "update");
    if (upd && upd[1] && upd[1].feedback && !upd[1].feedback._pending) written.push(upd[1]);
    return { data: null, error: null };
  };
}
const partOfPrompt = (p) => (/^You are the writing coach/.test(p) ? "responses" : /^You are the assessment engine/.test(p) ? "assess" : "core");

// answer(prompt, callNumber, part) returns the parsed JSON for that call.
async function run({ plan = "premium", tier = "middle", split = "1", answer }) {
  const was = process.env.PREMIUM_SPLIT;
  process.env.PREMIUM_SPLIT = split;
  const written = [], seen = [];
  try {
    const h = loadHandler("submit.js", {
      plan, db: submissionDb(tier, written),
      generate: async (prompt, opts = {}) => {
        const part = partOfPrompt(prompt);
        seen.push({ prompt, part, maxTokens: opts.maxTokens });
        return { parsed: JSON.parse(JSON.stringify(answer(prompt, seen.length, part))), modelUsed: "stub" };
      },
    });
    const res = await call(h, { method: "POST", body: { kind: "writing", submissionId: "sub1", text: TEXT } });
    return { res, written, seen };
  } finally { if (was === undefined) delete process.env.PREMIUM_SPLIT; else process.env.PREMIUM_SPLIT = was; }
}
const pick = (t) => (p, n, part) => t[part];

for (const tier of Object.keys(TIERS)) {
  test(`Premium / ${tier}: the coaching, the assessment and the rewrites are asked for at once, joined, and every section arrives`, async () => {
    const t = thirds(tier);
    const { res, seen, written } = await run({ tier, answer: pick(t) });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(seen.length, 3, "one call for each part, no retry");
    assert.deepEqual(seen.map((s) => s.part).sort(), ["assess", "core", "responses"]);
    const fb = res.body.feedback;
    for (const k of ["glow", "grow", "vocab", "highlights", "frameworkTip", "overallScore", "spellingGrammar", "growNext", "revisedStory", "modelFramework", "revisedFramework", "modelResponse"]) assert.ok(fb[k] != null, `${k} is delivered`);
    assert.equal(!!fb.examTechnique, EXAM_TIERS.has(tier));
    assert.ok(fb.frameworkInfo, "the framework definition is attached");
    assert.equal(written.length, 1);
    assert.ok(seen.every((s) => s.maxTokens > 0));
  });
}

test("Premium: if only the model response is wrong, only that part is asked again, and the rest is not paid for twice", async () => {
  const t = thirds("middle");
  const { res, seen } = await run({ answer: (p, n, part) => (part === "responses" ? (n <= 3 ? { ...t.responses, modelFramework: [] } : t.responses) : t[part]) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(seen.length, 4, "three at first, then only the rewrite part");
  assert.deepEqual(seen.map((s) => s.part).slice(3), ["responses"]);
  assert.match(seen[3].prompt, /Your previous attempt failed these checks/);
  assert.match(seen[3].prompt, /modelFramework/);
  assert.ok(res.body.feedback.modelFramework.length > 0 && res.body.feedback.glow && res.body.feedback.examTechnique);
});

test("Premium: if only the assessment is wrong, only that part is asked again", async () => {
  const t = thirds("middle");
  const { res, seen } = await run({ answer: (p, n, part) => (part === "assess" ? (n <= 3 ? { ...t.assess, overallScore: "ten" } : t.assess) : t[part]) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(seen.length, 4);
  assert.equal(seen[3].part, "assess");
  assert.match(seen[3].prompt, /overallScore/);
  assert.ok(Number.isInteger(res.body.feedback.overallScore), "the retried score replaced the bad one");
  assert.ok(res.body.feedback.examTechnique, "the exam bands from the first call were kept");
});

test("Premium: if only the coaching is wrong, only that part is asked again", async () => {
  const t = thirds("middle");
  const { res, seen } = await run({ answer: (p, n, part) => (part === "core" ? (n <= 3 ? { ...t.core, glow: "Nice." } : t.core) : t[part]) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(seen.length, 4);
  assert.equal(seen[3].part, "core");
  assert.match(seen[3].prompt, /glow/);
});

test("Premium: a bonus section that stays wrong through every retry is dropped and the rest is delivered", async () => {
  const t = thirds("middle");
  const bad = { ...t.responses, modelFramework: [], modelResponse: undefined };
  const { res, seen } = await run({ answer: (p, n, part) => (part === "responses" ? bad : t[part]) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(seen.filter((s) => s.part === "core").length, 1, "the good coaching was only ever asked for once");
  assert.equal(seen.filter((s) => s.part === "assess").length, 1);
  assert.equal(seen.filter((s) => s.part === "responses").length, 3);
  assert.ok(!res.body.feedback.modelFramework && !res.body.feedback.modelResponse);
  assert.ok(res.body.feedback.glow && res.body.feedback.revisedStory && res.body.feedback.overallScore);
});

test("only Premium is split: other plans stay one call with the whole prompt", async () => {
  for (const plan of ["free", "core"]) {
    const t = thirds("elementary");
    const full = { ...t.core, ...t.responses, ...t.assess };
    for (const k of ["growNext", "modelFramework", "revisedFramework", "modelResponse", "overallScore", "scoreReason", "spellingGrammar", "spellingGrammarTotal", "examTechnique", "examSummary"]) delete full[k];
    const { res, seen } = await run({ plan, tier: "elementary", answer: () => full });
    assert.equal(res.statusCode, 200, plan + " " + JSON.stringify(res.body));
    assert.equal(seen.length, 1, plan);
    assert.match(seen[0].prompt, /REVISED RESPONSE \(required\)/);
    assert.equal(seen[0].part, "core", "the combined prompt, not one of the three");
  }
});

test("with the split switched off, Premium is one combined call as before", async () => {
  const t = thirds("middle");
  const { res, seen } = await run({ split: "0", answer: () => ({ ...t.core, ...t.assess, ...t.responses }) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(seen.length, 1);
  assert.match(seen[0].prompt, /MODEL RESPONSE AND FRAMEWORK LABELS/);
  assert.match(seen[0].prompt, /OVERALL SCORE \(required\)/);
});
