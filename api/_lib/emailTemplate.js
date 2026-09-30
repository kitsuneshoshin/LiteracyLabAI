// The one branded shell every LiteracyLab AI email is built from, so no email
// can drift off-brand. Pure and DB-free: give it content, get back
// { html, text }. Sending, scheduling and unsubscribe handling live elsewhere.
//
// Brand values are the same tokens app.html uses (--cyan, --cyan-ink, --gold,
// --bg ...): the app's "cyan" is the deep wine #7A3B45, not a blue.
//
// Email clients are far more limited than browsers, so this is a table layout
// with inline styles. Web fonts only load in some clients (Apple Mail, iOS
// Mail and a few others); Gmail and Outlook ignore them, so every font stack
// ends in a system face chosen to sit close to Lexend (a clean geometric sans).

const SITE = "https://www.literacylabai.com";

const BRAND = {
  name: "LiteracyLab AI",
  logoUrl: SITE + "/apple-touch-icon.png", // the two letter tiles on the brand grey
  bg: "#F1F1EF",
  surface: "#FFFFFF",
  border: "#D3D3CF",
  ink: "#212121",
  inkSoft: "#5A5A56",
  wine: "#7A3B45",
  wineInk: "#552830",
  wineTint: "#EBDEE0",
  gold: "#8C7040",
  goldTint: "#E9E2D2",
  // Dark mode (same as the app's dark theme)
  dark: { bg: "#161513", surface: "#1E1B18", border: "#37322B", ink: "#EDE9E2", inkSoft: "#B3AB9C", wine: "#C4776E", wineInk: "#E3A79F", wineTint: "#362320" },
};

const FONT_SANS = "'Lexend', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const GOOGLE_FONTS = "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Adds campaign tags so Google Analytics can attribute sign-ups and upgrades
// to the email that drove them. Only touches links to our own site.
function tagLink(url, campaign) {
  if (!url || !campaign || url.indexOf(SITE) !== 0) return url;
  const sep = url.indexOf("?") === -1 ? "?" : "&";
  return url + sep + "utm_source=email&utm_medium=lifecycle&utm_campaign=" + encodeURIComponent(campaign);
}

function paragraph(text) {
  return `<p style="margin:0 0 16px;font-family:${FONT_SANS};font-size:16px;line-height:1.65;color:${BRAND.ink};" class="ll-ink">${esc(text)}</p>`;
}

function stepsBlock(steps) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">${steps.map((s, i) => `
    <tr>
      <td width="40" valign="top" style="padding:0 0 14px;">
        <div class="ll-num" style="width:28px;height:28px;border-radius:14px;background:${BRAND.wineTint};color:${BRAND.wineInk};font-family:${FONT_SANS};font-size:14px;font-weight:700;line-height:28px;text-align:center;">${i + 1}</div>
      </td>
      <td valign="top" style="padding:2px 0 14px;font-family:${FONT_SANS};font-size:16px;line-height:1.55;color:${BRAND.ink};" class="ll-ink"><strong style="font-weight:600;">${esc(s.title)}</strong><br><span class="ll-soft" style="color:${BRAND.inkSoft};">${esc(s.text)}</span></td>
    </tr>`).join("")}
  </table>`;
}

function button(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;"><tr><td class="ll-btn" style="border-radius:999px;background:${BRAND.wine};">
    <a href="${esc(url)}" class="ll-btn-a" style="display:inline-block;padding:14px 28px;font-family:${FONT_SANS};font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px;">${esc(label)}</a>
  </td></tr></table>`;
}

function noteBox(text) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;"><tr><td class="ll-tint" style="background:${BRAND.wineTint};border-radius:10px;padding:14px 18px;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:${BRAND.wineInk};">${esc(text)}</td></tr></table>`;
}

