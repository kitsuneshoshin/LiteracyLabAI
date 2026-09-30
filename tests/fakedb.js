// A small in-memory stand-in for the parts of the Supabase client the email code
// uses, with real-enough behaviour: filters, inserts that respect the unique
// (profile, dedupe_key) rule on email_log, updates, deletes, upserts and counts.
// Not a test file itself (no .test.js suffix).

function fakeDb(tables, { blindSelect = [] } = {}) {
  let seq = 0;
  function from(table) {
    const q = { op: "select", filters: [], payload: null, single: false, maybe: false, opts: {}, count: false };
    const api = {
      select(cols, opts) { if (opts && opts.count) q.count = true; return api; },
      insert(p) { q.op = "insert"; q.payload = p; return api; },
      update(p) { q.op = "update"; q.payload = p; return api; },
      delete() { q.op = "delete"; return api; },
      upsert(p, o) { q.op = "upsert"; q.payload = p; q.opts = o || {}; return api; },
      eq(c, v) { q.filters.push((r) => r[c] === v); return api; },
      in(c, vs) { q.filters.push((r) => vs.includes(r[c])); return api; },
      not(c, op, v) { if (op === "is" && v === null) q.filters.push((r) => r[c] != null); return api; },
      gte(c, v) { q.filters.push((r) => String(r[c]) >= String(v)); return api; },
      order() { return api; },
      limit() { return api; },
      single() { q.single = true; return api; },
      maybeSingle() { q.single = true; q.maybe = true; return api; },
      then(ok, bad) { try { ok(run()); } catch (e) { bad(e); } },
    };
    function run() {
      const rows = tables[table] || [];
      const match = rows.filter((r) => q.filters.every((f) => f(r)));
      const one = (data) => (q.single ? (data[0] ? { data: data[0], error: null } : q.maybe ? { data: null, error: null } : { data: null, error: { message: "no rows" } }) : { data, error: null });
      if (q.op === "select") {
        if (q.count) return { data: null, count: match.length, error: null };
        return one(blindSelect.includes(table) ? [] : match.map((r) => ({ ...r })));
      }
      if (q.op === "insert") {
        if (table === "email_log" && rows.some((r) => r.profile_id === q.payload.profile_id && r.dedupe_key === q.payload.dedupe_key)) return { data: null, error: { code: "23505", message: "duplicate" } };
        const row = { id: `row${++seq}`, sent_at: new Date().toISOString(), ...q.payload };
        (tables[table] = tables[table] || []).push(row);
        return one([row]);
      }
      if (q.op === "update") { match.forEach((r) => Object.assign(r, q.payload)); return one(match); }
      if (q.op === "delete") { tables[table] = rows.filter((r) => !match.includes(r)); return { data: null, error: null }; }
      if (q.op === "upsert") {
        const exists = rows.some((r) => r.profile_id === q.payload.profile_id);
        if (!exists) (tables[table] = tables[table] || []).push({ marketing_opt_out: false, unsubscribe_token: `token-${q.payload.profile_id}`, ...q.payload });
        return { data: null, error: null };
      }
      throw new Error("unsupported " + q.op);
    }
    return api;
  }
  return { from };
}

module.exports = { fakeDb };
