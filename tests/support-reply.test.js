const test = require("node:test");
const assert = require("node:assert/strict");
const { buildSupportReply, SIGN_OFF } = require("../api/_lib/supportReply");
const { BRAND } = require("../api/_lib/emailTemplate");

// A reply to a customer uses the same branded shell as every automated email, so the two can never drift apart.

const reply = buildSupportReply({ subject: "Re: Your LiteracyLab AI account", name: "Sherry", paragraphs: ["Earlier work is easy to find now."], cta: { label: "Open the dashboard", url: "https://www.literacylabai.com/app.html" } });

test("a support reply wears the same wine header band as the onboarding emails", () => {
  assert.match(reply.html, /class="ll-hd" style="background:#7A3B45/);
  assert.ok(reply.html.includes(BRAND.logoUrl));
});

test("it opens with a greeting, ends with the team sign-off, and has no unsubscribe link or heading", () => {
  assert.ok(reply.html.includes("Hi Sherry,"));
  assert.ok(reply.html.indexOf(SIGN_OFF) > reply.html.indexOf("Open the dashboard"), "sign-off comes last");
  assert.ok(!reply.html.includes("<h1"));
  assert.ok(!/unsubscribe/i.test(reply.html) && !/unsubscribe/i.test(reply.text));
  assert.equal(SIGN_OFF, "LiteracyLab AI Team");
});

test("with no name it says Hello, and the text version carries the same content", () => {
  const r = buildSupportReply({ subject: "s", paragraphs: ["Body."] });
  assert.ok(r.html.includes("Hello,"));
  assert.match(r.text, /Hello,\n\nBody\.\n\nLiteracyLab AI Team/);
});

// A reply can be plain text, instructions, or a mix: the shell has to cope with all of them.

test("plain text only: a couple of paragraphs, nothing else, no stray empty sections", () => {
  const r = buildSupportReply({ subject: "s", name: "Sam", paragraphs: ["First.", "Second."] });
  assert.ok(!r.html.includes("undefined") && !r.text.includes("undefined"));
  assert.match(r.text, /Hi Sam,\n\nFirst\.\n\nSecond\.\n\nLiteracyLab AI Team/);
  assert.ok(!r.html.includes('class="ll-num"'), "no numbered steps");
});

test("instructions: steps can be plain strings or a title with optional explanation", () => {
  const r = buildSupportReply({ subject: "s", paragraphs: ["Do this:"], steps: ["Log in", { title: "Open Activity history", text: "It's under the stats." }, { text: "Click the button" }] });
  assert.ok(!r.html.includes("undefined") && !r.text.includes("undefined"));
  assert.match(r.text, /1\. Log in\n2\. Open Activity history - It's under the stats\.\n3\. Click the button/);
  assert.equal((r.html.match(/class="ll-num"/g) || []).length, 3);
});

test("bullets, bold and links work in a reply, and the text version reads cleanly", () => {
  const r = buildSupportReply({ subject: "s", bullets: ["**Core** keeps the full history", "See [our plans](https://www.literacylabai.com/#pricing)"], paragraphs: ["Details at https://www.literacylabai.com/privacy.html please.\nSecond line."] });
  assert.match(r.html, /<strong style="font-weight:600;">Core<\/strong> keeps/);
  assert.match(r.html, /<a href="https:\/\/www\.literacylabai\.com\/#pricing"[^>]*>our plans<\/a>/);
  assert.match(r.html, /<a href="https:\/\/www\.literacylabai\.com\/privacy\.html"[^>]*>https/);
  assert.ok(r.html.includes("<br>Second line."));
  assert.match(r.text, /- Core keeps the full history\n- See our plans \(https:\/\/www\.literacylabai\.com\/#pricing\)/);
});

test("blocks put each piece exactly where it was written, in the HTML and the text", () => {
  const r = buildSupportReply({ subject: "s", name: "Jo", blocks: [{ p: "Intro." }, { steps: ["One", "Two"] }, { p: "Then this." }, { note: "A tip." }, { cta: { label: "Go", url: "https://www.literacylabai.com/app.html" } }] });
  const order = ["Intro.", "One", "Then this.", "A tip.", "Go"].map((t) => r.html.indexOf(t));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(r.text, /Intro\.\n\n1\. One\n2\. Two\n\nThen this\.\n\nA tip\.\n\nGo: https/);
});

test("nothing typed in a reply can inject markup or a non-web link", () => {
  const r = buildSupportReply({ subject: "s", paragraphs: ["<script>alert(1)</script> [x](javascript:alert(1)) **<b>hi</b>**"] });
  assert.ok(!r.html.includes("<script>") && !r.html.includes('href="javascript'));
  assert.ok(r.html.includes("&lt;script&gt;"));
});
