// Per-country, per-grade writing word-count targets, grounded in real
// curriculum/exam-board guidance where it publishes one, and reasoned,
// monotonically-increasing interpolation where it doesn't (most K-12
// curricula describe writing qualitatively rather than by word count).
// Anchor points used: AQA GCSE English Language Paper 1 Q5 guidance
// (~450 words, UK Year 11); Cambridge IGCSE First Language English
// Composition (~350-450 words, IGCSE Year 10/11 and SG O-Level Yr 4/5);
// Cambridge Primary Checkpoint / PSLE composition minimum (150 words,
// Singapore Primary 6); IB DP written tasks (800-1000 words, IB Diploma
// Yr 2); NAPLAN Year 9 writing guidance (~500 words, AU Year 9); Common
// App college-essay norms and AP essay length (~650-750 words, US Grade
// 12); DELF/DALF B1/B2/C1 written-production word counts (CEFR track).
// Mirrored in app.html's GRADE_WORD_TARGETS - keep both in sync by hand,
// same pattern as MAX_CHARS/PROMPTS already established in this codebase.
const GRADE_WORD_TARGETS = {
  "🇬🇧 United Kingdom": {
    "Reception": 15, "Year 1": 30, "Year 2": 50, "Year 3": 80, "Year 4": 120,
    "Year 5": 160, "Year 6": 250, "Year 7": 300, "Year 8": 330, "Year 9": 350,
    "Year 10": 400, "Year 11": 450, "Year 12": 600, "Year 13": 800,
  },
  "🇺🇸 United States": {
    "Kindergarten": 10, "Grade 1": 30, "Grade 2": 60, "Grade 3": 150, "Grade 4": 200,
    "Grade 5": 250, "Grade 6": 300, "Grade 7": 350, "Grade 8": 400, "Grade 9": 450,
    "Grade 10": 500, "Grade 11": 600, "Grade 12": 750,
  },
  "🇦🇺 Australia": {
    "Foundation": 10, "Year 1": 30, "Year 2": 60, "Year 3": 130, "Year 4": 170,
    "Year 5": 210, "Year 6": 260, "Year 7": 320, "Year 8": 380, "Year 9": 500,
    "Year 10": 520, "Year 11": 650, "Year 12": 850,
  },
  "🇨🇦 Canada": {
    "Kindergarten": 10, "Grade 1": 30, "Grade 2": 60, "Grade 3": 140, "Grade 4": 190,
    "Grade 5": 240, "Grade 6": 290, "Grade 7": 340, "Grade 8": 390, "Grade 9": 440,
    "Grade 10": 490, "Grade 11": 580, "Grade 12": 700,
  },
  "🇦🇪 UAE & GCC Hubs": {
    "Cambridge Primary 1": 15, "Cambridge Primary 2": 30, "Cambridge Primary 3": 50,
    "Cambridge Primary 4": 80, "Cambridge Primary 5": 110, "Cambridge Primary 6": 150,
    "Lower Secondary 7": 200, "Lower Secondary 8": 250, "Lower Secondary 9": 300,
    "IGCSE Year 10": 350, "IGCSE Year 11": 450, "AS Level (Yr 12)": 600, "A Level (Yr 13)": 800,
  },
  "🇸🇬 Singapore & SE Asia": {
    "Primary 1": 15, "Primary 2": 30, "Primary 3": 60, "Primary 4": 90, "Primary 5": 120,
    "Primary 6": 150, "Secondary 1": 200, "Secondary 2": 250, "Secondary 3": 300,
    "O-Level / IGCSE Yr 4": 400, "O-Level / IGCSE Yr 5": 450,
    "IB Diploma Yr 1": 700, "IB Diploma Yr 2": 900,
  },
  "🌐 Global ESL Mode": {
    "A1 Beginner": 50, "A2 Elementary": 80, "B1 Intermediate": 170,
    "B2 Upper-Intermediate": 280, "C1 Advanced": 350, "C2 Proficient": 500,
  },
};

// No published word-count guidance is specific enough to justify a
// separate character cap, so it's derived from the word target using a
// words-to-characters ratio that shrinks as writing matures (younger
// writing has more short/simple words and spacing overhead per word).
const RATIO_BY_TIER = { early: 13, elementary: 10, middle: 8.5, high: 7.5 };
const DEFAULT_TARGET_BY_TIER = { early: 60, elementary: 150, middle: 350, high: 800 };

function deriveMaxChars(target, tier) {
  return Math.round((target * (RATIO_BY_TIER[tier] || 9)) / 10) * 10;
}

function writingLimitsForGrade(country, gradeLabel, tier) {
  const target = (GRADE_WORD_TARGETS[country] || {})[gradeLabel] ?? DEFAULT_TARGET_BY_TIER[tier] ?? 150;
  return { target, maxChars: deriveMaxChars(target, tier) };
}

module.exports = { writingLimitsForGrade, GRADE_WORD_TARGETS, deriveMaxChars };
