const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const CP = require("../api/_lib/countryProfile");
const { GRADE_AGE } = require("../api/_lib/gradeLevel");
const { curriculumLabel } = require("../api/_lib/curriculum");
const F = require("../api/_lib/focus");
const QT = require("../api/_lib/questionTypes");
const { capabilitiesFor } = require("../api/_lib/plans");
const { buildReadingPassagePrompt, buildWritingPromptGenerator } = require("../api/_lib/prompt");

const UK = "🇬🇧 United Kingdom", SG = "🇸🇬 Singapore & SE Asia", ESL = "🌐 Global ESL Mode";
const EXAM_NAMES = /NAPLAN|PSLE|EQAO|OSSLT|HKDSE|CBSE|GCSE|NSC\b|NCEA|Leaving Cert|Checkpoint|SATs|AP-style|O-Level|IGCSE English/;

test("every country the app offers (except the CEFR mode) has a profile, bands that cover ages 5 to 18, and a source", () => {
  for (const country of Object.keys(GRADE_AGE)) {
    const p = CP.PROFILES[country];
    assert.ok(p, `${country} has a profile`);
    assert.ok(p.source && p.source.length > 30, `${country} names its sources`);
    const tos = p.bands.map((b) => b.to);
    assert.deepEqual(tos, tos.slice().sort((a, b) => a - b), `${country} bands rise with age`);
    assert.equal(tos[tos.length - 1], 18, `${country} covers up to 18`);
    for (const b of p.bands) for (const k of ["reading", "skill", "writing"]) assert.ok(b[k] && b[k].length > 25, `${country} ${b.to} has ${k}`);
    for (let age = 5; age <= 18; age++) assert.ok(CP.bandFor(country, age), `${country} age ${age}`);
  }
  assert.equal(CP.bandFor(ESL, 12), null, "the CEFR mode has no country profile");
});

test("review dates are real and no entry is more than 12 months old: this is the reminder to re-check a syllabus", () => {
  const now = new Date();
  for (const [country, p] of Object.entries(CP.PROFILES)) {
    assert.match(p.reviewed, /^\d{4}-\d{2}-\d{2}$/, country);
    const d = new Date(p.reviewed + "T00:00:00Z");
    assert.ok(!isNaN(d), `${country} date parses`);
    assert.ok(d <= new Date(now.getTime() + 86400000), `${country} is not reviewed in the future`);
    const months = (now - d) / (30.44 * 86400000);
    assert.ok(months <= 12, `${country} was last reviewed ${p.reviewed}: check it against ${p.source} and update the date`);
  }
});

test("different countries get different reading and writing notes at the same age", () => {
  const countries = Object.keys(CP.PROFILES);
  assert.equal(new Set(countries.map((c) => CP.readingNote(c, 10))).size, countries.length, "no two countries share a reading note");
  assert.equal(new Set(countries.map((c) => CP.readingSkill(c, 10))).size, countries.length, "no two countries share a skill list");
});

test("the notes never name an exam, so only Premium can ask for an exam style", () => {
  for (const [country, p] of Object.entries(CP.PROFILES)) for (const b of p.bands) for (const k of ["reading", "skill", "writing"]) assert.doesNotMatch(b[k], EXAM_NAMES, `${country} ${b.to} ${k}`);
});

const readArgs = (country, gradeLabel, tier) => ({ tier, country, gradeLabel, textType: QT.TEXT_TYPES[tier][0], template: QT.TEMPLATES[tier][0] });

test("the reading and writing prompts carry the learner's own curriculum, and the default skill follows it", () => {
  const uk = buildReadingPassagePrompt(readArgs(UK, "Year 5", "elementary"));
  const sg = buildReadingPassagePrompt(readArgs(SG, "Primary 5", "elementary"));
  assert.match(uk, /Curriculum fit: this learner follows UK National Curriculum/);
  assert.match(sg, /Curriculum fit: this learner follows/);
  assert.ok(uk.includes(CP.readingSkill(UK, 9)) && sg.includes(CP.readingSkill(SG, 10)));
  assert.notEqual(uk, sg);
  const w = buildWritingPromptGenerator({ tier: "elementary", country: SG, gradeLabel: "Primary 5" });
  assert.ok(w.includes(CP.writingNote(SG, 10)));
  const esl = buildReadingPassagePrompt(readArgs(ESL, "B1 Intermediate", "middle"));
  assert.doesNotMatch(esl, /Curriculum fit/, "the CEFR mode is unchanged");
  assert.doesNotMatch(buildWritingPromptGenerator({ tier: "middle", country: ESL, gradeLabel: "B1 Intermediate" }), /Curriculum fit/);
  for (const [p, c] of [[uk, UK], [sg, SG], [w, SG]]) assert.doesNotMatch(p.split(curriculumLabel(c)).join(""), EXAM_NAMES, "no exam named without the exam style");
});

test("a chosen skill still wins over the curriculum's default skills", () => {
  const skill = { key: "infer", text: F.READING_SKILLS.infer };
  const p = buildReadingPassagePrompt({ ...readArgs(UK, "Year 5", "elementary"), skill });
  assert.ok(p.includes("primarily test this comprehension skill: " + F.READING_SKILLS.infer));
  assert.ok(!p.includes(CP.readingSkill(UK, 9)));
});

