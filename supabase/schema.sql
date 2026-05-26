-- Iraqi Biradari heritage portal schema
-- Run this in Supabase SQL Editor for project dcslkrgocuxcogvmvfkr.

create table if not exists public.announcements (
  id text primary key,
  title text not null,
  body text,
  date date,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  title text not null,
  category text,
  description text,
  event_date date,
  registration_url text,
  url text,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id text primary key,
  title text not null,
  category text,
  description text,
  content_type text,
  url text,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id text primary key,
  title text not null,
  category text,
  description text,
  video_date date,
  url text,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.matrimony_profiles (
  id uuid primary key default gen_random_uuid(),
  candidate_name text not null,
  photo_url text,
  candidate_gender text not null,
  age integer,
  marital_status text,
  education text,
  profession text,
  city text,
  country text,
  family_background text,
  expectations text,
  contact_person_name text not null,
  relationship_to_candidate text,
  phone_whatsapp text not null,
  email text,
  consent_confirmed boolean not null default false,
  status text not null default 'new',
  admin_notes text,
  browser_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.matrimony_profiles add column if not exists photo_url text;

create table if not exists public.matrimony_requests (
  id uuid primary key default gen_random_uuid(),
  seeker_name text not null,
  seeking_for text,
  preferred_gender text,
  preferred_age_range text,
  preferred_location text,
  expectations text,
  contact_person_name text not null,
  phone_whatsapp text not null,
  email text,
  consent_confirmed boolean not null default false,
  status text not null default 'new',
  admin_notes text,
  browser_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
alter table public.events enable row level security;
alter table public.documents enable row level security;
alter table public.videos enable row level security;
alter table public.matrimony_profiles enable row level security;
alter table public.matrimony_requests enable row level security;

drop policy if exists "Public can read published announcements" on public.announcements;
drop policy if exists "Public can read published events" on public.events;
drop policy if exists "Public can read published documents" on public.documents;
drop policy if exists "Public can read published videos" on public.videos;
drop policy if exists "Public can submit matrimony profiles" on public.matrimony_profiles;
drop policy if exists "Public can submit matrimony requests" on public.matrimony_requests;

create policy "Public can read published announcements" on public.announcements for select using (published = true);
create policy "Public can read published events" on public.events for select using (published = true);
create policy "Public can read published documents" on public.documents for select using (published = true);
create policy "Public can read published videos" on public.videos for select using (published = true);
create policy "Public can submit matrimony profiles" on public.matrimony_profiles for insert
  with check (consent_confirmed = true and status = 'new');
create policy "Public can submit matrimony requests" on public.matrimony_requests for insert
  with check (consent_confirmed = true and status = 'new');

drop policy if exists "Admin can manage announcements" on public.announcements;
drop policy if exists "Admin can manage events" on public.events;
drop policy if exists "Admin can manage documents" on public.documents;
drop policy if exists "Admin can manage videos" on public.videos;
drop policy if exists "Admin can manage matrimony profiles" on public.matrimony_profiles;
drop policy if exists "Admin can manage matrimony requests" on public.matrimony_requests;

create policy "Admin can manage announcements" on public.announcements for all
  using ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create policy "Admin can manage events" on public.events for all
  using ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create policy "Admin can manage documents" on public.documents for all
  using ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create policy "Admin can manage videos" on public.videos for all
  using ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create policy "Admin can manage matrimony profiles" on public.matrimony_profiles for all
  using ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create policy "Admin can manage matrimony requests" on public.matrimony_requests for all
  using ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create index if not exists matrimony_profiles_status_created_idx on public.matrimony_profiles (status, created_at desc);
create index if not exists matrimony_requests_status_created_idx on public.matrimony_requests (status, created_at desc);

-- ── People & Stories RLS (tables were created outside the original schema) ──
-- Run this block in the Supabase SQL Editor if saving People or Culture
-- stories fails in the admin console (RLS was missing admin write policies).

alter table public.people enable row level security;
alter table public.stories enable row level security;
alter table public.story_submissions enable row level security;

drop policy if exists "Public can read published people"    on public.people;
drop policy if exists "Public can read published stories"   on public.stories;
drop policy if exists "Public can submit story"             on public.story_submissions;
drop policy if exists "Admin can manage people"             on public.people;
drop policy if exists "Admin can manage stories"            on public.stories;
drop policy if exists "Admin can manage story submissions"  on public.story_submissions;

create policy "Public can read published people" on public.people
  for select using (published = true);

create policy "Public can read published stories" on public.stories
  for select using (published = true);

create policy "Public can submit story" on public.story_submissions
  for insert with check (true);

create policy "Admin can manage people" on public.people for all
  using  ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create policy "Admin can manage stories" on public.stories for all
  using  ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create policy "Admin can manage story submissions" on public.story_submissions for all
  using  ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

-- ── Organizations ─────────────────────────────────────────────────────────

create table if not exists public.organizations (
  id              text primary key,
  title           text not null,
  tagline         text,
  body            text,               -- mission / about (rich text)
  logo_url        text,
  cover_image_url text,
  contact_email   text,
  contact_phone   text,
  website_url     text,
  address         text,
  how_to_contribute text,             -- plain text / HTML
  how_to_apply      text,             -- plain text / HTML (beneficiary)
  published       boolean not null default true,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     text not null references public.organizations(id) on delete cascade,
  name       text not null,
  role       text,
  photo_url  text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Tag events and videos to an organization (optional)
alter table public.events add column if not exists org_id text references public.organizations(id) on delete set null;
alter table public.videos add column if not exists org_id text references public.organizations(id) on delete set null;

alter table public.organizations enable row level security;
alter table public.org_members    enable row level security;

drop policy if exists "Public can read published organizations" on public.organizations;
drop policy if exists "Public can read org members"            on public.org_members;
drop policy if exists "Admin can manage organizations"         on public.organizations;
drop policy if exists "Admin can manage org members"           on public.org_members;

create policy "Public can read published organizations" on public.organizations
  for select using (published = true);

create policy "Public can read org members" on public.org_members
  for select using (
    exists (select 1 from public.organizations o where o.id = org_id and o.published = true)
  );

create policy "Admin can manage organizations" on public.organizations for all
  using  ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

create policy "Admin can manage org members" on public.org_members for all
  using  ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com')
  with check ((auth.jwt() ->> 'email') = 'mdshiraz.ib@outlook.com');

insert into public.announcements (id, title, body, date, published)
values
  ('archive-organization-started', 'Archive organization has started', 'Books, meeting notes, videos, and community records are being categorized from the existing public Drive collection.', '2026-05-10', true)
on conflict (id) do nothing;

insert into public.documents (id, title, category, content_type, url, description, published)
values
  ('lar-nama-noorul-qamar-lari', 'Lar Nama by Er. Noorul Qamar Lari', 'Books', 'PDF', 'https://drive.google.com/file/d/1zGD0FaRtLnND7Sd2p98aspq1ZROomwBW/view?usp=drivesdk', 'Community publication preserved from the old books archive.', true),
  ('maulana-mohibullah-lari-nadwi', 'Maulana Mohibullah Lari Nadwi Hayat wa Khidmat', 'Books', 'PDF', 'https://drive.google.com/file/d/1nXUUpT-Z0TQbw-STrxQX3E3qJHXsy2kX/view?usp=drivesdk', 'Biographical/community publication from the Drive archive.', true),
  ('rodad-1903', 'Rodad 1903', 'Historical Documents', 'PDF', 'https://drive.google.com/file/d/1IRgmuy-DCLsxD9PhTbb8A31ViX_eViuL/view?usp=drivesdk', 'Historical Rodad document from the Drive archive.', true),
  ('tujar-iraq-1', 'Tujar Iraq - 1', 'Books', 'PDF', 'https://drive.google.com/file/d/13xdCO551AV6WTURl4UAVFKZENepiQozj/view?usp=drivesdk', 'Community reference book from the Drive archive.', true),
  ('trust-paper', 'Trust Paper', 'Trust Documents', 'PDF', 'https://drive.google.com/file/d/1qoi1JfbtwtOvndSWgpwEfE1h4uhjTUHh/view?usp=drivesdk', 'Trust-related document from the Drive archive.', true),
  ('minutes-meeting-1', 'Minutes of Meeting - 1', 'Meeting Notes', 'PDF', 'https://drive.google.com/file/d/19XBOiBLhZhkKk-4tIkuk2VNrk8HGAhEp/view?usp=drivesdk', 'Meeting minutes preserved as a PDF.', true),
  ('anjm-today-1955', 'Anjm Today 1955', 'Historical Documents', 'PDF', 'https://drive.google.com/file/d/1ncbO2-zt40Cuy7cU63_vbqswXJBxZZnk/view?usp=drivesdk', 'Historical document from the Drive archive.', true),
  ('zakat-message', 'Zakat Message', 'Community Notices', 'PDF', 'https://drive.google.com/file/d/1xfH58BslG_ohNNzHq1w3tKyQEXimyBiO/view?usp=drivesdk', 'Community notice preserved from the Drive archive.', true)
on conflict (id) do nothing;

insert into public.videos (id, title, category, url, video_date, description, published)
values
  ('meeting-2025-02-27', 'Meeting 27.02.2025', 'Meeting Videos', 'https://drive.google.com/file/d/1MxnttCds3XKX1yowsC403eqNcJjSeB42/view?usp=drivesdk', '2025-02-27', 'Meeting video from the Drive archive.', true),
  ('tazkirul-quran-episode-1', 'Tazkirul Quran Episode - 1', 'Recorded Programs', 'https://drive.google.com/file/d/1NClp6GrgH8xd_Z2nrXCAIafCIKfWVaKH/view?usp=drivesdk', '2025-03-06', 'Recorded Tazkirul Quran program from the Drive archive.', true),
  ('monthly-meeting-2021-06-13', 'Apno Ki Talash Monthly Meeting', 'Meeting Videos', 'https://drive.google.com/file/d/1jc6gD_hYwatXsozeIVCwi81qm1flXAXr/view?usp=drivesdk', '2021-06-13', 'Monthly meeting video from the Drive archive.', true),
  ('meeting-2021-01-31', 'Meeting 2021-01-31', 'Meeting Videos', 'https://drive.google.com/file/d/10OUpXDteFelkt2td3F_obcH8zrCx03ZF/view?usp=drivesdk', '2021-01-31', 'Meeting recording from the Drive archive.', true),
  ('dr-tabrez-session-2020-11-15', 'Dr Tabrez Session', 'Recorded Programs', 'https://drive.google.com/file/d/1w_qqKXgK95lo9JZuxkdttI-wr_TNwlcH/view?usp=drivesdk', '2020-11-15', 'Recorded session from the Drive archive.', true)
on conflict (id) do nothing;
