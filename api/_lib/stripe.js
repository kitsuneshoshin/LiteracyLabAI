const Stripe = require("stripe");

let client = null;
function getStripe() {
  if (client) return client;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    const err = new Error("STRIPE_SECRET_KEY is not set in Vercel project env vars.");
    err.statusCode = 503;
    throw err;
  }
  client = new Stripe(secretKey, { apiVersion: "2024-06-20" });
  return client;
}

module.exports = { getStripe };
