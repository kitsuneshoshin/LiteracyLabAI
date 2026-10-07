// Delivery, open and click numbers per email subject, from Resend's own record of what it sent.
// Resend keeps only the LATEST event for each email (delivered, then opened, then clicked), so "opened"
// counts every email whose latest event is opened or clicked. Open tracking has to be switched on for the
// sending domain in Resend, otherwise no email ever shows as opened.

const OPENED = new Set(["opened", "clicked"]);
const BAD = new Set(["bounced", "complained", "delivery_delayed", "failed"]);

const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);

// emails: [{ subject, last_event }]. Returns one row per subject, most-sent first.
function summarise(emails) {
  const by = new Map();
  for (const e of emails || []) {
    const subject = String(e.subject || "(no subject)");
    const r = by.get(subject) || { subject, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
    const ev = String(e.last_event || "");
    r.sent += 1;
    if (ev === "delivered" || OPENED.has(ev)) r.delivered += 1;
    if (OPENED.has(ev)) r.opened += 1;
    if (ev === "clicked") r.clicked += 1;
    if (BAD.has(ev)) r.bounced += 1;
    by.set(subject, r);
  }
  return [...by.values()]
    .map((r) => ({ ...r, openRate: pct(r.opened, r.delivered), clickRate: pct(r.clicked, r.delivered) }))
    .sort((a, b) => b.sent - a.sent);
}

function totals(rows) {
  const t = rows.reduce((a, r) => ({ sent: a.sent + r.sent, delivered: a.delivered + r.delivered, opened: a.opened + r.opened, clicked: a.clicked + r.clicked, bounced: a.bounced + r.bounced }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 });
  return { ...t, openRate: pct(t.opened, t.delivered), clickRate: pct(t.clicked, t.delivered) };
}

// Reads the most recent emails (up to maxPages of 100) from Resend.
async function fetchRecent({ apiKey, fetchImpl, maxPages = 5, pauseMs = 0 }) {
  const doFetch = fetchImpl || fetch;
  const out = [];
  let after = null;
  for (let page = 0; page < maxPages; page++) {
    const res = await doFetch(`https://api.resend.com/emails?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`, { headers: { Authorization: `Bearer ${apiKey}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`Resend would not list emails (${res.status}): ${body.message || body.name || "unknown error"}`);
      err.statusCode = 502;
      throw err;
    }
    const rows = Array.isArray(body.data) ? body.data : [];
    out.push(...rows);
    if (!body.has_more || !rows.length) break;
    after = rows[rows.length - 1].id;
    if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
  }
  return out;
}

module.exports = { summarise, totals, fetchRecent };
