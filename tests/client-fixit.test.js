const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Fix It (the writing game) keeps its rules and its questions in app.html, so they are copied out of the source and run
// here: that every written question is well formed in every country, that the questions fit the age band and the country,
// how a round is chosen, and how skills level up. It shares the coins, egg and streak with Word Dash (the dash* rules).
const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
const a0 = APP.indexOf("const VOCAB_BOXES = "), a1 = APP.indexOf("// The Frayer card for a word");
const b0 = APP.indexOf("// ---- Word Dash rules (start)"), b1 = APP.indexOf("// ---- Word Dash rules (end)");
const c0 = APP.indexOf("// ---- Fix It rules (start)"), c1 = APP.indexOf("// ---- Fix It rules (end)");
assert.ok(a0 > 0 && a1 > a0 && b0 > 0 && b1 > b0 && c0 > b1 && c1 > c0, "the helpers and both games' rules are in app.html");
const G = new Function("localStorage", APP.slice(a0, a1) + "\n" + APP.slice(b0, b1) + "\n" + APP.slice(c0, c1) + `
return { FIXIT_ROUND, FIXIT_BANK, FIXIT_SKILLS, FIXIT_SWAP, fixitRegion, fixitSpell, fixitTerms, fixitSkillLabel, fixitId, fixitParse, fixitState, fixitLoad, fixitSave,
  fixitAcc, fixitSkillBox, fixitSkillLevel, fixitSkillsFor, fixitPlan, fixitRetry, fixitRecord, dashApplyRound, dashState };`)(
  (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; })()
);

const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const TIERS = ["early", "elementary", "middle", "high"];
const REGIONS = ["uk", "us", "ca", "au"];
const asItem = ([skill, level, src, note]) => ({ skill, level, src, note, id: G.fixitId(src) });

test("every question is well formed in every country: one mistake in one word, a right fix, and distinct wrong choices", () => {
  for (const tier of TIERS) {
    for (const row of G.FIXIT_BANK[tier]) {
      const item = asItem(row);
      for (const region of REGIONS) {
        const q = G.fixitParse(item, region, seeded(3));
        assert.ok(q, `${tier} / ${region}: could not build "${item.src}"`);
        assert.equal(q.words[q.at], q.wrong, `${item.src}: the word at the mistake is the mistake`);
        assert.notEqual(q.right, q.wrong);
        assert.ok(q.options.length >= 2 && q.options.length <= 4, `${item.src}: ${q.options.length} choices`);
        assert.equal(new Set(q.options).size, q.options.length, `${item.src}: repeated choice`);
        assert.ok(!q.options.includes(q.wrong), `${item.src}: the mistake is offered as a fix`);
        assert.equal(q.options[q.correctIndex], q.right);
        assert.notEqual(q.fixed, q.words.join(" "));
        assert.ok(q.fixed.split(" ").length >= q.words.length - 0 && q.fixed.includes(q.right));
        assert.ok(!/\{(stop|quote)\}/.test(q.hint) && q.hint.length > 10, `${item.src}: hint`);
      }
    }
  }
});

test("a country's spelling never changes the word being tested, so the mistake and its fix are the same everywhere", () => {
  for (const tier of TIERS) {
    for (const row of G.FIXIT_BANK[tier]) {
      const item = asItem(row);
      const base = G.fixitParse(item, "uk", seeded(1));
      for (const region of REGIONS) {
        const q = G.fixitParse(item, region, seeded(1));
        assert.equal(q.wrong, base.wrong, item.src);
        assert.equal(q.right, base.right, item.src);
        assert.equal(q.at, base.at, item.src);
      }
    }
  }
});

