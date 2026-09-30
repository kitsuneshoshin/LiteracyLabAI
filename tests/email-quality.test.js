const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { buildAnyEmail, ALL_EMAIL_KEYS, sampleContext } = require("../api/_lib/emailAny");
const { buildAuthEmails } = require("../api/_lib/authEmails");
const { pickEmail } = require("../api/_lib/freeEmails");
const { pickPaidEmail, pickSharedEmail, isTransactional } = require("../api/_lib/paidEmails");
const { runFreeEmailJob } = require("../api/_lib/emailJob");
const { BRAND, SITE } = require("../api/_lib/emailTemplate");
const { fakeDb } = require("./fakedb");
const { loadHandler, fakeRes, did } = require("./harness");

// Broader checks on the emails themselves and the system around them: are they
// well-formed, safe, readable, free of spam habits, and does the machinery hold
// up against thousands of random situations and a real Stripe signature.

const TOKEN = "11111111-2222-3333-4444-555555555555";
const ADDRESS = "PO Box 456, Austin, TX 78767, USA";
const all = ALL_EMAIL_KEYS.map((key) => ({ key, ...buildAnyEmail(key, { token: TOKEN, address: ADDRESS, ...sampleContext(key) }) }));
const auth = buildAuthEmails(ADDRESS);
const everything = [...all.map((e) => ({ name: e.key, html: e.html, text: e.text, subject: e.subject })), { name: "confirm-signup", ...auth.confirm }, { name: "reset-password", ...auth.reset }];

// ------------------------------------------------------------------ well-formed HTML

const VOID = new Set(["meta", "link", "img", "br", "hr", "input"]);
function tagProblems(html) {
  const problems = [];
  const body = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!doctype[^>]*>/i, "");
  const stack = [];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let m;
  while ((m = re.exec(body))) {
    const [, closing, nameRaw, rest] = m;
    const name = nameRaw.toLowerCase();
    if (VOID.has(name)) continue;
    if (rest.trim().endsWith("/")) continue;
    if (!closing) stack.push(name);
    else if (stack[stack.length - 1] === name) stack.pop();
    else problems.push(`</${name}> closes ${stack[stack.length - 1] || "nothing"}`);
  }
  if (stack.length) problems.push(`never closed: ${stack.join(", ")}`);
  return problems;
}

test("every email is well-formed HTML: every tag closed in order", () => {
  for (const e of everything) assert.deepEqual(tagProblems(e.html), [], e.name);
});

