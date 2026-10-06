const test = require("node:test");
const assert = require("node:assert/strict");
const { capabilitiesFor } = require("../api/_lib/plans");
const { targetsForGrade, examTargetsFor } = require("../api/_lib/masteryTargets");
const { standardsFor } = require("../api/_lib/curriculum");
const { frameworkFor, frameworkParts, DEFAULT_GENRE_BY_TIER } = require("../api/_lib/writingFrameworks");
const { assessLength } = require("../api/_lib/calibrate");
const RESP = require("../api/_lib/responses");
const { makeSplitGenerator, partOf, splitEnabled, RESPONSE_KEYS } = require("../api/_lib/splitGenerate");
const { correctiveAddendum } = require("../api/_lib/prompt");
const { did, loadHandler, call } = require("./harness");

// A Premium writing answer is asked for as two calls at once (the marking, and the long rewrites), and only the
// part that failed is asked again. These tests cover the joining and retrying, and the whole thing through
// api/submit.js with a stand-in model that answers each half the way the real one is asked to.

const COUNTRY = "🇬🇧 United Kingdom";
const TIERS = { early: "Year 2", elementary: "Year 5", middle: "Year 8", high: "Year 11" };
const EXAM_TIERS = new Set(["middle", "high"]);
const TEXT = "The dog ran fast. It saw a cat up in a tree. The end of the story was happy.";

// ------------------------------------------------------------ the joining and retrying

test("the two parts are asked at once, each with its own prompt and room, and joined into one answer", async () => {
  const calls = [];
  const next = makeSplitGenerator(
    { core: { prompt: "CORE", maxTokens: 2600 }, responses: { prompt: "RESP", maxTokens: 3000 } },
    async (prompt, o) => { calls.push([prompt, o.maxTokens]); return prompt.startsWith("CORE") ? { parsed: { glow: "g", revisedStory: "stray" }, modelUsed: "m" } : { parsed: { revisedStory: "rs", modelFramework: [1], glow: "stray" }, modelUsed: "m" }; },
    correctiveAddendum,
  );
  const r = await next([]);
  assert.deepEqual(calls.map((c) => c[0]).sort(), ["CORE", "RESP"]);
  assert.deepEqual(Object.fromEntries(calls), { CORE: 2600, RESP: 3000 });
  assert.equal(r.parsed.glow, "g", "marking fields come only from the marking call");
  assert.equal(r.parsed.revisedStory, "rs", "the rewrite comes only from the rewrite call, whatever the other said");
  assert.deepEqual(r.parsed.modelFramework, [1]);
  assert.equal(r.modelUsed, "m");
});

