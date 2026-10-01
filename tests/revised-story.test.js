const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { validateFeedback, stripUngrantedSections } = require("../api/_lib/validate");
const { buildWritingPrompt } = require("../api/_lib/prompt");

// The Premium "Your story, corrected and improved": the student's whole piece
// rewritten with every error fixed, plus the larger highlight count. The
// example is the real piece that prompted this (a Year 5 student on Superman).

const ORIGINAL = "a character that i have chose is superman. he struggled with bad people and cryponite. the imapct made me confused";
const GOOD = "A character that I have chosen is Superman. He struggled with villains and kryptonite. The impact left him confused.";

function feedback(overrides = {}) {
  return {
    glow: "You picked a clear character and named his main struggle with bad people.",
    grow: "Try adding one detail about how the struggle felt to build a more complete picture.",
    vocab: [
      { term: "villain", definition: "a character who does bad things in a story.", example: "The villain tried to take the city." },
      { term: "impact", definition: "the strong effect something has on you.", example: "The impact of the fall was huge." },
    ],
    glowTarget: "", growTarget: "",
    highlights: [
      { quote: "struggled with bad people", type: "glow", note: "A clear conflict." },
      { quote: "the imapct made me confused", type: "grow", note: "Say more here.", revision: "The impact left him confused." },
    ],
    frameworkTip: { name: "Story Mountain", quote: "he struggled with bad people", revision: "Climax: he struggled with bad people and nearly lost." },
    overallScore: 4, scoreReason: "Names a conflict but lacks detail and has frequent errors.",
    spellingGrammarTotal: 4,
    spellingGrammar: [
      { quote: "cryponite", type: "spelling", correction: "kryptonite" },
      { quote: "the imapct", type: "spelling", correction: "the impact" },
      { quote: "i have chose", type: "grammar", correction: "I have chosen" },
    ],
    revisedStory: GOOD,
    ...overrides,
  };
}
const ctx = { tier: "elementary", standardsList: [], targetNames: [], submittedText: ORIGINAL };
const about = (r) => r.issues.filter((i) => /revisedStory/.test(i));

test("revised story: a corrected, improved rewrite of the same piece passes", () => {
  assert.deepEqual(about(validateFeedback(feedback(), ctx)), []);
});

test("revised story: it is required whenever the plan includes the spelling check", () => {
  const f = feedback(); delete f.revisedStory;
  assert.ok(about(validateFeedback(f, ctx)).some((i) => /missing/.test(i)));
});

test("revised story: handing back the student's own text unchanged is refused", () => {
  assert.ok(about(validateFeedback(feedback({ revisedStory: ORIGINAL }), ctx)).some((i) => /identical/.test(i)));
});

test("revised story: a misspelling the spelling check listed must not survive in the rewrite", () => {
  const r = validateFeedback(feedback({ revisedStory: "A character that I have chosen is Superman. He struggled with villains and cryponite. The impact left him confused." }), ctx);
  assert.ok(about(r).some((i) => /cryponite/.test(i)), about(r).join("; "));
});

test("revised story: a lowercase 'I', a missing capital, or no end punctuation are all caught", () => {
  assert.ok(about(validateFeedback(feedback({ revisedStory: "A character that i have chosen is Superman. He struggled with villains and kryptonite. The impact left him confused." }), ctx)).some((i) => /lowercase "i"/.test(i)));
  assert.ok(about(validateFeedback(feedback({ revisedStory: "a character that I have chosen is Superman. He struggled with villains and kryptonite. The impact left him confused." }), ctx)).some((i) => /capital letter/.test(i)));
  assert.ok(about(validateFeedback(feedback({ revisedStory: "A character that I have chosen is Superman. He struggled with villains and kryptonite. The impact left him confused" }), ctx)).some((i) => /end punctuation/.test(i)));
});

test("revised story: it must stay THEIR piece - a much longer or much shorter rewrite is refused", () => {
  const long = GOOD + " Superman flew over the city every morning and watched the people below, and he thought about his home planet and his parents far away in the stars, and he wondered what his life would have been like if he had stayed there instead of coming to Earth.";
  assert.ok(about(validateFeedback(feedback({ revisedStory: long }), ctx)).some((i) => /length/.test(i)));
  assert.ok(about(validateFeedback(feedback({ revisedStory: "Superman is brave." }), ctx)).some((i) => /length/.test(i)));
});

test("revised story: every plan gets it for writing (Free and Core included), and it is never kept for a reading attempt", () => {
  for (const [name, caps] of [["free/core", { spellingGrammar: false, overallScore: false }], ["premium", { spellingGrammar: true, overallScore: true }]]) {
    const missing = feedback(); delete missing.revisedStory;
    if (name === "free/core") { delete missing.spellingGrammar; delete missing.spellingGrammarTotal; delete missing.overallScore; delete missing.scoreReason; }
    assert.ok(about(validateFeedback(missing, { ...ctx, capabilities: caps })).some((i) => /missing/.test(i)), `${name}: a missing rewrite is flagged`);
    const ok = feedback();
    if (name === "free/core") { delete ok.spellingGrammar; delete ok.spellingGrammarTotal; delete ok.overallScore; delete ok.scoreReason; }
    assert.deepEqual(about(validateFeedback(ok, { ...ctx, capabilities: caps })), [], `${name}: a good rewrite passes`);
  }
  const kept = stripUngrantedSections(feedback(), { capabilities: { spellingGrammar: false }, kind: "writing" });
  assert.equal(kept.revisedStory, GOOD, "Free and Core keep the rewrite");
  const reading = stripUngrantedSections(feedback(), { capabilities: { spellingGrammar: true }, kind: "reading" });
  assert.equal(reading.revisedStory, undefined, "reading has no student text to rewrite");
});

