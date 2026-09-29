// Sends one email through Resend. Kept tiny and dependency-free (plain fetch)
// so it can be unit tested with a stand-in fetch and never needs the SDK.
//
// Marketing-style mail carries the standard one-click unsubscribe headers
// (RFC 8058), which Gmail and Yahoo now expect from bulk senders and which
// puts an "Unsubscribe" button next to the sender name in the inbox.

const FROM = "LiteracyLab AI <hello@literacylabai.com>";
const REPLY_TO = "support@literacylabai.com";

async function sendEmail({ to, subject, html, text, bcc, replyTo, oneClickUrl, idempotencyKey, apiKey, fetchImpl }) {
  const key = apiKey || process.env.RESEND_API_KEY;
  if (!key) {
    const err = new Error("RESEND_API_KEY is not set.");
    err.statusCode = 500;
    throw err;
  }
  const doFetch = fetchImpl || fetch;
  const headers = {};
  if (oneClickUrl) {
    headers["List-Unsubscribe"] = `<${oneClickUrl}>, <mailto:${REPLY_TO}?subject=unsubscribe>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const payload = { from: FROM, to: [to], reply_to: replyTo || REPLY_TO, subject, html, text, headers };
  if (bcc && bcc.length) payload.bcc = bcc;

  const res = await doFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: Object.assign(
      { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}
    ),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Resend rejected the email (${res.status}): ${data.message || data.name || "unknown error"}`);
    err.statusCode = 502;
    throw err;
  }
  return { id: data.id };
}

module.exports = { sendEmail, FROM, REPLY_TO };
