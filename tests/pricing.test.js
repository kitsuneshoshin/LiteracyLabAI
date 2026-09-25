const test = require("node:test");
const assert = require("node:assert/strict");
const { AMOUNTS, SYMBOLS, currencyForTimeZone, priceLabel } = require("../pricing");

// pricing.js has to guess the currency Stripe will charge. Stripe charges
// the customer's local currency if the price has it, and USD otherwise, so
// every case below mirrors that rule. A wrong guess never changes the
// amount (it's 9.99 / 19.99 everywhere), but it would show a parent the
// wrong symbol right before checkout.

test("every currency uses the same two numbers", () => {
  assert.equal(AMOUNTS.core, "9.99");
  assert.equal(AMOUNTS.premium, "19.99");
  assert.deepEqual(Object.keys(SYMBOLS).sort(), ["AUD", "CAD", "EUR", "GBP", "SGD", "USD"]);
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
});

test("UAE and GCC pay in US$, as decided", () => {
  assert.equal(currencyForTimeZone("Asia/Dubai"), "USD");
  assert.equal(currencyForTimeZone("Asia/Riyadh"), "USD");
  assert.equal(currencyForTimeZone("Asia/Qatar"), "USD");
});

test("any unlisted country falls back to US$, matching Stripe's fallback", () => {
  for (const tz of ["Asia/Kolkata", "Asia/Kuala_Lumpur", "Pacific/Auckland", "Africa/Lagos", "America/Sao_Paulo"]) {
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
  assert.equal(priceLabel("premium", "GBP"), "£19.99");
  assert.equal(priceLabel("core", "USD"), "US$9.99");
  assert.equal(priceLabel("premium", "EUR"), "€19.99");
});
