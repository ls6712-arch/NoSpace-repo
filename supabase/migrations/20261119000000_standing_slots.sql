-- Soosh: standing_slots, the weekly schedule behind "Tonight" (brief: claude-code-brief-corners-rows-imports.md, PR 2).
--
-- Run AFTER 20261118000000_founding_stub.sql.
-- Rollback: rollback_20261119000000_standing_slots.sql.
-- Verification: supabase/verification/standing_slots_check.sql.
--
-- Most of what is on in New York on a given night repeats every week (trivia, run clubs, open
-- studio, salsa socials, drop-in climbing). A row here is one such weekly slot: "Every Thursday,
-- 7pm". Seeded empty; the founder researches the first ~100.
--
--   * Read: members (signed in, with a birthdate), active slots verified within stale_days (60, proposed) only.
--     Admins and the host of a slot's Space also see their stale and inactive ones, so they can
--     re-verify them.
--   * Write: admins, plus a Space host for slots whose space_id is their own Space.
--   * stale_days lives in app_config key standing_slots_v1 (a "proposed" number, founder approves).
--   * weekday is 0 to 6 with Sunday = 0, the same as JavaScript's getDay().
--   * start_time / end_time are the venue's local wall clock; tz is the IANA zone they are in.
--   * corner_slug is the bare Corner slug. Catalog Corners live in code, not in a table, so there
--     is no foreign key.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).

insert into public.app_config (key, value)
values ('standing_slots_v1', '{"stale_days": 60}'::jsonb)
on conflict (key) do nothing;

-- How many days a slot stays visible after it was last verified.
create function private.standing_stale_days()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (ac.value ->> 'stale_days')::integer from public.app_config ac where ac.key = 'standing_slots_v1'),
    60
  );
$$;
revoke all on function private.standing_stale_days() from public, anon;
grant execute on function private.standing_stale_days() to authenticated;

create table public.standing_slots (
  id bigint generated always as identity primary key,
  corner_slug text not null check (corner_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(corner_slug) <= 80),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  place_name text not null check (char_length(btrim(place_name)) between 1 and 80),
  -- The neighbourhood: "Greenpoint".
  area text not null check (char_length(btrim(area)) between 1 and 60),
  city text not null default 'new-york' check (char_length(city) between 1 and 40),
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time,
  tz text not null default 'America/New_York' check (char_length(tz) between 3 and 64),
  spend text not null default 'free' check (spend in ('free', 'under25', 'treat')),
  mode text not null default 'do' check (mode in ('do', 'watch')),
  source_url text check (source_url is null or (char_length(source_url) <= 500 and source_url ~* '^https://[^[:space:]]+$')),
  space_id uuid references public.spaces (id) on delete cascade,
  active boolean not null default true,
  last_verified_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);

-- "Tonight" asks for a city's active slots on one weekday.
create index standing_slots_city_weekday_idx on public.standing_slots (city, weekday) where active;
create index standing_slots_corner_idx on public.standing_slots (corner_slug);
create index standing_slots_space_idx on public.standing_slots (space_id) where space_id is not null;

-- A verification can't be dated in the future, and who made a slot and when never changes.
create function private.standing_slots_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_verified_at > now() then
    new.last_verified_at := now();
  end if;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
revoke all on function private.standing_slots_guard() from public, anon, authenticated;
create trigger standing_slots_guard
  before insert or update on public.standing_slots
  for each row execute function private.standing_slots_guard();

alter table public.standing_slots enable row level security;

-- After the member gate (20261111000050) every table is members only: a guest, a Stubby account
-- or a signed-out visitor reaches nothing here (supabase/security/accessAllowlist.test.ts).
create policy "members only" on public.standing_slots as restrictive for all to authenticated
  using ((select private.is_member())) with check ((select private.is_member()));

revoke all on public.standing_slots from public, anon, authenticated;
grant select, insert, update, delete on public.standing_slots to authenticated;

create policy "signed-in people read fresh slots, admins and hosts read their own"
  on public.standing_slots for select to authenticated
  using (
    (standing_slots.active
      and standing_slots.last_verified_at >= now() - make_interval(days => private.standing_stale_days()))
    or private.is_admin((select auth.uid()))
    or (standing_slots.space_id is not null
        and public.is_space_host(standing_slots.space_id, (select auth.uid())))
  );

create policy "admins and the Space's host add slots"
  on public.standing_slots for insert to authenticated
  with check (
    private.is_admin((select auth.uid()))
    or (standing_slots.space_id is not null
        and public.is_space_host(standing_slots.space_id, (select auth.uid())))
  );

-- with check repeats the rule on the new row, so a host can't move a slot to someone else's Space.
create policy "admins and the Space's host edit slots"
  on public.standing_slots for update to authenticated
  using (
    private.is_admin((select auth.uid()))
    or (standing_slots.space_id is not null
        and public.is_space_host(standing_slots.space_id, (select auth.uid())))
  )
  with check (
    private.is_admin((select auth.uid()))
    or (standing_slots.space_id is not null
        and public.is_space_host(standing_slots.space_id, (select auth.uid())))
  );

create policy "admins and the Space's host delete slots"
  on public.standing_slots for delete to authenticated
  using (
    private.is_admin((select auth.uid()))
    or (standing_slots.space_id is not null
        and public.is_space_host(standing_slots.space_id, (select auth.uid())))
  );