// ------------------------------------------------------------------ exam-style reading
test("every exam the writing side knows has a reading style, and the two share one name", () => {
  const seen = new Set();
  for (const country of Object.keys(CP.PROFILES).concat(ESL)) {
    for (let i = 0; i <= 13; i++) {
      for (const g of [`Year ${i}`, `Grade ${i}`, `Class ${i}`, `Primary ${i}`, `Secondary ${i}`, `Cambridge Primary ${i}`, `Lower Secondary ${i}`, `IGCSE Year ${i}`, `${i}th Year`, "1st Year", "2nd Year", "3rd Year", "A Level (Yr 13)", "O-Level / IGCSE Yr 5", "B1 Intermediate", "C2 Proficient"]) {
        const w = F.examStyleFor(country, g);
        if (!w) continue;
        seen.add(w.name);
        const r = F.readingExamStyleFor(country, g);
        assert.ok(r, `${w.name} has a reading style`);
        assert.ok(r.name === w.name || (w.name === "KS2 English" && r.name === "KS2 SATs"), r.name);
      }
    }
  }
  assert.ok(seen.size >= 18, `found ${seen.size} exams`);
  for (const name of Object.keys(F.READING_EXAM)) assert.ok(seen.has(name) || name === "KS2 SATs", `${name} in READING_EXAM is a real exam name`);
});

test("exam-style reading is Premium only, only where there is an exam, and only when asked for as exactly true", () => {
  const rf = (plan, raw, country = UK, gradeLabel = "Year 5") => F.readingFocusFor({ tier: "elementary", country, gradeLabel, capabilities: capabilitiesFor(plan) }, raw);
  assert.equal(rf("premium", { examStyle: true }).exam.name, "KS2 English");
  assert.equal(rf("premium", { examStyle: true }, UK, "Year 6").exam.name, "KS2 SATs");
  assert.equal(rf("free", { examStyle: true }).exam, null);
  assert.equal(rf("core", { examStyle: true }).exam, null);
  assert.equal(rf("premium", { examStyle: true }, UK, "Reception").exam, null, "no exam for this year");
  for (const bad of ["true", 1, {}, [], null, false]) assert.equal(rf("premium", { examStyle: bad }).exam, null, JSON.stringify(bad));
  assert.equal(F.readingFocusFor({ tier: "middle" }, { examStyle: true }).exam, null, "no country, no exam");
});

test("the exam line appears in the reading prompt only when an exam is given, and changes nothing else", () => {
  const exam = F.readingExamStyleFor(SG, "Primary 6");
  assert.equal(exam.name, "PSLE English");
  const a = readArgs(SG, "Primary 6", "elementary");
  const withExam = buildReadingPassagePrompt({ ...a, exam });
  const without = buildReadingPassagePrompt(a);
  assert.match(withExam, /Exam style: this is practice for the PSLE English/);
  assert.ok(withExam.includes(exam.read));
  assert.doesNotMatch(without, /PSLE/);
  assert.equal(withExam.replace(/\n- Exam style:[^\n]*/, ""), without);
});

test("the page offers the reading exam switch to Premium, sends it, and the endpoint passes it on", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  assert.match(html, /Set it like a \{rexam\} reading task/);
  assert.match(html, /\{rexam\}-style reading is on Premium/);
  const clean = html.match(/function cleanFocus[\s\S]*?\n\}/)[0];
  assert.equal((clean.match(/examStyle === true/g) || []).length, 2, "kept for writing and for reading");
  const src = fs.readFileSync(path.join(__dirname, "..", "api", "reading-passage.js"), "utf8");
  assert.match(src, /readingFocusFor\(\{ tier, country, gradeLabel, capabilities: usage\.capabilities \}/);
  assert.match(src, /examStyle: parsed\.examStyle \|\| null/);
});

test("each grade lands in a band written for its own stage (the band edges follow the ages in gradeLevel.js)", () => {
  const AE = "🇦🇪 UAE & GCC Hubs";
  const note = (c, g) => CP.readingNote(c, GRADE_AGE[c][g]);
  assert.match(note(AE, "Cambridge Primary 6"), /Cambridge Primary/);
  assert.match(note(AE, "Lower Secondary 7"), /Lower Secondary/, "age 11 starts Lower Secondary");
  assert.match(note(AE, "Lower Secondary 9"), /Lower Secondary/);
  assert.match(note(AE, "IGCSE Year 10"), /upper-secondary/, "age 14 is IGCSE");
  assert.match(note(AE, "AS Level (Yr 12)"), /AS and A Level/, "age 16 is AS Level");
  assert.match(note(SG, "Secondary 2"), /lower secondary/);
  assert.match(note(SG, "Secondary 3"), /upper secondary/, "Secondary 3 is upper secondary in MOE terms");
  assert.match(note(SG, "O-Level / IGCSE Yr 4"), /upper secondary/);
  assert.doesNotMatch(note(SG, "Secondary 3"), /lower secondary/);
});

test("Singapore Secondary 1-3 is not called an O-Level task, and only Primary 6 asks for the 150-word PSLE composition", () => {
  assert.equal(F.examStyleFor(SG, "Secondary 1").name, "Singapore secondary English");
  assert.equal(F.examStyleFor(SG, "O-Level / IGCSE Yr 4").name, "O-Level English Paper 1");
  assert.match(F.examStyleFor(SG, "Primary 6").style, /at least 150 words/);
  assert.doesNotMatch(F.examStyleFor(SG, "Primary 5").style, /150 words/);
  assert.equal(F.readingExamStyleFor(SG, "Secondary 1").name, "Singapore secondary English");
});
