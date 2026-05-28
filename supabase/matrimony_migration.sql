-- ─────────────────────────────────────────────────────────────────────────────
-- Matrimony v2 migration — run once in the Supabase SQL Editor
-- Project: dcslkrgocuxcogvmvfkr  (iraqibiradari.com)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Extend matrimony_profiles ─────────────────────────────────────────────
-- Add columns that the live JS expects but the original schema lacked.

alter table public.matrimony_profiles
  add column if not exists user_id         uuid references auth.users(id) on delete set null,
  add column if not exists initials        text,
  add column if not exists native_location  text,
  add column if not exists birth_location   text,
  add column if not exists current_location text,
  add column if not exists akt_profile_url  text,
  add column if not exists published        boolean not null default false;

-- Drop the unique constraint on user_id if it exists
-- (multi-profile: one user can now submit multiple candidate profiles)
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where t.relname = 'matrimony_profiles'
    and n.nspname = 'public'
    and c.contype = 'u'
    and exists (
      select 1 from pg_attribute a
      where a.attrelid = c.conrelid
        and a.attnum = any(c.conkey)
        and a.attname = 'user_id'
    );
  if cname is not null then
    execute 'alter table public.matrimony_profiles drop constraint ' || quote_ident(cname);
    raise notice 'Dropped constraint: %', cname;
  else
    raise notice 'No unique constraint on user_id found — nothing to drop.';
  end if;
end $$;

-- ── 2. matrimony_members ─────────────────────────────────────────────────────
-- One record per authenticated user — consent / membership verification.

create table if not exists public.matrimony_members (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references auth.users(id) on delete cascade,
  full_name        text not null,
  mobile           text not null,
  native_location  text not null,
  current_location text not null,
  akt_profile_url  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── 3. matrimony_requirements ────────────────────────────────────────────────
-- One record per user (their match preferences).

create table if not exists public.matrimony_requirements (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users(id) on delete cascade,
  seeker_name              text not null,
  seeking_for              text,
  preferred_gender         text,
  preferred_marital_status text not null default 'any',
  preferred_age_range      text,
  preferred_location       text,
  preferred_education      text,
  preferred_occupation     text,
  notes                    text,
  consent_confirmed        boolean not null default false,
  status                   text not null default 'new',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

alter table public.matrimony_members     enable row level security;
alter table public.matrimony_requirements enable row level security;

-- matrimony_members
drop policy if exists "Members can read own record"    on public.matrimony_members;
drop policy if exists "Members can insert own record"  on public.matrimony_members;
drop policy if exists "Members can update own record"  on public.matrimony_members;
drop policy if exists "Admin can manage members"       on public.matrimony_members;

create policy "Members can read own record"
  on public.matrimony_members for select
  using (auth.uid() = user_id);

create policy "Members can insert own record"
  on public.matrimony_members for insert
  with check (auth.uid() = user_id);

create policy "Members can update own record"
  on public.matrimony_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admin can manage members"
  on public.matrimony_members for all
  using  ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

-- matrimony_requirements
drop policy if exists "Members can read own requirement"   on public.matrimony_requirements;
drop policy if exists "Members can insert own requirement" on public.matrimony_requirements;
drop policy if exists "Members can update own requirement" on public.matrimony_requirements;
drop policy if exists "Admin can manage requirements"      on public.matrimony_requirements;

create policy "Members can read own requirement"
  on public.matrimony_requirements for select
  using (auth.uid() = user_id);

create policy "Members can insert own requirement"
  on public.matrimony_requirements for insert
  with check (auth.uid() = user_id and consent_confirmed = true);

create policy "Members can update own requirement"
  on public.matrimony_requirements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admin can manage requirements"
  on public.matrimony_requirements for all
  using  ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

-- matrimony_profiles — replace public-insert policy with auth-gated one
drop policy if exists "Public can submit matrimony profiles" on public.matrimony_profiles;
drop policy if exists "Members can insert own profiles"      on public.matrimony_profiles;
drop policy if exists "Members can read own profiles"        on public.matrimony_profiles;
drop policy if exists "Members can update own profiles"      on public.matrimony_profiles;

create policy "Members can insert own profiles"
  on public.matrimony_profiles for insert
  with check (auth.uid() = user_id and consent_confirmed = true);

create policy "Members can read own profiles"
  on public.matrimony_profiles for select
  using (auth.uid() = user_id or published = true);

create policy "Members can update own profiles"
  on public.matrimony_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 5. Indexes ────────────────────────────────────────────────────────────────

create index if not exists matrimony_profiles_user_id_idx
  on public.matrimony_profiles (user_id);

create index if not exists matrimony_profiles_published_created_idx
  on public.matrimony_profiles (published, created_at desc);

create index if not exists matrimony_members_user_id_idx
  on public.matrimony_members (user_id);

create index if not exists matrimony_requirements_user_id_idx
  on public.matrimony_requirements (user_id);
