// Finds every piece of reader-facing text in a page, and swaps in a translation for each. Used to build the translated
// copies of the site (scripts/build-localised.js) from the one English source, so the structure is never copied by hand and a
// sentence added to the English page shows up as "not yet translated" instead of silently staying English.
//
// A "unit" is one string a reader sees: the inside of a paragraph, heading, button or link (kept as HTML, so <em> and
// <strong> travel with it), or the value of a text attribute such as alt, title, placeholder or a meta description.

const VOID = new Set(["meta", "link", "img", "br", "hr", "input", "source", "area", "base", "col", "embed", "track", "wbr", "path", "circle", "line", "rect", "stop", "use"]);
// Tags that can sit inside a sentence. An element whose contents are only these is translated as one piece.
const INLINE = new Set(["a", "em", "strong", "b", "i", "span", "br", "small", "code", "sup", "sub", "mark", "abbr", "u", "tspan", "text", "time", "kbd", "s", "wbr"]);
const SKIP_TEXT = new Set(["script", "style", "noscript"]);
const TEXT_ATTRS = new Set(["alt", "title", "placeholder", "aria-label", "data-parent", "data-learner", "data-label", "aria-description"]);
const META_KEYS = new Set(["description", "og:title", "og:description", "og:image:alt", "twitter:title", "twitter:description", "twitter:image:alt", "og:site_name"]);

const hasLetters = (s) => /\p{L}/u.test(s.replace(/<[^>]*>/g, "").replace(/&[#\w]+;/g, ""));
const collapse = (s) => s.replace(/\s+/g, " ").trim();

function parse(html) {
  const root = { tag: "#root", children: [], start: 0, openEnd: 0, closeStart: html.length, end: html.length, attrs: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[0].startsWith("<!--")) continue;
    if (m[1]) { // script or style: kept whole, never descended into
      const open = /^<[^>]*>/.exec(m[0])[0];
      top.children.push({ tag: m[1].toLowerCase(), start: m.index, openEnd: m.index + open.length, closeStart: m.index + m[0].lastIndexOf("</"), end: m.index + m[0].length, attrs: parseAttrs(open), children: [], raw: true });
      continue;
    }
    if (m[2]) { // closing tag
      const name = m[2].toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === name) { stack[i].closeStart = m.index; stack[i].end = m.index + m[0].length; stack.length = i; break; }
      }
      continue;
    }
    const name = m[3].toLowerCase();
    const el = { tag: name, start: m.index, openEnd: m.index + m[0].length, closeStart: -1, end: -1, attrs: parseAttrs(m[0]), children: [] };
    top.children.push(el);
    if (!VOID.has(name) && !/\/\s*>$/.test(m[0])) stack.push(el);
    else { el.closeStart = el.end = el.openEnd; }
  }
  return root;
}

function parseAttrs(openTag) {
  const attrs = [];
  const re = /\s([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(openTag))) {
    const value = m[3] !== undefined ? m[3] : m[4];
    attrs.push({ name: m[1].toLowerCase(), value, start: m.index + m[0].length - m[2].length + 1 - 0, quote: m[2][0], tagStartOffset: m.index });
  }
  return attrs;
}

const isInlineOnly = (el) => el.children.every((c) => !c.raw && INLINE.has(c.tag) && isInlineOnly(c));

// Every unit as { kind, key, start, end } with offsets into html (the span that a translation replaces).
function findUnits(html) {
  const units = [];
  const root = parse(html);
  const attrUnits = (el) => {
    const metaKey = el.tag === "meta" ? (el.attrs.find((a) => a.name === "name" || a.name === "property") || {}).value : null;
    for (const a of el.attrs) {
      const wanted = TEXT_ATTRS.has(a.name) || (el.tag === "meta" && a.name === "content" && META_KEYS.has(metaKey));
      if (wanted && hasLetters(a.value)) {
        const at = el.start + a.start;
        units.push({ kind: "attr", key: a.value, start: at, end: at + a.value.length });
      }
    }
  };
  (function walk(el) {
    if (el.tag !== "#root") attrUnits(el);
    if (el.raw) return;
    const body = html.slice(el.openEnd, el.closeStart);
    // Words that sit directly in this element, outside any child. Only when there are some is the element one sentence with
    // inline markup in it (a paragraph with an <em>); otherwise its children are separate pieces (two buttons side by side).
    let loose = body;
    for (const c of el.children) loose = loose.replace(html.slice(c.start, c.end), "");
    if (el.tag !== "#root" && !SKIP_TEXT.has(el.tag) && el.children.length && isInlineOnly(el) && hasLetters(loose)) {
      units.push({ kind: "html", key: collapse(body), start: el.openEnd, end: el.closeStart });
      for (const c of el.children) attrUnits(c); // attributes of the inline children (e.g. a link's title)
      return;
    }
    if (el.tag !== "#root" && !SKIP_TEXT.has(el.tag) && el.children.length === 0 && hasLetters(body)) {
      units.push({ kind: "html", key: collapse(body), start: el.openEnd, end: el.closeStart });
      return;
    }
    // A container with other elements inside: translate any loose text it holds directly, then go into the children.
    let cursor = el.openEnd;
    const parts = [];
    for (const c of el.children) { parts.push([cursor, c.start]); cursor = c.end; }
    parts.push([cursor, el.closeStart]);
    for (const [a, b] of parts) {
      const text = html.slice(a, b);
      if (el.tag !== "#root" && !SKIP_TEXT.has(el.tag) && hasLetters(text) && !/^\s*$/.test(text)) units.push({ kind: "html", key: collapse(text), start: a, end: b });
    }
    for (const c of el.children) walk(c);
  })(root);
  return units;
}

// Replaces each unit with dict[key], keeping the whitespace around it. Returns { html, missing } where missing lists every key
// that had no translation (those stay as they are).
function applyUnits(html, dict) {
  const missing = new Set();
  const edits = [];
  for (const u of findUnits(html)) {
    const t = dict[u.key];
    if (t === undefined) { missing.add(u.key); continue; }
    const original = html.slice(u.start, u.end);
    const lead = /^\s*/.exec(original)[0];
    const trail = /\s*$/.exec(original)[0];
    edits.push({ start: u.start, end: u.end, text: u.kind === "html" ? lead + t + trail : t });
  }
  edits.sort((a, b) => b.start - a.start);
  let out = html;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { html: out, missing: [...missing] };
}

module.exports = { findUnits, applyUnits, collapse, hasLetters };
