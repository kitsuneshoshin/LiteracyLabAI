// A level from 1 to 4 for each skill on every piece of feedback, on EVERY plan. Each piece used to name only one strength and
// one next step, so a skill's progress bar could only move in big jumps. Premium's exam bands (examTechnique) already give a
// 1-4 band for every objective, so they are used there and this is asked only where they are not. The same 1-4 scale and the
// same percentages are used either way (see LEVEL_VALUE and api/_lib/targetScoring.js).
const LEVEL_NAMES = { 1: "Emerging", 2: "Developing", 3: "Secure", 4: "Strong" };
const LEVEL_VALUE = { 1: 0.1, 2: 0.4, 3: 0.7, 4: 0.95 };

// kind: "writing" (judge from the student's own text) or "reading" (judge from which questions they got right).
function skillLevelsClause(targets, kind) {
  const names = (targets || []).map((t) => `"${t.name}"`).join(", ");
  const evidence = kind === "reading"
    ? "from which questions they answered correctly and the reasoning behind their answers"
    : "from what is actually in their text";
  return `\n\nSKILL LEVELS (required): "skillLevels" gives one whole number from 1 to 4 for EACH of these skill areas: ${names}. 1 = Emerging (barely shown), 2 = Developing (shown, but inconsistently), 3 = Secure (shown clearly and consistently), 4 = Strong (shown with control). Judge ${evidence}, for this piece only. Use the whole range: different skills usually sit at different levels, so do not give them all the same number, and the skill you praised in the Glow should not be rated lower than the one you named in the Grow. If this piece gives no evidence of a skill at all, use null for it rather than guessing.`;
}

function skillLevelsShape(targets) {
  const entries = (targets || []).map((t) => `    ${JSON.stringify(t.name)}: "an integer 1-4, or null if there is no evidence"`).join(",\n");
  return `  "skillLevels": {\n${entries}\n  }`;
}

// Keeps only the valid entries (a real skill name, a whole number 1-4) and drops the rest, never failing the feedback over
// it: this is extra detail for the progress bars, not something worth a retry. names: the skills this kind of task can show.
function cleanSkillLevels(parsed, names, { ask }) {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (!ask) { delete parsed.skillLevels; return parsed; }
  const raw = parsed.skillLevels;
  const out = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const byLower = new Map((names || []).map((n) => [n.trim().toLowerCase(), n]));
    for (const [key, value] of Object.entries(raw)) {
      const name = byLower.get(String(key).trim().toLowerCase());
      const level = typeof value === "string" && /^\s*[1-4]\s*$/.test(value) ? Number(value) : value;
      if (name && Number.isInteger(level) && level >= 1 && level <= 4) out[name] = level;
    }
  }
  if (Object.keys(out).length) parsed.skillLevels = out; else delete parsed.skillLevels;
  return parsed;
}

module.exports = { LEVEL_NAMES, LEVEL_VALUE, skillLevelsClause, skillLevelsShape, cleanSkillLevels };
