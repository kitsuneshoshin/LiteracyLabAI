const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");

// "See PEEL at work" (the whole response labelled, plus a model) covers everything the one-sentence
// "Framework spotlight" shows, so a learner who has the first never sees the second.
test("the framework spotlight steps aside when the 'at work' panel is showing", () => {
  const a = APP.indexOf("function responsesShown"), b = APP.indexOf("function FrameworkTipPanel");
  assert.ok(a > 0 && b > a);
  const { responsesShown } = new Function(APP.slice(a, b) + "\nreturn { responsesShown };")();
  const full = { frameworkInfo: { name: "PEEL", parts: [{ name: "Point" }] }, modelResponse: "A model." };
  assert.equal(responsesShown(full), true);
  assert.equal(responsesShown({ ...full, modelResponse: "" }), false, "no model response, no panel");
  assert.equal(responsesShown({ frameworkInfo: { name: "PEEL", parts: [] }, modelResponse: "x" }), false);
  assert.equal(responsesShown({}), false, "Free and Core feedback keeps the spotlight");
  assert.match(APP, /function FrameworkTipPanel[\s\S]{0,300}if \(responsesShown\(feedback\)\) return null;/);
  assert.match(APP, /function ResponsesPanel[\s\S]{0,400}if \(!responsesShown\(feedback\)\) return null;/);
});
