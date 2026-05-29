-- ─────────────────────────────────────────────────────────────────────────────
-- Add policy agreement fields to matrimony_members
-- Run once in Supabase SQL Editor (project: dcslkrgocuxcogvmvfkr)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.matrimony_members
  add column if not exists policy_agreed_at  timestamptz,
  add column if not exists policy_version    text;
