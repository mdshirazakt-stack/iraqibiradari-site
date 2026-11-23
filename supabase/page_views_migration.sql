-- ─────────────────────────────────────────────────────────────────────────────
-- Page-view counters: site visits, Achievers (people) and Our Culture stories.
-- Run once in Supabase SQL Editor (project: dcslkrgocuxcogvmvfkr). Safe to re-run.
--
--   public.page_views   one row per counted page: (kind, item_id) → views
--   record_view()       the ONLY way to add a view (visitors cannot write the
--                       table directly); it ignores ids that are not a real
--                       published person / story, so junk rows cannot be made.
--
-- kind = 'site'    item_id = 'home'          → total site visits
-- kind = 'people'  item_id = people.id       → views of an Achiever profile
-- kind = 'culture' item_id = stories.id      → reads of a Culture story
-- kind = 'obituary' item_id = obituaries.id  → views of an obituary page
-- kind = 'event' / 'announcement' / 'organization'   item_id = that item's id
-- kind = 'page'    item_id = '/about/' etc.  → views of an ordinary page (fixed list below)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.page_views (
  kind     text   not null check (kind in ('site', 'people', 'culture', 'obituary', 'page', 'event', 'announcement', 'organization')),
  item_id  text   not null,
  views    bigint not null default 0,
  primary key (kind, item_id)
);

alter table public.page_views enable row level security;

drop policy if exists "Public can read page views" on public.page_views;
create policy "Public can read page views" on public.page_views
  for select using (true);
-- (No insert/update/delete policies: all writes go through record_view().)

create or replace function public.record_view(p_kind text, p_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    text := p_id;
  v_views bigint;
begin
  if p_kind = 'site' then
    v_id := 'home';
  elsif p_kind = 'people' then
    if not exists (select 1 from public.people  where id = p_id and published) then return null; end if;
  elsif p_kind = 'culture' then
    if not exists (select 1 from public.stories where id = p_id and published) then return null; end if;
  elsif p_kind = 'obituary' then
    if not exists (select 1 from public.obituaries where id = p_id and status = 'visible') then return null; end if;
  elsif p_kind = 'event' then
    if not exists (select 1 from public.events where id = p_id and published) then return null; end if;
  elsif p_kind = 'announcement' then
    if not exists (select 1 from public.announcements where id = p_id and published) then return null; end if;
  elsif p_kind = 'organization' then
    if not exists (select 1 from public.organizations where id = p_id and published) then return null; end if;
  elsif p_kind = 'page' then
    -- Only these ordinary pages can be counted (so nobody can create junk rows).
    if p_id not in ('/about/', '/announcements/', '/contact/', '/culture/', '/culture/submit/', '/directory/',
                    '/documents/', '/events/', '/helpdesk/', '/matrimony/', '/matrimony/policy/', '/obituaries/',
                    '/obituaries/submit/', '/organizations/', '/people/', '/videos/') then
      return null;
    end if;
  else
    return null;
  end if;

  insert into public.page_views (kind, item_id, views)
  values (p_kind, v_id, 1)
  on conflict (kind, item_id) do update set views = public.page_views.views + 1
  returning views into v_views;

  return v_views;
end;
$$;

revoke all on function public.record_view(text, text) from public;
grant execute on function public.record_view(text, text) to anon, authenticated;
grant select on public.page_views to anon, authenticated;
