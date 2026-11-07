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

  // Custom events. Only ever pass non-personal values (a plan name, a kind of
  // exercise) - never names, emails, or anything a learner wrote.
  window.llTrack = function (name, params) {
    try { gtag("event", name, params || {}); } catch (e) {}
  };

  // Every link into the app from the marketing pages counts as a CTA click.
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/^\/?app\.html/.test(href)) {
      window.llTrack("cta_click", { cta_text: (a.textContent || "").trim().slice(0, 40), page: location.pathname });
    }
  });

  if (saved) return; // already answered - no banner

  var BANNER_TEXT = {
    en: { label: "Cookie consent", text: "We use cookies to understand site traffic. You can accept or decline analytics cookies.", decline: "Decline", accept: "Accept" },
    pl: { label: "Zgoda na pliki cookie", text: "Używamy plików cookie, aby rozumieć ruch na stronie. Możesz zaakceptować lub odrzucić analityczne pliki cookie.", decline: "Odrzuć", accept: "Akceptuję" },
    es: { label: "Consentimiento de cookies", text: "Usamos cookies para entender el tráfico del sitio. Puedes aceptar o rechazar las cookies de análisis.", decline: "Rechazar", accept: "Aceptar" },
    pt: { label: "Consentimento de cookies", text: "Usamos cookies para entender o tráfego do site. Você pode aceitar ou recusar os cookies de análise.", decline: "Recusar", accept: "Aceitar" },
    ro: { label: "Acord pentru cookie-uri", text: "Folosim cookie-uri pentru a înțelege traficul de pe site. Poți accepta sau refuza cookie-urile de analiză.", decline: "Refuz", accept: "Accept" },
    ar: { dir: "rtl", label: "الموافقة على ملفات تعريف الارتباط", text: "نستخدم ملفات تعريف الارتباط (الكوكيز) لفهم حركة الزيارات إلى الموقع. يمكنك قبول ملفات التحليلات أو رفضها.", decline: "رفض", accept: "قبول" },
    ur: { dir: "rtl", label: "کوکیز کی رضامندی", text: "ہم سائٹ کے ٹریفک کو سمجھنے کے لیے کوکیز استعمال کرتے ہیں۔ آپ اینالیٹکس کوکیز قبول یا مسترد کر سکتے ہیں۔", decline: "مسترد کریں", accept: "قبول کریں" },
    hi: { label: "कुकी सहमति", text: "हम साइट ट्रैफ़िक को समझने के लिए कुकीज़ का उपयोग करते हैं। आप एनालिटिक्स कुकीज़ स्वीकार या अस्वीकार कर सकते हैं।", decline: "अस्वीकार करें", accept: "स्वीकार करें" },
    zh: { label: "Cookie 同意", text: "我们使用 Cookie 来了解网站流量。你可以接受或拒绝分析类 Cookie。", decline: "拒绝", accept: "接受" }
  };

  function showBanner() {
    var bar = document.createElement("div");
    bar.setAttribute("role", "dialog");
    // The banner speaks the page's language (the translated copies of the site set <html lang>).
    var code = String((document.documentElement && document.documentElement.lang) || "").slice(0, 2).toLowerCase();
    var T = BANNER_TEXT[code] || BANNER_TEXT.en;
    bar.setAttribute("aria-label", T.label);
    if (T.dir) bar.setAttribute("dir", T.dir);
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#1a1a1a;color:#fff;"
      + "padding:14px 16px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;"
      + "font:14px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";
    bar.innerHTML =
      '<span style="max-width:520px">' + T.text + '</span>'
      + '<span style="display:flex;gap:8px">'
      + '<button type="button" id="ll-cookie-decline" style="background:transparent;color:#fff;border:1px solid #666;'
      + 'border-radius:6px;padding:12px 18px;cursor:pointer;font:inherit">' + T.decline + '</button>'
      + '<button type="button" id="ll-cookie-accept" style="background:#fff;color:#1a1a1a;border:none;'
      + 'border-radius:6px;padding:12px 18px;cursor:pointer;font:inherit;font-weight:600">' + T.accept + '</button>'
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
