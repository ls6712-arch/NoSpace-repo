-- Soosh: the four Stubs (brief: claude/claude-code-brief-stubs-earned.md, decided Oct 31, 2026).
--
-- Run AFTER 20261114000000_calendar_feed.sql.
-- Rollback: rollback_20261115000000_stubs_four_kinds.sql.
-- Verification: supabase/verification/stubs_four_kinds_check.sql.
--
-- A Stub is now one of four kinds, and nothing else earns one:
--   event    a host confirmed you came (unchanged: confirm_event_attendance)
--   finish   you finished a Pursuit: its goal was met, or (no goal) you logged on 3 different days
--   drop     you reached a drop's goal inside its window; numbered in finishing order (edition)
--   regular  you logged Moments in one Corner on 10 different New York days in one month
-- 'session' (one per Moment) is retired and its rows are removed; 'gold' becomes 'finish'.
--
-- Still true: no client can insert, update or delete a Stub (select-only grant, no write
-- policy). Every Stub is issued by a trigger or a security definer function here.
-- No count or ranking of people by Stubs is added.
--
-- What this adds:
--   1. public.drops (admin-written) and pursuits.drop_id, set only by public.join_drop()
--   2. stubs: kinds, drop_id, edition, corner_key, period, pinned_at; post_id now means
--      "the Moment that earned it" for every Moment-earned kind
--   3. helpers: private.ny_day, private.corner_key_of, private.moment_counts
--   4. triggers: issue_finish_stubs (replaces issue_gold_stubs), award_moment_stubs
--      (drop + regular, replaces issue_session_stub), stubs_fill_corner_key, stubs_notify
--   5. readers: get_profile_stubs (all kinds), get_profile and get_profile_pursuits count
--      what the viewer may see, regular_days_this_month (the owner's tease, 7 to 9 only)
--   6. pin_stub (owner, at most 3)
--   7. notification kind 'stub_earned' (a host confirmed you came)
--   8. backfill: Finisher Stubs for Pursuits already finished, Regular Stubs for past months,
--      then each person's serials renumbered once in issued order
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Helpers
-- ─────────────────────────────────────────────────────────────────────────

-- The New York day a moment in time falls on. Every "day" and "month" here is New York's.
create function private.ny_day(p_at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_at at time zone 'America/New_York')::date;
$$;

-- "space/corner", the key a Corner is known by everywhere (ticket_saves uses the same shape).
create function private.corner_key_of(p_space text, p_corner text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when nullif(p_space, '') is null or nullif(p_corner, '') is null then null
              else lower(p_space) || '/' || lower(p_corner) end;
$$;

-- A Moment counts toward a Stub when it has a photo or video and was posted within 48 hours
-- of when it happened (old photos can still be posted; they just don't earn).
create function private.moment_counts(p_type text, p_media_url text, p_media_paths text[], p_created timestamptz, p_occurred timestamptz)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_type, '') in ('photo', 'video')
     and (nullif(p_media_url, '') is not null or coalesce(array_length(p_media_paths, 1), 0) > 0)
     and p_occurred >= p_created - interval '48 hours'
     and p_occurred <= p_created + interval '1 hour';
$$;

revoke all on function private.ny_day(timestamptz), private.corner_key_of(text, text),
  private.moment_counts(text, text, text[], timestamptz, timestamptz) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Drops
-- ─────────────────────────────────────────────────────────────────────────

create table public.drops (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  title text not null check (char_length(title) between 1 and 60),
  blurb text check (blurb is null or char_length(blurb) <= 280),
  corner_key text not null check (corner_key ~ '^[a-z0-9-]+/[a-z0-9-]+$'),
  target_moments integer not null check (target_moments between 1 and 60),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  max_editions integer check (max_editions is null or max_editions between 1 and 100000),
  art_path text check (art_path is null or (char_length(art_path) <= 300 and art_path !~ '\.\.')),
  palette jsonb not null default '["#ff7ab6", "#ffd36e", "#7ff2c8", "#73aaff", "#c47bff"]'::jsonb
    check (jsonb_typeof(palette) = 'array' and jsonb_array_length(palette) between 2 and 6),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create index drops_window_idx on public.drops (opens_at, closes_at);

alter table public.drops enable row level security;

-- Anyone can see a drop once it has opened; admins see them all, early.
create policy "drops are public once open" on public.drops for select to anon, authenticated
  using (drops.opens_at <= now() or private.is_admin((select auth.uid())));
create policy "admins write drops" on public.drops for insert to authenticated
  with check (private.is_admin((select auth.uid())));
create policy "admins edit drops" on public.drops for update to authenticated
  using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

revoke all on public.drops from anon, authenticated;
grant select on public.drops to anon, authenticated;
grant insert, update on public.drops to authenticated;
-- No delete for anyone but the table owner: a drop people hold Stubs from must stay.

alter table public.pursuits
  add column drop_id bigint references public.drops (id) on delete restrict;
create unique index pursuits_drop_once_idx on public.pursuits (user_id, drop_id) where drop_id is not null;
create index pursuits_drop_idx on public.pursuits (drop_id) where drop_id is not null;

-- drop_id is set only by join_drop() and never changes afterwards.
create function private.pursuits_drop_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.drop_id is not null)
     or (tg_op = 'UPDATE' and new.drop_id is distinct from old.drop_id) then
    if tg_op = 'UPDATE' or coalesce(current_setting('soosh.join_drop', true), '') <> 'on' then
      raise exception 'That can’t be changed.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.pursuits_drop_guard() from public, anon, authenticated;
create trigger pursuits_drop_guard
  before insert or update of drop_id on public.pursuits
  for each row execute function private.pursuits_drop_guard();

-- Join an open drop: makes your own Pursuit for it, once. Returns that Pursuit's id.
create function public.join_drop(p_drop_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id text;
  v_title text;
  v_key text;
  v_target integer;
  v_opens timestamptz;
  v_closes timestamptz;
  v_max integer;
begin
  if v_uid is null then
    raise exception 'You’re not logged in.';
  end if;
  if not private.is_active(v_uid) or public.write_blocked() then
    raise exception 'Your account can’t join right now.' using errcode = '42501';
  end if;
  v_title := (select d.title from public.drops d where d.id = p_drop_id);
  v_key := (select d.corner_key from public.drops d where d.id = p_drop_id);
  v_target := (select d.target_moments from public.drops d where d.id = p_drop_id);
  v_opens := (select d.opens_at from public.drops d where d.id = p_drop_id);
  v_closes := (select d.closes_at from public.drops d where d.id = p_drop_id);
  v_max := (select d.max_editions from public.drops d where d.id = p_drop_id);
  if v_title is null or v_opens > now() then
    raise exception 'That doesn’t exist.';
  end if;
  if v_closes <= now() then
    raise exception 'That one has closed.';
  end if;
  v_id := (select pu.id from public.pursuits pu where pu.user_id = v_uid and pu.drop_id = p_drop_id);
  if v_id is not null then
    return v_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('drop:' || p_drop_id::text, 0));
  if v_max is not null
     and (select count(*) from public.pursuits pu where pu.drop_id = p_drop_id) >= v_max then
    raise exception 'That one is full.';
  end if;
  v_id := gen_random_uuid()::text;
  perform set_config('soosh.join_drop', 'on', true);
  insert into public.pursuits (id, user_id, title, hobby_slug, sub_hobby, target_moments, shared, visibility, mode, drop_id)
  values (v_id, v_uid, v_title, split_part(v_key, '/', 1), split_part(v_key, '/', 2), v_target, true, 'friends', 'solo', p_drop_id);
  perform set_config('soosh.join_drop', 'off', true);
  return v_id;
end;
$$;
revoke all on function public.join_drop(bigint) from public, anon;
grant execute on function public.join_drop(bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. stubs: the four kinds
-- ─────────────────────────────────────────────────────────────────────────

drop trigger posts_issue_session_stub on public.posts;
drop function private.issue_session_stub();
drop trigger pursuits_issue_gold_stubs on public.pursuits;
drop function private.issue_gold_stubs();

alter table public.stubs drop constraint stubs_kind_fields;
alter table public.stubs drop constraint stubs_kind_check;
drop index public.stubs_session_post_key;
drop index public.stubs_gold_key;
drop index public.stubs_user_serial_key;

-- One per Moment is retired. The Moments stay; only their Stubs go.
delete from public.stubs where public.stubs.kind = 'session';
update public.stubs set kind = 'finish' where public.stubs.kind = 'gold';

alter table public.stubs
  add column drop_id bigint references public.drops (id) on delete restrict,
  add column edition integer check (edition is null or edition >= 1),
  add column corner_key text,
  add column period date,
  add column pinned_at timestamptz;

alter table public.stubs
  add constraint stubs_kind_check check (kind in ('event', 'finish', 'drop', 'regular')),
  add constraint stubs_kind_fields check (
    (kind = 'event' and event_id is not null and space_id is not null)
    or (kind = 'finish' and event_id is null and pursuit_id is not null and drop_id is null)
    or (kind = 'drop' and event_id is null and pursuit_id is not null and drop_id is not null and edition is not null)
    or (kind = 'regular' and event_id is null and corner_key is not null and period is not null)
  );

create unique index stubs_pursuit_award_key on public.stubs (user_id, pursuit_id) where kind in ('finish', 'drop');
create unique index stubs_drop_edition_key on public.stubs (drop_id, edition) where kind = 'drop';
create unique index stubs_regular_key on public.stubs (user_id, corner_key, period) where kind = 'regular';
create index stubs_user_idx on public.stubs (user_id, issued_at desc);
create index stubs_post_idx on public.stubs (post_id) where post_id is not null;

-- An event Stub knows its Corner by id; give it the key the other kinds use.
create function private.stubs_fill_corner_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.corner_key is null and new.corner_id is not null then
    new.corner_key := (select private.corner_key_of(c.space_slug, c.slug) from public.corners c where c.id = new.corner_id);
  end if;
  return new;
end;
$$;
revoke all on function private.stubs_fill_corner_key() from public, anon, authenticated;
create trigger stubs_fill_corner_key
  before insert on public.stubs
  for each row execute function private.stubs_fill_corner_key();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Issuing
-- ─────────────────────────────────────────────────────────────────────────

-- Finisher: when a Pursuit is finished (by its goal, or the Finish button), to each person in
-- it who did their part. Un-finishing takes them back; finishing again re-issues them.
create function private.issue_finish_stubs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_people integer;
  v_total integer;
begin
  if old.finished_at is not null and new.finished_at is null then
    delete from public.stubs where public.stubs.pursuit_id = new.id and public.stubs.kind = 'finish';
    return new;
  end if;
  if not (old.finished_at is null and new.finished_at is not null) then
    return new;
  end if;
  -- A drop still open is earned as a drop, not a Finisher (award_moment_stubs).
  if new.drop_id is not null
     and exists (select 1 from public.drops d where d.id = new.drop_id and d.closes_at > now()) then
    return new;
  end if;
  v_people := 1 + (select count(*) from public.pursuit_members pm
                    where pm.pursuit_id = new.id and pm.status = 'joined' and pm.user_id <> new.user_id);
  v_total := (select count(*) from public.posts po where po.pursuit_id = new.id);
  insert into public.stubs (user_id, kind, pursuit_id, corner_key, post_id)
  select x.uid, 'finish', new.id, private.corner_key_of(new.hobby_slug, new.sub_hobby),
         (select max(po.id) from public.posts po where po.pursuit_id = new.id and po.user_id = x.uid)
    from (select new.user_id as uid
          union
          select pm.user_id from public.pursuit_members pm
           where pm.pursuit_id = new.id and pm.status = 'joined') x
   where case
           when new.target_moments is not null then
             v_total >= new.target_moments
             and (select count(*) from public.posts po where po.pursuit_id = new.id and po.user_id = x.uid)
                 >= case when v_people > 1 then 2 else 1 end
           else
             (select count(distinct private.ny_day(coalesce(pp.occurred_at, po.created_at)))
                from public.posts po left join public.post_private pp on pp.post_id = po.id
               where po.pursuit_id = new.id and po.user_id = x.uid) >= 3
         end
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.issue_finish_stubs() from public, anon, authenticated;
create trigger pursuits_issue_finish_stubs
  after update of finished_at on public.pursuits
  for each row execute function private.issue_finish_stubs();

-- Drop and Regular, from a Moment as it is posted. Named to run after posts_seed_private,
-- so the Moment's post_private row (when it happened) already exists.
create function private.award_moment_stubs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurred timestamptz;
  v_key text;
  v_month date;
  v_days integer;
  v_drop bigint;
  v_target integer;
  v_opens timestamptz;
  v_closes timestamptz;
  v_done integer;
  v_edition integer;
begin
  v_occurred := coalesce((select pp.occurred_at from public.post_private pp where pp.post_id = new.id), new.created_at);
  if not private.moment_counts(new.type, new.media_url, new.media_paths, new.created_at, v_occurred) then
    return new;
  end if;

  -- Drop: your own Moments in your drop Pursuit reach its goal inside the window.
  if new.pursuit_id is not null then
    v_drop := (select pu.drop_id from public.pursuits pu where pu.id = new.pursuit_id and pu.user_id = new.user_id);
    if v_drop is not null then
      v_target := (select d.target_moments from public.drops d where d.id = v_drop);
      v_opens := (select d.opens_at from public.drops d where d.id = v_drop);
      v_closes := (select d.closes_at from public.drops d where d.id = v_drop);
      if now() >= v_opens and now() < v_closes
         and not exists (select 1 from public.stubs s where s.user_id = new.user_id and s.pursuit_id = new.pursuit_id and s.kind in ('drop', 'finish')) then
        v_done := (select count(*) from public.posts po
                     left join public.post_private pp on pp.post_id = po.id
                    where po.pursuit_id = new.pursuit_id and po.user_id = new.user_id
                      and po.created_at >= v_opens and po.created_at < v_closes
                      and private.moment_counts(po.type, po.media_url, po.media_paths, po.created_at, coalesce(pp.occurred_at, po.created_at)));
        if v_done >= v_target then
          perform pg_advisory_xact_lock(hashtextextended('drop:' || v_drop::text, 0));
          v_edition := 1 + coalesce((select max(s.edition) from public.stubs s where s.drop_id = v_drop and s.kind = 'drop'), 0);
          insert into public.stubs (user_id, kind, pursuit_id, drop_id, edition, corner_key, post_id)
          values (new.user_id, 'drop', new.pursuit_id, v_drop, v_edition,
                  (select d.corner_key from public.drops d where d.id = v_drop), new.id)
          on conflict do nothing;
        end if;
      end if;
    end if;
  end if;

  -- Regular: this Corner on 10 different days of this month.
  v_key := private.corner_key_of(new.hobby_slug, coalesce(nullif(new.corner, ''), nullif(new.sub_hobby, '')));
  if v_key is not null then
    v_month := date_trunc('month', private.ny_day(v_occurred))::date;
    if not exists (select 1 from public.stubs s where s.user_id = new.user_id and s.kind = 'regular' and s.corner_key = v_key and s.period = v_month) then
      perform pg_advisory_xact_lock(hashtextextended('regular:' || new.user_id::text, 0));
      v_days := (select count(distinct private.ny_day(coalesce(pp.occurred_at, po.created_at)))
                   from public.posts po
                   left join public.post_private pp on pp.post_id = po.id
                  where po.user_id = new.user_id
                    and private.corner_key_of(po.hobby_slug, coalesce(nullif(po.corner, ''), nullif(po.sub_hobby, ''))) = v_key
                    and private.moment_counts(po.type, po.media_url, po.media_paths, po.created_at, coalesce(pp.occurred_at, po.created_at))
                    and private.ny_day(coalesce(pp.occurred_at, po.created_at)) >= v_month
                    and private.ny_day(coalesce(pp.occurred_at, po.created_at)) < (v_month + interval '1 month')::date);
      if v_days >= 10 then
        insert into public.stubs (user_id, kind, corner_key, period, post_id)
        values (new.user_id, 'regular', v_key, v_month, new.id)
        on conflict do nothing;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.award_moment_stubs() from public, anon, authenticated;
create trigger posts_zz_award_moment_stubs
  after insert on public.posts
  for each row execute function private.award_moment_stubs();

-- A host confirmed you came: tell you, once per Stub.
create function private.stubs_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'event' then
    insert into public.notifications (user_id, kind, body, href)
    values (new.user_id, 'stub_earned',
            left(coalesce((select sp.name from public.spaces sp where sp.id = new.space_id), 'Your host'), 150) || ' confirmed you were there.',
            '/you?tab=stubs');
  end if;
  return new;
end;
$$;
revoke all on function private.stubs_notify() from public, anon, authenticated;
create trigger stubs_notify
  after insert on public.stubs
  for each row execute function private.stubs_notify();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Who may see a Stub
-- ─────────────────────────────────────────────────────────────────────────

-- p_role is private.can_read_lists() for the viewer (never null here).
create function private.stub_shown(p_kind text, p_pursuit text, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_role = 'owner'
      or p_kind in ('drop', 'regular', 'event')
      or (p_kind = 'finish' and exists (select 1 from public.pursuits pu
                                         where pu.id = p_pursuit and pu.shared and pu.archived_at is null));
$$;

-- An event Stub from a Closed Space shows its Space and event only to members (and the owner).
create function private.stub_event_full(p_space uuid, p_viewer uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_role = 'owner'
      or (select sp.access from public.spaces sp where sp.id = p_space) = 'open'
      or exists (select 1 from public.space_members sm
                  where sm.space_id = p_space and sm.user_id = p_viewer and sm.status = 'active');
$$;
revoke all on function private.stub_shown(text, text, text), private.stub_event_full(uuid, uuid, text) from public, anon, authenticated;

drop function public.get_profile_stubs(uuid);
create function public.get_profile_stubs(p_profile uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := auth.uid();
  v_role text := private.can_read_lists(auth.uid(), p_profile);
begin
  if v_role is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.issued_at desc) from (
      select s.issued_at,
             jsonb_strip_nulls(jsonb_build_object(
               'id', s.id,
               'kind', s.kind,
               'cornerKey', s.corner_key,
               'day', to_char(private.ny_day(s.issued_at), 'YYYY-MM-DD'),
               'pinned', s.pinned_at is not null,
               'serial', case when v_role = 'owner' then s.serial end,
               'title', case
                          when s.kind in ('finish', 'drop') then left(pu.title, 60)
                          when s.kind = 'event' and private.stub_event_full(s.space_id, v_viewer, v_role) then left(se.title, 80)
                        end,
               'goal', case when s.kind = 'finish' then pu.target_moments when s.kind = 'drop' then d.target_moments end,
               'coverPath', case when s.kind = 'finish' then pu.cover_image_path end,
               'period', case when s.kind = 'regular' then to_char(s.period, 'YYYY-MM') end,
               'drop', case when s.kind = 'drop' then jsonb_build_object(
                         'slug', d.slug, 'title', d.title, 'artPath', d.art_path, 'palette', d.palette,
                         'edition', s.edition, 'closesAt', d.closes_at,
                         'editionsTotal', case when d.closes_at <= now() then
                           (select count(*) from public.stubs s2 where s2.drop_id = d.id and s2.kind = 'drop') end) end,
               'event', case when s.kind = 'event' then
                          case when private.stub_event_full(s.space_id, v_viewer, v_role) then jsonb_build_object(
                                 'full', true,
                                 'spaceName', left(sp.name, 80),
                                 'spaceSlug', sp.slug,
                                 'neighborhood', se.neighborhood,
                                 'hostName', left(public.pursuit_person_name(s.issued_by), 60))
                               else jsonb_build_object('full', false, 'month', to_char(private.ny_day(s.issued_at), 'YYYY-MM')) end end
             )) as j
        from public.stubs s
        left join public.pursuits pu on pu.id = s.pursuit_id
        left join public.drops d on d.id = s.drop_id
        left join public.space_events se on se.id = s.event_id
        left join public.spaces sp on sp.id = s.space_id
       where s.user_id = p_profile
         and private.stub_shown(s.kind, s.pursuit_id, v_role)
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_profile_stubs(uuid) from public;
grant execute on function public.get_profile_stubs(uuid) to anon, authenticated;

-- The owner's own tease: how many different days this month they've logged this Corner,
-- but only from 7 to 9. Anything else is null, so no screen can become a counter.
create function public.regular_days_this_month(p_corner_key text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_month date := date_trunc('month', private.ny_day(now()))::date;
  v_days integer;
begin
  if v_uid is null or p_corner_key is null then
    return null;
  end if;
  if exists (select 1 from public.stubs s where s.user_id = v_uid and s.kind = 'regular' and s.corner_key = lower(p_corner_key) and s.period = v_month) then
    return null;
  end if;
  v_days := (select count(distinct private.ny_day(coalesce(pp.occurred_at, po.created_at)))
               from public.posts po
               left join public.post_private pp on pp.post_id = po.id
              where po.user_id = v_uid
                and private.corner_key_of(po.hobby_slug, coalesce(nullif(po.corner, ''), nullif(po.sub_hobby, ''))) = lower(p_corner_key)
                and private.moment_counts(po.type, po.media_url, po.media_paths, po.created_at, coalesce(pp.occurred_at, po.created_at))
                and private.ny_day(coalesce(pp.occurred_at, po.created_at)) >= v_month);
  return case when v_days between 7 and 9 then v_days end;
end;
$$;
revoke all on function public.regular_days_this_month(text) from public, anon;
grant execute on function public.regular_days_this_month(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. The front row
-- ─────────────────────────────────────────────────────────────────────────

create function public.pin_stub(p_stub_id bigint, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'You’re not logged in.';
  end if;
  if not exists (select 1 from public.stubs s where s.id = p_stub_id and s.user_id = v_uid) then
    raise exception 'That Stub isn’t yours.' using errcode = '42501';
  end if;
  if coalesce(p_pinned, false) then
    perform pg_advisory_xact_lock(hashtextextended('pin:' || v_uid::text, 0));
    if (select count(*) from public.stubs s where s.user_id = v_uid and s.pinned_at is not null and s.id <> p_stub_id) >= 3 then
      raise exception 'Your front row is full. Take one down first.';
    end if;
    update public.stubs set pinned_at = coalesce(public.stubs.pinned_at, now()) where public.stubs.id = p_stub_id;
  else
    update public.stubs set pinned_at = null where public.stubs.id = p_stub_id;
  end if;
end;
$$;
revoke all on function public.pin_stub(bigint, boolean) from public, anon;
grant execute on function public.pin_stub(bigint, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Profile counts: every kind the viewer may see (copied from
--    20261110000000_profile_roles_and_planning.sql; only the Stub counts change)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.get_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := auth.uid();
  v_id uuid;
  v_role text;
  v_p record;
  v_stubs integer;
  v_pursuits integer;
  v_friends integer;
  v_lvl record;
  v_next_min integer;
  v_follow text;
  v_followed_by boolean;
  v_closed boolean;
  v_out jsonb;
  v_mutual jsonb;
  v_paused boolean;
begin
  v_id := (select p.id from public.profiles p
            where (p.id::text = p_username or lower(p.username) = lower(p_username))
              and p.paused_at is null and p.deletion_requested_at is null);
  if v_id is null then
    return null;
  end if;
  v_role := private.viewer_role(v_viewer, v_id);
  if v_role = 'blocked' then
    return null;
  end if;

  select p.username, p.display_name, p.avatar_url, p.neighborhood, p.bio, p.is_private, p.planning_paused
    into v_p from public.profiles p where p.id = v_id;
  v_closed := v_p.is_private and v_role in ('public');

  -- Every Stub the viewer may see (the four kinds, 20261115000000).
  v_stubs := (select count(*) from public.stubs s
              where s.user_id = v_id
                and private.stub_shown(s.kind, s.pursuit_id, case when v_role = 'owner' then 'owner' else 'other' end));
  select l.idx, l.name into v_lvl from private.level_for(v_stubs) l;

  v_follow := coalesce((select f.status from public.profile_follows f
                         where f.follower_id = v_viewer and f.followed_id = v_id), 'none');

  v_out := jsonb_build_object(
    'role', v_role,
    'id', v_id,
    'username', v_p.username,
    'displayName', v_p.display_name,
    'avatarUrl', v_p.avatar_url,
    'followState', v_follow
  );

  if v_closed then
    return v_out || jsonb_build_object('private', true, 'levelName', v_lvl.name);
  end if;

  v_pursuits := (select count(*) from public.pursuits pu
                  where pu.user_id = v_id and pu.archived_at is null
                    and (v_role = 'owner' or pu.shared));
  v_friends := (select count(*) from public.profile_follows f
                 where f.followed_id = v_id and f.status = 'accepted'
                   and exists (select 1 from public.profile_follows g
                                where g.follower_id = v_id and g.followed_id = f.follower_id
                                  and g.status = 'accepted'));

  v_out := v_out || jsonb_build_object(
    'private', false,
    'neighborhood', v_p.neighborhood,
    'bio', v_p.bio,
    'stubCount', v_stubs,
    'pursuitCount', v_pursuits,
    'friendCount', v_friends,
    'level', jsonb_build_object('index', v_lvl.idx, 'name', v_lvl.name)
  );

  if v_role = 'owner' then
    v_next_min := (select l.min_stubs from (values (2, 1), (3, 3), (4, 7), (5, 10), (6, 20), (7, 35), (8, 50)) as l (idx, min_stubs)
                    where l.idx = v_lvl.idx + 1);
    v_out := v_out || jsonb_build_object(
      'stubsToNext', case when v_next_min is null then null else v_next_min - v_stubs end,
      'planningPaused', v_p.planning_paused,
      'isPrivate', v_p.is_private
    );
  end if;

  if v_role in ('friend', 'follower', 'public') then
    v_followed_by := exists (select 1 from public.profile_follows f
                              where f.follower_id = v_id and f.followed_id = v_viewer and f.status = 'accepted');
    v_out := v_out || jsonb_build_object('followsYou', v_followed_by);
  end if;

  if v_role = 'friend' then
    v_out := v_out || jsonb_build_object('planningPaused', v_p.planning_paused);
  end if;

  if v_role in ('friend', 'follower') then
    -- Mutual friends: people who are friends with both of you.
    v_mutual := coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', left(m.display_name, 60), 'avatarUrl', m.avatar_url) order by m.display_name)
        from public.profiles m
       where m.id <> v_viewer and m.id <> v_id
         and private.is_friend(m.id, v_viewer) and private.is_friend(m.id, v_id)
         and not private.is_blocked_between(m.id, v_viewer)
    ), '[]'::jsonb);
    if v_role = 'friend' then
      v_out := v_out || jsonb_build_object('mutualFriends', v_mutual, 'mutualFriendCount', jsonb_array_length(v_mutual));
    else
      v_out := v_out || jsonb_build_object('mutualFriendCount', jsonb_array_length(v_mutual));
    end if;
  end if;

  if v_role = 'friend' then
    -- Categories both of you have a Pursuit in, as plain names.
    v_out := v_out || jsonb_build_object('sharedCategories', coalesce((
      select jsonb_agg(distinct a.cat order by a.cat) from (
        select coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, '')) as cat
          from public.pursuits pu where pu.user_id = v_id and pu.archived_at is null
      ) a
      join (
        select coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, '')) as cat
          from public.pursuits pu where pu.user_id = v_viewer and pu.archived_at is null
      ) b on lower(b.cat) = lower(a.cat)
      where a.cat is not null
    ), '[]'::jsonb));
  end if;

  return v_out;
end;
$$;
revoke all on function public.get_profile(text) from public;
grant execute on function public.get_profile(text) to anon, authenticated;

create or replace function public.get_profile_pursuits(p_profile uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := auth.uid();
  v_role text := private.can_read_lists(v_viewer, p_profile);
begin
  if v_role is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.sort_at desc) from (
      select coalesce(pu.finished_at, pu.started_at) as sort_at,
             jsonb_build_object(
               'id', pu.id,
               'category', coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, ''), 'Something new'),
               'goal', left(pu.title, 60),
               'target', pu.target_moments,
               'momentCount', (select count(*) from public.posts po where po.pursuit_id = pu.id and po.user_id = p_profile
                                and (v_role = 'owner' or coalesce(po.visible_at, po.created_at) <= now())),
               'stubCount', (select count(*) from public.stubs s
                             where s.pursuit_id = pu.id and s.user_id = p_profile and s.kind in ('finish', 'drop')),
               'finished', pu.finished_at is not null
                 and (v_role = 'owner' or pu.target_moments is null
                      or (select count(*) from public.posts po where po.pursuit_id = pu.id and po.user_id = p_profile
                            and coalesce(po.visible_at, po.created_at) <= now()) >= pu.target_moments),
               'archived', pu.archived_at is not null,
               'lastMomentDate', case when v_role = 'owner' then
                   (select max(coalesce(pp.occurred_at, po.created_at)) from public.posts po left join public.post_private pp on pp.post_id = po.id where po.pursuit_id = pu.id) else null end,
               'finishedAt', case when pu.finished_at is null then null
                                  when v_role = 'owner' then to_char(pu.finished_at at time zone 'UTC', 'YYYY-MM-DD')
                                  else to_char(pu.finished_at at time zone 'UTC', 'YYYY-MM') end,
               'sharedWithYou', v_role = 'friend' and exists (
                   select 1 from public.pursuits mine
                    where mine.user_id = v_viewer and mine.archived_at is null
                      and lower(coalesce(nullif(mine.sub_hobby, ''), nullif(mine.interest, ''))) =
                          lower(coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, ''))))
             ) as j
        from public.pursuits pu
       where pu.user_id = p_profile
         and (v_role = 'owner' or (pu.shared and pu.archived_at is null))
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_profile_pursuits(uuid) from public;
grant execute on function public.get_profile_pursuits(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Notifications: 'stub_earned' (copied from 20261110000000; one kind added)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.enforce_notification_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.kind = 'save' then
    if coalesce(current_setting('soosh.save_notice', true), '') <> 'on' then
      raise exception 'Not a recognized notification kind: %', new.kind;
    end if;
    new.actor_id := null;
    new.actor_name := null;
  else
    new.actor_id := auth.uid();
  end if;

  if new.kind not in (
    'hobby_follow', 'joined', 'make_together', 'explore_together', 'thought',
    'message', 'accepted', 'message_request', 'space_invite',
    'pursuit_invite', 'pursuit_joined', 'pursuit_progress',
    'space_event_cancelled',
    'space_join_request', 'space_join_approved', 'space_join_declined', 'space_host_invite',
    'space_moment_pending', 'space_moment_approved',
    'first_moment', 'love', 'save', 'plan_invite', 'stub_earned'
  ) then
    raise exception 'Not a recognized notification kind: %', new.kind;
  end if;

  if new.actor_name is not null
     and new.actor_name not in ('Someone', 'You')
     and new.actor_name is distinct from public.pursuit_person_name(new.actor_id)
  then
    new.actor_name := public.pursuit_person_name(new.actor_id);
  end if;

  if new.href is not null
     and (new.href !~ '^/[a-zA-Z0-9/_?=&-]*$' or new.href like '//%')
  then
    raise exception 'A notification link must be an in-app path.';
  end if;

  if char_length(new.body) > 300 then
    raise exception 'A notification is too long.';
  end if;

  if new.actor_id is not null
     and new.actor_id <> new.user_id
     and private.is_blocked_between(new.actor_id, new.user_id) then
    return null;
  end if;

  if private.notification_kind_muted(new.user_id, new.kind) then
    return null;
  end if;

  new.target_post_id := null;
  new.target_pursuit_id := null;

  declare
    v_post_text text;
    v_post_id bigint;
    v_pursuit_id text;
  begin
    v_post_text := substring(new.href from '^/moment/(\d+)');
    if v_post_text is not null and char_length(v_post_text) <= 18 then
      v_post_id := v_post_text::bigint;
      if exists (select 1 from public.posts where public.posts.id = v_post_id) then
        new.target_post_id := v_post_id;
      end if;
    end if;

    v_pursuit_id := substring(new.href from '^/pursuit/([^/?]+)');
    if v_pursuit_id is not null
       and exists (select 1 from public.pursuits where public.pursuits.id = v_pursuit_id) then
      new.target_pursuit_id := v_pursuit_id;
    end if;
  end;

  return new;
end;
$function$;


-- ─────────────────────────────────────────────────────────────────────────
-- 9. Backfill, then serials
-- ─────────────────────────────────────────────────────────────────────────

-- Finisher Stubs for Pursuits already finished, by the same rule as issue_finish_stubs().
insert into public.stubs (user_id, kind, pursuit_id, corner_key, post_id, issued_at)
select x.uid, 'finish', pu.id, private.corner_key_of(pu.hobby_slug, pu.sub_hobby),
       (select max(po.id) from public.posts po where po.pursuit_id = pu.id and po.user_id = x.uid),
       pu.finished_at
  from public.pursuits pu
  cross join lateral (
    select pu.user_id as uid
    union
    select pm.user_id from public.pursuit_members pm where pm.pursuit_id = pu.id and pm.status = 'joined'
  ) x
 where pu.finished_at is not null
   and pu.drop_id is null
   and case
         when pu.target_moments is not null then
           (select count(*) from public.posts po where po.pursuit_id = pu.id) >= pu.target_moments
           and (select count(*) from public.posts po where po.pursuit_id = pu.id and po.user_id = x.uid)
               >= case when (select count(*) from public.pursuit_members pm
                              where pm.pursuit_id = pu.id and pm.status = 'joined' and pm.user_id <> pu.user_id) > 0 then 2 else 1 end
         else
           (select count(distinct private.ny_day(coalesce(pp.occurred_at, po.created_at)))
              from public.posts po left join public.post_private pp on pp.post_id = po.id
             where po.pursuit_id = pu.id and po.user_id = x.uid) >= 3
       end
 order by pu.finished_at
on conflict do nothing;

-- Regular Stubs for past months: issued on the 10th different day, from that day's first Moment.
insert into public.stubs (user_id, kind, corner_key, period, post_id, issued_at)
select r.user_id, 'regular', r.corner_key, r.period, r.post_id, r.created_at
  from (
    select d.user_id, d.corner_key, d.period, d.post_id, d.created_at,
           row_number() over (partition by d.user_id, d.corner_key, d.period order by d.day) as nth
      from (
        select distinct on (po.user_id, k.corner_key, private.ny_day(coalesce(pp.occurred_at, po.created_at)))
               po.user_id, k.corner_key,
               date_trunc('month', private.ny_day(coalesce(pp.occurred_at, po.created_at)))::date as period,
               private.ny_day(coalesce(pp.occurred_at, po.created_at)) as day,
               po.id as post_id, po.created_at
          from public.posts po
          left join public.post_private pp on pp.post_id = po.id
          cross join lateral (select private.corner_key_of(po.hobby_slug, coalesce(nullif(po.corner, ''), nullif(po.sub_hobby, ''))) as corner_key) k
         where k.corner_key is not null
           and private.moment_counts(po.type, po.media_url, po.media_paths, po.created_at, coalesce(pp.occurred_at, po.created_at))
         order by po.user_id, k.corner_key, private.ny_day(coalesce(pp.occurred_at, po.created_at)), po.created_at
      ) d
  ) r
 where r.nth = 10
 order by r.created_at
on conflict do nothing;

-- Each person's Stubs numbered 1, 2, 3 in the order they were issued, once.
update public.stubs
   set serial = n.rn
  from (select s.id, row_number() over (partition by s.user_id order by s.issued_at, s.id) as rn from public.stubs s) n
 where n.id = public.stubs.id;
create unique index stubs_user_serial_key on public.stubs (user_id, serial) where serial is not null;
