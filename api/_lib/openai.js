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

// Calls the model with the given prompt and parses the response as JSON.
// Uses OpenAI's native JSON mode (response_format) so the model is
// constrained to valid JSON rather than relying on prompt instructions alone.
async function generateFeedbackJSON(prompt) {
  const openai = getOpenAI();
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const completion = await openai.chat.completions.create({
    model,
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
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

module.exports = { generateFeedbackJSON };
