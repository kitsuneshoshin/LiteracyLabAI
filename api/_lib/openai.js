const OpenAI = require("openai");

let client = null;
function getOpenAI() {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY is not set in Vercel project env vars.");
    err.statusCode = 503;
    throw err;
  }
  client = new OpenAI({ apiKey });
  return client;
}

// Overridable via an OPENAI_MODEL env var without needing a code change —
// useful since OpenAI's model lineup moves faster than this file does.
const DEFAULT_MODEL = "gpt-4o-mini";

// Maps a raw provider error into something safe and useful to show a
// parent or child, instead of exposing quota/billing internals.
function friendlyProviderMessage(e) {
  const status = e.status || e.statusCode;
  if (status === 429) {
    return "Our AI feedback service is getting a lot of requests right now. Please wait a minute and try submitting again.";
  }
  if (status === 401 || status === 403) {
    return "There's a setup issue with our AI feedback service. We've been notified — please try again shortly.";
  }
  return "We couldn't generate feedback right now. Please try submitting again in a moment.";
}

// Calls the model with the given prompt and parses the response as JSON.
// Uses OpenAI's native JSON mode (response_format) so the model is
// constrained to valid JSON rather than relying on prompt instructions alone.
// Newer model families (gpt-5 and the o-series) reject max_tokens and spend part of the budget
// thinking, so they get max_completion_tokens with room to think and a low reasoning effort.
function usesCompletionTokens(model) {
  return /^(gpt-5|o\d)/.test(String(model));
}

async function generateFeedbackJSON(prompt, { maxTokens, model: modelOverride } = {}) {
  const openai = getOpenAI();
  const model = modelOverride || process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const budget = maxTokens || 2048;
  const limit = usesCompletionTokens(model) ? { max_completion_tokens: budget * 3, reasoning_effort: "low" } : { max_tokens: budget };

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model,
      ...limit,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
  } catch (e) {
    // Never surface the raw provider error to a student — it can contain
    // billing/quota details meant for whoever manages the API key, not a
    // parent or child looking at a feedback card. Log the real one for us.
    console.error("OpenAI API call failed:", e);
    const err = new Error(friendlyProviderMessage(e));
    err.statusCode = e.status === 429 ? 429 : 502;
    throw err;
  }
  const raw = completion.choices[0]?.message?.content || "";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const err = new Error("The AI response could not be parsed as JSON.");
    err.statusCode = 502;
    err.raw = raw;
    throw err;
  }
  return { parsed, modelUsed: completion.model };
}

async function listModels() {
  const page = await getOpenAI().models.list();
  return (page.data || []).map((m) => m.id).filter((id) => /^(gpt|o\d)/.test(id)).sort();
}

module.exports = { generateFeedbackJSON, listModels, usesCompletionTokens };
