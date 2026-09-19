-- LiteracyLab AI — Supabase schema
-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query → paste → Run).
-- Safe to re-run: uses "if not exists" / "or replace" throughout.

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

-- Safe to re-run against an existing table created before these columns existed.
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;

alter table public.profiles enable row level security;

drop policy if exists "profiles: self access" on public.profiles;
create policy "profiles: self access" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

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

alter table public.child_profiles enable row level security;

drop policy if exists "child_profiles: owner access" on public.child_profiles;
create policy "child_profiles: owner access" on public.child_profiles
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

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
create policy "submissions: owner access" on public.submissions
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

create index if not exists submissions_profile_month_idx
  on public.submissions (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Micro-mission commitments: the "what will you try next time?" taps.
-- Kept separate from submissions so we can track follow-through over time
-- (did the NEXT submission actually use the thing they committed to?).
-- ---------------------------------------------------------------------------
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  chosen_action text not null,
  helpful_rating text check (helpful_rating in ('up', 'down')),
  created_at timestamptz not null default now()
);

alter table public.commitments enable row level security;

drop policy if exists "commitments: owner access" on public.commitments;
create policy "commitments: owner access" on public.commitments
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
