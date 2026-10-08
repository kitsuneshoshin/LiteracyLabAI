// Refer-a-friend. A referral is only worth something once a REAL new account has done something real, so an
// email address typed into a box can never earn a reward. The steps, in order:
//   1. The friend signs up through the parent's personal link (?ref=CODE). The code travels with the sign-up
//      (stored on the new account), so it still works when the confirmation email is opened on another device.
//   2. The friend confirms their email address.
//   3. The friend finishes their first piece (this is the real proof of use, and it costs an AI call).
// Then BOTH accounts get REWARD_PIECES extra pieces for the current month only (nothing is stockpiled), and a
// referrer's rewards are capped at MAX_REWARDED_PER_MONTH a month. Rewards are worked out from the referral
// rows each time (see bonusFor), so there is no balance that could drift or be double spent.
//
// Checks that turn a sign-up into a rejected row: your own link, the same address (Gmail dots and +tags are
// ignored), a throwaway-email domain, and an account that is not new. One referral per new account is enforced
// by the database (referred_id is unique), and the reward is granted by a conditional update, so it happens once.

const REWARD_PIECES = 3;
const MAX_REWARDED_PER_MONTH = 5;
const CLAIM_WINDOW_DAYS = 30;
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O/1/I
const CODE_RE = /^[A-Z0-9]{6,12}$/;

const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "10minutemail.com", "10minutemail.net",
  "tempmail.com", "temp-mail.org", "tempmail.net", "yopmail.com", "yopmail.net", "trashmail.com", "getnada.com",
  "dispostable.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mintemail.com", "moakt.com", "emailondeck.com",
  "mohmal.com", "tempail.com", "tmpmail.org", "mailnesia.com", "mytemp.email", "burnermail.io", "spamgourmet.com", "tempr.email",
]);

// The address as one mailbox, so tricks that make one inbox look like several do not count: lowercase, no +tag,
// and (Gmail only) no dots in the name.
function normaliseEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at).split("+")[0];
  let domain = e.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

const isDisposable = (email) => DISPOSABLE.has(String(email || "").trim().toLowerCase().split("@").pop());

function newCode(random = Math.random) {
  let c = "";
  for (let i = 0; i < 8; i++) c += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return c;
}

// The parent's personal code, made on first need and kept.
async function ensureCode(supabase, profileId) {
  const { data: p, error } = await supabase.from("profiles").select("referral_code").eq("id", profileId).single();
  if (error) throw error;
  if (p && p.referral_code) return p.referral_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const { error: upErr } = await supabase.from("profiles").update({ referral_code: code }).eq("id", profileId).is("referral_code", null);
    if (!upErr) {
      const { data: again } = await supabase.from("profiles").select("referral_code").eq("id", profileId).single();
      if (again && again.referral_code) return again.referral_code;
    } else if (upErr.code !== "23505") throw upErr; // 23505: that code is taken, so try another
  }
  throw new Error("Could not make a referral code.");
}

const monthStartOf = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

// Records that this new account came through someone's link, if it did and if it passes the checks. Runs at most
// once per account (referred_id is unique). Returns the row's status, or null if there was nothing to record.
async function claimReferral(supabase, user, now = new Date()) {
  const raw = user && user.user_metadata && user.user_metadata.referral_code;
  const code = String(raw || "").trim().toUpperCase();
  if (!CODE_RE.test(code)) return null;
  const { data: existing } = await supabase.from("referrals").select("id, status").eq("referred_id", user.id).maybeSingle();
  if (existing) return existing.status;

  const { data: referrer } = await supabase.from("profiles").select("id, email").eq("referral_code", code).maybeSingle();
  if (!referrer) return null; // not a real code: nothing to record

  let reason = null;
  if (referrer.id === user.id) reason = "your own link";
  else if (normaliseEmail(referrer.email) === normaliseEmail(user.email)) reason = "same email address";
  else if (isDisposable(user.email)) reason = "throwaway email address";
  else if (user.created_at && now - new Date(user.created_at) > CLAIM_WINDOW_DAYS * 86400000) reason = "not a new account";

  const row = { referrer_id: referrer.id, referred_id: user.id, status: reason ? "rejected" : "signed_up", reason };
  const { error } = await supabase.from("referrals").insert(row);
  if (error && error.code !== "23505") throw error; // 23505: a parallel request recorded it first
  return row.status;
}

