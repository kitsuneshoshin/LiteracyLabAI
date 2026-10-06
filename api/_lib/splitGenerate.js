// A Premium writing answer asks the model for a lot: the coaching (glow, grow, next step, highlights, vocabulary,
// framework spotlight), the assessment (score, spelling and grammar, exam bands) AND two long pieces of writing (the
// student's piece rewritten, and a model response with labels). Asked in one call it is slow, and the model sometimes
// drops the later fields, which costs whole retries. So it is asked as three shorter calls at the same time:
//   core       the coaching
//   assess     the assessment
//   responses  the rewrite of the student's piece, the model response, and their framework labels
// and the answers are joined. On a retry, only the part that failed is asked again.

const RESPONSE_KEYS = ["revisedStory", "revisedFramework", "modelResponse", "modelFramework"];
const ASSESS_KEYS = ["overallScore", "scoreReason", "spellingGrammarTotal", "spellingGrammar", "examTechnique", "examSummary"];
const RESPONSE_ISSUE = /^(revisedStory|modelResponse|modelFramework|revisedFramework)\b/;
const ASSESS_ISSUE = /^(overallScore|scoreReason|spellingGrammar|examTechnique|examSummary)/;
const KEYS_OF = { responses: RESPONSE_KEYS, assess: ASSESS_KEYS };

// Which part an issue belongs to; anything else is the coaching ("core"). A part that was not asked for
// (a plan without a score, say) has no issues of its own to route.
const partOf = (issue, available) => {
  const part = RESPONSE_ISSUE.test(String(issue)) ? "responses" : ASSESS_ISSUE.test(String(issue)) ? "assess" : "core";
  return !available || available.includes(part) ? part : "core";
};

// parts: { core: { prompt, maxTokens }, assess?: {...}, responses?: {...} }
// generate(prompt, { maxTokens }) -> { parsed, modelUsed }
// Returns next(issues): the first call (no issues) asks for every part; a later call asks again only for the
// parts that had issues, telling each only its own.
function makeSplitGenerator(parts, generate, correctiveAddendum) {
  const names = ["core", "assess", "responses"].filter((n) => parts[n]);
  const kept = {};
  return async function next(issues) {
    const list = Array.isArray(issues) ? issues : [];
    const have = names.every((n) => kept[n]);
    const need = !have || list.length === 0 ? names : names.filter((n) => list.some((i) => partOf(i, names) === n));
    const todo = need.length ? need : names;
    await Promise.all(todo.map(async (n) => {
      const mine = list.filter((i) => partOf(i, names) === n);
      const prompt = parts[n].prompt + (mine.length ? correctiveAddendum(mine) : "");
      kept[n] = await generate(prompt, { maxTokens: parts[n].maxTokens });
    }));
    // Each field comes only from the call that was asked for it, whatever another call also sent.
    const parsed = { ...(kept.core.parsed || {}) };
    for (const n of names) if (n !== "core") for (const k of KEYS_OF[n]) delete parsed[k];
    for (const n of names) {
      if (n === "core") continue;
      const src = kept[n].parsed || {};
      for (const k of KEYS_OF[n]) if (k in src) parsed[k] = src[k];
    }
    return { parsed, modelUsed: kept.core.modelUsed || (kept.responses && kept.responses.modelUsed) };
  };
}

// On by default. Setting PREMIUM_SPLIT=0 in Vercel turns it off (one combined call, as before) without a code change.
const splitEnabled = () => process.env.PREMIUM_SPLIT !== "0";

module.exports = { makeSplitGenerator, partOf, splitEnabled, RESPONSE_KEYS, ASSESS_KEYS };
