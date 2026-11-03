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

// Light formatting for a hand-written reply: **bold**, [label](https://link), bare https:// links and line breaks.
// Everything is escaped first, and only http(s) links are made clickable, so nothing typed can inject markup.
// Only used when an email asks for it (c.rich); the automated emails keep their text exactly as written.
function rich(text) {
  return esc(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, l, u) => `<a href="${u}" class="ll-link" style="color:${BRAND.wine};text-decoration:underline;">${l}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, u) => `${pre}<a href="${u}" class="ll-link" style="color:${BRAND.wine};text-decoration:underline;">${u}</a>`)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong style="font-weight:600;">$1</strong>')
    .replace(/\n/g, "<br>");
}
const plain = (text) => String(text == null ? "" : text).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)").replace(/\*\*([^*\n]+)\*\*/g, "$1");

function paragraph(text, isRich) {
  return `<p style="margin:0 0 16px;font-family:${FONT_SANS};font-size:16px;line-height:1.65;color:${BRAND.ink};" class="ll-ink">${isRich ? rich(text) : esc(text)}</p>`;
}

function bulletsBlock(items, isRich) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${items.map((t) => `
    <tr>
      <td width="22" valign="top" class="ll-ink" style="padding:0 0 8px;font-family:${FONT_SANS};font-size:16px;line-height:1.65;color:${BRAND.wine};">&bull;</td>
      <td valign="top" class="ll-ink" style="padding:0 0 8px;font-family:${FONT_SANS};font-size:16px;line-height:1.65;color:${BRAND.ink};">${isRich ? rich(t) : esc(t)}</td>
    </tr>`).join("")}
  </table>`;
}

// A step is a plain string, or { title, text } where either part may be left out.
const stepParts = (s) => (s && typeof s === "object" ? { title: s.title || "", text: s.text || "" } : { title: String(s == null ? "" : s), text: "" });

function stepsBlock(steps, isRich) {
  const f = isRich ? rich : esc;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">${steps.map((raw, i) => {
    const st = stepParts(raw);
    const title = st.title ? `<strong style="font-weight:600;">${f(st.title)}</strong>` : "";
    const text = st.text ? `<span class="ll-soft" style="color:${BRAND.inkSoft};">${f(st.text)}</span>` : "";
    return `
    <tr>
      <td width="40" valign="top" style="padding:0 0 14px;">
        <div class="ll-num" style="width:28px;height:28px;border-radius:14px;background:${BRAND.wineTint};color:${BRAND.wineInk};font-family:${FONT_SANS};font-size:14px;font-weight:700;line-height:28px;text-align:center;">${i + 1}</div>
      </td>
      <td valign="top" style="padding:2px 0 14px;font-family:${FONT_SANS};font-size:16px;line-height:1.55;color:${BRAND.ink};" class="ll-ink">${title}${title && text ? "<br>" : ""}${text}</td>
    </tr>`;
  }).join("")}
  </table>`;
}

function button(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;"><tr><td class="ll-btn" style="border-radius:999px;background:${BRAND.wine};">
    <a href="${esc(url)}" class="ll-btn-a" style="display:inline-block;padding:14px 28px;font-family:${FONT_SANS};font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:999px;">${esc(label)}</a>
  </td></tr></table>`;
}

// A row of simple progress bars, built from table cells so they work in every mail client (rings need images or
// SVG, which many clients block). Each is { label, value (text), pct (0 to 100) }. Shown only when there is real data.
function meterBlock(meters) {
  const rows = (meters || []).filter((m) => m && m.label && Number.isFinite(m.pct)).map((m) => {
    const pct = Math.max(0, Math.min(100, Math.round(m.pct)));
    const fill = pct > 0 ? `<td class="ll-bar" width="${pct}%" height="10" style="width:${pct}%;height:10px;line-height:10px;font-size:0;background:${BRAND.wine};border-radius:6px;">&nbsp;</td>` : "";
    const rest = pct < 100 ? `<td width="${100 - pct}%" height="10" style="width:${100 - pct}%;height:10px;line-height:10px;font-size:0;">&nbsp;</td>` : "";
    return `<tr><td style="padding:8px 0 2px;font-family:${FONT_SANS};font-size:14px;color:${BRAND.ink};" class="ll-ink"><span style="font-weight:600;">${esc(m.label)}</span> <span class="ll-soft" style="color:${BRAND.inkSoft};">${esc(m.value)}</span></td></tr>
  <tr><td style="padding:0 0 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ll-tint" style="background:${BRAND.wineTint};border-radius:6px;"><tr>${fill}${rest}</tr></table></td></tr>`;
  });
  if (!rows.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">${rows.join("\n")}</table>`;
}

function noteBox(text, isRich) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;"><tr><td class="ll-tint" style="background:${BRAND.wineTint};border-radius:10px;padding:14px 18px;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:${BRAND.wineInk};">${isRich ? rich(text) : esc(text)}</td></tr></table>`;
}