test("a retry asks again only for the part that failed, and tells it only its own problems", async () => {
  const calls = [];
  const next = makeSplitGenerator(
    { core: { prompt: "CORE", maxTokens: 1 }, responses: { prompt: "RESP", maxTokens: 1 } },
    async (prompt) => { calls.push(prompt); return { parsed: prompt.startsWith("CORE") ? { glow: "g" + calls.length } : { revisedStory: "r" + calls.length }, modelUsed: "m" }; },
    correctiveAddendum,
  );
  await next([]);
  calls.length = 0;
  const onlyResponses = await next(["modelFramework must label where each part appears", "revisedStory is missing"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^RESP/);
  assert.match(calls[0], /modelFramework must label/);
  assert.match(calls[0], /revisedStory is missing/);
  assert.equal(onlyResponses.parsed.glow, "g1", "the marking that passed is kept");
  calls.length = 0;
  await next(["overallScore must be an integer from 1 to 10"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^CORE/);
  assert.doesNotMatch(calls[0], /modelFramework/);
  calls.length = 0;
  await next(["glow is vague", "modelResponse is too short"]);
  assert.equal(calls.length, 2, "problems in both halves, both asked again");
  const core = calls.find((c) => c.startsWith("CORE")), resp = calls.find((c) => c.startsWith("RESP"));
  assert.match(core, /glow is vague/); assert.doesNotMatch(core, /modelResponse/);
  assert.match(resp, /modelResponse is too short/); assert.doesNotMatch(resp, /glow is vague/);
});

test("which part an issue belongs to", () => {
  for (const i of ["revisedStory is missing", "modelResponse is too short", "modelFramework must label", "revisedFramework must label"]) assert.equal(partOf(i), "responses", i);
  for (const i of ["glow is vague", "overallScore must be an integer", "highlights[3].quote does not appear", "sentences are too long for this age tier", "growNext restates the grow"]) assert.equal(partOf(i), "core", i);
  assert.deepEqual(RESPONSE_KEYS, ["revisedStory", "revisedFramework", "modelResponse", "modelFramework"]);
});

test("a failure in either call is not hidden: it reaches the caller", async () => {
  const next = makeSplitGenerator({ core: { prompt: "CORE" }, responses: { prompt: "RESP" } }, async (p) => { if (p.startsWith("RESP")) throw new Error("the model broke"); return { parsed: {}, modelUsed: "m" }; }, correctiveAddendum);
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
// What a compliant model returns, split the way the two calls are asked.
function halves(tier) {
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
    overallScore: 6, scoreReason: "Clear structure but very short sentences throughout.",
    spellingGrammarTotal: 1, spellingGrammar: [{ quote: "The end of the story was happy", type: "grammar", correction: "The ending of the story was happy" }],
    growNext: "Once that feels natural, rework \"The dog ran fast\" so it opens with where or when.",
  };
  if (caps.examTechnique && EXAM_TIERS.has(tier)) {
    core.examTechnique = examTargetsFor(targets, "writing").map((t) => ({ criterion: t.name, band: 2, descriptor: "Developing", evidence: "The dog ran fast", toNextBand: "Add one more developed sentence to show this clearly." }));
    core.examSummary = "Accurate, fluent writing would gain the most marks next.";
  }
  const responses = {
    revisedStory: "The dog ran fast. It spotted a tiny grey cat high up in a tree. The end of the story was happy.",
    modelFramework: parts.map((pt, k) => ({ part: pt.name, text: sentences[k], note: "This sentence does the job of " + pt.name + " clearly." })),
    revisedFramework: [{ part: parts[0].name, text: "The dog ran fast.", note: "This sentence opens the response clearly." }],
  };
  return { core, responses };
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
const isResponsesPrompt = (p) => /^You are the writing coach/.test(p);

// plan: the account's plan. answer(prompt, callNumber, part) returns the parsed JSON for that call.
async function run({ plan = "premium", tier = "middle", split = "1", answer }) {
  const was = process.env.PREMIUM_SPLIT;
  process.env.PREMIUM_SPLIT = split;
  const written = [], seen = [];
  try {
    const h = loadHandler("submit.js", {
      plan, db: submissionDb(tier, written),
      generate: async (prompt, opts = {}) => {
        const part = isResponsesPrompt(prompt) ? "responses" : "core";
        seen.push({ prompt, part, maxTokens: opts.maxTokens });
        return { parsed: JSON.parse(JSON.stringify(answer(prompt, seen.length, part))), modelUsed: "stub" };
      },
    });
    const res = await call(h, { method: "POST", body: { kind: "writing", submissionId: "sub1", text: TEXT } });
    return { res, written, seen };
  } finally { if (was === undefined) delete process.env.PREMIUM_SPLIT; else process.env.PREMIUM_SPLIT = was; }
}

for (const tier of Object.keys(TIERS)) {
  test(`Premium / ${tier}: the marking and the rewrites are asked for at once, joined, and all the sections arrive`, async () => {
    const { core, responses } = halves(tier);
    const { res, seen, written } = await run({ tier, answer: (p, n, part) => (part === "core" ? core : responses) });
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(seen.length, 2, "one call for each half, no retry");
    assert.deepEqual(seen.map((s) => s.part).sort(), ["core", "responses"]);
    const fb = res.body.feedback;
    for (const k of ["glow", "grow", "vocab", "highlights", "frameworkTip", "overallScore", "spellingGrammar", "growNext", "revisedStory", "modelFramework", "revisedFramework", "modelResponse"]) assert.ok(fb[k] != null, `${k} is delivered`);
    assert.equal(!!fb.examTechnique, EXAM_TIERS.has(tier));
    assert.ok(fb.frameworkInfo, "the framework definition is attached");
    assert.equal(written.length, 1);
    const core2 = seen.find((s) => s.part === "core"), resp2 = seen.find((s) => s.part === "responses");
    assert.doesNotMatch(core2.prompt, /MODEL RESPONSE AND FRAMEWORK LABELS/, "the marking call is not also asked for the model response");
    assert.doesNotMatch(core2.prompt, /"revisedStory": "/, "nor for the rewrite");
    assert.match(resp2.prompt, /MODEL RESPONSE AND FRAMEWORK LABELS/);
    assert.doesNotMatch(resp2.prompt, /"glow"|"highlights"|"overallScore"/, "the rewrite call is not asked for any marking");
    assert.ok(resp2.prompt.includes(TEXT) && core2.prompt.includes(TEXT), "both see the student's piece");
    assert.ok(core2.maxTokens > 0 && resp2.maxTokens > 0);
    assert.ok(resp2.prompt.length < core2.prompt.length / 2, "the rewrite call is a short, focused prompt");
  });
}

test("Premium: if only the model response is wrong, only that half is asked again, and the marking is not paid for twice", async () => {
  const { core, responses } = halves("middle");
  const bad = { ...responses, modelFramework: [] };
  const { res, seen } = await run({ answer: (p, n, part) => (part === "core" ? core : (n <= 2 ? bad : responses)) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(seen.length, 3, "two at first, then only the rewrite half");
  assert.equal(seen.filter((s) => s.part === "core").length, 1);
  assert.equal(seen.filter((s) => s.part === "responses").length, 2);
  assert.match(seen[2].prompt, /Your previous attempt failed these checks/);
  assert.match(seen[2].prompt, /modelFramework/);
  assert.ok(res.body.feedback.modelFramework.length > 0 && res.body.feedback.glow);
});

test("Premium: if only the marking is wrong, only that half is asked again", async () => {
  const { core, responses } = halves("middle");
  const bad = { ...core, overallScore: "ten" };
  const { res, seen } = await run({ answer: (p, n, part) => (part === "responses" ? responses : (n <= 2 ? bad : core)) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(seen.length, 3);
  assert.equal(seen.filter((s) => s.part === "responses").length, 1, "the rewrite that was fine is kept");
  assert.equal(seen[2].part, "core");
  assert.match(seen[2].prompt, /overallScore/);
  assert.ok(Number.isInteger(res.body.feedback.overallScore), "the retried marking replaced the bad score");
});

test("Premium: a bonus section that stays wrong through every retry is dropped and the rest is delivered", async () => {
  const { core, responses } = halves("middle");
  const bad = { ...responses, modelFramework: [], modelResponse: undefined };
  const { res, seen } = await run({ answer: (p, n, part) => (part === "core" ? core : bad) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(seen.filter((s) => s.part === "core").length, 1, "the good marking was only ever asked for once");
  assert.equal(seen.filter((s) => s.part === "responses").length, 3);
  assert.ok(!res.body.feedback.modelFramework && !res.body.feedback.modelResponse);
  assert.ok(res.body.feedback.glow && res.body.feedback.revisedStory);
});

test("only Premium is split: other plans stay one call with the whole prompt", async () => {
  for (const plan of ["free", "core"]) {
    const { core, responses } = halves("elementary");
    const full = { ...core, ...responses };
    for (const k of ["growNext", "modelFramework", "revisedFramework", "modelResponse", "overallScore", "scoreReason", "spellingGrammar", "spellingGrammarTotal", "examTechnique", "examSummary"]) delete full[k];
    const { res, seen } = await run({ plan, tier: "elementary", answer: () => full });
    assert.equal(res.statusCode, 200, plan + " " + JSON.stringify(res.body));
    assert.equal(seen.length, 1, plan);
    assert.match(seen[0].prompt, /REVISED RESPONSE \(required\)/);
    assert.ok(!isResponsesPrompt(seen[0].prompt));
  }
});

test("with the split switched off, Premium is one combined call as before", async () => {
  const { core, responses } = halves("middle");
  const { res, seen } = await run({ split: "0", answer: () => ({ ...core, ...responses }) });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.equal(seen.length, 1);
  assert.match(seen[0].prompt, /MODEL RESPONSE AND FRAMEWORK LABELS/);
  assert.match(seen[0].prompt, /"glow"/);
});
