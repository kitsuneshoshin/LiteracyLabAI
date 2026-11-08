// The owner's customer-feedback inbox: turns raw feedback rows plus the people and pieces they point at into
// what the /admin page shows, and checks the owner's edits (status, priority, notes) before they are saved.

const STATUSES = ["new", "triaged", "planned", "done", "wont_do"];
const PRIORITIES = ["low", "medium", "high"];
const SUBMISSION_TAG = /\[submission ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i;

// A "report a mistake" press saves the piece it was about as "[submission <id>]" at the end of the message.
function submissionIdOf(message) {
  const m = SUBMISSION_TAG.exec(String(message || ""));
  return m ? m[1].toLowerCase() : null;
}

function cleanMessage(message) {
  return String(message || "").replace(SUBMISSION_TAG, "").trim();
}

function pieceOf(sub, childName) {
  const content = (sub && sub.content) || {};
  const fb = (sub && sub.feedback) || {};
  const prompt = content.generatedPrompt || null;
  return {
    id: sub.id,
    kind: sub.kind,
    at: sub.created_at,
    child: childName || null,
    gradeLabel: sub.grade_label || null,
    country: sub.country || null,
    interest: sub.interest || null,
    prompt: prompt ? { genre: prompt.genre || null, title: prompt.title || null, text: prompt.prompt || null } : null,
    written: typeof content.text === "string" ? content.text : null,
    score: sub.kind === "writing" ? (fb.overallScore == null ? null : fb.overallScore) : sub.score,
    total: sub.total_questions == null ? null : sub.total_questions,
    glow: fb.glow || null,
    grow: fb.grow || null,
    scoreReason: fb.scoreReason || null,
  };
}

function buildInbox({ rows, profiles, children, submissions }) {
  const profileById = new Map((profiles || []).map((p) => [p.id, p]));
  const childById = new Map((children || []).map((c) => [c.id, c]));
  const childrenByProfile = new Map();
  (children || []).forEach((c) => {
    if (!childrenByProfile.has(c.profile_id)) childrenByProfile.set(c.profile_id, []);
    childrenByProfile.get(c.profile_id).push(c.display_name || "Learner");
  });
  const subById = new Map((submissions || []).map((s) => [s.id, s]));

  const items = (rows || []).map((r) => {
    const p = r.profile_id ? profileById.get(r.profile_id) : null;
    const subId = submissionIdOf(r.message);
    const sub = subId ? subById.get(subId) : null;
    const child = sub && sub.child_id ? childById.get(sub.child_id) : null;
    return {
      id: r.id,
      at: r.created_at,
      source: r.source || null,
      emailKey: r.email_key || null,
      rating: r.rating || null,
      category: r.category || "other",
      message: cleanMessage(r.message),
      isMistakeReport: /^MISTAKE REPORT:/i.test(String(r.message || "")),
      contactOk: r.contact_ok === true,
      status: r.status || "new",
      priority: r.priority || null,
      notes: r.owner_notes || "",
      person: r.profile_id ? { email: (p && p.email) || null, plan: (p && p.plan) || null, learners: childrenByProfile.get(r.profile_id) || [] } : null,
      piece: sub ? pieceOf(sub, child && child.display_name) : null,
      pieceMissing: !!subId && !sub,
    };
  });

  const counts = { total: items.length };
  STATUSES.forEach((s) => { counts[s] = items.filter((i) => i.status === s).length; });
  return { generatedAt: new Date().toISOString(), counts, items };
}

// Only the three fields the owner can change; anything else in the request is ignored.
function validateUpdate(body) {
  const b = body || {};
  const patch = {};
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return { error: "Unknown status." };
    patch.status = b.status;
  }
  if (b.priority !== undefined) {
    if (b.priority !== null && b.priority !== "" && !PRIORITIES.includes(b.priority)) return { error: "Unknown priority." };
    patch.priority = b.priority || null;
  }
  if (b.notes !== undefined) {
    const notes = typeof b.notes === "string" ? b.notes.trim() : "";
    if (notes.length > 4000) return { error: "Please keep notes under 4000 characters." };
    patch.owner_notes = notes || null;
  }
  if (!Object.keys(patch).length) return { error: "Nothing to change." };
  return { patch };
}

module.exports = { STATUSES, PRIORITIES, submissionIdOf, cleanMessage, buildInbox, validateUpdate };
