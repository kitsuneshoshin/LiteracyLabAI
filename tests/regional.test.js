const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../api/_lib/regional");
const { dropInvalidSpellingGrammar } = require("../api/_lib/validate");
const P = require("../api/_lib/prompt");
const QT = require("../api/_lib/questionTypes");
const { capabilitiesFor } = require("../api/_lib/plans");
const { targetsForGrade } = require("../api/_lib/masteryTargets");

// Spelling and wording follow the learner's country: "colour" is right in Australia and wrong in the United States.

const UK = "🇬🇧 United Kingdom", AU = "🇦🇺 Australia", US = "🇺🇸 United States", CA = "🇨🇦 Canada", AE = "🇦🇪 UAE & GCC Hubs", SG = "🇸🇬 Singapore & SE Asia", ESL = "🌐 Global ESL Mode";

test("every country the site offers has a spelling convention, and the right one", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  const countries = [...app.slice(app.indexOf("const GRADE_DATA = {"), app.indexOf("const TIER_KEYS")).matchAll(/^ {2}"([^"]+)":/gm)].map((m) => m[1]);
  assert.equal(countries.length, 7, "all seven offered");
  const expected = { [UK]: "uk", [US]: "us", [AU]: "uk", [CA]: "ca", [AE]: "uk", [SG]: "uk", [ESL]: "any" };
  for (const c of countries) assert.equal(R.conventionFor(c), expected[c], c);
  assert.equal(R.conventionFor(undefined), "any"); assert.equal(R.conventionFor("Narnia"), "any");
});

test("the clause tells the model the convention, with examples, and what to do about the other one", () => {
  const us = R.spellingClause(US, "check"), au = R.spellingClause(AU, "check");
  assert.match(us, /American English/); assert.match(us, /color/); assert.match(us, /IS a genuine slip/);
  assert.match(au, /British English/); assert.match(au, /colour/); assert.match(au, /must never be listed in the spelling check/);
  assert.match(R.spellingClause(CA, "check"), /Canadian English/);
  assert.match(R.spellingClause(ESL, "check"), /both British and American spellings are correct/);
  assert.match(R.spellingClause(UK, "write"), /write in British English/);
  assert.match(R.spellingClause(US, "write"), /write in American English/);
  const both = R.spellingClause(US, "both");
  assert.ok(both.includes(R.spellingClause(US, "check")) && /Everything you write yourself/.test(both));
  assert.doesNotMatch(R.spellingClause(AU, "write"), /genuine slip/, "writing for a learner does not talk about slips");
});

test("a swap between two countries' spellings is recognised, in the many forms a word takes", () => {
  const pairs = [["colour", "color"], ["coloured", "colored"], ["colourful", "colorful"], ["favourite", "favorite"], ["neighbours", "neighbors"], ["behaviour", "behavior"],
    ["realise", "realize"], ["realised", "realized"], ["organisation", "organization"], ["recognising", "recognizing"], ["summarise", "summarize"], ["analyse", "analyze"],
    ["centre", "center"], ["theatre", "theater"], ["defence", "defense"], ["travelled", "traveled"], ["travelling", "traveling"], ["cancelled", "canceled"], ["jewellery", "jewelry"],
    ["grey", "gray"], ["programme", "program"], ["maths", "math"], ["mum", "mom"], ["learnt", "learned"], ["whilst", "while"], ["towards", "toward"], ["tyre", "tire"]];
  for (const [uk, us] of pairs) { assert.equal(R.UK_TO_US.get(uk), us, uk); assert.equal(R.US_TO_UK.get(us), uk, us); }
  assert.ok(R.UK_TO_US.size > 500, "a substantial list");
});

test("words that only look like variants are never treated as one", () => {
  for (const w of ["advise", "advised", "surprise", "surprised", "exercise", "promise", "otherwise", "rise", "wise", "precise", "noise", "praise", "raise", "premise", "compromise", "revise", "devise", "supervise", "disguise", "despise", "enterprise", "improvise", "comprise", "expertise", "hypothesis", "licence", "license", "practise", "practice", "cheque", "check", "storey", "story", "draught", "draft"]) {
    assert.ok(!R.UK_TO_US.has(w), w + " is not a UK form of anything");
    assert.ok(!R.US_TO_UK.has(w), w + " is not a US form of anything");
  }
});