test("the bank is big enough for every age band, uses only known skills and levels, and has no repeats", () => {
  const minimum = { early: 70, elementary: 105, middle: 90, high: 80 };
  for (const tier of TIERS) {
    const rows = G.FIXIT_BANK[tier];
    assert.ok(rows.length >= minimum[tier], `${tier}: only ${rows.length} questions`);
    assert.equal(new Set(rows.map((r) => r[2])).size, rows.length, tier + ": a sentence is written twice");
    assert.equal(new Set(rows.map((r) => G.fixitId(r[2]))).size, rows.length, tier + ": two sentences share an id");
    for (const [skill, level, src] of rows) {
      assert.ok(G.FIXIT_SKILLS[skill], `${tier}: unknown skill ${skill}`);
      assert.ok([1, 2, 3].includes(level), `${tier}: bad level for ${src}`);
      assert.equal((src.match(/\[\[/g) || []).length, 1, `${src}: exactly one mistake per sentence`);
    }
    assert.ok(G.fixitSkillsFor(tier).length >= 5, tier + ": too few skills");
  }
  for (const [k, s] of Object.entries(G.FIXIT_SKILLS)) assert.ok(s.label && s.hint, k + ": label and hint");
});

test("no question uses a word that would read oddly or wrongly in another country", () => {
  // Words the spelling swap does not cover, and one that means something different in the US.
  const risky = /\b(rubber|programme|criticis\w*|apologis\w*|practis\w*|recognis\w*|analys\w*|cosy|tyre|pyjamas|jumper|lorry|petrol|holiday|biscuit)\b/i;
  for (const tier of TIERS) for (const [, , src] of G.FIXIT_BANK[tier]) assert.ok(!risky.test(src), "reads differently in another country: " + src);
});

test("a plural owner takes the apostrophe after the s, and a single owner before it", () => {
  // Written once as [[stem|right|other]]: where the sentence says there is more than one owner, the right fix ends s'.
  const plural = /\b(two|three|four|five|several|both|many|all the)\s+$/i;
  let checked = 0;
  for (const tier of TIERS) {
    for (const [skill, , src] of G.FIXIT_BANK[tier]) {
      if (skill !== "apos") continue;
      const m = /^(.*?)\[\[([^|\]]+)\|([^|\]]+)\|([^\]]+)\]\]/.exec(src);
      if (!m) continue;
      const [, before, wrong, right, rest] = m;
      const forms = [right, ...rest.split("|")];
      const owner = forms.find((f) => /s'$/.test(f)), single = forms.find((f) => /'s$/.test(f) && f.slice(0, -2) === wrong.replace(/s$/, ""));
      if (!owner || !single) continue;
      checked++;
      if (plural.test(before)) assert.equal(right, owner, "more than one owner, so the apostrophe goes after the s: " + src);
    }
  }
  assert.ok(checked >= 8, "the check found the plural-owner questions (" + checked + ")");
});

test("the youngest learners get short sentences and only the simple skills", () => {
  for (const [skill, , src] of G.FIXIT_BANK.early) {
    assert.ok(src.replace(/\[\[([^|\]]+)[^\]]*\]\]/, "$1").split(" ").length <= 9, "too long for the early years: " + src);
    assert.ok(["caps", "stop", "question", "spell", "endings", "tense"].includes(skill), "early years should not get " + skill);
  }
});

