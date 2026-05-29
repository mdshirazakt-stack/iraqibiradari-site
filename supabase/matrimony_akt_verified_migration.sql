-- ─────────────────────────────────────────────────────────────────────────────
-- Add akt_verified flag to matrimony_profiles
-- Run once in Supabase SQL Editor (project: dcslkrgocuxcogvmvfkr)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.matrimony_profiles
  add column if not exists akt_verified boolean not null default false;