test("a 'correction' that only swaps the country's own spelling for another's is spotted, and a genuine slip is not", () => {
  const v = (q, c, country) => R.isRegionalVariantOnly(q, c, country);
  // an Australian, British or Singaporean learner who writes the British spelling is right, so changing it is a false alarm
  for (const c of [AU, UK, SG, AE]) assert.equal(v("her favourite colour", "her favorite color", c), true, c);
  // ...but writing the American spelling is a genuine slip for them
  for (const c of [AU, UK, SG, AE]) assert.equal(v("her favorite color", "her favourite colour", c), false, c);
  // an American learner is the reverse
  assert.equal(v("her favorite color", "her favourite colour", US), true);
  assert.equal(v("her favourite colour", "her favorite color", US), false);
  // Canada and the global learner: either is accepted
  for (const c of [CA, ESL]) { assert.equal(v("we realise it", "we realize it", c), true, c); assert.equal(v("we realize it", "we realise it", c), true, c); }
  // a real error that happens to sit near a variant is kept
  assert.equal(v("the colour was grean", "the color was green", AU), false, "grean is a real mistake");
  assert.equal(v("recieve the colour", "receive the color", AU), false);
  assert.equal(v("colour", "colour", AU), false, "no difference at all");
  assert.equal(v("", "color", AU), false); assert.equal(v("colour red", "color", AU), false, "different lengths");
  assert.equal(v("I advise you", "I advize you", AU), false);
});

const text = "My favourite colour is blue. I realise the theatre was grean, and we travelled towards the centre.";
const mk = () => ({ spellingGrammarTotal: 4, spellingGrammar: [
  { quote: "favourite colour", type: "spelling", correction: "favorite color" },
  { quote: "realise the theatre", type: "spelling", correction: "realize the theater" },
  { quote: "grean", type: "spelling", correction: "green" },
  { quote: "travelled towards the centre", type: "spelling", correction: "traveled toward the center" },
] });

test("the spelling check keeps a learner's correct spelling out of the error list and lowers the honest total", () => {
  const au = dropInvalidSpellingGrammar(mk(), text, AU);
  assert.deepEqual(au.spellingGrammar.map((i) => i.quote), ["grean"]);
  assert.equal(au.spellingGrammarTotal, 1, "three false alarms removed from the total as well");
  const us = dropInvalidSpellingGrammar(mk(), text, US);
  assert.equal(us.spellingGrammar.length, 4, "for an American learner every British spelling is a genuine slip");
  const ca = dropInvalidSpellingGrammar(mk(), text, CA);
  assert.deepEqual(ca.spellingGrammar.map((i) => i.quote), ["grean"]);
  const noCountry = dropInvalidSpellingGrammar(mk(), text);
  assert.ok(noCountry.spellingGrammar.length >= 1, "an unknown country is treated as 'accept either'");
  assert.equal(dropInvalidSpellingGrammar({ glow: "x" }, text, AU).glow, "x");
});

test("every prompt that writes for a learner, or checks their writing, names the convention for their country", () => {
  const targets = targetsForGrade(AU, "Year 8", "middle").targets;
  const args = (country) => ({ tier: "middle", country, gradeLabel: "Year 8", interest: "space", prompt: "Persuade your reader.", text: "Some words that the student wrote here.", capabilities: capabilitiesFor("premium"), targets, targetNames: targets.map((t) => t.name), genre: "persuasive" });
  for (const [country, name] of [[AU, "British English"], [US, "American English"], [CA, "Canadian English"]]) {
    const combined = P.buildWritingPrompt(args(country));
    assert.ok(combined.includes(name), country + " writing feedback");
    const parts = P.splitPrompts(args(country));
    for (const k of ["core", "assess", "responses"]) assert.ok(parts[k].prompt.includes(name), `${country} ${k}`);
    assert.ok(P.buildWritingPromptGenerator({ tier: "middle", country, gradeLabel: "Year 8" }).includes(name), country + " writing prompt");
    assert.ok(P.buildReadingPassagePrompt({ tier: "middle", country, gradeLabel: "Year 8", textType: QT.TEXT_TYPES.middle[0], template: QT.TEMPLATES.middle[0] }).includes(name), country + " passage");
    const q = QT.normalizeQuestions([{ q: "A question about it?", options: ["a", "b", "c", "d"], correct: 0 }], ["mc"])[0];
    assert.ok(P.buildReadingPrompt({ tier: "middle", country, gradeLabel: "Year 8", interest: "space", passageTitle: "T", passage: "A passage.", questions: [q], answers: [0], score: 1, totalQuestions: 1, targetNames: [], targets: [], capabilities: {} }).includes(name), country + " reading feedback");
  }
  assert.match(P.buildWritingPrompt(args(ESL)), /both British and American spellings are correct/);
  assert.doesNotMatch(P.buildWritingPrompt(args(AU)), /American English/);
});

test("the grading functions pass the learner's country to the spelling check", () => {
  const submit = fs.readFileSync(path.join(__dirname, "..", "api", "submit.js"), "utf8");
  assert.match(submit, /dropInvalidSpellingGrammar\(attempt\.parsed, submittedText, country\)/);
  const qa = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "qaRun.js"), "utf8");
  assert.match(qa, /dropInvalidSpellingGrammar\(parsed, s\.text, COUNTRY\)/);
});