test("each country gets its own spelling and words: periods or full stops, speech marks or quotation marks, mom or mum", () => {
  assert.deepEqual([["United Kingdom", "uk"], ["United States", "us"], ["Canada", "ca"], ["Australia", "au"], ["New Zealand", "uk"], ["Ireland", "uk"], ["India", "uk"], ["South Africa", "uk"], ["Hong Kong", "uk"], ["UAE & GCC Hubs", "uk"], ["Singapore & SE Asia", "uk"], ["Global ESL Mode", "uk"], ["", "uk"]].map(([c]) => G.fixitRegion("🏳 " + c)),
    ["uk", "us", "ca", "au", "uk", "uk", "uk", "uk", "uk", "uk", "uk", "uk", "uk"]);
  assert.equal(G.fixitTerms("uk").stop, "full stop");
  assert.equal(G.fixitTerms("au").stop, "full stop");
  assert.equal(G.fixitTerms("us").stop, "period");
  assert.equal(G.fixitTerms("ca").stop, "period");
  assert.equal(G.fixitTerms("uk").quote, "speech marks");
  assert.equal(G.fixitTerms("au").quote, "quotation marks");
  assert.equal(G.fixitTerms("us").quote, "quotation marks");
  assert.equal(G.fixitSkillLabel("stop", "uk"), "Full stops");
  assert.equal(G.fixitSkillLabel("stop", "us"), "Periods");
  assert.equal(G.fixitSkillLabel("stop", "au"), "Full stops");
  assert.equal(G.fixitSkillLabel("speech", "uk"), "Speech marks");
  assert.equal(G.fixitSkillLabel("speech", "au"), "Quotation marks");
  assert.equal(G.fixitSkillLabel("speech", "us"), "Quotation marks");
  assert.equal(G.fixitSpell("Mum said the colour is grey. Mum!", "us"), "Mom said the color is gray. Mom!");
  assert.equal(G.fixitSpell("Mum organised the colour", "ca"), "Mom organized the colour");
  assert.equal(G.fixitSpell("Mum organised the colour", "uk"), "Mum organised the colour");
  assert.equal(G.fixitSpell("Mummy and the humming", "us"), "Mummy and the humming", "only whole words change");
  const stop = G.fixitParse(asItem(["stop", 1, "The cat sat on the [[mat|mat.|mat,|mat?]]"]), "us", seeded());
  assert.match(stop.hint, /period/);
  assert.doesNotMatch(stop.hint, /full stop/);
  const speech = G.fixitParse(asItem(["speech", 2, "“Time for [[bed,|bed,”|bed”,|“bed,]] said Mum."]), "uk", seeded());
  assert.match(speech.hint, /speech marks/);
  const mom = G.fixitParse(asItem(["speech", 2, "“Time for [[bed,|bed,”|bed”,|“bed,]] said Mum."]), "us", seeded());
  assert.ok(mom.words.includes("Mom."));
});

test("a round is ten questions, none repeated, never the same skill three times running", () => {
  for (const tier of TIERS) {
    for (let s = 1; s <= 25; s++) {
      const plan = G.fixitPlan(tier, "uk", {}, seeded(s));
      assert.equal(plan.length, G.FIXIT_ROUND, tier);
      assert.equal(new Set(plan.map((q) => q.id)).size, plan.length, tier + ": a question repeats");
      for (let i = 2; i < plan.length; i++) assert.ok(!(plan[i].skill === plan[i - 1].skill && plan[i].skill === plan[i - 2].skill), `${tier}: ${plan[i].skill} three times running`);
    }
  }
});

test("a round leans towards the skills the learner finds hardest", () => {
  // A weak skill only gets its easiest questions, so compare how often each available question is chosen.
  const state = { stats: { caps: { n: 30, r: 30 }, comma: { n: 30, r: 5 } }, recent: [] };
  const rows = G.FIXIT_BANK.elementary;
  const base = (skill) => Math.min(...rows.filter((r) => r[0] === skill).map((r) => r[1]));
  const open = (skill) => rows.filter((r) => r[0] === skill && r[1] <= G.fixitSkillLevel(state.stats[skill], base(skill))).length;
  let caps = 0, comma = 0;
  for (let s = 1; s <= 300; s++) for (const q of G.fixitPlan("elementary", "uk", state, seeded(s))) { if (q.skill === "caps") caps++; if (q.skill === "comma") comma++; }
  assert.ok(open("caps") > 0 && open("comma") > 0);
  // (A round never repeats a question, so a skill with only two open questions is capped at two a round.)
  assert.ok(comma / open("comma") > (caps / open("caps")) * 1.2, `weak skill ${comma}/${open("comma")} vs strong skill ${caps}/${open("caps")}`);
});