// "Was this email useful?" row: one click records a thumbs up or down, and
// "Tell us more" opens the full feedback form. The feedback page reads the
// email and the rating from the link, so nothing is asked twice.
function feedbackRow(baseUrl) {
  const join = baseUrl.indexOf("?") === -1 ? "?" : "&";
  const link = (label, extra) => `<a href="${esc(baseUrl + join + extra)}" class="ll-ai" style="color:${BRAND.wineInk};font-weight:600;text-decoration:none;">${label}</a>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td class="ll-soft ll-rule" style="border-top:1px solid ${BRAND.border};padding-top:16px;font-family:${FONT_SANS};font-size:14px;line-height:1.6;color:${BRAND.inkSoft};">Was this email useful? ${link("Yes", "r=up")} &nbsp;·&nbsp; ${link("No", "r=down")} &nbsp;·&nbsp; ${link("Tell us more", "r=more")}</td></tr></table>`;
}

// One piece of a reply, in the order it was written: { p }, { bullets }, { steps }, { note } or { cta }.
function renderBlock(b, isRich, campaign) {
  if (!b || typeof b !== "object") return "";
  if (b.p != null) return paragraph(b.p, isRich);
  if (b.bullets) return bulletsBlock(b.bullets, isRich);
  if (b.steps) return stepsBlock(b.steps, isRich);
  if (b.note != null) return noteBox(b.note, isRich);
  if (b.cta) return button(b.cta.label, tagLink(b.cta.url, campaign));
  return "";
}

function blockText(b, rich, campaign) {
  if (!b || typeof b !== "object") return [];
  const f = rich ? plain : (x) => String(x);
  if (b.p != null) return [f(b.p), ""];
  if (b.bullets) return b.bullets.map((t) => "- " + f(t)).concat([""]);
  if (b.steps) return b.steps.map((raw, i) => { const st = stepParts(raw); return `${i + 1}. ${[f(st.title), f(st.text)].filter(Boolean).join(" - ")}`; }).concat([""]);
  if (b.note != null) return [f(b.note), ""];
  if (b.cta) return [`${b.cta.label}: ${tagLink(b.cta.url, campaign)}`, ""];
  return [];
}

