-- ─────────────────────────────────────────────────────────────────────────────
-- Matrimony shortlists — run once in Supabase SQL Editor
-- Project: dcslkrgocuxcogvmvfkr  (iraqibiradari.com)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.matrimony_shortlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.matrimony_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, profile_id)
);

alter table public.matrimony_shortlists enable row level security;

create policy "Users can manage own shortlists"
  on public.matrimony_shortlists for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists matrimony_shortlists_user_id_idx
  on public.matrimony_shortlists (user_id);