test("a skill starts at its easiest questions and unlocks harder ones only with steady accuracy", () => {
  assert.equal(G.fixitSkillLevel(undefined, 1), 1);
  assert.equal(G.fixitSkillLevel({ n: 5, r: 5 }, 1), 1, "too few answers");
  assert.equal(G.fixitSkillLevel({ n: 6, r: 5 }, 1), 2);
  assert.equal(G.fixitSkillLevel({ n: 6, r: 3 }, 1), 1, "not accurate enough");
  assert.equal(G.fixitSkillLevel({ n: 15, r: 13 }, 1), 3);
  assert.equal(G.fixitSkillLevel({ n: 15, r: 13 }, 2), 3, "never above 3");
  assert.equal(G.fixitSkillLevel({ n: 6, r: 6 }, 2), 3);
  const base = {};
  for (const [skill, level] of G.FIXIT_BANK.elementary) base[skill] = Math.min(base[skill] || 9, level);
  for (let s = 1; s <= 40; s++) for (const q of G.fixitPlan("elementary", "uk", {}, seeded(s), 5)) assert.equal(q.level, base[q.skill], `${q.skill} at level ${q.level} for a new learner`);
  const strong = { stats: { caps: { n: 20, r: 20 } }, recent: [] };
  let harder = 0;
  for (let s = 1; s <= 60; s++) for (const q of G.fixitPlan("elementary", "uk", strong, seeded(s), 5)) if (q.skill === "caps" && q.level > 1) harder++;
  assert.ok(harder > 0, "a strong skill reaches its harder questions");
});

test("questions seen lately are held back while there are enough others", () => {
  const rows = G.FIXIT_BANK.elementary.map(asItem);
  const recent = rows.slice(0, 20).map((r) => r.id);
  const seen = new Set(recent);
  for (let s = 1; s <= 30; s++) for (const q of G.fixitPlan("elementary", "uk", { stats: {}, recent }, seeded(s))) assert.ok(!seen.has(q.id), "a recent question came back");
  const all = G.fixitPlan("early", "uk", { stats: {}, recent: G.FIXIT_BANK.early.map((r) => G.fixitId(r[2])) }, seeded(), 10);
  assert.equal(all.length, 10, "when everything was seen lately, a round still has ten");
});

test("what is remembered is cleaned on the way in, and a round's answers add up", () => {
  const s = G.fixitState({ stats: { caps: { n: 4, r: 99 }, nonsense: { n: 3, r: 1 }, comma: "x", stop: { n: -5, r: 2 } }, recent: ["abc", 5, "x".repeat(40)] });
  assert.deepEqual(s.stats, { caps: { n: 4, r: 4 } });
  assert.deepEqual(s.recent, ["abc"]);
  assert.deepEqual(G.fixitState(null), { stats: {}, recent: [] });
  assert.deepEqual(G.fixitState("bad"), { stats: {}, recent: [] });
  const a = G.fixitRecord({ stats: { caps: { n: 2, r: 1 } }, recent: ["old"] }, [{ id: "q1", skill: "caps", ok: true }, { id: "q2", skill: "comma", ok: false }, { id: "q3", skill: "bogus", ok: true }]);
  assert.deepEqual(a.stats, { caps: { n: 3, r: 2 }, comma: { n: 1, r: 0 } });
  assert.deepEqual(a.recent, ["old", "q1", "q2", "q3"]);
  let big = { stats: { caps: { n: 40, r: 30 } }, recent: [] };
  big = G.fixitRecord(big, [{ id: "z", skill: "caps", ok: true }]);
  assert.deepEqual(big.stats.caps, { n: 21, r: 16 }, "old answers fade so the skill can still move");
  let many = { stats: {}, recent: [] };
  for (let i = 0; i < 100; i++) many = G.fixitRecord(many, [{ id: "id" + i, skill: "caps", ok: true }]);
  assert.equal(many.recent.length, 80);
  assert.equal(many.recent[79], "id99");
});

test("a skill's step on the four-step list follows how many answers and how accurate", () => {
  assert.equal(G.fixitSkillBox(undefined), 0);
  assert.equal(G.fixitSkillBox({ n: 2, r: 2 }), 0, "too soon to say");
  assert.equal(G.fixitSkillBox({ n: 5, r: 2 }), 1);
  assert.equal(G.fixitSkillBox({ n: 5, r: 4 }), 2);
  assert.equal(G.fixitSkillBox({ n: 10, r: 9 }), 3);
  assert.equal(G.fixitSkillBox({ n: 9, r: 9 }), 2, "needs ten answers for the top step");
});

