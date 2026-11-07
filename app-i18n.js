/* Translates the app's own interface text (buttons, labels, messages) into the family's language.
 *
 * The app's text is written in English inside its code. Rather than rewrite every line, this file translates what is on screen:
 * it looks each piece of text up in a dictionary (app-i18n/<code>.json) and swaps in the translation, and keeps doing so as the
 * app re-draws. Only the text a person sees changes: the app's data, the values it stores and the logic that reads them are
 * untouched, and anything not in the dictionary (curriculum names, example prompts, what a learner writes) stays as it is.
 *
 * A dictionary entry is "English text": "Translation". Text with a changing part uses {0}, {1}: "Hello, {0}": "Cześć, {0}".
 * A translation can also be an object with one form per plural category ({ "one": ..., "few": ..., "many": ..., "other": ... }),
 * chosen by the first {n} when it is a number.
 *
 * Which language: ?lang=pl in the address (remembered), else the choice remembered in this browser, else English.
 * Adding a language: add its code to LANGUAGES below and put its dictionary in app-i18n/<code>.json.
 */
(function (root) {
  "use strict";

  // Languages that have a dictionary. Native names are what the switcher shows.
  var LANGUAGES = [
    { code: "en", native: "English" },
    { code: "pl", native: "Polski" },
    { code: "es", native: "Español" },
    { code: "pt", native: "Português" },
    { code: "ro", native: "Română" },
    // Scripts the app's own fonts do not cover load a web font (and have letter-spacing and capitals switched off, as joined or
    // unicase scripts do not use them) only when chosen.
    { code: "hi", native: "हिन्दी", fonts: "Noto+Sans+Devanagari:wght@400;500;600;700", family: '"Noto Sans Devanagari"' },
    { code: "pa", native: "ਪੰਜਾਬੀ", fonts: "Noto+Sans+Gurmukhi:wght@400;500;600;700", family: '"Noto Sans Gurmukhi"' },
    { code: "bn", native: "বাংলা", fonts: "Noto+Sans+Bengali:wght@400;500;600;700", family: '"Noto Sans Bengali"' },
    // rtl: reads right to left; the page is flipped (dir="rtl") and app-rtl.css loads. Urdu is set in Naskh here (not the Nastaliq of
    // the homepage): Nastaliq's tall letters need line heights the app's compact controls do not have.
    { code: "ar", native: "العربية", rtl: true, fonts: "Noto+Naskh+Arabic:wght@400;500;600;700", family: '"Noto Naskh Arabic"' },
    { code: "ur", native: "اردو", rtl: true, fonts: "Noto+Naskh+Arabic:wght@400;500;600;700", family: '"Noto Naskh Arabic"' },
    { code: "zh", native: "中文", fonts: "Noto+Sans+SC:wght@400;500;700", family: '"Noto Sans SC", "PingFang SC", "Microsoft YaHei"' },
  ];
  // Bump when a dictionary changes, so browsers fetch the new one.
  var DICT_VERSION = 8;
  var STORE_KEY = "ll_ui_lang";
  var ATTRS = ["title", "placeholder", "aria-label", "alt"];

  // ---------------------------------------------------------------- the lookup (pure; tested in Node)
  function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // Turns the dictionary into { exact, patterns }. A key with {0} becomes a pattern that captures the changing parts:
  // {0} matches any text, {n0} matches only a number (so "{n0} / {n1} words" cannot swallow other words).
  function compile(entries) {
    var exact = Object.create(null), patterns = [];
    Object.keys(entries || {}).forEach(function (key) {
      var k = norm(key);
      if (/\{n?\d\}/.test(k)) {
        var order = [];
        var src = k.split(/(\{n?\d\})/).map(function (part) {
          var ph = /^\{(n?)(\d)\}$/.exec(part);
          if (!ph) return escapeRe(part);
          order.push(Number(ph[2]));
          return ph[1] ? "(\\d[\\d.,]*)" : "([\\s\\S]+?)";
        }).join("");
        patterns.push({ re: new RegExp("^" + src + "$"), order: order, value: entries[key], literal: k.replace(/\{n?\d\}/g, "").length });
      } else {
        exact[k] = entries[key];
      }
    });
    // The most specific pattern (the most fixed text) is tried first.
    patterns.sort(function (a, b) { return b.literal - a.literal; });
    return { exact: exact, patterns: patterns };
  }

  function fill(template, args) {
    return template.replace(/\{n?(\d)\}/g, function (m, i) { return args[i] !== undefined ? args[i] : m; });
  }

  function pick(value, args, rules) {
    if (typeof value === "string") return fill(value, args);
    if (value && typeof value === "object") {
      var n = parseFloat(args[0]);
      var cat = !isNaN(n) && rules ? rules.select(n) : "other";
      return fill(value[cat] || value.other || "", args);
    }
    return null;
  }

  // Translation of one piece of text, or null when the dictionary has none. Spaces around the text are kept as they were.
  function translate(compiled, text, rules) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(String(text));
    var core = norm(m[2]);
    if (!core || !/[A-Za-z]/.test(core)) return null;
    var out = null;
    if (core in compiled.exact) out = pick(compiled.exact[core], [], rules);
    else {
      for (var i = 0; i < compiled.patterns.length; i++) {
        var hit = compiled.patterns[i].re.exec(core);
        if (hit) {
          var args = [];
          // A changing part that is itself translatable (an age level, a country) is translated too.
          compiled.patterns[i].order.forEach(function (idx, g) {
            var a = hit[g + 1], k = norm(a);
            args[idx] = k in compiled.exact && typeof compiled.exact[k] === "string" ? compiled.exact[k] : a;
          });
          out = pick(compiled.patterns[i].value, args, rules);
          break;
        }
      }
    }
    return out === null || out === "" ? null : m[1] + out + m[3];
  }

  var core = { norm: norm, compile: compile, translate: translate, LANGUAGES: LANGUAGES };
  if (typeof module !== "undefined" && module.exports) { module.exports = core; return; }

  // ---------------------------------------------------------------- the page (browser only)
  var doc = root.document;
  var lang = "en", compiled = null, rules = null;
  var textRec = new WeakMap(), attrRec = new WeakMap();
  var missing = Object.create(null);
  var debug = /[?&]i18n=debug\b/.test(root.location.search);

  function storedLang() { try { return root.localStorage.getItem(STORE_KEY) || ""; } catch (e) { return ""; } }
  function remember(code) { try { root.localStorage.setItem(STORE_KEY, code); } catch (e) { /* private window: this visit only */ } }
  function known(code) { return LANGUAGES.some(function (l) { return l.code === code; }); }

  function chooseLanguage() {
    var m = /[?&]lang=([a-z]{2})(&|$)/i.exec(root.location.search);
    if (m && known(m[1].toLowerCase())) { remember(m[1].toLowerCase()); return m[1].toLowerCase(); }
    var s = storedLang();
    return known(s) ? s : "en";
  }

  function skipped(node) {
    for (var el = node.nodeType === 1 ? node : node.parentNode; el && el.nodeType === 1; el = el.parentNode) {
      var tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "NOSCRIPT" || tag === "CODE") return true;
      if (el.hasAttribute && el.hasAttribute("data-no-i18n")) return true;
    }
    return false;
  }

  // The English a text node holds: what we remembered if the app has not changed it since we wrote our translation, else what it says now.
  function originalOf(n) {
    var rec = textRec.get(n);
    return rec && rec.out === n.nodeValue ? rec.orig : n.nodeValue;
  }

  // The app draws "{count} words" as two pieces of text (the number, then " words") next to each other. When an element holds
  // several pieces of text, they are read together as one sentence: the whole translation goes in the first piece and the rest
  // are emptied (and put back together again if the app changes any of them).
  function doGroup(parent) {
    var nodes = [];
    for (var c = parent.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) nodes.push(c);
    if (nodes.length < 2) return false;
    var origs = nodes.map(originalOf), joined = origs.join("");
    var out = translate(compiled, joined, rules);
    if (out === null) {
      // For finding what to translate: a sentence the app builds from pieces is reported whole (when its pieces are all short).
      if (debug && /[A-Za-z]{3}/.test(joined) && !/^\s*$/.test(joined) && !(joined in compiled.exact)) missing["§ " + norm(joined)] = 1;
      return false;
    }
    for (var i = 0; i < nodes.length; i++) {
      var want = i === 0 ? out : "";
      textRec.set(nodes[i], { orig: origs[i], out: want });
      if (nodes[i].nodeValue !== want) nodes[i].nodeValue = want;
    }
    return true;
  }

  function doText(n) {
    if (skipped(n)) return;
    if (n.parentNode && n.parentNode.nodeType === 1 && doGroup(n.parentNode)) return;
    var cur = n.nodeValue, rec = textRec.get(n);
    var orig = rec && rec.out === cur ? rec.orig : cur;
    var out = translate(compiled, orig, rules);
    if (out === null) { textRec.delete(n); if (debug && /[A-Za-z]{2}/.test(orig)) missing[norm(orig)] = 1; return; }
    if (out !== cur) { textRec.set(n, { orig: orig, out: out }); n.nodeValue = out; } else textRec.set(n, { orig: orig, out: out });
  }

  function doAttrs(el) {
    if (!el.getAttribute || skipped(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], cur = el.getAttribute(a);
      if (cur === null) continue;
      var rec = attrRec.get(el) || {}, r = rec[a];
      var orig = r && r.out === cur ? r.orig : cur;
      var out = translate(compiled, orig, rules);
      if (out === null) { if (debug && /[A-Za-z]{2}/.test(orig)) missing["@" + norm(orig)] = 1; continue; }
      rec[a] = { orig: orig, out: out }; attrRec.set(el, rec);
      if (out !== cur) el.setAttribute(a, out);
    }
  }

  function walk(root_) {
    if (root_.nodeType === 3) return doText(root_);
    if (root_.nodeType !== 1) return;
    doAttrs(root_);
    var w = doc.createTreeWalker(root_, 1 | 4), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }

  function start() {
    walk(doc.body);
    new root.MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doAttrs(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    }).observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function switcher() {
    var sel = doc.createElement("select");
    sel.setAttribute("data-no-i18n", "");
    sel.setAttribute("aria-label", "Language");
    sel.style.cssText = "position:fixed;inset-inline-end:12px;bottom:12px;z-index:60;font:600 12px/1 system-ui,sans-serif;padding:8px 10px;border-radius:999px;border:1px solid rgba(0,0,0,.25);background:var(--surface,#fff);color:var(--ink,#222);cursor:pointer;opacity:.92";
    LANGUAGES.forEach(function (l) { var o = doc.createElement("option"); o.value = l.code; o.textContent = l.native; if (l.code === lang) o.selected = true; sel.appendChild(o); });
    sel.addEventListener("change", function () { api.set(sel.value); });
    doc.body.appendChild(sel);
  }

  var api = {
    language: function () { return lang; },
    // Changes the language for this browser and redraws the app in it.
    set: function (code) { if (!known(code)) return; remember(code); root.location.reload(); },
    // Remembers a choice for the next visit without redrawing now (the sign-up form uses it so no typing is lost).
    remember: function (code) { if (known(code)) remember(code); },
    // The account's own language, once someone is signed in: used when this browser has no choice yet.
    accountLanguage: function (code) {
      if (!code || !known(code) || storedLang()) return;
      try { if (root.sessionStorage.getItem("ll_ui_lang_tried")) return; root.sessionStorage.setItem("ll_ui_lang_tried", "1"); } catch (e) { return; }
      api.set(code);
    },
    missing: function () { return Object.keys(missing); },
    available: LANGUAGES,
  };
  root.LLI18N = api;

  lang = chooseLanguage();
  doc.documentElement.setAttribute("data-ui-lang", lang);
  function boot() {
    switcher();
    if (lang === "en") return;
    doc.documentElement.setAttribute("lang", lang);
    var info = LANGUAGES.filter(function (l) { return l.code === lang; })[0];
    if (info && info.fonts) {
      var link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=" + info.fonts + "&display=swap";
      doc.head.appendChild(link);
      var style = doc.createElement("style");
      style.textContent = 'html[data-ui-lang="' + lang + '"] * { font-family: ' + info.family + ', system-ui, sans-serif !important; letter-spacing: 0 !important; text-transform: none !important; }';
      doc.head.appendChild(style);
    }
    if (info && info.rtl) {
      doc.documentElement.setAttribute("dir", "rtl");
      var rtl = doc.createElement("link");
      rtl.rel = "stylesheet";
      rtl.href = "app-rtl.css?v=" + DICT_VERSION;
      doc.head.appendChild(rtl);
    }
    fetch("app-i18n/" + lang + ".json?v=" + DICT_VERSION).then(function (r) { return r.json(); }).then(function (d) {
      compiled = compile(d.strings || d);
      try { rules = new Intl.PluralRules(lang); } catch (e) { rules = null; }
      start();
    }).catch(function () { /* no dictionary: the app simply stays in English */ });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : this);