test("highlights: up to 10 are accepted for a long piece, 11 are refused, and fewer than 2 are refused", () => {
  const many = (n) => Array.from({ length: n }, (_, i) => ({ quote: "the imapct made me confused", type: i % 2 ? "grow" : "glow", note: "Note here.", ...(i % 2 ? { revision: "The impact left him confused." + " ".repeat(i) } : {}) }));
  const issuesFor = (n) => validateFeedback(feedback({ highlights: many(n) }), ctx).issues.filter((i) => /highlights must be/.test(i));
  assert.deepEqual(issuesFor(10), []);
  assert.equal(issuesFor(11).length, 1);
  assert.equal(issuesFor(1).length, 1);
});

test("prompt: every plan asks for the full rewrite; only Premium ties it to the spelling list and gets the length-scaled highlights wording on top", () => {
  const args = { tier: "elementary", country: "x", gradeLabel: "Year 5", interest: "football", prompt: "Write.", text: ORIGINAL, targets: [], targetNames: ["A"], genre: "narrative" };
  const premium = buildWritingPrompt({ ...args, capabilities: { spellingGrammar: true, overallScore: true } });
  assert.match(premium, /REVISED STORY \(required\)/);
  assert.match(premium, /fix EVERY spelling, grammar, capitalisation and punctuation error, including each one you list in the spelling and grammar check below/);
  assert.match(premium, /Do NOT add facts, characters, events, arguments or opinions the student did not write/);
  assert.match(premium, /about one genuine highlight for every 30-40 words, up to 10/);
  assert.match(premium, /"revisedStory":/);
  for (const caps of [{ spellingGrammar: false, overallScore: false }, { spellingGrammar: false, overallScore: false, deepFeedback: false }]) {
    const core = buildWritingPrompt({ ...args, capabilities: caps });
    assert.match(core, /REVISED STORY \(required\)/);
    assert.match(core, /"revisedStory":/);
    assert.ok(!core.includes("spelling and grammar check below"), "Core and Free are not pointed at a list they do not get");
    assert.ok(!core.includes("SPELLING AND GRAMMAR CHECK"), "the itemised spelling list stays Premium");
  }
});

test("prompt: older learners are told to keep a formal register and the youngest to keep it simple", () => {
  const mk = (tier) => buildWritingPrompt({ tier, country: "x", gradeLabel: "g", interest: "i", prompt: "w", text: ORIGINAL, targets: [], targetNames: ["A"], genre: "narrative", capabilities: { spellingGrammar: true } });
  assert.match(mk("high"), /formal, third-person academic register with no personal asides and no analogies/);
  assert.match(mk("early"), /sentences short and simple/);
});

// ---- the screen: the word-by-word "what changed" marking, run from the real source

function loadDiff() {
  const src = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  const start = src.indexOf("function diffWordsToParts");
  const end = src.indexOf("function AnnotatedText");
  assert.ok(start > 0 && end > start, "the diff function is in app.html");
  // Swap the JSX return for plain data so it runs outside the browser.
  const body = src.slice(start, end).replace(/return runs\.map[\s\S]*$/, "return runs;\n}");
  const ctx = {};
  vm.runInNewContext(body + "\nthis.diff = diffWordsToParts;", ctx);
  return ctx.diff;
}

test("screen: the changed words in the corrected story are marked and the unchanged ones are not", () => {
  const diff = loadDiff();
  const runs = diff(ORIGINAL, GOOD);
  const changed = runs.filter((r) => r.c).map((r) => r.t.trim());
  const joined = changed.join(" | ");
  assert.match(joined, /A/, "the fixed capital is marked");
  assert.match(joined, /Superman\./, "a capital and full stop on a name are marked");
  assert.match(joined, /kryptonite/);
  assert.equal(runs.map((r) => r.t).join(""), GOOD, "every word of the corrected story is shown, in order");
  assert.ok(runs.some((r) => !r.c && /character/.test(r.t)), "untouched words are not marked");
});

test("screen: an identical story marks nothing, and an empty or huge one does not crash", () => {
  const diff = loadDiff();
  assert.ok(diff("same words here.", "same words here.").every((r) => !r.c));
  assert.doesNotThrow(() => diff("", "A new sentence."));
  const big = Array.from({ length: 3000 }, (_, i) => "w" + i).join(" ");
  assert.doesNotThrow(() => diff(big, big + " extra"));
});
