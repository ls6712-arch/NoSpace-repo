-- Soosh onboarding, PR 3 of 4: taste (screens 7 to 9).
--
--   profile_private.picks            the Corners a person would say yes to, as keys
--                                    ("space-slug/corner-slug"). Null until they pick;
--                                    at least 3 once set. There is no product maximum;
--                                    500 is only a safety bound on the column.
--   profile_private.free_windows     when they are usually free: Daytime and Evening by
--                                    day, 14 possible values ('mon-day' to 'sun-eve').
--   profile_private.monthly_budget   "A month for doing things": 0 (free only), 50, 100
--                                    or 200 dollars. Null when skipped, and a skip means
--                                    the first plan only uses free plans and things a pass
--                                    covers. PRIVATE: profile_private is owner-only, so
--                                    this is never on a profile, a Stub or any shared view.
--   user_passes                      "What's already yours": a kind (climbing, museum,
--                                    library, bike, fitness, gear, other), an optional
--                                    place name, owner-only for every operation. Nothing
--                                    here says a listing is covered by a pass.
--   corners_with_activity()          which Corners have something real in a city in the
--                                    next N days (default 14): an upcoming event in an open
--                                    Space, or an open Pursuit with room that belongs to an
--                                    open Space there. Corner keys and counts only, never
--                                    ids or people. Orders the picks screen. A partner Space
--                                    (spaces.is_partner) in that city counts too.
--   spaces.is_partner                set by an admin only (a guard trigger refuses anyone
--                                    else, on insert and on update). Default false. The
--                                    database owner and the service role (no signed-in
--                                    person) can set it too, which is how it is first filled.
--   pursuit_invite_corner()          the Corner of the Pursuit an invite link is for, so
--                                    a friend's Corner can come first, already picked.
--
-- Checked against the live project on Oct 30, 2026 with read-only queries: profile_private
-- has no taste columns; there are no upcoming events and no open Pursuits yet, so the
-- activity ordering is empty there until some exist.
--
-- Run AFTER 20261104000000_open_signup_and_account.sql.
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261105000000_onboarding_taste.sql.

-- 0. Partner Spaces -------------------------------------------------------------

alter table public.spaces add column is_partner boolean not null default false;

-- Table-wide INSERT and UPDATE are granted to signed-in people on spaces, so a column
-- revoke would do nothing: a trigger decides instead. A signed-in person who is not an
-- admin cannot make a Space a partner or change it. No signed-in person at all (the
-- database owner, the service role) is allowed.
create or replace function private.guard_space_partner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not private.is_admin((select auth.uid()))
     and ((tg_op = 'INSERT' and new.is_partner)
          or (tg_op = 'UPDATE' and new.is_partner is distinct from old.is_partner)) then
    raise exception 'Only an admin can mark a partner Space.' using errcode = 'P0001';
  end if;
  return new;
end
$$;
revoke all on function private.guard_space_partner() from public;

create trigger spaces_guard_partner
  before insert or update of is_partner on public.spaces
  for each row execute function private.guard_space_partner();

-- 1. The private taste columns ------------------------------------------------

alter table public.profile_private
  add column picks text[],
  add column free_windows text[],
  add column monthly_budget smallint;

alter table public.profile_private
  add constraint profile_private_picks_valid check (
    picks is null
    or (
      cardinality(picks) between 3 and 500
      and array_to_string(picks, ',') ~ '^[a-z0-9_-]{1,80}/[a-z0-9_-]{1,80}(,[a-z0-9_-]{1,80}/[a-z0-9_-]{1,80})*$'
    )
  ),
  add constraint profile_private_free_windows_valid check (
    free_windows is null
    or (
      cardinality(free_windows) <= 14
      and free_windows <@ array[
        'mon-day', 'mon-eve', 'tue-day', 'tue-eve', 'wed-day', 'wed-eve', 'thu-day', 'thu-eve',
        'fri-day', 'fri-eve', 'sat-day', 'sat-eve', 'sun-day', 'sun-eve'
      ]::text[]
    )
  ),
  add constraint profile_private_monthly_budget_valid check (
    monthly_budget is null or monthly_budget in (0, 50, 100, 200)
  );

-- 2. What is already yours ----------------------------------------------------

create table public.user_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('climbing', 'museum', 'library', 'bike', 'fitness', 'gear', 'other')),
  label text not null check (char_length(label) between 1 and 60),
  place text check (place is null or char_length(place) between 1 and 80),
  created_at timestamptz not null default now()
);

create index user_passes_user_idx on public.user_passes (user_id, created_at);

alter table public.user_passes enable row level security;

