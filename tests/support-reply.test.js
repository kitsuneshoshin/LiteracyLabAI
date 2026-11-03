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
