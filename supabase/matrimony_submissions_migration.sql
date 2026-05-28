-- ─────────────────────────────────────────────────────────────────────────────
-- Matrimony submissions v2 — run in Supabase SQL Editor
-- Adds status-management columns to profiles + requirements
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.matrimony_profiles
  add column if not exists closed_on      date,
  add column if not exists admin_feedback text,
  add column if not exists meta           text;

alter table public.matrimony_requirements
  add column if not exists closed_on      date,
  add column if not exists admin_feedback text,
  add column if not exists meta           text;

-- Allow authenticated owners to update their own rows
-- (needed for close / reopen actions)
drop policy if exists "Members can update own profiles"     on public.matrimony_profiles;
drop policy if exists "Members can update own requirement"  on public.matrimony_requirements;

create policy "Members can update own profiles"
  on public.matrimony_profiles for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Members can update own requirement"
  on public.matrimony_requirements for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