// "Was this email useful?" row: one click records a thumbs up or down, and
// "Tell us more" opens the full feedback form. The feedback page reads the
// email and the rating from the link, so nothing is asked twice.
function feedbackRow(baseUrl) {
  const join = baseUrl.indexOf("?") === -1 ? "?" : "&";
  const link = (label, extra) => `<a href="${esc(baseUrl + join + extra)}" class="ll-ai" style="color:${BRAND.wineInk};font-weight:600;text-decoration:none;">${label}</a>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td class="ll-soft ll-rule" style="border-top:1px solid ${BRAND.border};padding-top:16px;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:${BRAND.inkSoft};">Was this email useful? ${link("Yes", "r=up")} &nbsp;·&nbsp; ${link("No", "r=down")} &nbsp;·&nbsp; ${link("Tell us more", "r=more")}</td></tr></table>`;
}

/**
 * @param {object} c
 * @param {string} c.subject        the subject line (also the <title>)
 * @param {string} c.preheader      the grey preview text shown after the subject in the inbox
 * @param {string} c.heading
 * @param {string[]} c.paragraphs   plain text, escaped here
 * @param {{title,text}[]} [c.steps]
 * @param {{label,url}} [c.cta]
 * @param {string} [c.note]
 * @param {string} [c.campaign]     tags links for analytics, e.g. "free_welcome"
 * @param {string} c.reason         why they are receiving it (footer)
 * @param {string} [c.unsubscribeUrl]  required for anything that is not an account/billing email
 * @param {string} [c.address]      the postal address line for the footer
 * @param {string} [c.feedbackUrl]  the feedback page link for this email; adds a quiet "Something missing or confusing? Tell us" line to the footer
 * @param {"row"} [c.feedbackStyle] set to "row" to also add the "Was this email useful? Yes / No" row above the footer
 */
function buildEmail(c) {
  const ctaUrl = c.cta ? tagLink(c.cta.url, c.campaign) : null;
  const body = [
    `<h1 class="ll-ink" style="margin:0 0 18px;font-family:${FONT_SANS};font-size:26px;line-height:1.25;font-weight:700;color:${BRAND.ink};">${esc(c.heading)}</h1>`,
    ...(c.paragraphs || []).map(paragraph),
    c.steps ? stepsBlock(c.steps) : "",
    c.cta ? button(c.cta.label, ctaUrl) : "",
    c.note ? noteBox(c.note) : "",
    c.feedbackUrl && c.feedbackStyle === "row" ? feedbackRow(c.feedbackUrl) : "",
  ].join("\n");
  // Every email gets the quiet footer line; only the ones that ask for it get the rating row above.
  const feedbackHref = c.feedbackUrl ? c.feedbackUrl + (c.feedbackUrl.indexOf("?") === -1 ? "?" : "&") + "r=more" : null;

  const footerLinks = [
    c.unsubscribeUrl ? `<a href="${esc(c.unsubscribeUrl)}" style="color:${BRAND.inkSoft};">Unsubscribe</a>` : "",
    `<a href="${SITE}/privacy.html" style="color:${BRAND.inkSoft};">Privacy</a>`,
    `<a href="${SITE}/terms.html" style="color:${BRAND.inkSoft};">Terms</a>`,
  ].filter(Boolean).join(" &nbsp;·&nbsp; ");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(c.subject)}</title>
<link href="${esc(GOOGLE_FONTS)}" rel="stylesheet">
<style>
  @media (max-width: 620px) { .ll-wrap { width: 100% !important; } .ll-pad { padding: 24px 20px !important; } }
  @media (prefers-color-scheme: dark) {
    .ll-bg { background: ${BRAND.dark.bg} !important; }
    .ll-card { background: ${BRAND.dark.surface} !important; border-color: ${BRAND.dark.border} !important; }
    .ll-ink { color: ${BRAND.dark.ink} !important; }
    .ll-soft { color: ${BRAND.dark.inkSoft} !important; }
    .ll-tint { background: ${BRAND.dark.wineTint} !important; color: ${BRAND.dark.wineInk} !important; }
    .ll-num { background: ${BRAND.dark.wineTint} !important; color: ${BRAND.dark.wineInk} !important; }
    .ll-btn { background: ${BRAND.dark.wine} !important; }
    .ll-btn-a { color: ${BRAND.dark.bg} !important; }
    .ll-rule { border-color: ${BRAND.dark.border} !important; }
    .ll-ai { color: ${BRAND.dark.wineInk} !important; }
    .ll-bar { background: ${BRAND.dark.wine} !important; }
  }
