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
// Uses Gemini's native JSON mode (responseMimeType) so the model is
// constrained to valid JSON rather than relying on prompt instructions alone.
async function generateFeedbackJSON(prompt) {
  const genAI = getGemini();
  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 1024 },
  });

  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (e) {
    // Never surface the raw provider error to a student — it can contain
    // billing/quota details meant for whoever manages the API key, not a
    // parent or child looking at a feedback card. Log the real one for us.
    console.error("Gemini API call failed:", e);
    const err = new Error(friendlyProviderMessage(e));
    err.statusCode = e.status === 429 ? 429 : 502;
    throw err;
  }
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
