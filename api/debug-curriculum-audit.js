// TEMPORARY diagnostic endpoint - no auth, no DB access, pure computation
// over this repo's own curriculum data. Exercises every (country, grade)
// combination the app exposes against the real targetsForGrade/standardsFor
// logic, to catch exactly the class of bug found earlier this session
// (a grade silently citing a different year's standards). Removed after use.
const { targetsForGrade, isMappedCountry } = require("./_lib/masteryTargets");
const { standardsFor, curriculumLabel } = require("./_lib/curriculum");

const GRADE_DATA = {
  "🇬🇧 United Kingdom": { grades: ["Reception","Year 1","Year 2","Year 3","Year 4","Year 5","Year 6","Year 7","Year 8","Year 9","Year 10","Year 11","Year 12","Year 13"], tiers: [3,7,10,14] },
  "🇺🇸 United States":  { grades: ["Kindergarten","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12"], tiers: [3,6,9,13] },
  "🇦🇺 Australia":      { grades: ["Foundation","Year 1","Year 2","Year 3","Year 4","Year 5","Year 6","Year 7","Year 8","Year 9","Year 10","Year 11","Year 12"], tiers: [3,7,10,13] },
  "🇨🇦 Canada":         { grades: ["Kindergarten","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8","Grade 9","Grade 10","Grade 11","Grade 12"], tiers: [3,6,9,13] },
  "🇦🇪 UAE & GCC Hubs": { grades: ["Cambridge Primary 1","Cambridge Primary 2","Cambridge Primary 3","Cambridge Primary 4","Cambridge Primary 5","Cambridge Primary 6","Lower Secondary 7","Lower Secondary 8","Lower Secondary 9","IGCSE Year 10","IGCSE Year 11","AS Level (Yr 12)","A Level (Yr 13)"], tiers: [3,6,9,13] },
  "🇸🇬 Singapore & SE Asia": { grades: ["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6","Secondary 1","Secondary 2","Secondary 3","O-Level / IGCSE Yr 4","O-Level / IGCSE Yr 5","IB Diploma Yr 1","IB Diploma Yr 2"], tiers: [3,6,9,13] },
  "🌐 Global ESL Mode": { grades: ["A1 Beginner","A2 Elementary","B1 Intermediate","B2 Upper-Intermediate","C1 Advanced","C2 Proficient"], tiers: [1,2,4,6] },
};
function tierForGrade(country, idx) {
  const t = GRADE_DATA[country].tiers;
  if (idx < t[0]) return "early";
  if (idx < t[1]) return "elementary";
  if (idx < t[2]) return "middle";
  return "high";
}

module.exports = async function handler(req, res) {
  const issues = [];
  let checked = 0;

  for (const country of Object.keys(GRADE_DATA)) {
    const { grades } = GRADE_DATA[country];
    grades.forEach((gradeLabel, idx) => {
      checked++;
      const tier = tierForGrade(country, idx);
      let targetsResult, standardsResult;
      try {
        targetsResult = targetsForGrade(country, gradeLabel, tier);
      } catch (e) {
        issues.push(`[${country} / ${gradeLabel}] targetsForGrade threw: ${e.message}`);
        return;
      }
      try {
        standardsResult = standardsFor(country, tier, gradeLabel);
      } catch (e) {
        issues.push(`[${country} / ${gradeLabel}] standardsFor threw: ${e.message}`);
        return;
      }

      const { targets, grain, approximatedFrom } = targetsResult;

      if (!isMappedCountry(country)) {
        issues.push(`[${country}] isMappedCountry() is false - unexpected`);
      }
      if (grain !== "grade") {
        issues.push(`[${country} / ${gradeLabel}] grain="${grain}" (expected "grade")`);
      }
      if (!Array.isArray(targets) || targets.length === 0) {
        issues.push(`[${country} / ${gradeLabel}] targets is empty or not an array`);
      } else {
        targets.forEach((t, i) => {
          if (!t.name || typeof t.name !== "string") issues.push(`[${country} / ${gradeLabel}] targets[${i}].name missing`);
          if (t.standard !== null && typeof t.standard !== "string") issues.push(`[${country} / ${gradeLabel}] targets[${i}].standard is neither a string nor null`);
        });
      }

      const expectedStandards = targets.map((t) => `${t.name} (${t.standard})`);
      const same = JSON.stringify(standardsResult) === JSON.stringify(expectedStandards);
      if (!same) {
        issues.push(`[${country} / ${gradeLabel}] MISMATCH standardsFor vs targetsForGrade: standardsFor=${JSON.stringify(standardsResult)} expected=${JSON.stringify(expectedStandards)}`);
      }

      let label;
      try {
        label = curriculumLabel(country);
      } catch (e) {
        issues.push(`[${country}] curriculumLabel threw: ${e.message}`);
      }
      if (!label || typeof label !== "string") issues.push(`[${country}] curriculumLabel returned falsy/non-string`);

      if (approximatedFrom && !grades.includes(approximatedFrom)) {
        issues.push(`[${country} / ${gradeLabel}] approximatedFrom="${approximatedFrom}" not a real grade in this country`);
      }
    });
  }

  return res.status(200).json({ checked, countries: Object.keys(GRADE_DATA).length, issueCount: issues.length, issues });
};
