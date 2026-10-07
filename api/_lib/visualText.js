// Data texts for reading practice: a short written piece that comes with a small table or bar chart, and
// questions that need the data (read a value, compare, spot a trend). The model writes the data in a plain
// shape; it is checked here, kept with the passage, drawn by the page, and shown to the marking model as text
// so feedback can talk about it.
//
//   table  { type: "table", title, headers: [2-5 labels], rows: [3-7 rows, one cell per header] }
//   chart  { type: "chart", title, unit, items: [3-7 { label, value }] }   (a bar chart: values are numbers, 0 or more)

const isArr = Array.isArray;
const str = (v, max) => (typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "");
const okStr = (v, min, max) => typeof v === "string" && v.trim().length >= min && v.trim().length <= max;

const LIMITS = { headers: [2, 5], rows: [3, 7], items: [3, 7], cell: 28, label: 24, title: 80, unit: 18, maxValue: 1000000 };

// Tidies what the model sent (cells may come as numbers, values as numeric text) without inventing anything.
function normalizeVisual(v) {
  if (!v || typeof v !== "object") return v;
  if (v.type === "table") {
    return {
      type: "table", title: str(v.title, LIMITS.title),
      headers: isArr(v.headers) ? v.headers.map((h) => str(h, LIMITS.cell)) : v.headers,
      rows: isArr(v.rows) ? v.rows.map((r) => (isArr(r) ? r.map((c) => str(c, LIMITS.cell)) : r)) : v.rows,
    };
  }
  if (v.type === "chart") {
    return {
      type: "chart", title: str(v.title, LIMITS.title), unit: str(v.unit, LIMITS.unit),
      items: isArr(v.items) ? v.items.map((it) => (it && typeof it === "object" ? { label: str(it.label, LIMITS.label), value: typeof it.value === "string" && it.value.trim() !== "" ? Number(it.value) : it.value } : it)) : v.items,
    };
  }
  return v;
}

// kind: "table" or "chart", what this text type asks for.
function validateVisual(v, kind, issues) {
  if (!v || typeof v !== "object" || v.type !== kind) { issues.push(`visual must be a ${kind} (type "${kind}")`); return; }
  if (!okStr(v.title, 3, LIMITS.title)) issues.push("visual.title is missing or an unreasonable length");
  if (kind === "table") {
    const h = v.headers, r = v.rows;
    if (!isArr(h) || h.length < LIMITS.headers[0] || h.length > LIMITS.headers[1] || !h.every((x) => okStr(x, 1, LIMITS.cell))) { issues.push(`visual.headers must be ${LIMITS.headers[0]} to ${LIMITS.headers[1]} short column labels`); return; }
    if (new Set(h.map((x) => x.trim().toLowerCase())).size !== h.length) issues.push("visual.headers has a repeated column label");
    if (!isArr(r) || r.length < LIMITS.rows[0] || r.length > LIMITS.rows[1]) { issues.push(`visual.rows must be ${LIMITS.rows[0]} to ${LIMITS.rows[1]} rows`); return; }
    r.forEach((row, i) => {
      if (!isArr(row) || row.length !== h.length || !row.every((c) => okStr(c, 1, LIMITS.cell))) issues.push(`visual.rows[${i}] must have exactly ${h.length} short cells`);
    });
    const firsts = r.filter(isArr).map((row) => String(row[0] || "").trim().toLowerCase());
    if (new Set(firsts).size !== firsts.length) issues.push("visual.rows repeats a row label in the first column");
  } else {
    const items = v.items;
    if (!okStr(v.unit, 1, LIMITS.unit)) issues.push("visual.unit is missing (what the bars measure, for example \"votes\")");
    if (!isArr(items) || items.length < LIMITS.items[0] || items.length > LIMITS.items[1]) { issues.push(`visual.items must be ${LIMITS.items[0]} to ${LIMITS.items[1]} bars`); return; }
    items.forEach((it, i) => {
      if (!it || typeof it !== "object" || !okStr(it.label, 1, LIMITS.label)) issues.push(`visual.items[${i}].label is missing or too long`);
      if (!it || typeof it.value !== "number" || !Number.isFinite(it.value) || it.value < 0 || it.value > LIMITS.maxValue) issues.push(`visual.items[${i}].value must be a number from 0 up`);
    });
    const labels = items.filter((it) => it && typeof it.label === "string").map((it) => it.label.trim().toLowerCase());
    if (new Set(labels).size !== labels.length) issues.push("visual.items repeats a bar label");
    const values = items.filter((it) => it && typeof it.value === "number").map((it) => it.value);
    if (values.length && Math.max(...values) === 0) issues.push("visual.items are all zero");
  }
}

// The data as plain text, for the marking model (and for anything that cannot draw it).
function describeVisual(v) {
  if (!v || typeof v !== "object") return "";
  if (v.type === "table" && isArr(v.headers) && isArr(v.rows)) {
    return `Table: ${v.title}\n${v.headers.join(" | ")}\n${v.rows.map((r) => (isArr(r) ? r.join(" | ") : "")).join("\n")}`;
  }
  if (v.type === "chart" && isArr(v.items)) {
    return `Bar chart: ${v.title} (${v.unit})\n${v.items.map((it) => `${it.label}: ${it.value}`).join("\n")}`;
  }
  return "";
}

module.exports = { normalizeVisual, validateVisual, describeVisual, LIMITS };
