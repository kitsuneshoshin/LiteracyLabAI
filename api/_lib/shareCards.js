// Shareable result cards: a parent can turn a finished piece into a small public page ("Maya just finished a Year 5
// writing piece") to send to a friend. Built to be safe by construction:
//  - The card holds only what is listed in CARD_FIELDS: a first name or nickname the parent types (letters only), the
//    kind of piece, the year group, the name of one curriculum skill, and (reading) the score. NEVER any writing,
//    quote, answer or feedback sentence, and never the stored learner name: the parent must type the name, so a
//    child's name is only ever shared on purpose.
//  - The page text is built from these fields in the browser, so nothing a person typed is ever shown except the name.
//  - A card is reached only by its random token, is not listed anywhere, is marked noindex, and can be switched off
//    by the parent at any time (revoked_at), after which the page says it is no longer available.
//  - The friend's link carries the parent's referral code, so a sign-up through a card counts like any invite
//    (api/_lib/referrals.js).

const crypto = require("node:crypto");
const { ensureCode } = require("./referrals");

const MAX_ACTIVE_PER_ACCOUNT = 20;
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes
const NAME_RE = /^[\p{L}][\p{L} '’-]{0,23}$/u;
const DEFAULT_NAME = "My child";
const CARD_FIELDS = ["name", "kind", "year", "skill", "score", "total", "ref"];

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function newToken(random = crypto.randomInt) {
  let t = "";
  for (let i = 0; i < 12; i++) t += TOKEN_ALPHABET[random(TOKEN_ALPHABET.length)];
  return t;
}

// The name on the card: blank becomes "My child"; anything else must be a first name or nickname made of letters.
function cleanName(raw) {
  const n = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
  if (!n) return DEFAULT_NAME;
  if (!NAME_RE.test(n)) throw httpError(400, "Use a first name or nickname: letters only, up to 24 characters. Or leave it blank to say \"My child\".");
  return n;
}

// A short plain label (a year group or a skill name) taken from our own stored data, trimmed and cut to a safe length.
const label = (v, max) => {
  const t = String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

// What a finished piece contributes to its card.
function fieldsFromSubmission(sub) {
  const fb = sub && sub.feedback;
  if (!fb || typeof fb !== "object" || fb._pending) return null;
  const kind = sub.kind === "reading" ? "reading" : sub.kind === "writing" ? "writing" : null;
  if (!kind) return null;
  const reading = kind === "reading" && Number.isInteger(sub.score) && Number.isInteger(sub.total_questions) && sub.total_questions > 0;
  return {
    kind,
    grade_label: label(sub.grade_label, 60),
    skill: label(fb.glowTarget, 80),
    score: reading ? sub.score : null,
    total: reading ? sub.total_questions : null,
  };
}

const publicUrl = (token, siteUrl) => `${siteUrl}/c/${token}`;

async function findMine(supabase, user, submissionId) {
  const { data } = await supabase.from("share_cards").select("token, display_name, created_at")
    .eq("profile_id", user.id).eq("submission_id", submissionId).is("revoked_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

async function mineFor(supabase, user, submissionId, { siteUrl = "https://www.literacylabai.com" } = {}) {
  if (!submissionId) return { card: null };
  const c = await findMine(supabase, user, submissionId);
  return { card: c ? { token: c.token, url: publicUrl(c.token, siteUrl), name: c.display_name } : null };
}

async function createCard(supabase, user, { submissionId, name }, { siteUrl = "https://www.literacylabai.com" } = {}) {
  if (!submissionId) throw httpError(400, "submissionId is required.");
  const display = cleanName(name);
  const { data: sub, error } = await supabase.from("submissions")
    .select("id, kind, grade_label, score, total_questions, feedback").eq("id", submissionId).eq("profile_id", user.id).maybeSingle();
  if (error) throw error;
  if (!sub) throw httpError(404, "That piece was not found.");
  const fields = fieldsFromSubmission(sub);
  if (!fields) throw httpError(409, "Finish the piece and get its feedback first, then you can share it.");

  const existing = await findMine(supabase, user, submissionId);
  if (existing) {
    // The same piece keeps one link: sharing again just updates the name on it.
    await supabase.from("share_cards").update({ display_name: display }).eq("token", existing.token).eq("profile_id", user.id);
    return { token: existing.token, url: publicUrl(existing.token, siteUrl), name: display };
  }
  const { count, error: cErr } = await supabase.from("share_cards").select("id", { count: "exact", head: true }).eq("profile_id", user.id).is("revoked_at", null);
  if (cErr) throw cErr;
  if ((count || 0) >= MAX_ACTIVE_PER_ACCOUNT) throw httpError(429, `You have ${MAX_ACTIVE_PER_ACCOUNT} shared cards. Stop sharing one to make another.`);

  await ensureCode(supabase, user.id); // so the friend's sign-up through this card can count as an invite
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = newToken();
    const { error: insErr } = await supabase.from("share_cards").insert({ token, profile_id: user.id, submission_id: submissionId, display_name: display, ...fields });
    if (!insErr) return { token, url: publicUrl(token, siteUrl), name: display };
    if (insErr.code !== "23505") throw insErr; // 23505: that token exists, so try another
  }
  throw new Error("Could not make a share link.");
}

async function revokeCard(supabase, user, token) {
  const t = String(token || "");
  if (!/^[a-z0-9]{12}$/.test(t)) throw httpError(400, "That is not a valid link.");
  const { error } = await supabase.from("share_cards").update({ revoked_at: new Date().toISOString() }).eq("token", t).eq("profile_id", user.id).is("revoked_at", null);
  if (error) throw error;
  return { revoked: true };
}

// The public read. Returns only CARD_FIELDS, or null when the link is unknown or switched off.
async function viewCard(supabase, token) {
  const t = String(token || "");
  if (!/^[a-z0-9]{12}$/.test(t)) return null;
  const { data: c } = await supabase.from("share_cards")
    .select("profile_id, display_name, kind, grade_label, skill, score, total, revoked_at").eq("token", t).maybeSingle();
  if (!c || c.revoked_at) return null;
  const { data: p } = await supabase.from("profiles").select("referral_code").eq("id", c.profile_id).maybeSingle();
  return { name: c.display_name, kind: c.kind, year: c.grade_label, skill: c.skill, score: c.score, total: c.total, ref: (p && p.referral_code) || null };
}

module.exports = { MAX_ACTIVE_PER_ACCOUNT, CARD_FIELDS, cleanName, newToken, fieldsFromSubmission, createCard, revokeCard, viewCard, mineFor, DEFAULT_NAME };
