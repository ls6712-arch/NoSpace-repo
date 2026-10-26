-- Soosh: Stubs, the event source. A row here is host-confirmed attendance at a
-- Space event, and is what the "event" type of Stub on a Shelf is read from.
-- Stubs on the Shelf are one concept with several types (silver, ticket, with
-- someone, event, plain), derived from Moments in the Door list's Shelf tab;
-- this file adds only the event source and the host action that fills it.
--
-- Run AFTER 20261027000000_corner_categories_18.sql.
--
-- Nobody can give themselves a Stub:
--
--   * public.stubs has RLS on and NO insert, update or delete policy, and the
--     table privileges for anon and authenticated are select only. The only
--     way a row appears is confirm_event_attendance() below.
--   * confirm_event_attendance() refuses the caller's own id in the list, so
--     a host cannot tick themselves either (another host can).
--
-- What this adds:
--   1. public.stubs (user_id, event_id, space_id, corner_id, issued_by, issued_at)
--   2. public.confirm_event_attendance(event, users[])  host-only, after the end
--
-- Not added: any reader for the Shelf. A Stub from a Closed Space must show
-- only its Corner and date to someone outside that Space; whoever builds the
-- Shelf's Stubs tab adds a reader that applies that rule. There is no ranking
-- or count of Stubs anywhere (the Door list has no leaderboards).
--
-- Not touched: corners, space_corners, space_events, event_rsvps. A Stub's
-- corner_id is the Space's primary Corner when it was issued (null if the
-- Space had none). Stubs go when their event or Space row is deleted.
--
-- "Ended" means ends_at has passed, or, for an event with no end time,
-- starts_at has passed.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).

create table public.stubs (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id bigint not null references public.space_events (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  corner_id bigint references public.corners (id) on delete set null,
  issued_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index stubs_space_idx on public.stubs (space_id);
create index stubs_corner_idx on public.stubs (corner_id) where corner_id is not null;

alter table public.stubs enable row level security;

-- Your own Stubs, and the hosts of the Space that issued them (so the confirm
-- screen can show who is already confirmed). Nobody else reads this table.
create policy "you and the space's hosts read stubs"
  on public.stubs for select to authenticated
  using (
    stubs.user_id = auth.uid()
    or public.is_space_host(stubs.space_id, auth.uid())
    or private.is_admin(auth.uid())
  );

revoke all on public.stubs from anon, authenticated;
grant select on public.stubs to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Host confirms who showed up.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.confirm_event_attendance(p_event_id bigint, p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_corner_id bigint;
  v_user uuid;
  v_issued integer := 0;
  v_rows integer;
begin
  if auth.uid() is null then
    raise exception 'You’re not logged in.';
  end if;

  select se.id, se.space_id, se.status, se.starts_at, se.ends_at
  into v_event
  from space_events se
  where se.id = p_event_id;
  if v_event.id is null then
    raise exception 'That event doesn’t exist.';
  end if;
  if v_event.status <> 'scheduled' then
    raise exception 'This event was cancelled.';
  end if;
  if not exists (select 1 from spaces s where s.id = v_event.space_id and s.status <> 'deleted') then
    raise exception 'That event doesn’t exist.';
  end if;
  if not public.is_space_host(v_event.space_id, auth.uid()) then
    raise exception 'Only a host can confirm who came.';
  end if;
  if coalesce(v_event.ends_at, v_event.starts_at) > now() then
    raise exception 'You can confirm who came once the event has ended.';
  end if;
  if p_user_ids is null or coalesce(array_length(p_user_ids, 1), 0) = 0 then
    raise exception 'Pick at least one person.';
  end if;
  if array_length(p_user_ids, 1) > 500 then
    raise exception 'That’s too many people at once.';
  end if;
  if auth.uid() = any (p_user_ids) then
    raise exception 'Another host has to confirm you.';
  end if;

  select sc.corner_id into v_corner_id
  from space_corners sc
  where sc.space_id = v_event.space_id and sc.is_primary
  limit 1;

  for v_user in select distinct u from unnest(p_user_ids) as u loop
    if not exists (
      select 1 from event_rsvps er
      where er.event_id = p_event_id and er.user_id = v_user
    ) then
      raise exception 'You can only confirm people who said they were going.';
    end if;
    if exists (
      select 1 from space_members sm
      where sm.space_id = v_event.space_id and sm.user_id = v_user and sm.status = 'banned'
    ) then
      raise exception 'You can only confirm people who said they were going.';
    end if;

    insert into stubs (user_id, event_id, space_id, corner_id, issued_by)
    values (v_user, p_event_id, v_event.space_id, v_corner_id, auth.uid())
    on conflict (user_id, event_id) do nothing;
    get diagnostics v_rows = row_count;
    v_issued := v_issued + v_rows;
  end loop;

  return v_issued;
end;
$$;
revoke all on function public.confirm_event_attendance(bigint, uuid[]) from public, anon;
grant execute on function public.confirm_event_attendance(bigint, uuid[]) to authenticated;
