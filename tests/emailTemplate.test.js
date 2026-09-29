const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildEmail, tagLink, BRAND, SITE } = require("../api/_lib/emailTemplate");

// Every email goes through this one template, so these tests pin the brand:
// the header, the fonts, the colours (the same tokens app.html uses), and the
// rules that keep marketing email legal and safe.

const base = {
  subject: "Welcome to LiteracyLab AI",
  preheader: "Pick a year level.",
  heading: "Welcome",
  paragraphs: ["Hello there."],
  cta: { label: "Start", url: SITE + "/app.html" },
  campaign: "free_welcome",
  reason: "You're receiving this because you created an account.",
  unsubscribeUrl: SITE + "/unsubscribe?t=abc",
  address: "PO Box 1, Sydney",
};

test("brand colours match the app's own tokens", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");
  const token = (name) => (app.match(new RegExp("--" + name + ":\\s*(#[0-9A-Fa-f]{6})")) || [])[1].toUpperCase();
  assert.equal(BRAND.wine, token("cyan"), "primary wine");
  assert.equal(BRAND.wineInk, token("cyan-ink"), "deep wine for text");
  assert.equal(BRAND.wineTint, token("cyan-tint"), "wine tint");
  assert.equal(BRAND.ink, token("ink"), "body text");
  assert.equal(BRAND.bg, token("bg"), "page background");
  assert.equal(BRAND.gold, token("gold"), "gold");
});

test("every email carries the LiteracyLab AI header: logo, wordmark with a wine AI, accent bar", () => {
  const { html } = buildEmail(base);
  assert.ok(html.includes(BRAND.logoUrl), "logo image");
  assert.match(html, /alt="LiteracyLab AI"/);
  assert.match(html, /LiteracyLab <span class="ll-ai" style="color:#552830;">AI<\/span>/);
  assert.ok(html.includes("background:#7A3B45"), "wine accent bar and button");
  assert.ok(BRAND.logoUrl.startsWith("https://"), "images must be absolute https URLs");
});

test("the brand fonts are used, with system fallbacks for clients that ignore web fonts", () => {
  const { html } = buildEmail(base);
  assert.ok(html.includes("family=Lexend"), "Lexend is requested");
  assert.match(html, /font-family:'Lexend', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif/);
});

test("dark mode is designed, not inverted by the mail app", () => {
  const { html } = buildEmail(base);
  assert.match(html, /name="color-scheme" content="light dark"/);
  assert.match(html, /prefers-color-scheme: dark/);
  assert.ok(html.includes(BRAND.dark.bg) && html.includes(BRAND.dark.surface));
});

test("a plain-text version is produced with the same content and links", () => {
  const { text } = buildEmail(base);
  assert.match(text, /LITERACYLAB AI/);
  assert.match(text, /Start: https:\/\/www\.literacylabai\.com\/app\.html\?utm_source=email/);
  assert.match(text, /Unsubscribe: https:\/\/www\.literacylabai\.com\/unsubscribe\?t=abc/);
});

test("links to our site are tagged for Google Analytics; other links are left alone", () => {
  assert.equal(tagLink(SITE + "/app.html", "free_welcome"), SITE + "/app.html?utm_source=email&utm_medium=lifecycle&utm_campaign=free_welcome");
  assert.equal(tagLink(SITE + "/app.html?x=1", "c"), SITE + "/app.html?x=1&utm_source=email&utm_medium=lifecycle&utm_campaign=c");
  assert.equal(tagLink("https://example.com/", "c"), "https://example.com/");
  assert.ok(buildEmail(base).html.includes("utm_campaign=free_welcome"));
});

test("the footer has the unsubscribe link, privacy, terms, the reason and the address", () => {
  const { html } = buildEmail(base);
  assert.ok(html.includes("Unsubscribe"));
  assert.ok(html.includes(SITE + "/privacy.html") && html.includes(SITE + "/terms.html"));
  assert.ok(html.includes("You&#39;re receiving this because you created an account."));
  assert.ok(html.includes("PO Box 1, Sydney"));
});

test("an account or billing email can omit the unsubscribe link", () => {
  const { html } = buildEmail({ ...base, unsubscribeUrl: undefined });
  assert.ok(!html.includes("Unsubscribe"));
});

test("content is escaped, so a name or piece of text can never inject markup", () => {
  const { html } = buildEmail({ ...base, heading: "<script>alert(1)</script>", paragraphs: ['Hi "<b>x</b>"'] });
  assert.ok(!html.includes("<script>alert(1)"));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("<b>x</b>"));
});

test("the preview text is hidden in the body and the subject is the title", () => {
  const { html, subject } = buildEmail(base);
  assert.equal(subject, "Welcome to LiteracyLab AI");
  assert.match(html, /<title>Welcome to LiteracyLab AI<\/title>/);
  assert.match(html, /display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Pick a year level\./);
});
