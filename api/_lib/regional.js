// Spelling and wording that follows the learner's country. A student in Australia who writes "colour" has spelled it
// right; a student in the United States who writes "colour" has not. Every prompt that writes for, or checks, a
// learner's English says which convention applies, and the spelling check drops a "correction" that only swaps one
// country's accepted spelling for another's.

// ---------------------------------------------------------------- which convention
// "us"  American spelling and usage
// "uk"  British spelling and usage (also Australia, Singapore, the Gulf: they follow British conventions)
// "ca"  Canadian: colour, centre, but -ize and program; either form of those is accepted
// "any" no single convention (the global English-learner mode): either is accepted
function conventionFor(country) {
  const c = String(country || "");
  if (/United States/.test(c)) return "us";
  if (/Canada/.test(c)) return "ca";
  if (/Global|ESL/i.test(c)) return "any";
  if (/United Kingdom|Australia|Singapore|UAE|GCC/.test(c)) return "uk";
  return "any";
}

const CONVENTION_TEXT = {
  us: { name: "American English", examples: "color, realize, center, math, grade, recess" },
  uk: { name: "British English", examples: "colour, realise, centre, maths" },
  ca: { name: "Canadian English", examples: "colour, centre, realize, program" },
};

// What to tell the model. kind: "write" (it is writing for the learner) or "check" (it is judging the learner's own writing).
function spellingClause(country, kind) {
  if (kind === "both") return spellingClause(country, "check") + " Everything you write yourself (rewrites, examples, definitions, explanations) must use this same convention.";
  const conv = conventionFor(country);
  if (conv === "any") {
    return kind === "check"
      ? "\n\nSPELLING CONVENTION: this learner is learning English, and both British and American spellings are correct. Never flag a spelling as an error only because it is the other country's spelling (for example colour and color, or realise and realize)."
      : "\n\nSPELLING CONVENTION: use plain, clear English. Choose one consistent spelling style (British or American) and keep to it.";
  }
  const t = CONVENTION_TEXT[conv];
  if (kind === "check") {
    return `\n\nSPELLING CONVENTION: this learner follows ${t.name} (${t.examples}). A spelling that is correct in ${t.name} is NOT an error, and must never be listed in the spelling check or "corrected" into the other country's spelling. A spelling from the other country's convention IS a genuine slip for this learner: list it, and show the ${t.name} form.`;
  }
  return `\n\nSPELLING AND WORDING: write in ${t.name} (${t.examples}), with the vocabulary this learner's country uses at school, and keep to it throughout.`;
}

// ---------------------------------------------------------------- the pairs
// [British, American]. Verbs and nouns are listed in their base form and expanded below.
const BASE_PAIRS = [
  // -our / -or
  ["colour", "color"], ["favour", "favor"], ["favourite", "favorite"], ["neighbour", "neighbor"], ["honour", "honor"], ["behaviour", "behavior"],
  ["humour", "humor"], ["labour", "labor"], ["rumour", "rumor"], ["harbour", "harbor"], ["flavour", "flavor"], ["savour", "savor"], ["vapour", "vapor"],
  ["odour", "odor"], ["endeavour", "endeavor"], ["rigour", "rigor"], ["vigour", "vigor"], ["glamour", "glamor"], ["parlour", "parlor"], ["armour", "armor"],
  // -re / -er
  ["centre", "center"], ["metre", "meter"], ["litre", "liter"], ["theatre", "theater"], ["fibre", "fiber"], ["calibre", "caliber"], ["lustre", "luster"],
  ["sombre", "somber"], ["spectre", "specter"], ["meagre", "meager"], ["kilometre", "kilometer"], ["centimetre", "centimeter"], ["millimetre", "millimeter"],
  // -ence / -ense
  ["defence", "defense"], ["offence", "offense"], ["pretence", "pretense"],
  // single or double l
  ["travelled", "traveled"], ["travelling", "traveling"], ["traveller", "traveler"], ["travellers", "travelers"], ["cancelled", "canceled"], ["cancelling", "canceling"],
  ["labelled", "labeled"], ["labelling", "labeling"], ["modelled", "modeled"], ["modelling", "modeling"], ["signalled", "signaled"], ["signalling", "signaling"],
  ["fuelled", "fueled"], ["fuelling", "fueling"], ["levelled", "leveled"], ["levelling", "leveling"], ["counsellor", "counselor"], ["counsellors", "counselors"],
  ["counselling", "counseling"], ["jewellery", "jewelry"], ["marvellous", "marvelous"], ["woollen", "woolen"], ["skilful", "skillful"], ["fulfil", "fulfill"],
  ["fulfils", "fulfills"], ["enrol", "enroll"], ["enrols", "enrolls"], ["instil", "instill"], ["enthral", "enthrall"], ["ageing", "aging"], ["totalled", "totaled"],
  ["equalled", "equaled"], ["quarrelling", "quarreling"], ["rivalled", "rivaled"],
  // others
  ["grey", "gray"], ["tyre", "tire"], ["tyres", "tires"], ["programme", "program"], ["programmes", "programs"], ["catalogue", "catalog"], ["analogue", "analog"],
  ["aluminium", "aluminum"], ["sceptic", "skeptic"], ["sceptical", "skeptical"], ["scepticism", "skepticism"], ["plough", "plow"], ["mum", "mom"], ["mummy", "mommy"],
  ["maths", "math"], ["whilst", "while"], ["towards", "toward"], ["learnt", "learned"], ["spelt", "spelled"], ["burnt", "burned"], ["dreamt", "dreamed"],
  ["leapt", "leaped"], ["smelt", "smelled"], ["spilt", "spilled"], ["cosy", "cozy"], ["pyjamas", "pajamas"], ["kerb", "curb"], ["mould", "mold"], ["moult", "molt"],
  ["smoulder", "smolder"], ["paediatric", "pediatric"], ["manoeuvre", "maneuver"], ["manoeuvres", "maneuvers"], ["oestrogen", "estrogen"], ["anaemia", "anemia"],
  ["judgement", "judgment"], ["acknowledgement", "acknowledgment"],
];
// -ise / -ize words (and their forms). Only these stems are treated as variants, so "advise", "surprise" or "exercise" are never touched.
const IZE_STEMS = ["realis", "organis", "recognis", "apologis", "criticis", "summaris", "emphasis", "minimis", "maximis", "specialis", "familiaris", "memoris", "categoris",
  "characteris", "civilis", "colonis", "customis", "finalis", "generalis", "hospitalis", "idealis", "legalis", "localis", "mobilis", "modernis", "normalis", "optimis",
  "popularis", "prioritis", "publicis", "standardis", "stabilis", "symbolis", "utilis", "visualis", "authoris", "capitalis", "centralis", "commercialis", "criminalis",
  "democratis", "digitalis", "equalis", "fertilis", "harmonis", "immunis", "industrialis", "individualis", "itemis", "jeopardis", "legitimis", "materialis", "neutralis",
  "personalis", "pasteuris", "polaris", "privatis", "randomis", "revolutionis", "sanitis", "socialis", "sympathis", "synchronis", "terroris", "theoris", "tranquillis",
  "urbanis", "vandalis", "westernis", "womanis", "dramatis", "energis", "fantasis", "fraternis", "galvanis", "globalis", "hypothesis", "internationalis", "magnetis", "mechanis"]
  .filter((s) => s !== "hypothesis"); // "hypothesis" is a noun spelled the same everywhere
