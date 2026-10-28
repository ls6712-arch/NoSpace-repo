-- Soosh core loop v1, PR 3: open-group Pursuits, shared sessions and join requests.
--
-- Run AFTER 20261030000000_profiles_city_moods.sql.
--
--   1. pursuits.visibility ('open' | 'friends' | 'solo'), space_id (a host's Space,
--      nullable), capacity, ends_at. Existing Pursuits are backfilled: solo mode is
--      'solo', everything else 'friends'. An open Pursuit must be shared and have a
--      capacity (a check enforces both).
--   2. pursuit_members.status gains 'requested': a join request on an open Pursuit.
--      A requested person is not a participant, so they see nothing but their own row.
--   3. pursuit_sessions and pursuit_session_rsvps: the "Next together" card. Only the
--      owner sets a session; participants say "I'm in".
--   4. Three functions, all security definer with a fixed search_path:
--        open_pursuits_for_corner()  open Pursuits for a Corner, with spots and the
--                                    next session, for the Make it a Pursuit sheet
--        join_open_pursuit()         'joined' at once while at most half the spots
--                                    are taken, else 'requested'
--        answer_join_request()       the owner lets someone in or declines
--      Anyone who can see an open Pursuit here is a signed-in, active account. What
--      they see is the owner, up to three avatars and the counts, never the member
--      list.
--
-- Not added: notifications for join requests (the Notifications screen, PR 5), the
-- Stub kinds (PR 4).
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261031000000_open_pursuits.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. pursuits columns
-- ─────────────────────────────────────────────────────────────────────────
alter table public.pursuits
  add column visibility text not null default 'friends' check (visibility in ('open', 'friends', 'solo')),
  add column space_id uuid references public.spaces (id) on delete set null,
  add column capacity integer check (capacity is null or capacity between 2 and 200),
  add column ends_at timestamptz;

update public.pursuits set visibility = 'solo' where public.pursuits.mode = 'solo';

alter table public.pursuits
  add constraint pursuits_open_is_shared_with_capacity
  check (visibility <> 'open' or (coalesce(shared, false) and capacity is not null));

create index pursuits_open_corner_idx on public.pursuits (hobby_slug, sub_hobby) where visibility = 'open';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. join requests ride on pursuit_members
-- ─────────────────────────────────────────────────────────────────────────
alter table public.pursuit_members drop constraint pursuit_members_status_check;
alter table public.pursuit_members
  add constraint pursuit_members_status_check check (status = any (array['invited', 'joined', 'declined', 'requested']));

