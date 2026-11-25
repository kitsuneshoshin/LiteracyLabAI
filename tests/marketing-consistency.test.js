const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PLANS } = require("../api/_lib/plans");

// What the site SAYS each plan gets must match what plans.js GIVES it. The
// pricing table, plan cards and FAQ are hand-written HTML, so this is what
// stops a plan change in code from leaving the page promising (or hiding)
// something the product doesn't do - which is exactly how "nothing held back",
// "a mission for next time" and a missing spelling-check row got through.

const ROOT = path.join(__dirname, "..");
const INDEX = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const APP = fs.readFileSync(path.join(ROOT, "app.html"), "utf8");

// ---- the comparison table on the homepage, parsed into rows of [free, core, premium]
function tableRows() {
  const start = INDEX.indexOf("<tbody", INDEX.indexOf("What you get"));
  const end = INDEX.indexOf("</tbody>", start);
  const body = INDEX.slice(start, end);
  const rows = {};
  // Rows and cells carry accessibility roles and per-plan labels (for the phone
  // layout), so match them by tag and by the attributes that matter.
  for (const tr of body.split(/<tr\b[^>]*>/).slice(1)) {
    const th = tr.match(/<th\b[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>/);
    if (!th) continue;
    const label = th[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const cells = [...tr.matchAll(/<td\b[^>]*class="(yes|no)[^"]*"[^>]*>([\s\S]*?)<\/td>/g)].map((m) => ({ yes: m[1] === "yes", text: m[2].replace(/<[^>]+>/g, "").trim() }));
    if (cells.length === 3) rows[label] = cells;
  }
  return rows;
}
const ROWS = tableRows();
const rowFor = (prefix) => {
  const key = Object.keys(ROWS).find((k) => k.startsWith(prefix));
  assert.ok(key, `the pricing table has no row starting "${prefix}"`);
  return ROWS[key];
};

const TIERS = ["free", "core", "premium"];
const BOOLEAN_ROWS = [
  ["Extended feedback", "deepFeedback"],
  ["Your response revised", "deepFeedback"],
  ["Written answer in reading comprehension", "deepFeedback"],
  ["Exam-style prompts", "deepFeedback"],
  ["Exam-technique scoring", "examTechnique"],
  ["Spelling & grammar check", "spellingGrammar"],
  ["Overall score out of 10", "overallScore"],
  ["Vocabulary bank", "vocabBank"],
  ["Game progress", "vocabBank"],
  ["26-week progress trend chart", "progressTrend"],
  ["Anonymous ranking", "peerComparison"],
];

for (const [label, flag] of BOOLEAN_ROWS) {
  test(`pricing table: "${label}" is ticked for exactly the plans that have ${flag}`, () => {
    const cells = rowFor(label);
    TIERS.forEach((tier, i) => {
      assert.equal(cells[i].yes, !!PLANS[tier][flag], `${tier}: the table says ${cells[i].yes ? "yes" : "no"} but plans.js ${flag} is ${PLANS[tier][flag]}`);
    });
  });
}

test("pricing table: submissions, learners and history match plans.js", () => {
  const subs = rowFor("Submissions per month");
  assert.equal(subs[0].text, String(PLANS.free.monthlyCap));
  assert.equal(subs[1].text, PLANS.core.monthlyCap === Infinity ? "Unlimited" : String(PLANS.core.monthlyCap));
  assert.equal(subs[2].text, PLANS.premium.monthlyCap === Infinity ? "Unlimited" : String(PLANS.premium.monthlyCap));
  const learners = rowFor("Learners on one account");
  assert.equal(learners[0].text, String(PLANS.free.maxLearners));
  assert.equal(learners[1].text, String(PLANS.core.maxLearners));
  assert.match(learners[2].text, new RegExp(String(PLANS.premium.maxLearners)));
  const history = rowFor("Reopen past work & feedback");
  assert.match(history[0].text, new RegExp(String(PLANS.free.recentHistoryLimit)), "Free's history limit");
  assert.match(history[1].text, /Full/);
  assert.match(history[2].text, /Full/);
});

// ---- the games: Fix It and Boss Battle are open to every plan; only SAVING the game to the account is Core and Premium
test("pricing: Fix It and Boss Battle are ticked for every plan, and the game progress row says Free keeps it on one device", () => {
  const games = rowFor("Fix It and Boss Battle");
  assert.ok(games.every((c) => c.yes), "the games are not behind a plan");
  const saved = rowFor("Game progress");
  assert.equal(saved[0].text, "This device only", "Free keeps game progress on the device");
  assert.ok(saved[1].yes && saved[2].yes);
  // Why that is true: nothing in the app gates the games, and only the account copy of the game needs a plan with a vocabulary bank.
  const gamesCode = APP.slice(APP.indexOf("function GamesHub("), APP.indexOf("// Tell us what you think: a short form"));
  assert.ok(!/isPaidPlan|LockedFeature|onSeePlans/.test(gamesCode), "the games screens never lock themselves");
  assert.match(gamesCode, /const canSync = !!\(backendLive && childId && session && planMeta\(plan\)\.vocabBank\)/);
  assert.equal(PLANS.free.vocabBank, false);
});

test("the plan cards and the vocabulary row name the games wherever they describe the vocabulary bank", () => {
  assert.match(rowFor("Vocabulary bank").length ? Object.keys(ROWS).find((k) => k.startsWith("Vocabulary bank")) : "", /Word Dash/, "the table's vocabulary row names Word Dash");
  const freeCard = INDEX.split('<div class="price-plan">Free</div>')[1].split('<div class="price-card pro">')[0];
  assert.match(freeCard, /Fix It and Boss Battle, writing games/, "the Free card lists the games");
  const coreCard = INDEX.split('<div class="price-plan">Core</div>')[1].split('<div class="price-plan">Premium</div>')[0];
  assert.match(coreCard, /Word Dash, with game progress saved across devices/, "the Core card names Word Dash and the saved progress");
  assert.match(APP, /"Vocabulary bank with flashcards, a quiz and Word Dash, with game progress saved across devices"/, "the in-app Core card");
  assert.ok(!/Vocabulary bank with flashcards, a quiz and progress saved across devices/.test(INDEX + APP), "the old wording is gone");
});

test("pricing table: a plan is never shown as having less than the plan below it", () => {
  for (const [label, cells] of Object.entries(ROWS)) {
    if (cells[0].yes) assert.ok(cells[1].yes, `"${label}": Free has it but Core doesn't`);
    if (cells[1].yes) assert.ok(cells[2].yes, `"${label}": Core has it but Premium doesn't`);
  }
});

// ---- wording that used to describe features the product doesn't have (or no longer has)
const RETIRED = [
  /nothing held back/i,
  /watered-down/i,
  /a mission for next time/i,
  /tap to commit to trying/i,
  /commit to trying it in their next piece/i,
  /fresh worked example/i,
];
for (const [file, text] of [["index.html", INDEX], ["app.html", APP]]) {
  test(`${file}: no wording left over from features that were removed or changed`, () => {
    for (const pattern of RETIRED) {
      assert.ok(!pattern.test(text), `${file} still contains text matching ${pattern}`);
    }
  });
}

test("the Premium-only features are named wherever Premium is described", () => {
  assert.match(INDEX, /Spelling &amp; grammar check and a score out of 10 on every piece/, "homepage Premium card");
  assert.match(APP, /Spelling & grammar check and a score out of 10 on every piece/, "in-app plan card");
  const premiumFaq = INDEX.split("<strong>Premium</strong>")[1] || "";
  assert.match(premiumFaq.slice(0, 700), /spelling and grammar check/, "the FAQ answer about Premium");
});

// ---- the app's own copy of the plan table (PLAN_META) can't drift from plans.js either
test("app.html PLAN_META agrees with plans.js for every plan", () => {
  for (const tier of TIERS) {
    const line = APP.split("\n").find((l) => l.trim().startsWith(`${tier}:`) && l.includes("badge:") && l.includes("maxLearners"));
    assert.ok(line, `PLAN_META line for ${tier} not found`);
    const flags = Object.fromEntries([...line.matchAll(/(\w+):\s*(true|false)/g)].map((m) => [m[1], m[2] === "true"]));
    for (const flag of ["peerComparison", "progressTrend", "deepFeedback", "examTechnique", "spellingGrammar", "overallScore", "vocabBank"]) {
      assert.equal(flags[flag], !!PLANS[tier][flag], `${tier}.${flag}: app.html says ${flags[flag]}, plans.js says ${PLANS[tier][flag]}`);
    }
    assert.equal(Number(line.match(/maxLearners:\s*(\d+)/)[1]), PLANS[tier].maxLearners, `${tier}.maxLearners`);
  }
});

// ---- no button may say "Upgrade" and then do nothing
test("every 'Upgrade to Continue' button is wired to the plans page, not left disabled", () => {
  const labels = APP.split("Upgrade to Continue").length - 1;
  const wired = APP.split("locked ? onSeePlans : onSubmit").length - 1;
  assert.ok(labels > 0);
  assert.equal(wired, labels, `${labels} 'Upgrade to Continue' buttons but only ${wired} are wired to onSeePlans`);
  assert.ok(!/disabled=\{disabled\}[^>]*>\s*\{locked \? <><IconLock/.test(APP), "a locked button is still disabled");
});