/**
 * @param {object} c
 * @param {string} c.subject        the subject line (also the <title>)
 * @param {string} c.preheader      the grey preview text shown after the subject in the inbox
 * @param {string} [c.heading]   omitted for a personal reply, which opens with a greeting instead
 * @param {string[]} c.paragraphs   plain text, escaped here
 * @param {{title,text}[]} [c.steps]
 * @param {{label,value,pct}[]} [c.meters]  progress bars shown under the paragraphs (for example days practised this week)
 * @param {{label,url}} [c.cta]
 * @param {string} [c.note]
 * @param {string[]} [c.bullets]  a bulleted list shown after the paragraphs
 * @param {object[]} [c.blocks]   instead of paragraphs/bullets/steps/cta/note: pieces shown in the order given, each { p } | { bullets } | { steps } | { note } | { cta }
 * @param {boolean} [c.rich]      allow **bold**, [label](https://link), bare https links and line breaks in the text
 * @param {string} [c.signOff]     a closing line under everything else, e.g. the team name on a support reply
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
    c.heading ? `<h1 class="ll-ink" style="margin:0 0 18px;font-family:${FONT_SANS};font-size:26px;line-height:1.25;font-weight:700;color:${BRAND.ink};">${esc(c.heading)}</h1>` : "",
    ...(c.blocks
      ? c.blocks.map((blk) => renderBlock(blk, c.rich, c.campaign))
      : [
        ...(c.paragraphs || []).map((t) => paragraph(t, c.rich)),
        ...(c.bullets && c.bullets.length ? [bulletsBlock(c.bullets, c.rich)] : []),
        ...(c.meters && c.meters.length ? [meterBlock(c.meters)] : []),
        c.steps ? stepsBlock(c.steps, c.rich) : "",
        c.cta ? button(c.cta.label, ctaUrl) : "",
        c.note ? noteBox(c.note, c.rich) : "",
      ]),
    c.signOff ? `<p class="ll-ink" style="margin:20px 0 16px;font-family:${FONT_SANS};font-size:16px;line-height:1.65;color:${BRAND.ink};">${esc(c.signOff)}</p>` : "",
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
  @media (max-width: 620px) { .ll-wrap { width: 100% !important; } .ll-pad { padding: 24px 20px !important; } .ll-hd { padding: 16px 20px !important; } }
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
    .ll-hd { background: ${BRAND.dark.wineTint} !important; }
    .ll-hdtxt { color: ${BRAND.dark.ink} !important; }
    .ll-hdai { color: ${BRAND.dark.wineInk} !important; }
    .ll-link { color: ${BRAND.dark.wineInk} !important; }
  }
</style>
</head>
<body class="ll-bg" style="margin:0;padding:0;background:${BRAND.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(c.preheader)}&#8199;&zwnj;&#8199;&zwnj;&#8199;&zwnj;&#8199;&zwnj;&#8199;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ll-bg" style="background:${BRAND.bg};">
  <tr><td align="center" style="padding:24px 12px 40px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="ll-wrap" style="width:600px;max-width:100%;">
      <!-- Header: one solid wine band, with the card tucked directly under it -->
      <tr><td class="ll-hd" style="background:${BRAND.wine};border-radius:14px 14px 0 0;padding:18px 36px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td valign="middle" style="padding-right:12px;"><a href="${SITE}" style="text-decoration:none;"><img src="${BRAND.logoUrl}" width="44" height="44" alt="LiteracyLab AI" style="display:block;border:0;border-radius:10px;"></a></td>
          <td valign="middle"><a href="${SITE}" class="ll-hdtxt" style="text-decoration:none;font-family:${FONT_SANS};font-size:22px;font-weight:700;letter-spacing:-0.2px;color:#FFFFFF;">LiteracyLab <span class="ll-hdai" style="color:${BRAND.goldTint};">AI</span></a></td>
        </tr></table>
      </td></tr>
      <!-- Card -->
      <tr><td class="ll-card ll-pad" style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-top:0;border-radius:0 0 14px 14px;padding:36px 36px 28px;">
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
    ...(c.heading ? [c.heading, ""] : []),
    ...(c.blocks ? c.blocks.flatMap((blk) => blockText(blk, c.rich, c.campaign)) : (c.paragraphs || []).flatMap((p) => [c.rich ? plain(p) : p, ""])),
    ...(!c.blocks && c.bullets && c.bullets.length ? c.bullets.map((t) => "- " + (c.rich ? plain(t) : t)).concat([""]) : []),
    ...(c.blocks ? [] : c.meters && c.meters.length ? c.meters.filter((m) => m && m.label && Number.isFinite(m.pct)).map((m) => `${m.label}: ${m.value}`).concat([""]) : []),
    ...(!c.blocks && c.steps ? c.steps.map((raw, i) => { const st = stepParts(raw); const f = c.rich ? plain : String; return `${i + 1}. ${[f(st.title), f(st.text)].filter(Boolean).join(" - ")}`; }).concat([""]) : []),
    ...(!c.blocks && c.cta ? [`${c.cta.label}: ${ctaUrl}`, ""] : []),
    ...(!c.blocks && c.note ? [c.rich ? plain(c.note) : c.note, ""] : []),
    ...(c.signOff ? [c.signOff, ""] : []),
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
