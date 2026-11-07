// First-party usage events (table usage_events) and the owner's activity report built from them.
// Events say WHAT people did, never what they wrote: a name from the list below and a few short,
// non-personal values. The writing, prompts and feedback themselves already live in `submissions`.

// Anything not on this list is ignored, so a bad client can't fill the table with junk names.
const EVENT_NAMES = [
  "app_open",         // the app loaded for a signed-in person
  "view",             // moved to a page: props.view
  "prompt_generated", // a writing prompt was made: props.kind, tier, interest
  "passage_generated",// a reading passage was made: props.kind, tier, interest
  "generate_failed",  // making a prompt/passage failed: props.kind, tier, status
  "submit_failed",    // marking failed: props.kind, tier, status
  "vocab_cards",      // opened the flashcards
  "vocab_quiz",       // started the vocab quiz
  "vocab_quiz_failed",// the quiz would not load
  "feedback_rated",   // thumbs up/down on feedback: props.rating
];
// The only values an event may carry, each cut to a short string.
const PROP_KEYS = ["view", "kind", "tier", "interest", "status", "rating"];
const MAX_PROP_LEN = 40;
const MAX_EVENTS_PER_MINUTE = 60;

// The one person who may open the activity report. ACTIVITY_OWNER_EMAIL in Vercel overrides the default; the address
// must also be confirmed with Supabase Auth, so nobody can get in by registering it first.
const DEFAULT_OWNER_EMAIL = "kitsune.shoshin@gmail.com";
function isOwner(user) {
  if (!user || !user.email || !user.email_confirmed_at) return false;
  const owner = String(process.env.ACTIVITY_OWNER_EMAIL || DEFAULT_OWNER_EMAIL).trim().toLowerCase();
  return String(user.email).trim().toLowerCase() === owner;
}

function cleanEvent(body) {
  const name = String((body && body.name) || "");
  if (!EVENT_NAMES.includes(name)) return null;
  const props = {};
  const given = (body && body.props && typeof body.props === "object") ? body.props : {};
  for (const k of PROP_KEYS) {
    const v = given[k];
    if (typeof v === "string" || typeof v === "number") props[k] = String(v).slice(0, MAX_PROP_LEN);
  }
  return { name, props };
}

function dayOf(iso) { return String(iso || "").slice(0, 10); }

function countBy(rows, keyFn) {
  const out = {};
  for (const r of rows) {
    const k = keyFn(r);
    if (k == null || k === "") continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}
function sortedPairs(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
}

// What the page shows for one submission: the prompt or passage the child was given, what they wrote or
// answered, and the feedback returned. Missing parts are simply null.
function shapeSubmission(s, emailByProfile) {
  const c = s.content && typeof s.content === "object" ? s.content : {};
  const gp = c.generatedPrompt || null;
  const gpass = c.generatedPassage || null;
  const fb = s.feedback && typeof s.feedback === "object" ? s.feedback : null;
  const email = emailByProfile[s.profile_id] || "";
  return {
    id: s.id,
    at: s.created_at,
    kind: s.kind,
    tier: s.tier,
    gradeLabel: s.grade_label || null,
    country: s.country || null,
    interest: s.interest || null,
    user: email ? email.replace(/^(.{2}).*(@.*)$/, "$1…$2") : String(s.profile_id || "").slice(0, 8),
    userId: s.profile_id,
    wordCount: s.word_count == null ? null : s.word_count,
    score: s.score == null ? null : s.score,
    total: s.total_questions == null ? null : s.total_questions,
    model: s.model_used || null,
    // "stopped" = a prompt/passage was made and billed but nothing was ever submitted for it.
    status: s.kind === "writing" ? (typeof c.text === "string" ? "marked" : "stopped") : (fb ? "marked" : "stopped"),
    prompt: gp ? { genre: gp.genre || null, title: gp.title || null, text: gp.prompt || null } : null,
    passage: gpass ? { title: gpass.title || null, skill: gpass.skill || null, text: gpass.passage || null } : null,
    written: typeof c.text === "string" ? c.text : null,
    answers: Array.isArray(c.answers) ? c.answers : null,
    feedback: fb,
  };
}

function buildActivity({ events = [], submissions = [], profiles = [], now = new Date(), days = 30 }) {
  const emailByProfile = {};
  for (const p of profiles) emailByProfile[p.id] = p.email || "";
  const since = new Date(now.getTime() - days * 86400000).toISOString();
  const evs = events.filter((e) => String(e.created_at) >= since);
  const subs = submissions.map((s) => shapeSubmission(s, emailByProfile));

  const byDay = {};
  for (const e of evs) {
    const d = dayOf(e.created_at);
    (byDay[d] = byDay[d] || { day: d, events: 0, people: new Set() });
    byDay[d].events += 1;
    if (e.profile_id) byDay[d].people.add(e.profile_id);
  }
  const perDay = Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)).map((d) => ({ day: d.day, events: d.events, people: d.people.size }));

  const viewCounts = countBy(evs.filter((e) => e.name === "view"), (e) => e.props && e.props.view);
  const failures = evs.filter((e) => /_failed$/.test(e.name));

  const perUser = {};
  for (const p of profiles) perUser[p.id] = { userId: p.id, email: p.email || "", plan: p.plan, joined: p.created_at, writing: 0, reading: 0, stopped: 0, events: 0, lastSeen: null };
  for (const s of submissions) {
    const u = perUser[s.profile_id]; if (!u) continue;
    u[s.kind === "reading" ? "reading" : "writing"] += 1;
    const sh = shapeSubmission(s, emailByProfile);
    if (sh.status === "stopped") u.stopped += 1;
    if (!u.lastSeen || s.created_at > u.lastSeen) u.lastSeen = s.created_at;
  }
  for (const e of events) {
    const u = perUser[e.profile_id]; if (!u) continue;
    u.events += 1;
    if (!u.lastSeen || e.created_at > u.lastSeen) u.lastSeen = e.created_at;
  }

  return {
    generatedAt: now.toISOString(),
    windowDays: days,
    totals: {
      accounts: profiles.length,
      paid: profiles.filter((p) => p.plan && p.plan !== "free").length,
      submissions: subs.length,
      marked: subs.filter((s) => s.status === "marked").length,
      stopped: subs.filter((s) => s.status === "stopped").length,
      events: evs.length,
      failures: failures.length,
    },
    perDay,
    eventCounts: sortedPairs(countBy(evs, (e) => e.name)),
    views: sortedPairs(viewCounts),
    failures: sortedPairs(countBy(failures, (e) => `${e.name} (${(e.props && e.props.status) || "?"})`)),
    interests: sortedPairs(countBy(subs, (s) => s.interest)),
    genres: sortedPairs(countBy(subs.filter((s) => s.prompt), (s) => s.prompt.genre)),
    users: Object.values(perUser).sort((a, b) => String(b.lastSeen || "").localeCompare(String(a.lastSeen || ""))),
    submissions: subs,
  };
}

module.exports = { isOwner, EVENT_NAMES, PROP_KEYS, MAX_EVENTS_PER_MINUTE, cleanEvent, buildActivity, shapeSubmission };