revoke all on public.user_passes from public, anon, authenticated;
grant select, insert, update, delete on public.user_passes to authenticated;

create policy "you read your own passes" on public.user_passes
  for select to authenticated
  using ((select auth.uid()) = user_passes.user_id);

create policy "you add your own passes" on public.user_passes
  for insert to authenticated
  with check ((select auth.uid()) = user_passes.user_id);

create policy "you edit your own passes" on public.user_passes
  for update to authenticated
  using ((select auth.uid()) = user_passes.user_id)
  with check ((select auth.uid()) = user_passes.user_id);

create policy "you remove your own passes" on public.user_passes
  for delete to authenticated
  using ((select auth.uid()) = user_passes.user_id);

-- A person holds at most 50 passes: nobody needs more, and the table stays small.
create or replace function private.limit_user_passes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.user_passes up where up.user_id = new.user_id) >= 50 then
    raise exception 'That is the most passes you can add.' using errcode = 'P0001';
  end if;
  return new;
end
$$;
revoke all on function private.limit_user_passes() from public;

create trigger user_passes_limit
  before insert on public.user_passes
  for each row execute function private.limit_user_passes();

-- 3. Corners with something real near a person ---------------------------------

create or replace function public.corners_with_activity(p_city text, p_days integer default 14)
returns table (corner_key text, events integer, pursuits integer, partners integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_city text := lower(btrim(coalesce(p_city, '')));
  v_days integer := greatest(1, least(coalesce(p_days, 14), 60));
begin
  if auth.uid() is null or not private.is_active(auth.uid()) or v_city = '' then
    return;
  end if;
  return query
  with ev as (
    select c.space_slug || '/' || c.slug as k, count(distinct e.id)::integer as n
    from public.space_events e
    join public.spaces s on s.id = e.space_id and s.status = 'active' and s.access = 'open'
    join public.space_corners sc on sc.space_id = s.id
    join public.corners c on c.id = sc.corner_id and not c.hidden
    where e.status is distinct from 'cancelled'
      and e.starts_at > now()
      and e.starts_at <= now() + make_interval(days => v_days)
      and lower(btrim(coalesce(e.city, s.city, ''))) = v_city
    group by 1
  ),
  pu as (
    select p.hobby_slug || '/' || p.sub_hobby as k, count(*)::integer as n
    from public.pursuits p
    join public.spaces s on s.id = p.space_id and s.status = 'active' and s.access = 'open'
    where p.visibility = 'open'
      and p.hobby_slug is not null and p.sub_hobby is not null
      and p.finished_at is null and p.let_go_at is null and p.paused_at is null
      and (p.ends_at is null or p.ends_at > now())
      and lower(btrim(coalesce(s.city, ''))) = v_city
      and private.pursuit_taken(p.id) < coalesce(p.capacity, 0)
      and not private.is_blocked_between((select auth.uid()), p.user_id)
    group by 1
  ),
  pt as (
    select c.space_slug || '/' || c.slug as k, count(distinct s.id)::integer as n
    from public.spaces s
    join public.space_corners sc on sc.space_id = s.id
    join public.corners c on c.id = sc.corner_id and not c.hidden
    where s.is_partner and s.status = 'active' and s.access = 'open'
      and lower(btrim(coalesce(s.city, ''))) = v_city
    group by 1
  ),
  keys as (
    select ev.k from ev union select pu.k from pu union select pt.k from pt
  )
  select keys.k, coalesce(ev.n, 0), coalesce(pu.n, 0), coalesce(pt.n, 0)
  from keys
  left join ev on ev.k = keys.k
  left join pu on pu.k = keys.k
  left join pt on pt.k = keys.k
  order by coalesce(ev.n, 0) + coalesce(pu.n, 0) + coalesce(pt.n, 0) desc, keys.k;
end
$$;
revoke all on function public.corners_with_activity(text, integer) from public, anon;
grant execute on function public.corners_with_activity(text, integer) to authenticated;

-- 4. The Corner of the Pursuit a friend's invite is for ------------------------

create or replace function public.pursuit_invite_corner(invite_token text)
returns table (hobby_slug text, sub_hobby text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.hobby_slug, p.sub_hobby
  from public.pursuit_invite_links l
  join public.pursuits p on p.id = l.pursuit_id
  where l.token = invite_token
    and l.revoked_at is null
    and p.hobby_slug is not null and p.sub_hobby is not null
    and p.finished_at is null and p.let_go_at is null
$$;
revoke all on function public.pursuit_invite_corner(text) from public, anon;
grant execute on function public.pursuit_invite_corner(text) to authenticated;
