-- ─────────────────────────────────────────────────────────────────────────────
-- Add user_email to matrimony_members for clean consent tracking
-- Run once in Supabase SQL Editor (project: dcslkrgocuxcogvmvfkr)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.matrimony_members
  add column if not exists user_email text;