// Grants the reward once the friend has confirmed their email and finished a piece. The update only matches a row
// that is still "signed_up", so two parallel calls cannot both reward. Returns true when this call granted it.
async function settleReferral(supabase, user, now = new Date()) {
  if (!user || !user.email_confirmed_at) return false;
  const { data: row } = await supabase.from("referrals").select("id, status").eq("referred_id", user.id).maybeSingle();
  if (!row || row.status !== "signed_up") return false;
  const { count, error } = await supabase.from("submissions").select("id", { count: "exact", head: true }).eq("profile_id", user.id).not("feedback", "is", null);
  if (error) throw error;
  if (!count) return false;
  const { data: updated, error: upErr } = await supabase.from("referrals")
    .update({ status: "rewarded", rewarded_at: now.toISOString() }).eq("id", row.id).eq("status", "signed_up").select("id");
  if (upErr) throw upErr;
  return Array.isArray(updated) ? updated.length > 0 : true;
}

// Called after a piece is completed. A problem here must never break the learner's feedback.
async function settleReferralSafe(supabase, user) {
  try {
    await claimReferral(supabase, user);
    await settleReferral(supabase, user);
  } catch (err) {
    console.error("Referral check failed (ignored):", err && err.message);
  }
}

// Extra pieces this month: REWARD_PIECES for each reward earned this month by bringing a friend (at most
// MAX_REWARDED_PER_MONTH of them), plus REWARD_PIECES if this account was itself referred and rewarded this month.
async function bonusFor(supabase, profileId, now = new Date()) {
  const since = monthStartOf(now);
  const base = () => supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "rewarded").gte("rewarded_at", since);
  const [asReferrer, asFriend] = await Promise.all([base().eq("referrer_id", profileId), base().eq("referred_id", profileId)]);
  if (asReferrer.error) throw asReferrer.error;
  if (asFriend.error) throw asFriend.error;
  const rewardedFriends = Math.min(MAX_REWARDED_PER_MONTH, asReferrer.count || 0);
  return { pieces: REWARD_PIECES * (rewardedFriends + ((asFriend.count || 0) > 0 ? 1 : 0)), rewardedFriends, wasReferredAndRewarded: (asFriend.count || 0) > 0 };
}

// What the Parent Dashboard card shows: the link, where each invited friend is up to (no names or emails), and
// whether this account was itself invited.
async function statusFor(supabase, user, { siteUrl = "https://www.literacylabai.com", now = new Date() } = {}) {
  await claimReferral(supabase, user, now);
  await settleReferral(supabase, user, now);
  const code = await ensureCode(supabase, user.id);
  const { data: rows, error } = await supabase.from("referrals").select("referred_id, status, created_at").eq("referrer_id", user.id).neq("status", "rejected").order("created_at", { ascending: true }).limit(20);
  if (error) throw error;
  const friends = [];
  for (const [i, r] of (rows || []).entries()) {
    let step = r.status === "rewarded" ? "rewarded" : "signed_up";
    if (step === "signed_up") {
      try {
        const { data } = await supabase.auth.admin.getUserById(r.referred_id);
        if (data && data.user && data.user.email_confirmed_at) step = "confirmed";
      } catch (e) { /* stays "signed_up" */ }
    }
    friends.push({ label: `Friend ${i + 1}`, step });
  }
  const bonus = await bonusFor(supabase, user.id, now);
  const { data: mine } = await supabase.from("referrals").select("status").eq("referred_id", user.id).maybeSingle();
  return {
    code, link: `${siteUrl}/?ref=${code}`, friends,
    rewardPieces: REWARD_PIECES, maxPerMonth: MAX_REWARDED_PER_MONTH,
    rewardedThisMonth: bonus.rewardedFriends, bonusThisMonth: bonus.pieces,
    // Where this account's own invitation stands: null (not invited), "signed_up" (finish a piece to unlock), "rewarded", or "rejected"
    invitedStatus: mine ? mine.status : null,
  };
}

module.exports = {
  REWARD_PIECES, MAX_REWARDED_PER_MONTH, CLAIM_WINDOW_DAYS, normaliseEmail, isDisposable, newCode, ensureCode,
  claimReferral, settleReferral, settleReferralSafe, bonusFor, statusFor,
};
