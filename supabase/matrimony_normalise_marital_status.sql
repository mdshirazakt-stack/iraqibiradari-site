-- ─────────────────────────────────────────────────────────────────────────────
-- Normalise legacy marital_status values in matrimony_profiles
-- Run once in the Supabase SQL Editor (project: dcslkrgocuxcogvmvfkr)
-- ─────────────────────────────────────────────────────────────────────────────

update public.matrimony_profiles
set    marital_status = 'fresh'
where  lower(trim(coalesce(marital_status, ''))) in (
         '', 'never married', 'unmarried', 'single'
       );
