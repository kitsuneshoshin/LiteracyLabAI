const test = require("node:test");
const assert = require("node:assert/strict");
const { cleanSkillLevels, skillLevelsShape, skillLevelsClause } = require("../api/_lib/skillLevels");
const { scoreTargets } = require("../api/_lib/targetScoring");
const { buildWritingPrompt, buildReadingPrompt } = require("../api/_lib/prompt");
const { targetsForGrade } = require("../api/_lib/masteryTargets");

// Every plan gets a 1-4 level per skill (Premium's exam bands already are one), so the progress bars are graded for everyone.

const UK = "🇬🇧 United Kingdom";
const targets = targetsForGrade(UK, "Year 5", "elementary").targets;
const names = targets.map((t) => t.name);

test("cleanSkillLevels keeps only real skills with whole levels 1-4, and never invents any", () => {
  const p = { skillLevels: { [names[0]]: 3, [names[1].toUpperCase()]: "2", "Not a skill": 4, [names[2]]: 7, [names[3]]: null } };
  cleanSkillLevels(p, names, { ask: true });
  assert.deepEqual(p.skillLevels, { [names[0]]: 3, [names[1]]: 2 });
  const none = { skillLevels: { x: 1 } };
  cleanSkillLevels(none, names, { ask: true });
  assert.equal("skillLevels" in none, false, "nothing valid -> no field");
  const premium = { skillLevels: { [names[0]]: 3 } };
  cleanSkillLevels(premium, names, { ask: false });
  assert.equal("skillLevels" in premium, false, "not asked (exam bands cover it) -> dropped");
  assert.doesNotThrow(() => cleanSkillLevels({ skillLevels: [1, 2] }, names, { ask: true }));
});

test("progress uses the level for each skill in place of strength / next step, and falls back to them where there is none", () => {
  const sub = (fb) => ({ feedback: fb });
  const [A, B, C] = names;
  const t = Object.fromEntries(scoreTargets(targets, [sub({ glowTarget: A, growTarget: B, skillLevels: { [A]: 4, [B]: 2 } })]).map((x) => [x.name, x]));
  assert.equal(t[A].pct, 73, "Strong: (0.95 + 0.5) / 2");
  assert.equal(t[B].pct, 45, "Developing: (0.4 + 0.5) / 2");
  assert.equal(t[C].status, "Not Yet Assessed");
  assert.equal(t[A].assessedCount, 1, "the level replaces the glow, it is not counted twice");
  const old = Object.fromEntries(scoreTargets(targets, [sub({ glowTarget: A, growTarget: B })]).map((x) => [x.name, x]));
  assert.equal(old[A].pct, 75, "older feedback without levels still scores as before");
  // three pieces, each a little different: the percentages are not stuck on a few round numbers
  const many = scoreTargets(targets, [
    sub({ glowTarget: A, growTarget: B, skillLevels: { [A]: 3, [B]: 2 } }),
    sub({ glowTarget: A, growTarget: B, skillLevels: { [A]: 3, [B]: 3 } }),
    sub({ glowTarget: A, growTarget: B, skillLevels: { [A]: 4, [B]: 3 } }),
  ]);
  assert.ok(new Set(many.filter((x) => x.pct !== null).map((x) => x.pct)).size >= 2);
});

const base = { tier: "elementary", country: UK, gradeLabel: "Year 5", interest: "football", confidenceWriting: "growing", motivation: "enjoyment", prompt: "Write about a storm.", text: "The storm came fast and loud.", targetNames: names, targets };

test("the writing and reading prompts ask for levels unless the plan already has exam bands", () => {
  const core = buildWritingPrompt({ ...base, capabilities: { examTechnique: false } });
  assert.match(core, /SKILL LEVELS \(required\)/);
  assert.match(core, /"skillLevels": \{/);
  const split = buildWritingPrompt({ ...base, capabilities: { examTechnique: true, deepFeedback: true }, part: "core" });
  assert.match(split, /"skillLevels": \{/, "Premium early/elementary years have no exam bands, so they get levels");
  const high = targetsForGrade("🇬🇧 United Kingdom", "Year 10", "high").targets;
  const premiumHigh = buildWritingPrompt({ ...base, tier: "high", gradeLabel: "Year 10", targets: high, targetNames: high.map((t) => t.name), capabilities: { examTechnique: true, deepFeedback: true } });
  assert.doesNotMatch(premiumHigh, /SKILL LEVELS/, "exam bands already give a level per objective");
  assert.match(skillLevelsClause(targets, "reading"), /questions they answered correctly/);
  assert.match(skillLevelsShape(targets), /an integer 1-4/);
  const reading = buildReadingPrompt({ tier: "elementary", country: UK, gradeLabel: "Year 5", interest: "football", confidenceReading: "growing", motivation: "enjoyment", passageTitle: "T", passage: "P", questions: [{ q: "Q?", options: ["a", "b"], answer: 0 }], answers: [0], score: 1, totalQuestions: 1, targetNames: names, targets, capabilities: {} });
  assert.match(reading, /"skillLevels": \{/);
});