-- ─────────────────────────────────────────────────────────────────────────
-- 3. sessions and "I'm in"
-- ─────────────────────────────────────────────────────────────────────────
create table public.pursuit_sessions (
  id bigint generated always as identity primary key,
  pursuit_id text not null references public.pursuits (id) on delete cascade,
  starts_at timestamptz not null,
  place text check (place is null or char_length(place) <= 120),
  note text check (note is null or char_length(note) <= 140),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index pursuit_sessions_pursuit_idx on public.pursuit_sessions (pursuit_id, starts_at);

create table public.pursuit_session_rsvps (
  session_id bigint not null references public.pursuit_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create index pursuit_session_rsvps_user_idx on public.pursuit_session_rsvps (user_id);

alter table public.pursuit_sessions enable row level security;
alter table public.pursuit_session_rsvps enable row level security;

revoke all on public.pursuit_sessions, public.pursuit_session_rsvps from public, anon, authenticated;
grant select, insert, update, delete on public.pursuit_sessions to authenticated;
grant select, insert, delete on public.pursuit_session_rsvps to authenticated;

create policy "participants see sessions" on public.pursuit_sessions
  for select to authenticated
  using (public.is_pursuit_participant(pursuit_sessions.pursuit_id, (select auth.uid())));

create policy "the owner sets sessions" on public.pursuit_sessions
  for insert to authenticated
  with check (
    pursuit_sessions.created_by = (select auth.uid())
    and private.is_active((select auth.uid()))
    and not (select public.write_blocked())
    and exists (
      select 1 from public.pursuits p
      where p.id = pursuit_sessions.pursuit_id and p.user_id = (select auth.uid())
    )
  );

create policy "the owner edits sessions" on public.pursuit_sessions
  for update to authenticated
  using (exists (
    select 1 from public.pursuits p
    where p.id = pursuit_sessions.pursuit_id and p.user_id = (select auth.uid())
  ))
  with check (
    not (select public.write_blocked())
    and exists (
      select 1 from public.pursuits p
      where p.id = pursuit_sessions.pursuit_id and p.user_id = (select auth.uid())
    )
  );

create policy "the owner removes sessions" on public.pursuit_sessions
  for delete to authenticated
  using (exists (
    select 1 from public.pursuits p
    where p.id = pursuit_sessions.pursuit_id and p.user_id = (select auth.uid())
  ));

create policy "participants see who is in" on public.pursuit_session_rsvps
  for select to authenticated
  using (exists (
    select 1 from public.pursuit_sessions s
    where s.id = pursuit_session_rsvps.session_id
      and public.is_pursuit_participant(s.pursuit_id, (select auth.uid()))
  ));

create policy "you say you are in" on public.pursuit_session_rsvps
  for insert to authenticated
  with check (
    pursuit_session_rsvps.user_id = (select auth.uid())
    and private.is_active((select auth.uid()))
    and not (select public.write_blocked())
    and exists (
      select 1 from public.pursuit_sessions s
      where s.id = pursuit_session_rsvps.session_id
        and public.is_pursuit_participant(s.pursuit_id, (select auth.uid()))
    )
  );

create policy "you take it back" on public.pursuit_session_rsvps
  for delete to authenticated
  using (pursuit_session_rsvps.user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. functions
-- ─────────────────────────────────────────────────────────────────────────

-- People in an open Pursuit: the owner counts, plus every joined member.
create function private.pursuit_taken(pid text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 1 + (
    select count(*)::int from public.pursuit_members m
    where m.pursuit_id = pid and m.status = 'joined'
      and m.user_id <> (select p.user_id from public.pursuits p where p.id = pid)
  );
$$;
revoke all on function private.pursuit_taken(text) from public, anon, authenticated;

create function public.open_pursuits_for_corner(p_hobby_slug text, p_sub_hobby text, p_limit integer default 5)
returns table (
  pursuit_id text,
  title text,
  owner_id uuid,
  owner_name text,
  capacity integer,
  taken integer,
  ends_at timestamptz,
  session_id bigint,
  session_starts_at timestamptz,
  session_place text,
  people jsonb,
  mine text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_active(auth.uid()) then
    return;
  end if;
  return query
  select
    p.id,
    p.title,
    p.user_id,
    coalesce(nullif(trim(o.display_name), ''), o.username, 'Someone'),
    p.capacity,
    private.pursuit_taken(p.id),
    p.ends_at,
    s.id,
    s.starts_at,
    s.place,
    (
      select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(nullif(trim(pr.display_name), ''), pr.username, 'Someone'), 'avatar', pr.avatar_url) order by x.joined_at), '[]'::jsonb)
      from (
        select p.user_id as user_id, p.started_at as joined_at
        union all
        select m.user_id, m.created_at
        from public.pursuit_members m
        where m.pursuit_id = p.id and m.status = 'joined' and m.user_id <> p.user_id
        order by 2
        limit 3
      ) x
      join public.profiles pr on pr.id = x.user_id
    ),
    (select m2.status from public.pursuit_members m2 where m2.pursuit_id = p.id and m2.user_id = auth.uid())
  from public.pursuits p
  join public.profiles o on o.id = p.user_id
  left join lateral (
    select ps.id, ps.starts_at, ps.place
    from public.pursuit_sessions ps
    where ps.pursuit_id = p.id and ps.starts_at > now()
    order by ps.starts_at
    limit 1
  ) s on true
  where p.visibility = 'open'
    and p.hobby_slug = p_hobby_slug
    and p.sub_hobby = p_sub_hobby
    and p.finished_at is null and p.let_go_at is null and p.paused_at is null
    and (p.ends_at is null or p.ends_at > now())
    and not private.is_blocked_between(auth.uid(), p.user_id)
  order by (s.starts_at is null), s.starts_at, p.started_at desc
  limit greatest(1, least(coalesce(p_limit, 5), 20));
end;
$$;

create function public.join_open_pursuit(p_pursuit_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_capacity integer;
  v_taken integer;
  v_status text;
  v_existing text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join.';
  end if;
  if not private.is_active(auth.uid()) or (select public.write_blocked()) then
    raise exception 'Your account isn''t active yet.' using errcode = '42501';
  end if;
  select p.user_id, p.capacity into v_owner, v_capacity
  from public.pursuits p
  where p.id = p_pursuit_id and p.visibility = 'open'
    and p.finished_at is null and p.let_go_at is null and p.paused_at is null
    and (p.ends_at is null or p.ends_at > now());
  if v_owner is null then
    raise exception 'This group is no longer open.';
  end if;
  if v_owner = auth.uid() then
    return 'joined';
  end if;
  if private.is_blocked_between(auth.uid(), v_owner) then
    raise exception 'This group is no longer open.';
  end if;

  v_existing := (select m.status from public.pursuit_members m where m.pursuit_id = p_pursuit_id and m.user_id = auth.uid());
  if v_existing = 'joined' or v_existing = 'requested' then
    return v_existing;
  end if;
  if v_existing = 'declined' then
    raise exception 'The host did not accept this request.';
  end if;

  v_taken := private.pursuit_taken(p_pursuit_id);
  if v_taken >= v_capacity then
    raise exception 'This group is full.';
  end if;

  -- Instant while at most half the spots are taken; after that the owner decides.
  v_status := case when v_taken * 2 > v_capacity then 'requested' else 'joined' end;

  insert into public.pursuit_members (pursuit_id, user_id, role, status, invited_by)
    values (p_pursuit_id, v_owner, 'owner', 'joined', v_owner)
    on conflict (pursuit_id, user_id) do nothing;
  insert into public.pursuit_members (pursuit_id, user_id, role, status, invited_by)
    values (p_pursuit_id, auth.uid(), 'member', v_status, v_owner)
    on conflict (pursuit_id, user_id) do update set status = excluded.status;
  if v_status = 'joined' then
    update public.pursuits set mode = 'together' where public.pursuits.id = p_pursuit_id and public.pursuits.mode = 'solo';
  end if;
  return v_status;
end;
$$;

create function public.answer_join_request(p_pursuit_id text, p_user_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not exists (select 1 from public.pursuits p where p.id = p_pursuit_id and p.user_id = auth.uid()) then
    raise exception 'Only the host can answer a request.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.pursuit_members m
    where m.pursuit_id = p_pursuit_id and m.user_id = p_user_id and m.status = 'requested'
  ) then
    raise exception 'There is no request to answer.';
  end if;
  if p_accept then
    if private.pursuit_taken(p_pursuit_id) >= (select p.capacity from public.pursuits p where p.id = p_pursuit_id) then
      raise exception 'This group is full.';
    end if;
    update public.pursuit_members set status = 'joined'
      where public.pursuit_members.pursuit_id = p_pursuit_id and public.pursuit_members.user_id = p_user_id;
    update public.pursuits set mode = 'together' where public.pursuits.id = p_pursuit_id and public.pursuits.mode = 'solo';
  else
    update public.pursuit_members set status = 'declined'
      where public.pursuit_members.pursuit_id = p_pursuit_id and public.pursuit_members.user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.open_pursuits_for_corner(text, text, integer) from public, anon;
revoke all on function public.join_open_pursuit(text) from public, anon;
revoke all on function public.answer_join_request(text, uuid, boolean) from public, anon;
grant execute on function public.open_pursuits_for_corner(text, text, integer) to authenticated;
grant execute on function public.join_open_pursuit(text) to authenticated;
grant execute on function public.answer_join_request(text, uuid, boolean) to authenticated;
