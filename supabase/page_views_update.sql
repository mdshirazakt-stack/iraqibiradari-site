-- ─────────────────────────────────────────────────────────────────────────────
-- Page-view counters: every page now shows its own view count in the footer.
-- Adds counting for obituary pages, event / announcement / organization pages
-- and the ordinary pages (About, People, Stories, Obituaries, …).
-- Run once in Supabase SQL Editor, AFTER obituaries_migration.sql. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.page_views drop constraint if exists page_views_kind_check;
alter table public.page_views add  constraint page_views_kind_check
  check (kind in ('site', 'people', 'culture', 'obituary', 'page', 'event', 'announcement', 'organization'));

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