const IZE_ENDINGS = ["e", "es", "ed", "ing", "ation", "ations", "er", "ers"];
const OUR_ENDINGS = ["s", "ed", "ing", "ful", "ite", "ites", "able", "less", "hood", "hoods", "ist", "ists", "y"];

const UK_TO_US = new Map();
const US_TO_UK = new Map();
function addPair(uk, us) {
  if (!uk || !us || uk === us) return;
  UK_TO_US.set(uk, us); US_TO_UK.set(us, uk);
}
for (const [uk, us] of BASE_PAIRS) {
  addPair(uk, us);
  if (/our$/.test(uk)) for (const e of OUR_ENDINGS) addPair(uk + e, us + e);
}
for (const stem of IZE_STEMS) for (const e of IZE_ENDINGS) addPair(stem + e, stem.replace(/is$/, "iz") + e);
// "analyse/analyze", "paralyse/paralyze", "catalyse/catalyze" and their forms
for (const stem of ["analys", "paralys", "catalys"]) for (const e of ["e", "es", "ed", "ing", "er", "ers"]) addPair(stem + e, stem.replace(/s$/, "z") + e);

const norm = (w) => String(w || "").toLowerCase().replace(/[’‘]/g, "'");
const words = (s) => (String(s || "").toLowerCase().match(/[a-z']+/g) || []);

// Is `student` the form that this convention accepts, as opposed to the other country's? (null: not a regional pair at all)
function formIsAccepted(student, correction, conv) {
  const a = norm(student), b = norm(correction);
  if (UK_TO_US.get(a) === b) return conv === "uk" || conv === "ca" || conv === "any"; // student wrote the British form
  if (US_TO_UK.get(a) === b) return conv === "us" || conv === "ca" || conv === "any"; // student wrote the American form
  return null;
}
// For Canada and the global learner either form is accepted; for the US only American, for the rest only British.
// Returns true when a listed "error" is only a swap between two countries' spellings AND the learner's own spelling is the accepted one.
function isRegionalVariantOnly(quote, correction, country) {
  const conv = conventionFor(country);
  const q = words(quote), c = words(correction);
  if (q.length === 0 || q.length !== c.length) return false;
  let diffs = 0;
  for (let i = 0; i < q.length; i++) {
    if (q[i] === c[i]) continue;
    diffs++;
    const ok = formIsAccepted(q[i], c[i], conv);
    if (ok !== true) return false; // not a regional pair, or the learner's form is not the one their country uses
  }
  return diffs > 0;
}

module.exports = { conventionFor, spellingClause, isRegionalVariantOnly, UK_TO_US, US_TO_UK, CONVENTION_TEXT };
