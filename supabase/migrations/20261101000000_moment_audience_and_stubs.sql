-- Soosh core loop v1, PR 4: who a Moment is for, and Stubs for doing the thing.
--
-- Run AFTER 20261031000000_open_pursuits.sql.
--
--   1. posts.audience ('group' | 'friends' | 'everyone', null on older Moments).
--      "everyone" and "friends" ride on the existing visibility values (public and
--      followers). "group" is a Moment for the people in its Pursuit: it is stored
--      with visibility 'just_me', so nothing that reads by visibility can show it,
--      and a second read policy lets the Pursuit's participants read it. A trigger
--      refuses a group Moment with no Pursuit or from someone who is not in it.
--   2. stubs grow three kinds. 'event' is what the table held (host-confirmed
--      attendance, unchanged). 'session' is one per Moment that counts toward a
--      Pursuit. 'gold' is one per person when a Pursuit they logged in is finished.
--      Both new kinds are issued by the trigger functions below; the table still has
--      no insert, update or delete privilege for anon or authenticated, so a client
--      can never give itself a Stub. Each Stub gets a per-person serial.
--      event_id and space_id become nullable (a session or gold Stub has neither);
--      the primary key moves to a new id and (user_id, event_id) stays unique, so
--      confirm_event_attendance() works unchanged. No ranking or counting of Stubs
--      is added anywhere.
--
-- Not added: Stub readers for other people (PR 5 shows friend signals through its own
-- function) and notification kinds (the Love this notification already exists).
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261101000000_moment_audience_and_stubs.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. posts.audience
-- ─────────────────────────────────────────────────────────────────────────
alter table public.posts
  add column audience text check (audience in ('group', 'friends', 'everyone'));

create function private.posts_audience_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.audience = 'group' then
    -- Only when a Moment becomes a group Moment. A Pursuit that is later deleted
    -- sets pursuit_id to null; the Moment then stays, readable by its maker only.
    if tg_op = 'INSERT' or old.audience is distinct from 'group' then
      if new.pursuit_id is null then
        raise exception 'Pick a Pursuit to share with its group.';
      end if;
      if not public.is_pursuit_participant(new.pursuit_id, new.user_id) then
        raise exception 'Only people in a Pursuit can post to its group.' using errcode = '42501';
      end if;
    end if;
    new.visibility := 'just_me';
  end if;
  return new;
end;
$$;
revoke all on function private.posts_audience_guard() from public, anon, authenticated;

create trigger posts_audience_guard
  before insert or update of audience, visibility, pursuit_id on public.posts
  for each row execute function private.posts_audience_guard();

create policy "group posts are readable by the group" on public.posts
  for select to authenticated
  using (
    posts.audience = 'group'
    and posts.pursuit_id is not null
    and public.is_pursuit_participant(posts.pursuit_id, (select auth.uid()))
    and public.is_visible_profile(posts.user_id)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. stubs: kinds, serial, and who issues them
-- ─────────────────────────────────────────────────────────────────────────
alter table public.stubs drop constraint stubs_pkey;
alter table public.stubs add column id bigint generated always as identity;
alter table public.stubs add constraint stubs_pkey primary key (id);
alter table public.stubs add constraint stubs_user_event_key unique (user_id, event_id);

alter table public.stubs
  alter column event_id drop not null,
  alter column space_id drop not null;

alter table public.stubs
  add column kind text not null default 'event' check (kind in ('event', 'session', 'gold')),
  add column post_id bigint references public.posts (id) on delete cascade,
  add column pursuit_id text references public.pursuits (id) on delete cascade,
  add column serial integer;

alter table public.stubs
  add constraint stubs_kind_fields check (
    (kind = 'event' and event_id is not null and space_id is not null)
    or (kind = 'session' and event_id is null and pursuit_id is not null and post_id is not null)
    or (kind = 'gold' and event_id is null and pursuit_id is not null)
  );

create unique index stubs_session_post_key on public.stubs (post_id) where kind = 'session';
create unique index stubs_gold_key on public.stubs (user_id, pursuit_id) where kind = 'gold';
create unique index stubs_user_serial_key on public.stubs (user_id, serial) where serial is not null;
create index stubs_pursuit_idx on public.stubs (pursuit_id) where pursuit_id is not null;

-- Each person's Stubs are numbered 1, 2, 3 in the order they were issued.
create function private.stubs_assign_serial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.serial is null then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    new.serial := 1 + coalesce((select max(s.serial) from public.stubs s where s.user_id = new.user_id), 0);
  end if;
  return new;
end;
$$;
revoke all on function private.stubs_assign_serial() from public, anon, authenticated;

create trigger stubs_assign_serial
  before insert on public.stubs
  for each row execute function private.stubs_assign_serial();

-- One session Stub per Moment that counts toward a Pursuit the poster is in.
-- Fires when a Moment is posted with a Pursuit, and when one is attached later.
create function private.issue_session_stub()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pursuit_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.pursuit_id is not distinct from new.pursuit_id then
    return new;
  end if;
  if public.is_pursuit_participant(new.pursuit_id, new.user_id) then
    insert into public.stubs (user_id, kind, post_id, pursuit_id)
      values (new.user_id, 'session', new.id, new.pursuit_id)
      on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.issue_session_stub() from public, anon, authenticated;

create trigger posts_issue_session_stub
  after insert or update of pursuit_id on public.posts
  for each row execute function private.issue_session_stub();

-- A gold Stub for everyone who logged a Moment in a Pursuit when it is finished.
create function private.issue_gold_stubs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.finished_at is null and new.finished_at is not null then
    insert into public.stubs (user_id, kind, pursuit_id)
      select distinct s.user_id, 'gold', new.id
      from public.stubs s
      where s.pursuit_id = new.id and s.kind = 'session'
      on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.issue_gold_stubs() from public, anon, authenticated;

create trigger pursuits_issue_gold_stubs
  after update of finished_at on public.pursuits
  for each row execute function private.issue_gold_stubs();
