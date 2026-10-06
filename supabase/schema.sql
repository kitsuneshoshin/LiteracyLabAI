-- LiteracyLab AI — Supabase schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query → paste → Run).
-- Safe to re-run: uses "if not exists" / "or replace" throughout.

-- ---------------------------------------------------------------------------
-- Direct table access: NONE, on purpose.
-- The browser uses Supabase only to sign in. Every data read and write goes
-- through the server API (api/*.js), which uses the service role and is
-- where plan limits, ownership and billing are enforced. Row Level Security
-- is enabled on every table with NO policies, so signed-in users cannot
-- touch rows directly with the public anon key.
-- This file used to create "owner access" policies (for all using
-- auth.uid() = ...). Those let any signed-in parent set their own
-- profiles.plan to 'premium' without paying, add unlimited learners, and
-- delete their own submissions to reset the free cap. Removed 2026-09-25.
-- Do not add a policy here without also checking which columns it exposes.
-- (Each table's old policy is still dropped right after the table is created
-- below, so re-running this file on an older database removes it.)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Profiles: one row per Account Holder (parent/guardian), keyed to auth.users.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

-- Pricing moved from one paid tier to two (Core and Premium), so the
-- original two-value constraint has to widen. 'pro' is kept as a permitted
-- value rather than migrated away: it's what any subscription created
-- before the split is stamped with, and api/_lib/plans.js treats it as
-- Premium - which is what those customers were actually sold. The tier was
-- briefly called "family" during development and renamed to "premium"
-- before anything using it shipped, so no row anywhere has plan='family' -
-- this can rename cleanly with no data migration. Safe to re-run; dropping
-- a constraint that doesn't exist is a no-op with IF EXISTS.
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check
  check (plan in ('free', 'core', 'premium', 'pro'));

-- Safe to re-run against an existing table created before these columns existed.
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;

alter table public.profiles enable row level security;

drop policy if exists "profiles: self access" on public.profiles;
-- No policy on purpose: see "Direct table access" at the top of this file.

-- Auto-create a profile row the moment someone signs up via Supabase Auth.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Child profiles: the learner-setup data (country, grade, interests, etc.)
-- ---------------------------------------------------------------------------
create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null default 'My Learner',
  country text not null default '🇬🇧 United Kingdom',
  grade_idx int not null default 5,
  interests text[] not null default '{}',
  confidence_writing text not null default 'growing',
  confidence_reading text not null default 'growing',
  motivation text not null default 'enjoyment',
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to re-run against an existing table created before this column existed.
alter table public.child_profiles add column if not exists onboarded boolean not null default false;

-- Which of the 50 preset avatars (app.html's AVATARS array - an icon/color
-- pair, never a photo) this learner has chosen. An index rather than a
-- foreign key since the set is a fixed, code-defined list, not app data.
alter table public.child_profiles add column if not exists avatar_id int not null default 0;

-- The learner who stays usable when an account holds more learners than its
-- plan covers (after a downgrade - see api/_lib/learnerAccess.js), and when
-- that choice was last made (changes are limited to one per 30 days). Lives
-- on profiles but must be added after child_profiles exists, hence here.
-- "on delete set null": removing that learner falls back to the default
-- (oldest learners keep access) rather than blocking the delete.
alter table public.profiles add column if not exists active_child_id uuid
  references public.child_profiles(id) on delete set null;
alter table public.profiles add column if not exists active_child_set_at timestamptz;

alter table public.child_profiles enable row level security;

drop policy if exists "child_profiles: owner access" on public.child_profiles;
-- No policy on purpose: see "Direct table access" at the top of this file.

-- ---------------------------------------------------------------------------
-- Submissions: every writing or reading-comprehension attempt, plus the
-- feedback that was generated for it. This is both the usage-cap ledger
-- (count rows in the current calendar month) and the progress history.
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  kind text not null check (kind in ('writing', 'reading')),
  tier text not null check (tier in ('early', 'elementary', 'middle', 'high')),
  country text not null,
  grade_label text,                 -- e.g. "Year 7" — lets mastery be scored per exact year, not just tier
  interest text,
  content jsonb not null,          -- the raw text (writing) or answers (reading)
  word_count int,
  char_count int,
  score int,                        -- reading only: correct answers
  total_questions int,              -- reading only
  feedback jsonb,                   -- { glow, grow, vocab: [...], microMission }
  model_used text,
  created_at timestamptz not null default now()
);

-- Safe to re-run against an existing table created before this column existed.
alter table public.submissions add column if not exists grade_label text;

alter table public.submissions enable row level security;

drop policy if exists "submissions: owner access" on public.submissions;
-- No policy on purpose: see "Direct table access" at the top of this file.

create index if not exists submissions_profile_month_idx
  on public.submissions (profile_id, created_at desc);

-- Supports api/cohort-stats.js's peer-comparison query, the one place that
-- deliberately scans across every account (via the service-role key, which
-- bypasses the owner-only RLS policy above) rather than filtering by
-- profile_id - it groups every submission for an exact (country, tier,
-- grade_label) triple to compute an anonymous cohort average/percentile.
create index if not exists submissions_cohort_idx
  on public.submissions (country, tier, grade_label);

-- ---------------------------------------------------------------------------
-- Micro-mission commitments: the "what will you try next time?" taps.
-- Kept separate from submissions so we can track follow-through over time
-- (did the NEXT submission actually use the thing they committed to?).
-- ---------------------------------------------------------------------------
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  chosen_action text,
  helpful_rating text check (helpful_rating in ('up', 'down')),
  created_at timestamptz not null default now()
);

-- Was "not null" - broke every ThumbsFeedback rating submitted without a
-- CommitPrompt choice also made on the same submission (the two widgets are
-- independent, so this happened constantly): the insert threw a 500 that
-- the client silently swallowed, showing "Thanks!" while never actually
-- saving the rating. Found live while checking this table before adding
-- feedback_text below. Safe to re-run even if the table predates this fix.
alter table public.commitments alter column chosen_action drop not null;

-- Free-text "tell us more" captured when a parent/student taps thumbs-down
-- on a piece of AI feedback - the start of a real product-feedback backlog,
-- not just a satisfaction score. Optional: a thumbs-down with no comment is
-- still a useful signal on its own.
alter table public.commitments add column if not exists feedback_text text;

alter table public.commitments enable row level security;

drop policy if exists "commitments: owner access" on public.commitments;
-- No policy on purpose: see "Direct table access" at the top of this file.

-- ---------------------------------------------------------------------------
-- Rate limiting: one row per request to a metered endpoint (writing-prompt,
-- reading-passage, submit), so a sliding-window count can be read back
-- cheaply per account. Deliberately separate from submissions/usage's
-- monthly billing count above - this exists purely to stop a single account
-- (including an "unlimited" Pro one) from hammering the OpenAI-billed
-- endpoints faster than any real student plausibly would, not to enforce
-- the free-tier cap. Only ever touched by the service-role key server-side,
-- so no client RLS policy is needed - just enable RLS with no policy, which
-- denies all direct client access by default.
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  bucket text not null,
  created_at timestamptz not null default now()
);

alter table public.rate_limit_hits enable row level security;

create index if not exists rate_limit_hits_profile_bucket_idx
  on public.rate_limit_hits (profile_id, bucket, created_at desc);

-- Old rows are only ever needed for a few minutes of lookback; without
-- cleanup this table would otherwise grow forever. Safe to re-run.
create index if not exists rate_limit_hits_created_at_idx on public.rate_limit_hits (created_at);

-- ---------------------------------------------------------------------------
-- Email: preferences, send log, and customer feedback (the product backlog).
-- Like every table here, only the service-role key touches these (RLS on, no
-- policy), so nothing is readable or writable from the browser.
-- ---------------------------------------------------------------------------

-- One row per parent, created the first time we email them. The token is what
-- an unsubscribe or feedback link carries instead of anything identifying.
create table if not exists public.email_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  marketing_opt_out boolean not null default false,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.email_preferences enable row level security;

-- Every email sent. dedupe_key makes "send once" a database guarantee: a
-- one-off email uses its own key (free-welcome), a monthly one adds the month
-- (free-limit:2026-10), so a re-run of the daily job can never double-send.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email_key text not null,
  dedupe_key text not null,
  resend_id text,
  sent_at timestamptz not null default now(),
  unique (profile_id, dedupe_key)
);
alter table public.email_log enable row level security;
create index if not exists email_log_profile_sent_idx on public.email_log (profile_id, sent_at desc);

-- What customers tell us, from the email feedback page. Status and priority
-- turn it into a backlog. Deleted with the account (profile_id cascades) so
-- the deletion promise in the privacy policy holds; anonymous rows have no
-- profile_id. ip_hash is a one-way hash used only to rate-limit anonymous posts.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid references public.profiles(id) on delete cascade,
  source text not null default 'email',
  email_key text,
  rating text check (rating in ('up', 'down')),
  category text not null default 'other' check (category in ('bug', 'idea', 'praise', 'question', 'other')),
  message text check (char_length(message) <= 2000),
  contact_ok boolean not null default false,
  ip_hash text,
  status text not null default 'new' check (status in ('new', 'triaged', 'planned', 'done', 'wont_do')),
  priority text check (priority in ('low', 'medium', 'high')),
  owner_notes text
);
alter table public.feedback enable row level security;
create index if not exists feedback_status_created_idx on public.feedback (status, created_at desc);
create index if not exists feedback_ip_created_idx on public.feedback (ip_hash, created_at desc);

-- ---------------------------------------------------------------------------
-- Weekly marking-quality check: one summary row per run (api/_lib/qaRun.js,
-- called by Vercel Cron). Holds only made-up sample pieces and their results,
-- never anything from a customer. RLS on with no policy, like every table here.
-- ---------------------------------------------------------------------------
create table if not exists public.qa_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  passed integer not null,
  total integer not null,
  summary jsonb not null
);
alter table public.qa_runs enable row level security;
create index if not exists qa_runs_created_idx on public.qa_runs (created_at desc);

-- ---------------------------------------------------------------------------
-- OpenAI usage per day and model (api/_lib/aiUsage.js, written on every AI call): the call
-- count, tokens and an estimated cost. Holds no customer content. Days are UTC. RLS on with no
-- policy, like every table here; only the server (service role) reads or writes.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage_daily (
  day date not null,
  model text not null,
  calls integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  est_cost_usd numeric(12, 6) not null default 0,
  primary key (day, model)
);
alter table public.ai_usage_daily enable row level security;

-- One row per day on which the "spend today passed your alert level" email went out.
create table if not exists public.ai_usage_alerts (
  day date primary key,
  sent_at timestamptz not null default now(),
  cost_usd numeric(12, 4)
);
alter table public.ai_usage_alerts enable row level security;

-- Adds one call atomically and returns today's rows, so one round trip does both.
create or replace function public.record_ai_usage(p_day date, p_model text, p_in integer, p_out integer, p_cost numeric)
returns table (model text, calls integer, input_tokens bigint, output_tokens bigint, est_cost_usd numeric)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  insert into public.ai_usage_daily as u (day, model, calls, input_tokens, output_tokens, est_cost_usd)
  values (p_day, p_model, 1, p_in, p_out, p_cost)
  on conflict on constraint ai_usage_daily_pkey do update
    set calls = u.calls + 1,
        input_tokens = u.input_tokens + excluded.input_tokens,
        output_tokens = u.output_tokens + excluded.output_tokens,
        est_cost_usd = u.est_cost_usd + excluded.est_cost_usd;
  return query
    select d.model, d.calls, d.input_tokens, d.output_tokens, d.est_cost_usd
    from public.ai_usage_daily d where d.day = p_day;
end;
$$;
revoke all on function public.record_ai_usage(date, text, integer, integer, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- How well each learner knows each vocabulary word (api/_lib/vocabProgress.js, read and written through
-- api/history.js), so flashcard progress follows a learner between devices. One row per learner and
-- word: a box from 0 (new) to 3 (known) and when it last changed; the newest change wins. Holds only
-- words the product itself taught, never anything a student wrote. RLS on with no policy, like every
-- table here; only the server (service role) reads or writes.
-- ---------------------------------------------------------------------------
create table if not exists public.vocab_progress (
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  term text not null,
  box smallint not null check (box between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (child_id, term)
);
alter table public.vocab_progress enable row level security;
create index if not exists vocab_progress_profile_idx on public.vocab_progress (profile_id);
