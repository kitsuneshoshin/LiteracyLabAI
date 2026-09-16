const Anthropic = require("@anthropic-ai/sdk");

let client = null;
function getAnthropic() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("ANTHROPIC_API_KEY is not set in Vercel project env vars.");
    err.statusCode = 503;
    throw err;
  }
  client = new Anthropic({ apiKey });
  return client;
}

// Calls Claude with the given prompt and parses the response as JSON,
// stripping accidental markdown code fences since models sometimes add them
// even when told not to.
async function generateFeedbackJSON(prompt) {
  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const err = new Error("The AI response could not be parsed as JSON.");
    err.statusCode = 502;
    err.raw = raw;
    throw err;
  }
  return { parsed, modelUsed: message.model };
}

module.exports = { generateFeedbackJSON };
