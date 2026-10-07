const test = require("node:test");
const assert = require("node:assert/strict");
const { dropNonVerbatimHighlights, validateExamTechnique, coerceOverallScore } = require("../api/_lib/validate");

// Two things made a real Year 11 essay fail three times running, shown to the student as "Couldn't generate feedback":
// a highlight that quoted words the student never wrote, and an exam summary that repeated the length check's own
// "about 44% of the expected length" (our rule against invented marks mistook it for one).

const TEXT = "Comfort is not the goal, because growth only happens when we are stretched. Every great athlete is brave, bold and determined. Therefore, comfort should be a place we visit, never the place we live.";
const hl = (quote, type = "glow") => ({ quote, type, note: "A fair point.", ...(type === "grow" ? { revision: "A better version of it" } : {}) });

test("a highlight that is not the student's own words is dropped and the real ones are kept", () => {
  const p = { highlights: [hl("Comfort is not the goal"), hl("Every great athlete is brave, bold and determined"), hl("growth requires frustration and risk"), hl("never the place we live", "grow")] };
  dropNonVerbatimHighlights(p, TEXT);
  assert.deepEqual(p.highlights.map((h) => h.quote), ["Comfort is not the goal", "Every great athlete is brave, bold and determined", "never the place we live"]);
});

test("capitals, punctuation and curly quotes do not make a real quote look invented", () => {
  const p = { highlights: [hl("COMFORT IS NOT THE GOAL"), hl("brave, bold and determined")] };
  dropNonVerbatimHighlights(p, TEXT);
  assert.equal(p.highlights.length, 2);
});

test("if dropping would leave fewer than two highlights, nothing is dropped, so the usual check still fails and retries", () => {
  const p = { highlights: [hl("Comfort is not the goal"), hl("something nobody wrote"), hl("another invention")] };
  dropNonVerbatimHighlights(p, TEXT);
  assert.equal(p.highlights.length, 3);
  const none = { highlights: [hl("Comfort is not the goal"), hl("Every great athlete is brave, bold and determined")] };
  dropNonVerbatimHighlights(none, TEXT);
  assert.equal(none.highlights.length, 2, "nothing to drop");
});

test("missing or odd input never crashes", () => {
  assert.deepEqual(dropNonVerbatimHighlights({}, TEXT), {});
  assert.equal(dropNonVerbatimHighlights(null, TEXT), null);
  assert.deepEqual(dropNonVerbatimHighlights({ highlights: "x" }, TEXT), { highlights: "x" });
  const p = { highlights: [hl("Comfort is not the goal"), null, hl("Every great athlete is brave, bold and determined"), { quote: 5 }] };
  dropNonVerbatimHighlights(p, TEXT);
  assert.equal(p.highlights.length, 2);
  const q = { highlights: [hl("a"), hl("b")] };
  assert.deepEqual(dropNonVerbatimHighlights(q, ""), q, "no text, nothing to compare");
});

function examIssues(summary) {
  const issues = [];
  validateExamTechnique({ examTechnique: [{ criterion: "Analytical & Persuasive Writing", band: 2, descriptor: "Developing", evidence: "Comfort is not the goal", toNextBand: "Add a second developed reason to show this clearly." }], examSummary: summary }, ["Analytical & Persuasive Writing"], issues, TEXT);
  return issues.filter((i) => /examSummary/.test(i));
}

test("an exam summary may state how long the piece is, as a percentage of the expected length", () => {
  assert.deepEqual(examIssues("Analytical & Persuasive Writing is the single objective to work on next, because the response is only about 44% of the expected length, so it needs more developed reasons and evidence."), []);
  assert.deepEqual(examIssues("The piece is only 60 % of the target length, so it needs more developed reasons to move up a band."), []);
  assert.deepEqual(examIssues("The piece reaches about 44.5% of the expected word count, so more developed reasons would help most."), []);
});

test("an exam summary that invents a mark, a percentage score or a grade is still refused", () => {
  for (const bad of [
    "This essay would score 7/10, so it needs more developed reasons and evidence to improve.",
    "This is a solid 72% piece of work, and more developed reasons would lift it further.",
    "Overall this earns a Grade B, so more developed reasons and evidence would lift it higher.",
    "It scored 6 out of 10 because it is only about 44% of the expected length and needs reasons.",
  ]) assert.ok(examIssues(bad).some((i) => /invents a raw mark/.test(i)), bad);
});

test("the repair runs on every piece of writing before it is checked", () => {
  const fs = require("node:fs"), path = require("node:path");
  const submit = fs.readFileSync(path.join(__dirname, "..", "api", "submit.js"), "utf8");
  assert.match(submit, /dropNonVerbatimHighlights\(attempt\.parsed, submittedText\)/);
  const qa = fs.readFileSync(path.join(__dirname, "..", "api", "_lib", "qaRun.js"), "utf8");
  assert.match(qa, /dropNonVerbatimHighlights\(parsed, s\.text\)/);
});

test("a score sent as clear text is turned into the number, and anything unclear is left to be refused", () => {
  const c = (v) => coerceOverallScore({ overallScore: v }).overallScore;
  assert.equal(c("6"), 6); assert.equal(c(" 7 "), 7); assert.equal(c("8/10"), 8); assert.equal(c("9 / 10"), 9); assert.equal(c("5.0"), 5); assert.equal(c(6.0), 6); assert.equal(c(10), 10);
  for (const bad of ["six", "11/10", "6.5", 6.5, "", null, undefined, "ten", "6 out of 10", [6], {}]) assert.deepEqual(c(bad), bad, String(bad));
  assert.deepEqual(coerceOverallScore({ glow: "x" }), { glow: "x" }); assert.equal(coerceOverallScore(null), null);
  const { validateFeedback } = require("../api/_lib/validate");
  assert.equal(typeof validateFeedback, "function");
  const fs = require("node:fs"), path = require("node:path");
  assert.match(fs.readFileSync(path.join(__dirname, "..", "api", "submit.js"), "utf8"), /coerceOverallScore\(attempt\.parsed\)/);
});
