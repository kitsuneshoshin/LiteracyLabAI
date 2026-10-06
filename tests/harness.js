const path = require("node:path");
// The existing endpoint tests script ONE model reply per attempt, which is how a combined call behaves; the
// Premium split into two calls at once is covered in tests/split-generate.test.js, which turns it on itself.
if (process.env.PREMIUM_SPLIT === undefined) process.env.PREMIUM_SPLIT = "0";
const { capabilitiesFor } = require("../api/_lib/plans");

// Shared by plan-gates.test.js and plan-matrix.test.js: runs the REAL endpoint
// handlers with only the outside world stood in for (database, Stripe, the AI
// model, the logged-in user). Not a test file itself (no .test.js suffix).

const ROOT = path.join(__dirname, "..");
const lib = (p) => path.join(ROOT, "api", "_lib", p);

function stub(file, exports) {
  const id = require.resolve(file);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

// A stand-in for the Supabase client. Every query-builder call is recorded;
// awaiting the query asks `resolve` what the database would return.
function fakeSupabase(resolve, log = []) {
  return {
    from(table) {
      const q = { table, ops: [] };
      log.push(q);
      const chain = new Proxy({}, {
        get(_, prop) {
          if (prop === "then") {
            const result = resolve(q) || { data: null, error: null };
            return (ok, bad) => Promise.resolve(result).then(ok, bad);
          }
          return (...args) => { q.ops.push([prop, ...args]); return chain; };
        },
      });
      return chain;
    },
  };
}
const did = (q, op) => q.ops.some(([name]) => name === op);

function fakeRes() {
  const res = { statusCode: 200, body: undefined, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.end = () => res;
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}

// Loads a handler fresh with the given plan, usage and database.
function loadHandler(name, { plan = "free", used = 0, db, log, stripe, generate, supabaseExtras } = {}) {
  const caps = capabilitiesFor(plan);
  stub(lib("auth.js"), {
    requireUser: async () => ({ id: "user-1", email: "parent@example.com" }),
    // Mirrors the real sendError: deliberate 4xx errors carry their code.
    sendError: async (res, err) => {
      const status = err.statusCode || 500;
      const body = { error: err.message };
      if (status < 500 && err.code) body.code = err.code;
      return res.status(status).json(body);
    },
  });
  stub(lib("usage.js"), {
    getMonthlyUsage: async () => ({ used, cap: caps.monthlyCap, plan, capabilities: caps }),
    FREE_MONTHLY_CAP: 3,
  });
  stub(lib("supabaseAdmin.js"), { getSupabaseAdmin: () => Object.assign(fakeSupabase(db || (() => ({ data: null })), log), supabaseExtras || {}) });
  stub(lib("rateLimit.js"), { checkRateLimit: async () => {} });
  stub(lib("openai.js"), { generateFeedbackJSON: generate || (async () => ({ parsed: {}, modelUsed: "stub" })) });
  if (stripe) stub(lib("stripe.js"), { getStripe: () => stripe });
  const file = require.resolve(path.join(ROOT, "api", name));
  delete require.cache[file];
  return require(file);
}

async function call(handler, { method = "GET", query = {}, body } = {}) {
  const res = fakeRes();
  await handler({ method, query, body, headers: {} }, res);
  return res;
}

module.exports = { stub, fakeSupabase, did, fakeRes, loadHandler, call };
