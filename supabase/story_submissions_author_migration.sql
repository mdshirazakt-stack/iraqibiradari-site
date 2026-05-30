-- ─────────────────────────────────────────────────────────────────────────────
-- Add author_bio and akt_profile_url to story_submissions
-- Run once in Supabase SQL Editor (project: dcslkrgocuxcogvmvfkr)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.story_submissions
  add column if not exists author_bio      text,
  add column if not exists akt_profile_url text;
