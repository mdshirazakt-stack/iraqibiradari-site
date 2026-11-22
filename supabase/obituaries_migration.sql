-- ─────────────────────────────────────────────────────────────────────────────
-- Obituaries: anyone can post one (it goes live immediately), the poster gets a
-- private edit link, and admins can hide or delete. Condolence messages reuse
-- the comments tables (kind = 'obituary').
-- Run once in Supabase SQL Editor (project: dcslkrgocuxcogvmvfkr), AFTER
-- comments_migration.sql. Safe to re-run.
--
-- PRIVACY BY DESIGN
--   * Phone numbers (condolence contacts) and the street address are NEVER sent
--     to or stored in the database. They exist only in the WhatsApp message the
--     poster builds in their own browser.
--   * The poster's own mobile number IS stored (so admins can reach them about
--     a wrong post) but is returned to nobody except admins and the poster.
--   * The table itself has no public access: visitors only use the functions
--     below, which return public fields only.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.obituaries (
  id               text        primary key,                       -- slug: name-YYYY-MM-DD
  status           text        not null default 'visible' check (status in ('visible', 'hidden')),
  honorific        text,                                          -- Haji, Begum, Dr. …
  name             text        not null check (char_length(name) between 2 and 80),
  gender           text        not null check (gender in ('male', 'female')),
  relations        jsonb       not null default '[]'::jsonb,      -- [{rel, name, late}]
  city             text        not null check (char_length(city) between 2 and 60),
  residence_area   text,                                          -- locality only, never a street address
  native_place     text,
  age              integer     check (age between 0 and 130),
  passed_on        date        not null,
  janaza_date      date,
  janaza_place     text,
  janaza_timing    text,                                          -- "after Zohar Namaaz", …
  leaves_from_kind text        check (leaves_from_kind in ('residence', 'other')),
  leaves_from_other text,
  leaves_from_time text,
  burial_text      text,
  message          text,                                          -- optional dua / note
  poster_name      text        not null,
  poster_relation  text,
  poster_mobile    text        not null,                          -- admin-only
  edit_token_hash  text        not null,
  client_id        text        not null,
  report_count     integer     not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists obituaries_list_idx   on public.obituaries (status, passed_on desc, created_at desc);
create index if not exists obituaries_client_idx on public.obituaries (client_id, created_at);

create table if not exists public.obituary_reports (
  obituary_id text        not null references public.obituaries(id) on delete cascade,
  client_id   text        not null,
  created_at  timestamptz not null default now(),
  primary key (obituary_id, client_id)
);

alter table public.obituaries        enable row level security;
alter table public.obituary_reports  enable row level security;

drop policy if exists "Admins manage obituaries" on public.obituaries;
create policy "Admins manage obituaries" on public.obituaries for all
  using (is_platform_admin()) with check (is_platform_admin());

drop policy if exists "Admins read obituary reports" on public.obituary_reports;
create policy "Admins read obituary reports" on public.obituary_reports for select
  using (is_platform_admin());

-- ── Condolences reuse the comments system ────────────────────────────────────
alter table public.comments drop constraint if exists comments_kind_check;
alter table public.comments add  constraint comments_kind_check check (kind in ('people', 'culture', 'obituary'));

create or replace function public._engagement_item_exists(p_kind text, p_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_kind = 'people' then
    return exists (select 1 from public.people  where id = p_id and published);
  elsif p_kind = 'culture' then
    return exists (select 1 from public.stories where id = p_id and published);
  elsif p_kind = 'obituary' then
    return exists (select 1 from public.obituaries where id = p_id and status = 'visible');
  end if;
  return false;
end;
$$;

-- Deleting an obituary also deletes its condolence messages.
create or replace function public._obituary_delete_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.comments where kind = 'obituary' and item_id = old.id;
  return old;
end;
$$;
drop trigger if exists obituary_delete_cleanup on public.obituaries;
create trigger obituary_delete_cleanup after delete on public.obituaries
  for each row execute function public._obituary_delete_cleanup();

-- ── Validation / clean-up of a submitted obituary (used by create + update) ──
create or replace function public._obit_text(p jsonb, k text, p_max integer, p_label text, p_required boolean default false)
returns text
language plpgsql
immutable
as $$
declare
  v text := btrim(regexp_replace(coalesce(p ->> k, ''), '[[:cntrl:]]', ' ', 'g'));
begin
  if v = '' then
    if p_required then raise exception 'Please fill in: %.', p_label; end if;
    return null;
  end if;
  if char_length(v) > p_max then
    raise exception '% is too long (up to % characters).', p_label, p_max;
  end if;
  if v ~* '(https?://|www\.|\.com\y|\.in\y|\.net\y|\.org\y)' then
    raise exception '% cannot contain links.', p_label;
  end if;
  return v;
end;
$$;

create or replace function public._obit_clean(p jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_today   date := (now() at time zone 'Asia/Kolkata')::date;
  v_passed  date;
  v_janaza  date;
  v_gender  text := lower(coalesce(p ->> 'gender', ''));
  v_rels    jsonb := '[]'::jsonb;
  v_rel     jsonb;
  v_relname text;
  v_relkind text;
  v_age     integer;
  v_kind    text := nullif(lower(coalesce(p ->> 'leaves_from_kind', '')), '');
  v_mobile  text := regexp_replace(coalesce(p ->> 'poster_mobile', ''), '[^0-9+]', '', 'g');
begin
  if v_gender not in ('male', 'female') then
    raise exception 'Please choose male or female.';
  end if;

  begin
    v_passed := (p ->> 'passed_on')::date;
  exception when others then
    raise exception 'Please enter a valid date of passing.';
  end;
  if v_passed is null then raise exception 'Please enter the date of passing.'; end if;
  if v_passed > v_today + 1 or v_passed < v_today - 30 then
    raise exception 'The date of passing must be within the last 30 days.';
  end if;

  if nullif(p ->> 'janaza_date', '') is not null then
    begin
      v_janaza := (p ->> 'janaza_date')::date;
    exception when others then
      raise exception 'Please enter a valid janaza date.';
    end;
    if v_janaza < v_passed or v_janaza > v_passed + 4 then
      raise exception 'The janaza date should be within a few days of the date of passing.';
    end if;
  end if;

  if nullif(p ->> 'age', '') is not null then
    begin
      v_age := (p ->> 'age')::integer;
    exception when others then
      raise exception 'Please enter the age as a number.';
    end;
    if v_age < 0 or v_age > 130 then raise exception 'Please enter a valid age.'; end if;
  end if;

  if v_kind is not null and v_kind not in ('residence', 'other') then v_kind := null; end if;

  if jsonb_typeof(coalesce(p -> 'relations', '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid family relations.';
  end if;
  if jsonb_array_length(coalesce(p -> 'relations', '[]'::jsonb)) > 8 then
    raise exception 'Please list at most 8 family relations.';
  end if;
  for v_rel in select * from jsonb_array_elements(coalesce(p -> 'relations', '[]'::jsonb)) loop
    v_relkind := lower(coalesce(v_rel ->> 'rel', ''));
    if v_relkind not in ('wife', 'husband', 'son', 'daughter', 'mother', 'father', 'brother', 'sister') then
      raise exception 'Invalid family relation.';
    end if;
    v_relname := public._obit_text(v_rel, 'name', 80, 'Relative''s name', true);
    v_rels := v_rels || jsonb_build_array(jsonb_build_object(
      'rel', v_relkind, 'name', v_relname, 'late', coalesce((v_rel ->> 'late')::boolean, false)));
  end loop;

  if char_length(v_mobile) < 8 or char_length(v_mobile) > 16 then
    raise exception 'Please enter your mobile number (it is kept private).';
  end if;

  return jsonb_build_object(
    'honorific',         public._obit_text(p, 'honorific', 20, 'Title'),
    'name',              public._obit_text(p, 'name', 80, 'Name', true),
    'gender',            v_gender,
    'relations',         v_rels,
    'city',              public._obit_text(p, 'city', 60, 'City', true),
    'residence_area',    public._obit_text(p, 'residence_area', 60, 'Area'),
    'native_place',      public._obit_text(p, 'native_place', 60, 'Native place'),
    'age',               v_age,
    'passed_on',         v_passed,
    'janaza_date',       v_janaza,
    'janaza_place',      public._obit_text(p, 'janaza_place', 120, 'Janaza place'),
    'janaza_timing',     public._obit_text(p, 'janaza_timing', 120, 'Janaza timing'),
    'leaves_from_kind',  v_kind,
    'leaves_from_other', public._obit_text(p, 'leaves_from_other', 120, 'Place the janaza leaves from'),
    'leaves_from_time',  public._obit_text(p, 'leaves_from_time', 40, 'Time the janaza leaves'),
    'burial_text',       public._obit_text(p, 'burial_text', 120, 'Burial place'),
    'message',           public._obit_text(p, 'message', 500, 'Message'),
    'poster_name',       public._obit_text(p, 'poster_name', 60, 'Your name', true),
    'poster_relation',   public._obit_text(p, 'poster_relation', 40, 'Your relationship'),
    'poster_mobile',     v_mobile
  );
end;
$$;

-- What visitors may see (no mobile, token, client id or report count).
create or replace function public._obit_public(o public.obituaries)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', o.id, 'honorific', o.honorific, 'name', o.name, 'gender', o.gender,
    'relations', o.relations, 'city', o.city, 'residence_area', o.residence_area,
    'native_place', o.native_place, 'age', o.age, 'passed_on', o.passed_on,
    'janaza_date', o.janaza_date, 'janaza_place', o.janaza_place, 'janaza_timing', o.janaza_timing,
    'leaves_from_kind', o.leaves_from_kind, 'leaves_from_other', o.leaves_from_other,
    'leaves_from_time', o.leaves_from_time, 'burial_text', o.burial_text, 'message', o.message,
    'posted_by', o.poster_name, 'posted_relation', o.poster_relation,
    'created_at', o.created_at, 'updated_at', o.updated_at
  );
$$;

-- ── Create ───────────────────────────────────────────────────────────────────
create or replace function public.create_obituary(p_data jsonb, p_client text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c        jsonb;
  v_base   text;
  v_id     text;
  v_n      integer := 1;
  v_token  text;
begin
  if p_client is null or char_length(p_client) < 8 or char_length(p_client) > 64 then
    raise exception 'Something went wrong. Please refresh the page and try again.';
  end if;
  c := public._obit_clean(p_data);

  if exists (select 1 from public.obituaries
              where lower(name) = lower(c ->> 'name')
                and passed_on = (c ->> 'passed_on')::date
                and created_at > now() - interval '7 days') then
    raise exception 'An obituary for this person with the same date has already been posted. Please check the Obituaries page.';
  end if;
  if (select count(*) from public.obituaries
       where client_id = p_client and created_at > now() - interval '1 day') >= 3 then
    raise exception 'You have reached the daily limit for posting obituaries. Please try again tomorrow.';
  end if;
  if (select count(*) from public.obituaries
       where created_at > now() - interval '1 day') >= 40 then
    raise exception 'Too many obituaries have been posted today. Please try again later.';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(c ->> 'name'), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'obituary'; end if;
  v_base := v_base || '-' || (c ->> 'passed_on');
  v_id := v_base;
  while exists (select 1 from public.obituaries where id = v_id) loop
    v_n := v_n + 1;
    v_id := v_base || '-' || v_n;
  end loop;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  insert into public.obituaries (
    id, honorific, name, gender, relations, city, residence_area, native_place, age, passed_on,
    janaza_date, janaza_place, janaza_timing, leaves_from_kind, leaves_from_other, leaves_from_time,
    burial_text, message, poster_name, poster_relation, poster_mobile, edit_token_hash, client_id)
  values (
    v_id, c ->> 'honorific', c ->> 'name', c ->> 'gender', c -> 'relations', c ->> 'city',
    c ->> 'residence_area', c ->> 'native_place', (c ->> 'age')::integer, (c ->> 'passed_on')::date,
    (c ->> 'janaza_date')::date, c ->> 'janaza_place', c ->> 'janaza_timing', c ->> 'leaves_from_kind',
    c ->> 'leaves_from_other', c ->> 'leaves_from_time', c ->> 'burial_text', c ->> 'message',
    c ->> 'poster_name', c ->> 'poster_relation', c ->> 'poster_mobile',
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_client);

  return json_build_object('id', v_id, 'edit_token', v_token);
end;
$$;

-- ── Read (public) ────────────────────────────────────────────────────────────
create or replace function public.list_obituaries(
  p_search text default null, p_year integer default null,
  p_limit integer default 24, p_offset integer default 0)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q     text := lower(btrim(coalesce(p_search, '')));
  v_limit integer := least(greatest(coalesce(p_limit, 24), 1), 60);
  v_off   integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_rows  json;
  v_years json;
begin
  select count(*) into v_total
    from public.obituaries o
   where o.status = 'visible'
     and (v_q = '' or position(v_q in lower(o.name)) > 0)
     and (p_year is null or extract(year from o.passed_on)::integer = p_year);

  select coalesce(json_agg(public._obit_public(o) order by o.passed_on desc, o.created_at desc), '[]'::json)
    into v_rows
    from public.obituaries o
   where o.id in (
      select o2.id from public.obituaries o2
       where o2.status = 'visible'
         and (v_q = '' or position(v_q in lower(o2.name)) > 0)
         and (p_year is null or extract(year from o2.passed_on)::integer = p_year)
       order by o2.passed_on desc, o2.created_at desc
       limit v_limit offset v_off);

  select coalesce(json_agg(y order by y desc), '[]'::json)
    into v_years
    from (select distinct extract(year from passed_on)::integer as y
            from public.obituaries where status = 'visible') s;

  return json_build_object('total', v_total, 'rows', v_rows, 'years', v_years);
end;
$$;

create or replace function public.get_obituary(p_id text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select public._obit_public(o)::json from public.obituaries o where o.id = p_id and o.status = 'visible';
$$;

-- ── Edit / delete with the private edit link ─────────────────────────────────
create or replace function public.get_obituary_for_edit(p_id text, p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select (public._obit_public(o) || jsonb_build_object(
            'status', o.status, 'poster_name', o.poster_name,
            'poster_relation', o.poster_relation, 'poster_mobile', o.poster_mobile))::json
    from public.obituaries o
   where o.id = p_id and o.edit_token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

create or replace function public.update_obituary(p_id text, p_token text, p_data jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c jsonb;
begin
  if not exists (select 1 from public.obituaries
                  where id = p_id and edit_token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')) then
    raise exception 'This edit link is not valid.';
  end if;
  c := public._obit_clean(p_data);
  update public.obituaries set
    honorific = c ->> 'honorific', name = c ->> 'name', gender = c ->> 'gender',
    relations = c -> 'relations', city = c ->> 'city', residence_area = c ->> 'residence_area',
    native_place = c ->> 'native_place', age = (c ->> 'age')::integer, passed_on = (c ->> 'passed_on')::date,
    janaza_date = (c ->> 'janaza_date')::date, janaza_place = c ->> 'janaza_place',
    janaza_timing = c ->> 'janaza_timing', leaves_from_kind = c ->> 'leaves_from_kind',
    leaves_from_other = c ->> 'leaves_from_other', leaves_from_time = c ->> 'leaves_from_time',
    burial_text = c ->> 'burial_text', message = c ->> 'message',
    poster_name = c ->> 'poster_name', poster_relation = c ->> 'poster_relation',
    poster_mobile = c ->> 'poster_mobile', updated_at = now()
  where id = p_id;
  return json_build_object('id', p_id);
end;
$$;

create or replace function public.delete_obituary(p_id text, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.obituaries
   where id = p_id and edit_token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  return found;
end;
$$;

-- ── Report to the moderators (once per browser) ──────────────────────────────
create or replace function public.report_obituary(p_id text, p_client text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_client is null or char_length(p_client) < 8 or char_length(p_client) > 64 then
    return;
  end if;
  insert into public.obituary_reports (obituary_id, client_id)
  select p_id, p_client
   where exists (select 1 from public.obituaries where id = p_id and status = 'visible')
  on conflict do nothing;
  if found then
    update public.obituaries set report_count = report_count + 1 where id = p_id;
  end if;
end;
$$;

-- ── Permissions ──────────────────────────────────────────────────────────────
revoke all on function public._obit_text(jsonb, text, integer, text, boolean)  from public;
revoke all on function public._obit_clean(jsonb)                               from public;
revoke all on function public._obit_public(public.obituaries)                  from public;
revoke all on function public._obituary_delete_cleanup()                       from public;
revoke all on function public.create_obituary(jsonb, text)                     from public;
revoke all on function public.list_obituaries(text, integer, integer, integer) from public;
revoke all on function public.get_obituary(text)                               from public;
revoke all on function public.get_obituary_for_edit(text, text)                from public;
revoke all on function public.update_obituary(text, text, jsonb)               from public;
revoke all on function public.delete_obituary(text, text)                      from public;
revoke all on function public.report_obituary(text, text)                      from public;

grant execute on function public.create_obituary(jsonb, text)                     to anon, authenticated;
grant execute on function public.list_obituaries(text, integer, integer, integer) to anon, authenticated;
grant execute on function public.get_obituary(text)                               to anon, authenticated;
grant execute on function public.get_obituary_for_edit(text, text)                to anon, authenticated;
grant execute on function public.update_obituary(text, text, jsonb)               to anon, authenticated;
grant execute on function public.delete_obituary(text, text)                      to anon, authenticated;
grant execute on function public.report_obituary(text, text)                      to anon, authenticated;