test("what is remembered is kept per learner on this device, and a broken store does nothing", () => {
  G.fixitSave("kid1", { stats: { caps: { n: 3, r: 2 } }, recent: ["a"] });
  assert.deepEqual(G.fixitLoad("kid1"), { stats: { caps: { n: 3, r: 2 } }, recent: ["a"] });
  assert.deepEqual(G.fixitLoad("kid2"), { stats: {}, recent: [] });
});

test("a missed question comes back once with the same fix and freshly shuffled choices", () => {
  const q = G.fixitPlan("middle", "uk", {}, seeded(4))[0];
  const again = G.fixitRetry(q, "middle", "uk", seeded(9));
  assert.ok(again.retry);
  assert.equal(again.id, q.id);
  assert.equal(again.fixed, q.fixed);
  assert.equal(again.options[again.correctIndex], q.right);
  assert.equal(G.fixitRetry({ id: "nope" }, "middle", "uk", seeded()), null);
});

test("the screens adapt to the device: wider on big screens, easy to tap on phones, and correct right to left", () => {
  const ui = APP.slice(APP.indexOf("function GamesHub("), APP.indexOf("// Tell us what you think: a short form"));
  // Big screens: the home card, the round and the results grow, and so does the text.
  assert.match(ui, /max-w-3xl lg:max-w-5xl 2xl:max-w-6xl/);
  assert.match(ui, /sm:grid-cols-2 lg:grid-cols-3/, "skills: one column on a phone, two, then three");
  assert.match(ui, /max-w-xl md:max-w-2xl 2xl:max-w-3xl/);
  assert.match(ui, /text-\[19px\] md:text-\[22px\] 2xl:text-\[26px\]/);
  assert.match(ui, /text-\[26px\] md:text-\[32px\] 2xl:text-\[38px\]/);
  // Phones: the two main buttons stack full width, and every tappable thing is at least 40 to 48px.
  assert.match(ui, /flex flex-col sm:flex-row/);
  assert.equal((ui.match(/w-full sm:w-auto/g) || []).length, 2);
  assert.match(ui, /min-h-\[44px\] min-w-\[44px\]/, "each word of the sentence");
  assert.match(ui, /min-h-\[40px\] text-\[12px\]/, "read aloud");
  assert.match(ui, /min-h-\[48px\]/, "the choices");
  // Right to left: counters and scores keep their order, and the English reminder keeps its punctuation.
  assert.match(ui, /dir="ltr">\{idx \+ 1\} \/ \{qs\.length\}/);
  assert.match(ui, /dir="ltr">\{value\}/);
  assert.match(ui, /lang="en" dir="ltr">\{q\.hint\}/);
  // Nothing fixed-width that could push a phone sideways.
  assert.ok(!/\bw-\[\d{3,}px\]|min-w-\[\d{3,}px\]|style=\{\{[^}]*\bwidth: \d{3,}\b/.test(ui), "a fixed width wider than a small phone");
});

test("it shares its coins, Word Pals and streak with Word Dash, and the screens are wired into the workspace", () => {
  const out = G.dashApplyRound(G.dashState(), { right: 10, outOf: 10, coins: 160, bestCombo: 10, perfect: true }, 20000, seeded());
  assert.equal(out.state.streak, 1);
  assert.equal(out.hatched.length, 1, "160 coins hatch a Word Pal, the same egg Word Dash fills");
  assert.match(APP, /\["games","Games",IconTrophy\]/, "a Games tab");
  assert.match(APP, /<GamesHub plan=\{plan\} country=\{country\} tier=\{tier\}/);
  assert.match(APP, /logEvent\("fixit_start"/);
  assert.match(APP, /logEvent\("fixit_round"/);
  assert.match(APP, /dashApplyRound\(dash, res, dashDay\(Date\.now\(\)\), Math\.random\)/);
  assert.match(APP, /planMeta\(plan\)\.vocabBank/, "the account copy of the game is only saved on plans that keep it");
  const ui = APP.slice(APP.indexOf("function GamesHub("), APP.indexOf("// Tell us what you think: a short form"));
  assert.match(ui, /dir="ltr" lang="en" data-no-i18n=""/, "the English sentence is never flipped or translated");
  assert.ok(!/tabIndex/.test(ui));
});
