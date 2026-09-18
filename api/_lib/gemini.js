const { GoogleGenerativeAI } = require("@google/generative-ai");

let client = null;
function getGemini() {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY is not set in Vercel project env vars.");
    err.statusCode = 503;
    throw err;
  }
  client = new GoogleGenerativeAI(apiKey);
  return client;
}

// Overridable via a GEMINI_MODEL env var without needing a code change.
// gemini-1.5-flash is the model covered by Google AI Studio's free tier.
const DEFAULT_MODEL = "gemini-1.5-flash";

// Calls the model with the given prompt and parses the response as JSON.
// Uses Gemini's native JSON mode (responseMimeType) so the model is
// constrained to valid JSON rather than relying on prompt instructions alone.
async function generateFeedbackJSON(prompt) {
  const genAI = getGemini();
  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1024 },
  });

  const result = await model.generateContent(prompt);
  const raw = result.response.text() || "";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const err = new Error("The AI response could not be parsed as JSON.");
    err.statusCode = 502;
    err.raw = raw;
    throw err;
  }
  return { parsed, modelUsed: modelName };
}

module.exports = { generateFeedbackJSON };
