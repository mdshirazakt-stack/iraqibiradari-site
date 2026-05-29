-- ─────────────────────────────────────────────────────────────────────────────
-- Matrimony activity log — run once in Supabase SQL Editor
-- Project: dcslkrgocuxcogvmvfkr  (iraqibiradari.com)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.matrimony_activity_log (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete cascade,
  user_email  text,
  event_type  text        not null,
  -- event_type values:
  --   login            user signed in
  --   browse_open      user opened browse section
  --   profile_view     user opened a candidate detail
  --   shortlist_add    user shortlisted a profile
  --   shortlist_remove user removed a shortlist
  --   policy_agree     user agreed to matrimony policy
  --   candidate_submit user submitted a candidate profile
  --   requirement_submit user submitted match requirements
  meta        jsonb,
  created_at  timestamptz not null default now()
);

alter table public.matrimony_activity_log enable row level security;

-- Users can only insert their own activity rows
create policy "Users can log own activity"
  on public.matrimony_activity_log for insert
  with check (auth.uid() = user_id);

-- All authenticated users can read (admin panel requires auth)
create policy "Authenticated users can read activity"
  on public.matrimony_activity_log for select
  using (auth.role() = 'authenticated');

create index if not exists matrimony_activity_log_user_id_idx
  on public.matrimony_activity_log (user_id);

create index if not exists matrimony_activity_log_event_type_idx
  on public.matrimony_activity_log (event_type);

create index if not exists matrimony_activity_log_created_at_idx
  on public.matrimony_activity_log (created_at desc);
