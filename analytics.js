// Google Analytics (GA4), loaded on every page. Consent Mode starts with
// analytics_storage denied - no tracking cookie is set until a visitor
// clicks "Accept" on the banner below, so this doesn't run afoul of
// UK/EU cookie-consent rules. The choice is remembered in localStorage so
// returning visitors who already answered don't see the banner again.
(function () {
  var GA_ID = "G-GHG6VSTPSG";
  var CONSENT_KEY = "ll_cookie_consent"; // "granted" | "denied"

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  var saved = null;
  try { saved = localStorage.getItem(CONSENT_KEY); } catch (e) {}
  if (saved === "granted") {
    gtag("consent", "update", { analytics_storage: "granted" });
  }

  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", GA_ID);

  if (saved) return; // already answered - no banner

  function showBanner() {
    var bar = document.createElement("div");
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Cookie consent");
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#1a1a1a;color:#fff;"
      + "padding:14px 16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;"
      + "font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
    bar.innerHTML =
      '<span style="max-width:520px">We use cookies to understand site traffic. '
      + 'You can accept or decline analytics cookies.</span>'
      + '<span style="display:flex;gap:8px">'
      + '<button type="button" id="ll-cookie-decline" style="background:transparent;color:#fff;border:1px solid #666;'
      + 'border-radius:6px;padding:7px 14px;cursor:pointer;font:inherit">Decline</button>'
      + '<button type="button" id="ll-cookie-accept" style="background:#fff;color:#1a1a1a;border:none;'
      + 'border-radius:6px;padding:7px 14px;cursor:pointer;font:inherit;font-weight:600">Accept</button>'
      + '</span>';
    document.body.appendChild(bar);

    function answer(choice) {
      try { localStorage.setItem(CONSENT_KEY, choice); } catch (e) {}
      if (choice === "granted") gtag("consent", "update", { analytics_storage: "granted" });
      bar.remove();
    }
    document.getElementById("ll-cookie-accept").addEventListener("click", function () { answer("granted"); });
    document.getElementById("ll-cookie-decline").addEventListener("click", function () { answer("denied"); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showBanner);
  } else {
    showBanner();
  }
})();
