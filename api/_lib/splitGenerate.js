// A Premium writing answer asks the model for a lot: the marking (highlights, spelling, score, exam
// bands, framework) AND two long pieces of writing (the student's piece rewritten, and a model
// response with labels). Asked in one call, it is slow, and the model sometimes drops the later
// fields, which costs whole retries. So it is asked as two shorter calls at the same time:
//   core       the marking
//   responses  the rewrite of the student's piece, the model response, and their framework labels
// and the two answers are joined. On a retry, only the part that failed is asked again.

const RESPONSE_KEYS = ["revisedStory", "revisedFramework", "modelResponse", "modelFramework"];
const RESPONSE_ISSUE = /^(revisedStory|modelResponse|modelFramework|revisedFramework)\b/;

// Which part an issue belongs to: the rewrite and model response are "responses", all else is "core".
const partOf = (issue) => (RESPONSE_ISSUE.test(String(issue)) ? "responses" : "core");

// parts: { core: { prompt, maxTokens }, responses: { prompt, maxTokens } }
// generate(prompt, { maxTokens }) -> { parsed, modelUsed }
// Returns next(issues): the first call (no issues) asks for both parts; a later call asks again
// only for the parts that had issues, telling each only its own.
function makeSplitGenerator(parts, generate, correctiveAddendum) {
  const kept = {};
  return async function next(issues) {
    const list = Array.isArray(issues) ? issues : [];
    const need = !kept.core || !kept.responses || list.length === 0
      ? ["core", "responses"]
      : ["core", "responses"].filter((p) => list.some((i) => partOf(i) === p));
    const todo = need.length ? need : ["core", "responses"];
    await Promise.all(todo.map(async (p) => {
      const mine = list.filter((i) => partOf(i) === p);
      const prompt = parts[p].prompt + (mine.length ? correctiveAddendum(mine) : "");
      kept[p] = await generate(prompt, { maxTokens: parts[p].maxTokens });
    }));
    const core = { ...(kept.core.parsed || {}) };
    for (const k of RESPONSE_KEYS) delete core[k];
    const responses = {};
    for (const k of RESPONSE_KEYS) if (kept.responses.parsed && k in kept.responses.parsed) responses[k] = kept.responses.parsed[k];
    return { parsed: { ...core, ...responses }, modelUsed: kept.core.modelUsed || kept.responses.modelUsed };
  };
}

// On by default. Setting PREMIUM_SPLIT=0 in Vercel turns it off (one combined call, as before) without a code change.
const splitEnabled = () => process.env.PREMIUM_SPLIT !== "0";

module.exports = { makeSplitGenerator, partOf, splitEnabled, RESPONSE_KEYS };
