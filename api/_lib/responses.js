// The rewritten and the model response (Premium), and the framework labels that show a
// student exactly where the named framework (PEEL, PEAL, Story Mountain, Show Don't
// Tell) is being used in each. Pure helpers shared by the prompt, the validator and
// the route, so every country, grade and genre goes through the same rules.

const { frameworkParts } = require("./writingFrameworks");

const norm = (s) => String(s || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const wordCount = (t) => (String(t || "").match(WORD) || []).length;

// How long the corrected-and-improved version of THEIR piece may be. A piece of the
// expected length stays close to its own length. A short piece may be developed
// (their own point explained and supported) but never beyond the expected length.
function revisedLimits(assessment, origWords) {
  const o = Math.max(0, origWords || 0);
  const min = Math.max(4, Math.floor(o * 0.6));
  const tight = Math.ceil(o * 1.35) + 8;
  if (!assessment || assessment.level === "ok") return { min, max: tight };
  const target = assessment.target || tight;
  return { min, max: Math.max(tight, Math.min(target, Math.ceil(o * 3) + 30)) };
}

// How long the model response should be: the expected length for the grade, capped so
// one response stays readable and affordable.
function modelWordTarget(assessment) {
  const t = (assessment && assessment.target) || 150;
  return Math.min(250, Math.max(t, 12));
}
function modelLimits(assessment) {
  const n = modelWordTarget(assessment);
  // Models reliably write short when asked for a word count (live checks: 50 to 130 words when
  // asked for 300), so the floor is generous; the prompt also asks for sentences, not words.
  return { n, min: Math.max(8, Math.floor(n * 0.3)), max: Math.ceil(n * 1.6) + 6, sentences: Math.max(3, Math.ceil(n / 17)) };
}

function partNames(fw) {
  return frameworkParts(fw).map((p) => p.name);
}

// Canonicalises a part name the model gave ("point", "Point:") to the framework's own.
function canonicalPart(fw, name) {
  const want = norm(String(name || "").replace(/[:.]/g, ""));
  const hit = frameworkParts(fw).find((p) => norm(p.name) === want);
  return hit ? hit.name : null;
}

// Drops label entries that cannot be shown truthfully: unknown part, or text that is
// not a verbatim piece of the response it claims to label. Mirrors
// dropInvalidSpellingGrammar: a bad entry is removed, not allowed to fail the response.
function repairFrameworkLabels(parsed, fw, field, responseField) {
  if (!parsed || !Array.isArray(parsed[field])) return parsed;
  const response = norm(parsed[responseField]);
  const seen = new Set();
  const kept = [];
  for (const e of parsed[field]) {
    if (!e || typeof e !== "object") continue;
    const part = canonicalPart(fw, e.part);
    const text = typeof e.text === "string" ? e.text.trim() : "";
    const note = typeof e.note === "string" ? e.note.trim() : "";
    if (!part || text.length < 3 || text.length > 1500 || !response || !response.includes(norm(text))) continue;
    if (note.length < 8 || note.length > 240) continue;
    const key = `${part}|${norm(text)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ part, text, note });
  }
  parsed[field] = kept;
  return parsed;
}

// The model response is returned ONCE, as consecutive labelled segments (so it is not written
// out twice, which keeps the answer short enough to generate reliably). The full response is
// the segments joined in order. Segments with an unknown part name are dropped.
function composeModelResponse(parsed, fw) {
  if (!parsed || !Array.isArray(parsed.modelFramework)) return parsed;
  const segs = [];
  for (const e of parsed.modelFramework) {
    if (!e || typeof e !== "object") continue;
    const part = canonicalPart(fw, e.part);
    const text = typeof e.text === "string" ? e.text.trim() : "";
    if (!part || text.length < 3) continue;
    let note = typeof e.note === "string" ? e.note.trim() : "";
    if (note.length < 8) note = "This part does the job of " + part + ".";
    if (note.length > 240) note = note.slice(0, 237) + "...";
    segs.push({ part, text, note });
  }
  parsed.modelFramework = segs;
  parsed.modelResponse = segs.map((s) => s.text).join(" ");
  return parsed;
}

// Order the labels as they occur in the response, so the display reads top to bottom.
function sortByPosition(parsed, field, responseField) {
  if (!parsed || !Array.isArray(parsed[field])) return;
  const response = norm(parsed[responseField]);
  parsed[field].sort((a, b) => response.indexOf(norm(a.text)) - response.indexOf(norm(b.text)));
}

// Issues for the Premium model response and both label lists. `info` is
// { fw, assessment, submittedText }.
function validateResponses(parsed, info, issues) {
  const { fw, assessment, submittedText } = info;
  const lim = modelLimits(assessment);
  const resp = parsed && parsed.modelResponse;
  if (typeof resp !== "string" || resp.trim().length < 20 || resp.length > 8000) {
    issues.push("modelResponse is missing, too short, or too long");
  } else {
    const n = wordCount(resp);
    if (n < lim.min || n > lim.max) issues.push(`modelResponse must be about ${lim.n} words (between ${lim.min} and ${lim.max}), not ${n}`);
    const student = norm(submittedText);
    if (student.length > 30 && norm(resp).includes(student)) issues.push("modelResponse must be written fresh, not contain the student's own text");
    if (/(^|[\s"“(])i(?=[\s',.!?;:)”"]|$)/.test(resp)) issues.push('modelResponse has a lowercase "i" - the pronoun must be capital I');
    if (!/^["“'‘(]*[A-Z0-9À-Þ]/.test(resp.trim())) issues.push("modelResponse must start with a capital letter");
  }
  const parts = partNames(fw);
  const model = parsed && parsed.modelFramework;
  if (!Array.isArray(model) || model.length === 0) {
    issues.push(`modelFramework must label where each part of ${fw ? fw.name : "the framework"} appears in modelResponse`);
  } else if (parts.length) {
    const have = new Set(model.map((e) => e.part));
    const missing = parts.filter((p) => !have.has(p));
    if (missing.length) issues.push(`modelFramework is missing: ${missing.join(", ")} - every part of ${fw.name} must appear in the model response and be labelled with an exact quote from it`);
  }
  const revised = parsed && parsed.revisedFramework;
  if (!Array.isArray(revised) || revised.length === 0) {
    issues.push(`revisedFramework must label at least one place where ${fw ? fw.name : "the framework"} is used in revisedStory, quoting it exactly`);
  }
}

function frameworkInfo(fw) {
  return fw ? { name: fw.name, description: fw.description, parts: frameworkParts(fw) } : null;
}

// The prompt section.
function responsesClause({ fw, tier, gradeLabel, country, assessment, interestNote }) {
  if (!fw) return "";
  const lim = modelLimits(assessment);
  const parts = frameworkParts(fw).map((p) => `${p.name} (${p.meaning})`).join("; ");
  const names = frameworkParts(fw).map((p) => `"${p.name}"`).join(", ");
  const formal = tier === "middle" || tier === "high" ? " Formal, third-person academic register, no personal asides and no analogies." : " Keep it at a level a very strong student of this age could write.";
  return `\n\nMODEL RESPONSE AND FRAMEWORK LABELS (required):
1. "modelFramework": the best response you can write to the SAME task, so the student can learn from it - what an excellent response looks like for ${gradeLabel} in ${country} (excellent for this age, not adult-level) - written as an ordered array of consecutive segments, so the student can SEE the framework at work: { "part": one of ${names}, "text": the next words of the response (one or more whole sentences), "note": one plain sentence (under 25 words) saying how those words do that part's job }. Read in order, the segments' text IS the whole response: about ${lim.n} words in total (roughly ${lim.sentences} sentences - models tend to write too short, so err on the longer side: give each part at least ${Math.max(2, Math.ceil(lim.sentences / Math.max(1, frameworkParts(fw).length)))} full sentences), the same kind of writing as the task, clearly using "${fw.name}" (${parts}) with EVERY part present at least once, in a sensible order.${formal} Write it fresh: do not reuse the student's sentences, take a clear position that answers the task, and never invent statistics, named studies, quotations or personal experiences. Do not add a separate "modelResponse" field.
2. "revisedFramework": the same kind of array for "revisedStory" (the student's own response, corrected and improved), so they see the framework in their OWN words. Label only parts that are genuinely present in revisedStory - never label something that is not there, and do not pad the response just to include a part. Each "text" is an EXACT copy of words in revisedStory. At least one entry.`;
}

function responsesJsonShape(fw) {
  const names = frameworkParts(fw).map((p) => `"${p.name}"`).join(" or ");
  return `  "modelFramework": [{ "part": ${names || '"a framework part"'}, "text": "the next words of the model response, in order", "note": "one plain sentence on how these words do that part's job" }],
  "revisedFramework": [{ "part": ${names || '"a framework part"'}, "text": "exact words copied from revisedStory", "note": "one plain sentence on how these words do that part's job" }]`;
}

module.exports = {
  composeModelResponse, revisedLimits, modelWordTarget, modelLimits, partNames, canonicalPart,
  repairFrameworkLabels, sortByPosition, validateResponses, frameworkInfo,
  responsesClause, responsesJsonShape, wordCount, norm,
};
