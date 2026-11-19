-- ─────────────────────────────────────────────────────────────────────────────
-- Story submissions: remember which Culture story an approved submission
-- became, so the admin card can link to it ("View on site").
-- Run once in Supabase SQL Editor (project: dcslkrgocuxcogvmvfkr). Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.story_submissions
  add column if not exists published_story_id text;