</style>
</head>
<body class="ll-bg" style="margin:0;padding:0;background:${BRAND.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(c.preheader)}&#8199;&zwnj;&#8199;&zwnj;&#8199;&zwnj;&#8199;&zwnj;&#8199;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ll-bg" style="background:${BRAND.bg};">
  <tr><td align="center" style="padding:24px 12px 40px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="ll-wrap" style="width:600px;max-width:100%;">
      <!-- Header -->
      <tr><td class="ll-bar" height="4" style="height:4px;line-height:4px;font-size:0;background:${BRAND.wine};border-radius:4px 4px 0 0;">&nbsp;</td></tr>
      <tr><td style="padding:18px 8px 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" style="padding-right:12px;"><a href="${SITE}" style="text-decoration:none;"><img src="${BRAND.logoUrl}" width="48" height="48" alt="LiteracyLab AI" style="display:block;border:0;border-radius:10px;"></a></td>
          <td valign="middle"><a href="${SITE}" class="ll-ink" style="text-decoration:none;font-family:${FONT_SANS};font-size:24px;font-weight:700;letter-spacing:-0.2px;color:${BRAND.ink};">LiteracyLab <span class="ll-ai" style="color:${BRAND.wineInk};">AI</span></a></td>
        </tr></table>
      </td></tr>
      <!-- Card -->
      <tr><td class="ll-card ll-pad" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:14px;padding:36px 36px 28px;">
${body}
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:20px 8px 0;font-family:${FONT_SANS};font-size:12px;line-height:1.7;color:${BRAND.inkSoft};" class="ll-soft">
        <div>${esc(c.reason)}</div>${feedbackHref ? `
        <div style="margin-top:6px;">Something missing or confusing? <a href="${esc(feedbackHref)}" style="color:${BRAND.inkSoft};">Tell us</a></div>` : ""}
        <div style="margin-top:6px;">${footerLinks}</div>
        <div style="margin-top:6px;">${esc(BRAND.name)}${c.address ? " · " + esc(c.address) : ""}</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  // Plain-text twin: helps deliverability and covers clients that block HTML.
  const text = [
    BRAND.name.toUpperCase(),
    "",
    c.heading,
    "",
    ...(c.paragraphs || []).flatMap((p) => [p, ""]),
    ...(c.steps ? c.steps.flatMap((s, i) => [`${i + 1}. ${s.title} - ${s.text}`]).concat([""]) : []),
    ...(c.cta ? [`${c.cta.label}: ${ctaUrl}`, ""] : []),
    ...(c.note ? [c.note, ""] : []),
    ...(c.feedbackUrl && c.feedbackStyle === "row" ? [`Was this email useful? Yes: ${c.feedbackUrl}${c.feedbackUrl.indexOf("?") === -1 ? "?" : "&"}r=up | No: ${c.feedbackUrl}${c.feedbackUrl.indexOf("?") === -1 ? "?" : "&"}r=down`, ""] : []),
    "--",
    c.reason,
    ...(feedbackHref ? [`Something missing or confusing? Tell us: ${feedbackHref}`] : []),
    ...(c.unsubscribeUrl ? [`Unsubscribe: ${c.unsubscribeUrl}`] : []),
    `Privacy: ${SITE}/privacy.html`,
    `Terms: ${SITE}/terms.html`,
    BRAND.name + (c.address ? " - " + c.address : ""),
  ].join("\n");

  return { subject: c.subject, html, text };
}

module.exports = { buildEmail, tagLink, BRAND, SITE };
