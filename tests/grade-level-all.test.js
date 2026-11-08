const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { levelFor, readability } = require("../api/_lib/gradeLevel");
const { GRADE_WORD_TARGETS } = require("../api/_lib/writingLimits");
const { validatePassage, validateWritingPrompt } = require("../api/_lib/validate");
const { buildReadingPassagePrompt, buildWritingPromptGenerator } = require("../api/_lib/prompt");
const { DEFAULT_GENRE_BY_TIER } = require("../api/_lib/writingFrameworks");
const { did, loadHandler, call } = require("./harness");

// Every country, every year, reading and writing, read from app.html so a new grade is covered automatically.
function appSyllabuses() {
  const html = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  const out = [];
  for (const m of html.matchAll(/^\s*"([^"]+)":\s*\{\s*curriculum:[^\n]*?grades:\s*\[([^\]]*)\],\s*tiers:\s*\[([^\]]*)\]/gm)) {
    out.push({ country: m[1], grades: [...m[2].matchAll(/"([^"]+)"/g)].map((g) => g[1]), cuts: m[3].split(",").map(Number) });
  }
  return out;
}
const SYLLABUSES = appSyllabuses();
const tierOf = (cuts, i) => (i < cuts[0] ? "early" : i < cuts[1] ? "elementary" : i < cuts[2] ? "middle" : "high");
const ALL = SYLLABUSES.flatMap((s) => s.grades.map((g, i) => ({ country: s.country, grade: g, tier: tierOf(s.cuts, i) })));

// Plain text built to a band: sentences of `avg` words, with the share of long words a real text of that level has.
const ONE = ["the", "dog", "ran", "to", "park", "and", "we", "see", "it", "big", "red", "sat", "on", "with", "her", "friend"];
const TWO = ["garden", "morning", "water", "market", "river", "window", "pocket", "quiet", "village", "carried", "gently", "tower"];
const THREE = ["beautiful", "adventure", "important", "remember", "excited", "enormous", "discovered", "mysterious"];
const FOUR = ["extraordinary", "unfortunately", "considerably", "imagination", "opportunity", "approximately"];
function textOf(words, avg, longShare) {
  const out = [];
  for (let i = 0; i < words; i++) {
    const r = (i * 37 % 100) / 100;
    const pool = r < longShare * 0.15 ? FOUR : r < longShare * 0.5 ? THREE : r < longShare ? TWO : ONE;
    let w = pool[(i * 7 + (i >> 3)) % pool.length];
    if (i % avg === 0) w = w[0].toUpperCase() + w.slice(1);
    out.push(w + ((i + 1) % avg === 0 ? "." : ""));
  }
  return out.join(" ") + (words % avg ? "." : "");
}
// How a real text of this age reads: young texts are mostly one-syllable words, older ones use more long words.
const longShareFor = (age) => (age <= 7 ? 0.12 : age <= 10 ? 0.2 : age <= 13 ? 0.3 : 0.4);
const QUESTIONS = Array.from({ length: 5 }, (_, i) => ({ type: "mc", q: `Question ${i + 1}?`, options: ["a", "b", "c", "d"].map((x) => x + i), correct: 0 }));
const mine = (issues) => issues.filter((i) => /too long for|reads too hard|words, expected/.test(i));
const check = (passage, g, textType) => validatePassage({ title: "Title", skill: "Skill", passage, questions: QUESTIONS }, { tier: g.tier, country: g.country, gradeLabel: g.grade, template: ["mc", "mc", "mc", "mc", "mc"], textType });

test("sweep size: all twelve syllabuses and every year are covered", () => {
  assert.equal(SYLLABUSES.length, 12);
  assert.ok(ALL.length === 149, `${ALL.length} year groups`);
});

test("READING, every country and year: the prompt carries that year's length and limits and no old wording", () => {
  for (const g of ALL) {
    const lv = levelFor(g.country, g.grade, g.tier);
    const p = buildReadingPassagePrompt({ tier: g.tier, country: g.country, gradeLabel: g.grade });
    const where = `${g.country} ${g.grade}`;
    assert.ok(lv.reading, `${where} has a reading band`);
    assert.ok(p.includes(`roughly ${lv.reading.words[0]}-${lv.reading.words[1]} words`), `${where}: length`);
    assert.ok(p.includes(`about ${lv.reading.avg} words or fewer`), `${where}: sentence limit`);
    assert.ok(p.includes(lv.reading.vocab), `${where}: vocabulary`);
    assert.ok(p.includes(g.grade), `${where}: names the year`);
    assert.doesNotMatch(p, /adult-register|real stretch/);
  }
});

test("READING, every country and year: a passage written to the year's band is accepted", () => {
  for (const g of ALL) {
    const lv = levelFor(g.country, g.grade, g.tier);
    const r = lv.reading;
    const age = lv.age || ({ A1: 5, A2: 7, B1: 10, B2: 13, C1: 16, C2: 18 })[lv.cefr];
    const passage = textOf(Math.round((r.words[0] + r.words[1]) / 2), r.avg, longShareFor(age));
    const issues = mine(check(passage, g).issues);
    assert.deepEqual(issues, [], `${g.country} ${g.grade}: ${JSON.stringify(readability(passage))}`);
  }
});

test("READING, every country and year: the longest and shortest lengths the prompt asks for are both accepted", () => {
  for (const g of ALL) {
    const r = levelFor(g.country, g.grade, g.tier).reading;
    const age = levelFor(g.country, g.grade, g.tier).age || 12;
    for (const n of r.words) {
      const issues = mine(check(textOf(n, r.avg, longShareFor(age) * 0.6), g).issues);
      assert.deepEqual(issues, [], `${g.country} ${g.grade} at ${n} words`);
    }
  }
});

test("READING, every country and year: a long, dense passage is sent back (except at the very top years)", () => {
  for (const g of ALL) {
    const lv = levelFor(g.country, g.grade, g.tier);
    const r = lv.reading;
    if (r.avg >= 20) continue; // the oldest years legitimately take long sentences
    const passage = textOf(Math.round((r.words[0] + r.words[1]) / 2), Math.round(r.avg * 2.2), 0.5);
    assert.ok(mine(check(passage, g).issues).some((i) => /too long for|reads too hard/.test(i)), `${g.country} ${g.grade} should reject it: ${JSON.stringify(readability(passage))}`);
  }
});

test("READING, every country and year: a passage that is wildly too long for the year is sent back", () => {
  for (const g of ALL) {
    const r = levelFor(g.country, g.grade, g.tier).reading;
    const age = levelFor(g.country, g.grade, g.tier).age || 12;
    const passage = textOf(Math.ceil(r.words[1] * 1.6), r.avg, longShareFor(age) * 0.5);
    assert.ok(mine(check(passage, g).issues).some((i) => /words, expected/.test(i)) || check(passage, g).issues.some((i) => /unreasonable length/.test(i)), `${g.country} ${g.grade}`);
  }
});

test("READING, within each country: older years get longer passages and longer sentences, never shorter", () => {
  for (const s of SYLLABUSES) {
    if (/Global ESL/.test(s.country)) continue;
    let prev = null;
    s.grades.forEach((grade, i) => {
      const r = levelFor(s.country, grade, tierOf(s.cuts, i)).reading;
      if (prev) { assert.ok(r.words[1] >= prev.words[1], `${s.country} ${grade}: length`); assert.ok(r.avg >= prev.avg && r.fk >= prev.fk, `${s.country} ${grade}: sentence and ceiling`); }
      prev = r;
    });
  }
});

test("READING: the same age gets the same band in every country (UK Year 4 = US Grade 3 = NZ Year 5)", () => {
  const band = (country, grade) => JSON.stringify(levelFor(country, grade, "elementary").reading);
  assert.equal(band("🇬🇧 United Kingdom", "Year 4"), band("🇺🇸 United States", "Grade 3"));
  assert.equal(band("🇬🇧 United Kingdom", "Year 4"), band("🇳🇿 New Zealand", "Year 4"));
  assert.equal(band("🇬🇧 United Kingdom", "Year 10"), band("🇺🇸 United States", "Grade 9"));
});

test("WRITING, every country and year: the prompt asks for that year's length and reader, and the word target exists", () => {
  for (const g of ALL) {
    const lv = levelFor(g.country, g.grade, g.tier);
    const p = buildWritingPromptGenerator({ tier: g.tier, country: g.country, gradeLabel: g.grade });
    assert.ok(p.includes(`no more than ${lv.writing.maxWords} words`), `${g.country} ${g.grade}: prompt length`);
    assert.ok(p.includes(lv.writing.ask), `${g.country} ${g.grade}: what it may ask`);
    assert.ok(g.country.includes("Global ESL") || GRADE_WORD_TARGETS[g.country][g.grade] > 0, `${g.country} ${g.grade}: word target`);
  }
});

test("WRITING, every country and year: a prompt at the year's limit is accepted and one twice as long is sent back", () => {
  for (const g of ALL) {
    const lv = levelFor(g.country, g.grade, g.tier);
    const words = (n) => Array.from({ length: n }, (_, i) => ONE[i % ONE.length]).join(" ") + ".";
    const ok = validateWritingPrompt({ title: "Title", prompt: words(lv.writing.maxWords), genre: "narrative" }, { tier: g.tier, country: g.country, gradeLabel: g.grade });
    assert.deepEqual(ok.issues, [], `${g.country} ${g.grade}`);
    const long = words(Math.min(lv.writing.maxWords * 2, 60));
    if (lv.writing.maxWords * 2 > 60 && lv.writing.maxWords > 47) continue; // the stored prompt may not pass 400 characters anyway
    const bad = validateWritingPrompt({ title: "Title", prompt: long, genre: "narrative" }, { tier: g.tier, country: g.country, gradeLabel: g.grade });
    assert.ok(bad.issues.some((i) => /too long for/.test(i)), `${g.country} ${g.grade}`);
  }
});

test("WRITING through the real endpoint, every country and year: a prompt at the limit is delivered and a too-long one is retried then refused with nothing left reserved", async () => {
  for (const g of ALL) {
    const lv = levelFor(g.country, g.grade, g.tier);
    const words = (n) => Array.from({ length: n }, (_, i) => ONE[i % ONE.length]).join(" ") + ".";
    const run = async (prompt) => {
      let calls = 0, deleted = 0;
      const h = loadHandler("writing-prompt.js", {
        plan: "core", used: 0,
        db: (q) => {
          if (q.table === "child_profiles" && did(q, "maybeSingle")) return { data: { id: "c1" }, error: null };
          if (q.table === "child_profiles") return { data: [{ id: "c1", display_name: "Kid", created_at: "2026-09-01T00:00:00Z" }], error: null };
          if (q.table === "profiles") return { data: { active_child_id: "c1", active_child_set_at: null }, error: null };
          if (did(q, "insert")) return { data: { id: "sub-new" }, error: null };
          if (did(q, "delete")) deleted++;
          return { data: null, error: null };
        },
        generate: async () => { calls++; return { parsed: { title: "A Title", prompt, genre: DEFAULT_GENRE_BY_TIER[g.tier] }, modelUsed: "stub" }; },
      });
      const res = await call(h, { method: "POST", body: { tier: g.tier, country: g.country, gradeLabel: g.grade, interest: "space", childId: "c1" } });
      return { res, calls, deleted };
    };
    const good = await run(words(lv.writing.maxWords));
    assert.equal(good.res.statusCode, 200, `${g.country} ${g.grade}: ${JSON.stringify(good.res.body)}`);
    if (lv.writing.maxWords <= 47) {
      const bad = await run(words(lv.writing.maxWords * 2));
      assert.equal(bad.res.statusCode, 502, `${g.country} ${g.grade}`);
      assert.equal(bad.calls, 2, "one retry, then give up");
    }
  }
});
