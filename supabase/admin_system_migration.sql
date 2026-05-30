-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-admin role system
-- Run once in Supabase SQL Editor (project: dcslkrgocuxcogvmvfkr)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. admin_users ────────────────────────────────────────────────────────────
-- One record per admin. The superadmin email (mdshiraz.ib@outlook.com) always
-- has full access regardless of whether it appears here.

create table if not exists public.admin_users (
  id           uuid        primary key default gen_random_uuid(),
  email        text        not null unique,
  name         text        not null,
  role         text        not null default 'content_admin',
  -- role values: org_admin | matrimony_admin | content_admin
  -- (superadmin is never stored here — hardcoded in JS/RLS)
  assigned_org_ids text[]  not null default '{}',
  -- for org_admin: array of organization IDs they can manage
  is_active    boolean     not null default true,
  invited_by   text,       -- email of the superadmin who invited them
  notes        text,       -- what they manage, context
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── 2. admin_activity_log ─────────────────────────────────────────────────────
-- Every action taken by any admin user.

create table if not exists public.admin_activity_log (
  id            uuid        primary key default gen_random_uuid(),
  admin_email   text        not null,
  admin_name    text,
  admin_role    text,
  action        text        not null,
  -- action values: login | create | update | delete | publish | unpublish |
  --   approve | reject | akt_verify | notes_save | status_change | add_admin | deactivate_admin
  section       text,       -- events | organizations | matrimony | stories | people | admin_users
  target_id     text,       -- ID of the record acted on
  target_title  text,       -- Human-readable title for quick scanning
  meta          jsonb,
  created_at    timestamptz not null default now()
);

-- ── 3. RLS — admin_users ──────────────────────────────────────────────────────

alter table public.admin_users enable row level security;

drop policy if exists "Superadmin can manage admin_users" on public.admin_users;
drop policy if exists "Admins can read own record"        on public.admin_users;

create policy "Superadmin can manage admin_users"
  on public.admin_users for all
  using  ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create policy "Admins can read own record"
  on public.admin_users for select
  using ((auth.jwt() ->> 'email') = email);

-- ── 4. RLS — admin_activity_log ───────────────────────────────────────────────

alter table public.admin_activity_log enable row level security;

drop policy if exists "Admins can insert own activity"  on public.admin_activity_log;
drop policy if exists "Superadmin can read all activity" on public.admin_activity_log;
drop policy if exists "Admins can read own activity"     on public.admin_activity_log;

create policy "Admins can insert activity"
  on public.admin_activity_log for insert
  with check (
    (auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com'
    or exists (
      select 1 from public.admin_users
      where email = (auth.jwt() ->> 'email') and is_active = true
    )
  );

create policy "Superadmin can read all activity"
  on public.admin_activity_log for select
  using ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create policy "Admins can read own activity"
  on public.admin_activity_log for select
  using ((auth.jwt() ->> 'email') = admin_email);

-- ── 5. Helper function ────────────────────────────────────────────────────────
-- Used in updated content-table policies below.

create or replace function public.is_platform_admin()
returns boolean as $$
  select
    (auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com'
    or exists (
      select 1 from public.admin_users
      where email = (auth.jwt() ->> 'email') and is_active = true
    );
$$ language sql security definer;

-- ── 6. Update content table RLS to allow all active admins ───────────────────
-- Drop the old superadmin-only policies and replace with is_platform_admin().

-- events
drop policy if exists "Admin can manage events" on public.events;
create policy "Admin can manage events"
  on public.events for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- announcements
drop policy if exists "Admin can manage announcements" on public.announcements;
create policy "Admin can manage announcements"
  on public.announcements for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- documents
drop policy if exists "Admin can manage documents" on public.documents;
create policy "Admin can manage documents"
  on public.documents for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- videos
drop policy if exists "Admin can manage videos" on public.videos;
create policy "Admin can manage videos"
  on public.videos for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- people
drop policy if exists "Admin can manage people" on public.people;
create policy "Admin can manage people"
  on public.people for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- stories
drop policy if exists "Admin can manage stories" on public.stories;
create policy "Admin can manage stories"
  on public.stories for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- organizations
drop policy if exists "Admin can manage organizations" on public.organizations;
create policy "Admin can manage organizations"
  on public.organizations for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- org_members
drop policy if exists "Admin can manage org_members" on public.org_members;
create policy "Admin can manage org_members"
  on public.org_members for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- matrimony_profiles
drop policy if exists "Admin can manage profiles" on public.matrimony_profiles;
create policy "Admin can manage profiles"
  on public.matrimony_profiles for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- matrimony_members
drop policy if exists "Admin can manage members" on public.matrimony_members;
create policy "Admin can manage members"
  on public.matrimony_members for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- matrimony_requirements
drop policy if exists "Admin can manage requirements" on public.matrimony_requirements;
create policy "Admin can manage requirements"
  on public.matrimony_requirements for all
  using  (is_platform_admin())
  with check (is_platform_admin());

-- matrimony_activity_log — broaden select to all platform admins
drop policy if exists "Authenticated users can read activity" on public.matrimony_activity_log;
create policy "Platform admins can read matrimony activity"
  on public.matrimony_activity_log for select
  using (is_platform_admin());

-- ── 7. Indexes ────────────────────────────────────────────────────────────────

create index if not exists admin_users_email_idx
  on public.admin_users (email);

create index if not exists admin_activity_log_admin_email_idx
  on public.admin_activity_log (admin_email);

create index if not exists admin_activity_log_section_idx
  on public.admin_activity_log (section);

create index if not exists admin_activity_log_created_at_idx
  on public.admin_activity_log (created_at desc);
