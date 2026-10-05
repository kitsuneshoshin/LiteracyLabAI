// Counts every OpenAI call (model, tokens, estimated cost) per day, and emails the owner once
// if one day's estimated spend crosses a threshold. Nothing here may ever break feedback: every
// failure is logged and swallowed. Days are UTC, matching OpenAI's own usage page.

// US dollars per million tokens: [input, output]. Prices were taken from published price lists
// in October 2026 and are estimates; OpenAI's own Usage page is the source of truth for billing.
const PRICES = {
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1": [2.0, 8.0],
  "gpt-5-mini": [0.25, 2.0],
  "gpt-5.4-mini": [0.75, 4.5],
  "gpt-5.6-luna": [1.0, 6.0],
};
const FALLBACK_PRICE = PRICES["gpt-5.4-mini"]; // an unknown model is estimated at the current one's rate

function priceFor(model) {
  const name = String(model || "").replace(/-\d{4}-\d{2}-\d{2}$/, ""); // dated snapshots share the base price
  return PRICES[name] || FALLBACK_PRICE;
}

function costUsd(model, inputTokens, outputTokens) {
  const [pin, pout] = priceFor(model);
  return ((inputTokens || 0) * pin + (outputTokens || 0) * pout) / 1e6;
}

const DEFAULT_ALERT_USD = 2;
function alertThreshold() {
  const v = Number(process.env.AI_DAILY_ALERT_USD);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_ALERT_USD;
}

const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

function alertEmail({ day, cost, threshold, calls, inTokens, outTokens, perModel }) {
  const money = (n) => "$" + n.toFixed(2);
  const lines = perModel.map((m) => `${m.model}: ${m.calls} calls, ${money(m.cost)}`).join("; ");
  const subject = `OpenAI spend today has reached ${money(cost)}`;
  const text = [
    `Estimated OpenAI spend for ${day} (UTC) has passed your daily alert level of ${money(threshold)}.`,
    ``,
    `So far today: ${money(cost)} from ${calls} AI calls (${inTokens.toLocaleString("en-US")} tokens in, ${outTokens.toLocaleString("en-US")} out).`,
    `By model: ${lines}`,
    ``,
    `A normal day at launch is a few cents. If this is more students than expected, that is good news: check your credit balance and monthly limit so the AI does not stop.`,
    `If it is not expected, open platform.openai.com/settings/organization/usage and look at which model and key are being used.`,
    ``,
    `This is an estimate from our own counts; OpenAI's Usage page is the exact figure. You get at most one of these emails a day. Change the level with the AI_DAILY_ALERT_USD setting in Vercel.`,
  ].join("\n");
  const html = text.split("\n").map((l) => (l ? `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "")).join("");
  return { subject, text, html };
}

// Records one call. Returns { cost } for today when the totals were read, else null.
async function recordUsage({ model, inputTokens, outputTokens }, deps = {}) {
  try {
    const supabase = (deps.getSupabase || require("./supabaseAdmin").getSupabaseAdmin)();
    const day = utcDay(deps.now);
    const cost = costUsd(model, inputTokens, outputTokens);
    const { data, error } = await supabase.rpc("record_ai_usage", {
      p_day: day, p_model: String(model || "unknown"), p_in: inputTokens || 0, p_out: outputTokens || 0, p_cost: cost,
    });
    if (error) throw new Error(error.message);
    const rows = Array.isArray(data) ? data : [];
    const perModel = rows.map((r) => ({ model: r.model, calls: Number(r.calls), cost: Number(r.est_cost_usd) }));
    const total = perModel.reduce((s, m) => s + m.cost, 0);
    const threshold = alertThreshold();
    if (total >= threshold) {
      // Once a day: the insert only succeeds for the first call that crosses the line.
      const { data: inserted, error: aErr } = await supabase.from("ai_usage_alerts").insert({ day, cost_usd: total }).select();
      if (!aErr && Array.isArray(inserted) && inserted.length) {
        const to = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean)[0];
        if (to) {
          const calls = rows.reduce((s, r) => s + Number(r.calls), 0);
          const mail = alertEmail({ day, cost: total, threshold, calls, inTokens: rows.reduce((s, r) => s + Number(r.input_tokens), 0), outTokens: rows.reduce((s, r) => s + Number(r.output_tokens), 0), perModel });
          await (deps.sendEmail || require("./emailSend").sendEmail)({ to, ...mail });
        }
      }
    }
    return { cost: total };
  } catch (e) {
    console.error("AI usage recording failed (feedback is unaffected):", e && e.message);
    return null;
  }
}

module.exports = { recordUsage, costUsd, priceFor, PRICES, alertThreshold, alertEmail, utcDay, DEFAULT_ALERT_USD };
