-- ─────────────────────────────────────────────────────────────────────────────
-- Comments, replies (threaded) and thumbs up/down for Achiever profiles
-- (kind = 'people') and Our Culture stories (kind = 'culture').
-- Run once in Supabase SQL Editor (project: dcslkrgocuxcogvmvfkr). Safe to re-run.
--
-- Visitors do not need an account: they type a name. Nothing can be read or
-- written directly — all access goes through the SECURITY DEFINER functions at
-- the bottom (get_engagement, add_comment, cast_vote, report_comment,
-- delete_own_comment). Admins moderate through the table itself (RLS policy
-- below, same is_platform_admin() rule as every other admin table).
--
-- Anti-abuse built into add_comment(): name/length limits, at most 2 links,
-- no repeat of the same text, and rate limits per browser and site-wide.
-- A "client_id" (random id kept in the visitor's browser) stands in for an
-- account: it limits votes to one per person per item and lets someone
-- delete their own comment. Clearing browser data resets it, so this is
-- deliberately light protection, not strong identity.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.comments (
  id           uuid        primary key default gen_random_uuid(),
  kind         text        not null check (kind in ('people', 'culture')),
  item_id      text        not null,
  parent_id    uuid        references public.comments(id) on delete cascade,
  author_name  text        not null check (char_length(author_name) between 1 and 60),
  body         text        not null check (char_length(body) between 1 and 2000),
  status       text        not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  client_id    text        not null,
  report_count integer     not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists comments_item_idx   on public.comments (kind, item_id, created_at);
create index if not exists comments_client_idx on public.comments (client_id, created_at);

create table if not exists public.engagement_votes (
  target_type text        not null check (target_type in ('item', 'comment')),
  target_id   text        not null,       -- item: '<kind>:<item_id>'   comment: comment uuid
  client_id   text        not null,
  value       smallint    not null check (value in (1, -1)),
  created_at  timestamptz not null default now(),
  primary key (target_type, target_id, client_id)
);

create table if not exists public.comment_reports (
  comment_id uuid        not null references public.comments(id) on delete cascade,
  client_id  text        not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, client_id)
);

alter table public.comments         enable row level security;
alter table public.engagement_votes enable row level security;
alter table public.comment_reports  enable row level security;

drop policy if exists "Admins manage comments" on public.comments;
create policy "Admins manage comments" on public.comments for all
  using (is_platform_admin()) with check (is_platform_admin());

drop policy if exists "Admins read comment reports" on public.comment_reports;
create policy "Admins read comment reports" on public.comment_reports for select
  using (is_platform_admin());
-- (No public policies on any of the three tables.)

-- ── Is this a real, published item? ──────────────────────────────────────────
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
  end if;
  return false;
end;
$$;

-- ── Read everything for one page: item thumbs + all comments with tallies ────
create or replace function public.get_engagement(p_kind text, p_id text, p_client text default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target   text := p_kind || ':' || p_id;
  v_item     json;
  v_comments json;
begin
  if not public._engagement_item_exists(p_kind, p_id) then
    return null;
  end if;

  select json_build_object(
           'up',   count(*) filter (where value = 1),
           'down', count(*) filter (where value = -1),
           'mine', coalesce(max(case when client_id = p_client then value end), 0)
         )
    into v_item
    from public.engagement_votes
   where target_type = 'item' and target_id = v_target;

  select coalesce(json_agg(row_to_json(t) order by t.created_at), '[]'::json)
    into v_comments
    from (
      select c.id,
             c.parent_id,
             c.status,
             c.created_at,
             case when c.status = 'visible' then c.author_name end as author_name,
             case when c.status = 'visible' then c.body        end as body,
             coalesce(c.client_id = p_client, false)               as is_mine,
             coalesce(v.up, 0)   as up,
             coalesce(v.down, 0) as down,
             coalesce(v.mine, 0) as mine
        from public.comments c
        left join (
          select target_id,
                 count(*) filter (where value = 1)  as up,
                 count(*) filter (where value = -1) as down,
                 coalesce(max(case when client_id = p_client then value end), 0) as mine
            from public.engagement_votes
           where target_type = 'comment'
           group by target_id
        ) v on v.target_id = c.id::text
       where c.kind = p_kind and c.item_id = p_id
    ) t;

  return json_build_object('item', v_item, 'comments', v_comments);
end;
$$;

-- ── Post a comment or a reply ────────────────────────────────────────────────
create or replace function public.add_comment(
  p_kind text, p_id text, p_parent uuid, p_name text, p_body text, p_client text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', ' ', 'g'));
  v_body text := btrim(coalesce(p_body, ''));
  v_row  public.comments;
begin
  if p_client is null or char_length(p_client) < 8 or char_length(p_client) > 64 then
    raise exception 'Something went wrong. Please refresh the page and try again.';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'Please enter your name (up to 60 characters).';
  end if;
  if char_length(v_body) < 1 then
    raise exception 'Please write a comment first.';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'Comments can be up to 2000 characters.';
  end if;
  if (select count(*) from regexp_matches(v_body, 'https?://|www\.', 'gi')) > 2 then
    raise exception 'Please include at most two links in a comment.';
  end if;
  if not public._engagement_item_exists(p_kind, p_id) then
    raise exception 'This page is no longer available.';
  end if;
  if p_parent is not null and not exists (
       select 1 from public.comments
        where id = p_parent and kind = p_kind and item_id = p_id and status = 'visible') then
    raise exception 'The comment you are replying to is no longer available.';
  end if;

  if exists (select 1 from public.comments
              where client_id = p_client and kind = p_kind and item_id = p_id
                and body = v_body and created_at > now() - interval '1 day') then
    raise exception 'You have already posted this comment.';
  end if;
  if (select count(*) from public.comments
       where client_id = p_client and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'You are posting too quickly. Please wait a few minutes and try again.';
  end if;
  if (select count(*) from public.comments
       where client_id = p_client and created_at > now() - interval '1 day') >= 40 then
    raise exception 'You have reached the daily comment limit. Please try again tomorrow.';
  end if;
  if (select count(*) from public.comments
       where created_at > now() - interval '1 hour') >= 150 then
    raise exception 'Comments are very busy right now. Please try again in a little while.';
  end if;

  insert into public.comments (kind, item_id, parent_id, author_name, body, client_id)
  values (p_kind, p_id, p_parent, v_name, v_body, p_client)
  returning * into v_row;

  return json_build_object(
    'id', v_row.id, 'parent_id', v_row.parent_id, 'status', v_row.status,
    'created_at', v_row.created_at, 'author_name', v_row.author_name, 'body', v_row.body,
    'is_mine', true, 'up', 0, 'down', 0, 'mine', 0
  );
end;
$$;

-- ── Thumbs up / down (value 1, -1, or 0 to take the vote back) ───────────────
create or replace function public.cast_vote(p_type text, p_target text, p_value integer, p_client text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_id   text;
  v_up   integer;
  v_down integer;
begin
  if p_client is null or char_length(p_client) < 8 or char_length(p_client) > 64 then
    raise exception 'Something went wrong. Please refresh the page and try again.';
  end if;
  if p_value not in (-1, 0, 1) then
    raise exception 'Invalid vote.';
  end if;

  if p_type = 'item' then
    v_kind := split_part(p_target, ':', 1);
    v_id   := substr(p_target, char_length(v_kind) + 2);
    if not public._engagement_item_exists(v_kind, v_id) then
      raise exception 'This page is no longer available.';
    end if;
  elsif p_type = 'comment' then
    if not exists (select 1 from public.comments where id::text = p_target and status = 'visible') then
      raise exception 'This comment is no longer available.';
    end if;
  else
    raise exception 'Invalid vote.';
  end if;

  if p_value = 0 then
    delete from public.engagement_votes
     where target_type = p_type and target_id = p_target and client_id = p_client;
  else
    insert into public.engagement_votes (target_type, target_id, client_id, value)
    values (p_type, p_target, p_client, p_value)
    on conflict (target_type, target_id, client_id) do update set value = excluded.value;
  end if;

  select count(*) filter (where value = 1), count(*) filter (where value = -1)
    into v_up, v_down
    from public.engagement_votes
   where target_type = p_type and target_id = p_target;

  return json_build_object('up', v_up, 'down', v_down, 'mine', p_value);
end;
$$;

-- ── Report a comment to the moderators (once per browser) ────────────────────
create or replace function public.report_comment(p_id uuid, p_client text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_client is null or char_length(p_client) < 8 or char_length(p_client) > 64 then
    return;
  end if;
  insert into public.comment_reports (comment_id, client_id)
  select p_id, p_client
   where exists (select 1 from public.comments where id = p_id and status = 'visible')
  on conflict do nothing;
  if found then
    update public.comments set report_count = report_count + 1 where id = p_id;
  end if;
end;
$$;

-- ── Let a visitor delete their own comment (kept as a "removed" placeholder) ─
create or replace function public.delete_own_comment(p_id uuid, p_client text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.comments
     set status = 'deleted'
   where id = p_id and client_id = p_client and status = 'visible';
  return found;
end;
$$;

revoke all on function public._engagement_item_exists(text, text)                          from public;
revoke all on function public.get_engagement(text, text, text)                             from public;
revoke all on function public.add_comment(text, text, uuid, text, text, text)              from public;
revoke all on function public.cast_vote(text, text, integer, text)                         from public;
revoke all on function public.report_comment(uuid, text)                                   from public;
revoke all on function public.delete_own_comment(uuid, text)                               from public;

grant execute on function public.get_engagement(text, text, text)                          to anon, authenticated;
grant execute on function public.add_comment(text, text, uuid, text, text, text)           to anon, authenticated;
grant execute on function public.cast_vote(text, text, integer, text)                      to anon, authenticated;
grant execute on function public.report_comment(uuid, text)                                to anon, authenticated;
grant execute on function public.delete_own_comment(uuid, text)                            to anon, authenticated;