test("no bare ampersands: every & in the markup is an entity, as mail clients require", () => {
  for (const e of everything) {
    const bare = (e.html.replace(/<style[\s\S]*?<\/style>/g, "").match(/&(?!(amp|lt|gt|quot|nbsp|zwnj|#\d+);)/g) || []);
    assert.equal(bare.length, 0, `${e.name} has ${bare.length} bare &`);
  }
});

test("each email has exactly one heading, a language, a title, and alt text on every image", () => {
  for (const e of everything) {
    assert.equal((e.html.match(/<h1[ >]/g) || []).length, 1, `${e.name}: one h1`);
    assert.match(e.html, /<html lang="en">/, e.name);
    assert.match(e.html, /<title>[^<]{5,}<\/title>/, e.name);
    for (const img of e.html.match(/<img[^>]*>/g) || []) assert.match(img, /alt="[^"]+"/, `${e.name}: image without alt text`);
  }
});

test("each email stays far under Gmail's 102 KB clipping limit", () => {
  for (const e of everything) assert.ok(Buffer.byteLength(e.html) < 30000, `${e.name} is ${Buffer.byteLength(e.html)} bytes`);
});

// ------------------------------------------------------------------ links

test("every link goes to our own site over https (or is Supabase's own placeholder), never to anywhere else", () => {
  for (const e of everything) {
    for (const href of (e.html.match(/href="([^"]*)"/g) || []).map((h) => h.slice(6, -1).replace(/&amp;/g, "&"))) {
      const ok = href.startsWith("https://www.literacylabai.com") || href === "{{ .ConfirmationURL }}" || href.startsWith("https://fonts.googleapis.com/");
      assert.ok(ok, `${e.name} links to ${href}`);
      assert.ok(!/localhost|http:\/\//.test(href), `${e.name}: ${href}`);
    }
  }
});

test("every link to the app or the feedback page in every email points at a page that exists in this site", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const routes = { "/": "index.html", "/app.html": "app.html", "/privacy.html": "privacy.html", "/terms.html": "terms.html", "/feedback": "feedback.html", "/unsubscribe": "unsubscribe.html", "/apple-touch-icon.png": "apple-touch-icon.png" };
  for (const e of everything) {
    for (const href of (e.html.match(/href="https:\/\/www\.literacylabai\.com[^"]*"/g) || []).map((h) => h.slice(6, -1))) {
      const p = new URL(href.replace(/&amp;/g, "&")).pathname;
      assert.ok(routes[p], `${e.name} links to an unknown page ${p}`);
      assert.ok(fs.existsSync(path.join(__dirname, "..", routes[p])), `${p} has no file`);
    }
    const src = (e.html.match(/<img[^>]*src="([^"]*)"/) || [])[1];
    assert.equal(src, BRAND.logoUrl, `${e.name}: the logo`);
  }
});

test("links to the app carry the campaign tag so analytics can tell which email drove a visit", () => {
  for (const e of all) {
    const btn = (e.html.match(/href="(https:\/\/www\.literacylabai\.com\/(?:app\.html|feedback)[^"]*utm_campaign=[^"]*)"/) || [])[1];
    assert.ok(btn, `${e.key} has a tagged main button`);
    assert.ok(btn.includes("utm_campaign=" + e.key.replace(/-/g, "_")), `${e.key}: campaign name`);
  }
});

// ------------------------------------------------------------------ readability

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test("text is readable against its background in light and dark mode (WCAG AA, 4.5 to 1)", () => {
  const D = BRAND.dark;
  const pairs = [
    ["body text on the card", BRAND.ink, BRAND.surface], ["secondary text on the card", BRAND.inkSoft, BRAND.surface],
    ["footer text on the page", BRAND.inkSoft, BRAND.bg], ["button text", "#FFFFFF", BRAND.wine],
    ["note text", BRAND.wineInk, BRAND.wineTint], ["wordmark AI", BRAND.wineInk, BRAND.bg], ["step number", BRAND.wineInk, BRAND.wineTint],
    ["dark: body text", D.ink, D.surface], ["dark: secondary text", D.inkSoft, D.surface], ["dark: footer", D.inkSoft, D.bg],
    ["dark: button text (dark on the lighter dark-mode button)", D.bg, D.wine], ["dark: note", D.wineInk, D.wineTint], ["dark: wordmark AI", D.wineInk, D.bg],
  ];
  for (const [name, fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${name}: ${contrast(fg, bg).toFixed(2)} to 1`);
});

// ------------------------------------------------------------------ copy: spam habits and parity

test("subjects are short, not shouty, and unique; preview text is a sensible length", () => {
  const seen = new Set();
  for (const e of all) {
    assert.ok(e.subject.length <= 70, `${e.key} subject ${e.subject.length} chars`);
    assert.ok(!/[A-Z]{5,}/.test(e.subject.replace(/LiteracyLab AI/g, "")), `${e.key}: shouting in the subject`);
    assert.ok((e.subject.match(/!/g) || []).length <= 1, `${e.key}: too many exclamation marks`);
    assert.ok(!/free!!!|act now|click here|100%|guarantee|winner|urgent/i.test(e.subject), `${e.key}: spam-filter words`);
    assert.ok(!seen.has(e.subject), `${e.key}: duplicate subject`);
    seen.add(e.subject);
    const pre = ((e.html.match(/opacity:0;color:transparent;">([\s\S]*?)&#8199;/) || [])[1] || "").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    assert.ok(pre.length >= 15 && pre.length <= 110, `${e.key}: preview text is ${pre.length} chars`);
  }
});

test("the body has no spam habits: no 'click here', no shouting, no dashes used as separators", () => {
  for (const e of everything) {
    const visible = e.html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
    assert.ok(!/click here|buy now|limited time|act now/i.test(visible), `${e.name}: spam wording`);
    assert.ok(!/ — | – /.test(visible.replace(/&nbsp;/g, " ")), `${e.name}: a spaced dash in the copy`);
    assert.ok(!/!!/.test(visible), `${e.name}: repeated exclamation marks`);
  }
});

test("the plain-text version has the heading, the button link, the footer details, and no HTML", () => {
  for (const e of all) {
    const heading = (e.html.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1].replace(/&#39;/g, "'").replace(/&amp;/g, "&");
    assert.ok(e.text.includes(heading), `${e.key}: heading in the text version`);
    assert.ok(/https:\/\/www\.literacylabai\.com\/\S+/.test(e.text), `${e.key}: a link in the text version`);
    assert.ok(e.text.includes(ADDRESS), `${e.key}: postal address in the text version`);
    assert.ok(!/<[a-z][^>]*>/i.test(e.text), `${e.key}: HTML tags in the text version`);
    assert.equal(e.text.includes("Unsubscribe:"), !e.transactional, `${e.key}: unsubscribe line`);
  }
});

test("nothing in any email names the wrong thing: no stale prices, no unfinished words", () => {
  for (const e of everything) {
    assert.ok(!/19\.99/.test(e.html + e.text), `${e.name}: old price`);
    assert.ok(!/\b(TODO|lorem|placeholder|undefined|NaN|null)\b|\[object/i.test(e.html + e.text), `${e.name}: unfinished text`);
  }
  assert.ok(all.find((e) => e.key === "free-limit").text.includes("9.99"), "the limit email quotes the current Core price");
});

// ------------------------------------------------------------------ the pickers hold up against random situations

let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pickOne = (arr) => arr[Math.floor(rnd() * arr.length)];
const DAY = 86400000;
const BASE = new Date("2026-01-05T22:00:00Z").getTime();
function randomDate() { return new Date(BASE + Math.floor(rnd() * 400) * DAY + Math.floor(rnd() * 24) * 3600000); }
const VALID_KEYS = new Set(ALL_EMAIL_KEYS);

test("fuzz: 5,000 random Free, Core and Premium situations never throw and only ever pick a real, correctly-keyed email", () => {
  let picked = 0;
  for (let i = 0; i < 5000; i++) {
    const now = randomDate();
    const created = new Date(now.getTime() - Math.floor(rnd() * 500) * DAY);
    const sent = {};
    for (const k of ["free-welcome", "free-nudge", "free-first-followup", "milestone-10", "milestone-25", "core-to-premium", "bill-winback", `free-limit:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`, "bill-cancel:sub_1", "all-inactive:2026-01"]) {
      if (rnd() < 0.2) sent[k] = new Date(now.getTime() - Math.floor(rnd() * 100) * DAY);
    }
    const completedTotal = Math.floor(rnd() * 40);
    const facts = {
      tier: pickOne(["core", "premium"]), plan: pickOne(["free", "core", "premium"]), createdAt: created, usedThisMonth: Math.floor(rnd() * 6),
      completedTotal, completedLast7d: Math.min(completedTotal, Math.floor(rnd() * 5)), firstCompletedAt: completedTotal ? new Date(now.getTime() - Math.floor(rnd() * 60) * DAY) : null,
      examAgeLast14d: rnd() < 0.3, lastActivityAt: completedTotal ? new Date(now.getTime() - Math.floor(rnd() * 60) * DAY) : null, sent,
    };
    for (const pick of [pickEmail(facts, now), pickPaidEmail(facts, now), pickSharedEmail(facts, now)]) {
      if (!pick) continue;
      picked++;
      assert.ok(VALID_KEYS.has(pick.key), `unknown key ${pick.key}`);
      assert.ok(pick.dedupeKey === pick.key || pick.dedupeKey.startsWith(pick.key + ":"), `dedupe key ${pick.dedupeKey} does not belong to ${pick.key}`);
      assert.ok(!Object.prototype.hasOwnProperty.call(sent, pick.dedupeKey), `${pick.dedupeKey} was already sent`);
      assert.ok(!isTransactional(pick.key), `${pick.key} is an account email and must only come from Stripe events`);
    }
  }
  assert.ok(picked > 500, `only ${picked} picks: the fuzz is not exercising the rules`);
});

test("fuzz: nobody gets an email within 20 hours of another, and inside 2 days only the limit notice may follow", () => {
  let limitSeen = 0;
  for (let i = 0; i < 3000; i++) {
    const now = randomDate();
    const hours = Math.floor(rnd() * 47);
    const last = new Date(now.getTime() - hours * 3600000);
    const facts = { tier: pickOne(["core", "premium"]), plan: "core", createdAt: new Date(now.getTime() - 200 * DAY), usedThisMonth: 3, completedTotal: 30, completedLast7d: 3, firstCompletedAt: new Date(now.getTime() - 3 * DAY), examAgeLast14d: true, lastActivityAt: new Date(now.getTime() - 30 * DAY), sent: { "free-welcome": last } };
    for (const p of [pickEmail(facts, now), pickPaidEmail(facts, now), pickSharedEmail(facts, now)]) {
      if (!p) continue;
      assert.ok(hours >= 20, `${p.key} was picked only ${hours} hours after the last email`);
      assert.equal(p.key, "free-limit", `${p.key} was picked inside the 2-day quiet gap`);
      limitSeen++;
    }
  }
  assert.ok(limitSeen > 100, "the essential limit notice is still allowed after 20 hours");
});

test("the year boundary works: a December limit email leads to a January reset email", () => {
  const jan = new Date("2027-01-03T22:00:00Z");
  const sent = { "free-limit:2026-12": new Date("2026-12-28T00:00:00Z") };
  const p = pickEmail({ createdAt: new Date("2026-06-01T00:00:00Z"), usedThisMonth: 0, completedTotal: 5, firstCompletedAt: new Date("2026-06-10T00:00:00Z"), completedLast7d: 0, sent }, jan);
  assert.equal(p.key, "free-reset");
  assert.equal(p.dedupeKey, "free-reset:2027-01");
});

// ------------------------------------------------------------------ the daily job against random accounts

function randomWorld(n) {
  const plans = ["free", "free", "core", "premium", "pro"];
  const profiles = Array.from({ length: n }, (_, i) => ({ id: `u${i}`, email: `u${i}@example.com`, plan: pickOne(plans), created_at: new Date(BASE + rnd() * 300 * DAY).toISOString() }));
  const submissions = [];
  profiles.forEach((p) => {
    const k = Math.floor(rnd() * 30);
    for (let j = 0; j < k; j++) submissions.push({ profile_id: p.id, child_id: `c${p.id}`, created_at: new Date(BASE + rnd() * 420 * DAY).toISOString(), kind: pickOne(["writing", "reading"]), tier: pickOne(["early", "elementary", "middle", "high"]), score: 3, total_questions: 4, word_count: 50 + Math.floor(rnd() * 200), feedback: {}, glow: pickOne(["A", "B", null]), grow: pickOne(["C", "D", null]) });
  });
  const prefs = profiles.filter(() => rnd() < 0.15).map((p) => ({ profile_id: p.id, marketing_opt_out: true, unsubscribe_token: "t" + p.id }));
  return { profiles, submissions, email_preferences: prefs, email_log: [], child_profiles: profiles.map((p) => ({ id: `c${p.id}`, profile_id: p.id, display_name: "Kid" })) };
}

test("fuzz: over 20 random days and 60 random accounts, nobody gets two emails a day, nobody gets the same email twice, and nobody who unsubscribed is emailed", async () => {
  for (let trial = 0; trial < 20; trial++) {
    const tables = randomWorld(60);
    const optedOut = new Set(tables.email_preferences.map((p) => p.profile_id));
    const now = new Date(BASE + (150 + trial * 3) * DAY + 22 * 3600000);
    const sent = [];
    const send = async (m) => { sent.push(m); return { id: "re" + sent.length }; };
    const s1 = await runFreeEmailJob({ supabase: fakeDb(tables), now, send, address: ADDRESS, dryRun: false, maxPerRun: 1000 });
    assert.equal(s1.errors, 0);
    const to = sent.map((m) => m.to);
    assert.equal(new Set(to).size, to.length, "two emails to one parent in one run");
    for (const m of sent) {
      const id = m.to.split("@")[0];
      assert.ok(!optedOut.has(id), `${id} unsubscribed but was emailed`);
      assert.ok(m.html.includes(ADDRESS), "postal address");
      assert.ok(m.subject && m.html.length > 1000);
    }
    const keys = tables.email_log.map((r) => `${r.profile_id}|${r.dedupe_key}`);
    assert.equal(new Set(keys).size, keys.length, "the same email logged twice");
    const again = await runFreeEmailJob({ supabase: fakeDb(tables), now, send, address: ADDRESS, dryRun: false, maxPerRun: 1000 });
    assert.equal(again.sent, 0, "running again the same day sends nothing");
  }
});

test("fuzz: a dry run over random accounts always predicts exactly what a live run then sends", async () => {
  for (let trial = 0; trial < 10; trial++) {
    const tables = randomWorld(40);
    const now = new Date(BASE + (200 + trial) * DAY + 22 * 3600000);
    const dry = await runFreeEmailJob({ supabase: fakeDb(tables), now, send: async () => ({ id: "x" }), address: ADDRESS, dryRun: true, maxPerRun: 1000 });
    const sent = [];
    const live = await runFreeEmailJob({ supabase: fakeDb(tables), now, send: async (m) => { sent.push(m); return { id: "y" }; }, address: ADDRESS, dryRun: false, maxPerRun: 1000 });
    assert.equal(live.sent, dry.eligible, "the dry run is honest");
    assert.deepEqual(live.plan, dry.plan);
  }
});

// ------------------------------------------------------------------ the Stripe webhook with a REAL signature

const Stripe = require("stripe");
const SECRET = "whsec_test_secret";
function signedReq(eventObj, secret = SECRET) {
  const payload = JSON.stringify(eventObj);
  const stripe = new Stripe("sk_test_dummy");
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const req = new EventEmitter();
  req.method = "POST";
  req.headers = { "stripe-signature": header };
  process.nextTick(() => { req.emit("data", Buffer.from(payload)); req.emit("end"); });
  return req;
}
function env(vars, fn) {
  const saved = {};
  for (const k of Object.keys(vars)) { saved[k] = process.env[k]; if (vars[k] == null) delete process.env[k]; else process.env[k] = vars[k]; }
  return Promise.resolve().then(fn).finally(() => { for (const k of Object.keys(vars)) { if (saved[k] == null) delete process.env[k]; else process.env[k] = saved[k]; } });
}

async function runRealSignature(eventObj, { secret = SECRET, plan = "premium" } = {}) {
  const updates = [];
  const mail = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => { mail.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ id: "re" }) }; };
  try {
    return await env({ STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_ID_CORE: "price_core", STRIPE_PRICE_ID_PREMIUM: "price_premium", EMAIL_LIVE: "true", RESEND_API_KEY: "k", EMAIL_POSTAL_ADDRESS: ADDRESS }, async () => {
      const real = new Stripe("sk_test_dummy");
      const h = loadHandler("stripe-webhook.js", {
        stripe: { webhooks: real.webhooks, subscriptions: { retrieve: async () => ({ id: "sub_1", customer: "cus_1", status: "active", items: { data: [{ price: { id: "price_core" } }] } }) } },
        db: (q) => {
          if (q.table === "profiles" && did(q, "update")) { updates.push(q.ops.find(([n]) => n === "update")[1]); return { data: null, error: null }; }
          if (q.table === "profiles") return { data: { id: "p1", email: "parent@example.com", plan }, error: null };
          if (q.table === "email_preferences" && !did(q, "upsert")) return { data: { unsubscribe_token: TOKEN }, error: null };
          if (q.table === "email_log" && did(q, "insert")) return { data: { id: "log1" }, error: null };
          return { data: null, count: 1, error: null };
        },
      });
      const res = fakeRes();
      await h(signedReq(eventObj, secret), res);
      return { res, updates, mail };
    });
  } finally { globalThis.fetch = realFetch; }
}
const subObj = (status, price = "price_premium", extra = {}) => ({ id: "sub_1", customer: "cus_1", status, items: { data: [{ price: { id: price } }] }, ...extra });

test("webhook with a real signature: a correctly signed event is accepted, a forged one is refused, and nothing is sent for a forgery", async () => {
  const good = await runRealSignature({ id: "evt_1", type: "customer.subscription.deleted", data: { object: subObj("canceled") } });
  assert.equal(good.res.statusCode, 200);
  assert.equal(good.updates[0].plan, "free");
  assert.equal(good.mail.length, 1);
  const forged = await runRealSignature({ id: "evt_2", type: "customer.subscription.deleted", data: { object: subObj("canceled") } }, { secret: "whsec_someone_else" });
  assert.equal(forged.res.statusCode, 400, "a bad signature is refused");
  assert.equal(forged.updates.length, 0, "a forged event changes nothing");
  assert.equal(forged.mail.length, 0, "and emails nobody");
});

test("no grace period: the moment a payment fails the plan drops to Free, and it comes back when the payment succeeds", async () => {
  const failed = await runRealSignature({ id: "evt_3", type: "customer.subscription.updated", data: { object: subObj("past_due", "price_core", { current_period_end: 1790000000 }), previous_attributes: { status: "active" } } }, { plan: "core" });
  assert.equal(failed.updates[0].plan, "free", "past due means Free straight away");
  assert.equal(failed.updates[0].stripe_subscription_id, null);
  assert.ok(failed.mail.some((m) => /couldn't take your LiteracyLab AI payment/.test(m.subject)), "and they are told");

  const paid = await runRealSignature({ id: "evt_4", type: "customer.subscription.updated", data: { object: subObj("active", "price_core"), previous_attributes: { status: "past_due" } } }, { plan: "free" });
  assert.equal(paid.updates[0].plan, "core", "paying again restores the plan automatically");
  assert.equal(paid.updates[0].stripe_subscription_id, "sub_1");
  assert.equal(paid.mail.length, 0, "no email for a recovery");
});

// ------------------------------------------------------------------ billing-session: no double subscriptions after a failed payment

function fakeStripe({ subs = [] } = {}) {
  const calls = [];
  return {
    calls,
    subscriptions: { list: async (args) => { calls.push(["list", args]); return { data: subs }; } },
    billingPortal: { sessions: { create: async (a) => { calls.push(["portal", a]); return { url: "https://billing.stripe.com/session/x" }; } } },
    checkout: { sessions: { create: async (a) => { calls.push(["checkout", a]); return { url: "https://checkout.stripe.com/c/x" }; } } },
    customers: { create: async () => ({ id: "cus_new" }) },
  };
}
async function billing({ plan, customer, subs, tier = "core" }) {
  const stripe = fakeStripe({ subs });
  return env({ SITE_URL: "https://www.literacylabai.com", STRIPE_PRICE_ID_CORE: "price_core", STRIPE_PRICE_ID_PREMIUM: "price_premium" }, async () => {
    const h = loadHandler("billing-session.js", { stripe, db: () => ({ data: { plan, stripe_customer_id: customer }, error: null }) });
    const out = { statusCode: 200, body: undefined, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    await h({ method: "POST", query: {}, headers: {}, body: { tier } }, out);
    return { out, calls: stripe.calls };
  });
}

test("billing: a parent on Free whose old subscription is past due is sent to fix their card, not to start a second subscription", async () => {
  for (const status of ["past_due", "unpaid"]) {
    const { out, calls } = await billing({ plan: "free", customer: "cus_1", subs: [{ id: "sub_1", status }] });
    assert.match(out.body.url, /billing\.stripe\.com/, status);
    assert.ok(!calls.some(([k]) => k === "checkout"), "no second checkout");
  }
});

test("billing: a Free parent with no failing subscription, or no Stripe customer yet, still goes to checkout", async () => {
  const a = await billing({ plan: "free", customer: "cus_1", subs: [{ id: "sub_0", status: "canceled" }] });
  assert.match(a.out.body.url, /checkout\.stripe\.com/);
  const b = await billing({ plan: "free", customer: null, subs: [] });
  assert.match(b.out.body.url, /checkout\.stripe\.com/);
  assert.ok(!b.calls.some(([k]) => k === "list"), "no Stripe lookup when there is no customer");
  const c = await billing({ plan: "core", customer: "cus_1", subs: [] });
  assert.match(c.out.body.url, /billing\.stripe\.com/, "a paying customer still goes to the portal");
});
