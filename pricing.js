// The one place prices are defined for display. Loaded by both index.html
// and app.html so the landing page and the in-app upgrade card can never
// quote different numbers.
//
// US$, A$, £, €, C$ and S$ deliberately use the same number (9.99 / 15.99).
// New Zealand, Hong Kong, South Africa and India have their own amounts below,
// because the same number would be worth far too little there (9.99 rupees is
// about 12 US cents). What a customer is actually CHARGED is decided by
// Stripe, not by this file:
// each Stripe Price carries one amount per currency below, with USD as the
// price's default. At checkout Stripe charges the customer's local currency
// if the price has it, and falls back to USD otherwise. That fallback is
// how UAE/GCC and every unlisted country end up paying in US$.
//
// So this file only has to pick the currency Stripe will pick. Stripe
// decides from the customer's IP address, which a static page can't see;
// the browser's time zone is the closest signal available and agrees with
// it for nearly everyone. A rare mismatch (a VPN, or someone travelling)
// shows the wrong symbol and amount on the page, and Stripe's checkout page
// always shows the exact currency and amount before anyone pays.
(function (global) {
  var AMOUNTS = { core: "9.99", premium: "15.99" };

  // Currencies that have their own amounts. These must match the amounts on the
  // Stripe prices (currency options), which tests/pricing.test.js cannot see.
  var LOCAL_AMOUNTS = {
    NZD: { core: "12.99", premium: "19.99" },
    HKD: { core: "59", premium: "89" },
    ZAR: { core: "109", premium: "179" },
    INR: { core: "499", premium: "799" }
  };

  var SYMBOLS = { USD: "US$", AUD: "A$", GBP: "£", EUR: "€", CAD: "C$", SGD: "S$", NZD: "NZ$", HKD: "HK$", ZAR: "R", INR: "₹" };

  var UK = ["Europe/London", "Europe/Belfast", "Europe/Guernsey", "Europe/Jersey", "Europe/Isle_of_Man", "GB"];

  var NEW_ZEALAND = ["Pacific/Auckland", "Pacific/Chatham", "NZ", "NZ-CHAT"];
  var HONG_KONG = ["Asia/Hong_Kong", "Hongkong"];
  var SOUTH_AFRICA = ["Africa/Johannesburg"];
  var INDIA = ["Asia/Kolkata", "Asia/Calcutta"];

  var CANADA_PREFIX = "Canada/";
  var CANADA = [
    "America/Toronto", "America/Montreal", "America/Vancouver", "America/Edmonton", "America/Winnipeg",
    "America/Regina", "America/Swift_Current", "America/Halifax", "America/Glace_Bay", "America/Moncton",
    "America/Goose_Bay", "America/St_Johns", "America/Whitehorse", "America/Dawson", "America/Dawson_Creek",
    "America/Fort_Nelson", "America/Creston", "America/Iqaluit", "America/Pangnirtung", "America/Rankin_Inlet",
    "America/Resolute", "America/Cambridge_Bay", "America/Inuvik", "America/Yellowknife", "America/Atikokan",
    "America/Coral_Harbour", "America/Blanc-Sablon", "America/Nipigon", "America/Thunder_Bay", "America/Rainy_River"
  ];

  // Countries whose own currency is the euro. Non-euro EU members (Poland,
  // Sweden, Czechia and so on) are deliberately absent: Stripe's local
  // currency there isn't one we price in, so it falls back to USD, and this
  // list has to agree with that. Bulgaria adopted the euro in January 2026.
  var EUROZONE = [
    "Europe/Amsterdam", "Europe/Andorra", "Europe/Athens", "Europe/Berlin", "Europe/Bratislava",
    "Europe/Brussels", "Europe/Busingen", "Europe/Dublin", "Europe/Helsinki", "Europe/Lisbon",
    "Europe/Ljubljana", "Europe/Luxembourg", "Europe/Madrid", "Europe/Malta", "Europe/Mariehamn",
    "Europe/Monaco", "Europe/Nicosia", "Europe/Paris", "Europe/Riga", "Europe/Rome", "Europe/San_Marino",
    "Europe/Sofia", "Europe/Tallinn", "Europe/Vatican", "Europe/Vienna", "Europe/Vilnius", "Europe/Zagreb",
    "Asia/Nicosia", "Asia/Famagusta", "Atlantic/Canary", "Atlantic/Madeira", "Atlantic/Azores", "Africa/Ceuta"
  ];

  function currencyForTimeZone(tz) {
    tz = tz || "";
    if (tz.indexOf("Australia/") === 0) return "AUD";
    if (UK.indexOf(tz) !== -1) return "GBP";
    if (tz === "Asia/Singapore" || tz === "Singapore") return "SGD";
    if (tz.indexOf(CANADA_PREFIX) === 0 || CANADA.indexOf(tz) !== -1) return "CAD";
    if (NEW_ZEALAND.indexOf(tz) !== -1) return "NZD";
    if (HONG_KONG.indexOf(tz) !== -1) return "HKD";
    if (SOUTH_AFRICA.indexOf(tz) !== -1) return "ZAR";
    if (INDIA.indexOf(tz) !== -1) return "INR";
    if (EUROZONE.indexOf(tz) !== -1) return "EUR";
    return "USD";
  }

  function detectCurrency() {
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* very old browser: USD */ }
    return currencyForTimeZone(tz);
  }

  function amountFor(tier, currency) {
    return (LOCAL_AMOUNTS[currency] || AMOUNTS)[tier];
  }

  function priceLabel(tier, currency) {
    currency = currency || detectCurrency();
    return SYMBOLS[currency] + amountFor(tier, currency);
  }

  var api = { AMOUNTS: AMOUNTS, LOCAL_AMOUNTS: LOCAL_AMOUNTS, SYMBOLS: SYMBOLS, amountFor: amountFor, currencyForTimeZone: currencyForTimeZone, detectCurrency: detectCurrency, priceLabel: priceLabel };
  if (typeof module !== "undefined" && module.exports) module.exports = api; // for the test suite
  else global.LL_PRICING = api;
})(typeof window !== "undefined" ? window : this);
