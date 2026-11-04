const test = require("node:test");
const assert = require("node:assert/strict");
const { AMOUNTS, LOCAL_AMOUNTS, SYMBOLS, currencyForTimeZone, priceLabel } = require("../pricing");

// pricing.js has to guess the currency Stripe will charge. Stripe charges
// the customer's local currency if the price has it, and USD otherwise, so
// every case below mirrors that rule. A wrong guess never changes the
// amount (it's 9.99 / 15.99 everywhere), but it would show a parent the
// wrong symbol right before checkout. (Where a currency has its own amount, a
// wrong guess shows the wrong amount too, which is why Stripe shows the exact
// price again at checkout.)

test("US$, A$, £, €, C$ and S$ use the same two numbers; NZ, Hong Kong, South Africa and India have their own", () => {
  assert.equal(AMOUNTS.core, "9.99");
  assert.equal(AMOUNTS.premium, "15.99");
  assert.deepEqual(Object.keys(SYMBOLS).sort(), ["AUD", "CAD", "EUR", "GBP", "HKD", "INR", "NZD", "SGD", "USD", "ZAR"]);
  assert.deepEqual(Object.keys(LOCAL_AMOUNTS).sort(), ["HKD", "INR", "NZD", "ZAR"]);
  for (const [cur, a] of Object.entries(LOCAL_AMOUNTS)) {
    assert.ok(Number(a.premium) > Number(a.core), cur + ": Premium costs more than Core");
    assert.ok(Number(a.premium) < 2 * Number(a.core), cur + ": Premium is cheaper than two Cores");
  }
});

test("each priced market gets its own currency", () => {
  assert.equal(currencyForTimeZone("Australia/Sydney"), "AUD");
  assert.equal(currencyForTimeZone("Australia/Perth"), "AUD");
  assert.equal(currencyForTimeZone("Europe/London"), "GBP");
  assert.equal(currencyForTimeZone("Asia/Singapore"), "SGD");
  assert.equal(currencyForTimeZone("America/Toronto"), "CAD");
  assert.equal(currencyForTimeZone("America/Vancouver"), "CAD");
  assert.equal(currencyForTimeZone("Europe/Paris"), "EUR");
  assert.equal(currencyForTimeZone("Europe/Dublin"), "EUR");
  assert.equal(currencyForTimeZone("America/New_York"), "USD");
  assert.equal(currencyForTimeZone("Pacific/Auckland"), "NZD");
  assert.equal(currencyForTimeZone("Pacific/Chatham"), "NZD");
  assert.equal(currencyForTimeZone("Asia/Hong_Kong"), "HKD");
  assert.equal(currencyForTimeZone("Africa/Johannesburg"), "ZAR");
  assert.equal(currencyForTimeZone("Asia/Kolkata"), "INR");
  assert.equal(currencyForTimeZone("Asia/Calcutta"), "INR");
});

test("UAE and GCC pay in US$, as decided", () => {
  assert.equal(currencyForTimeZone("Asia/Dubai"), "USD");
  assert.equal(currencyForTimeZone("Asia/Riyadh"), "USD");
  assert.equal(currencyForTimeZone("Asia/Qatar"), "USD");
});

test("any unlisted country falls back to US$, matching Stripe's fallback", () => {
  for (const tz of ["Asia/Kuala_Lumpur", "Africa/Lagos", "Africa/Nairobi", "America/Sao_Paulo"]) {
    assert.equal(currencyForTimeZone(tz), "USD", tz);
  }
});

test("non-euro European countries are not shown euros", () => {
  // Stripe's local currency there (PLN, SEK, CHF...) isn't one we price in,
  // so Stripe falls back to USD. Showing € would promise a currency Stripe
  // won't charge.
  for (const tz of ["Europe/Warsaw", "Europe/Stockholm", "Europe/Zurich", "Europe/Prague", "Europe/Oslo"]) {
    assert.equal(currencyForTimeZone(tz), "USD", tz);
  }
});

test("US time zones are not mistaken for Canada, and vice versa", () => {
  assert.equal(currencyForTimeZone("America/Chicago"), "USD");
  assert.equal(currencyForTimeZone("America/Los_Angeles"), "USD");
  assert.equal(currencyForTimeZone("America/Halifax"), "CAD");
  assert.equal(currencyForTimeZone("America/St_Johns"), "CAD");
});

test("a missing or unreadable time zone falls back to US$ rather than crashing", () => {
  assert.equal(currencyForTimeZone(""), "USD");
  assert.equal(currencyForTimeZone(undefined), "USD");
});

test("labels combine the symbol with the shared amount", () => {
  assert.equal(priceLabel("core", "AUD"), "A$9.99");
  assert.equal(priceLabel("premium", "GBP"), "£15.99");
  assert.equal(priceLabel("core", "USD"), "US$9.99");
  assert.equal(priceLabel("premium", "EUR"), "€15.99");
});

test("labels for the currencies with their own amounts use those amounts", () => {
  assert.equal(priceLabel("core", "NZD"), "NZ$12.99");
  assert.equal(priceLabel("premium", "NZD"), "NZ$19.99");
  assert.equal(priceLabel("core", "HKD"), "HK$59");
  assert.equal(priceLabel("premium", "HKD"), "HK$89");
  assert.equal(priceLabel("core", "ZAR"), "R109");
  assert.equal(priceLabel("premium", "ZAR"), "R179");
  assert.equal(priceLabel("core", "INR"), "₹499");
  assert.equal(priceLabel("premium", "INR"), "₹799");
});

// ------------------------------------------------------------------ claims the site makes about its own prices

const fs = require("node:fs");
const path = require("node:path");
const INDEX = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const APP = fs.readFileSync(path.join(__dirname, "..", "app.html"), "utf8");

test("the homepage claim 'Two children? Cheaper than two Cores' is true at the current prices", () => {
  assert.ok(INDEX.includes("Cheaper than two Cores"), "the claim is on the page");
  assert.ok(Number(AMOUNTS.premium) < 2 * Number(AMOUNTS.core), `Premium ${AMOUNTS.premium} must cost less than two Cores (${(2 * Number(AMOUNTS.core)).toFixed(2)})`);
});

test("the homepage and the app show both current prices and never the old Premium price", () => {
  for (const [name, text] of [["index.html", INDEX], ["app.html", APP]]) {
    assert.ok(!text.includes("19.99"), name + " still shows the old Premium price 19.99");
    assert.ok(text.includes(AMOUNTS.premium) && text.includes(AMOUNTS.core), name + " shows both current prices");
  }
});
