-- Soosh: a private city key per Moment, for counting activity by city
-- (brief: claude-code-brief-corners-rows-imports.md, Top 10, Never been done, Founding Stub).
--
-- Run AFTER 20261117000000_weekly_free_hours.sql.
-- Rollback: rollback_20261118000000_post_city_key.sql.
-- Verification: supabase/verification/post_city_key_check.sql.
--
-- Decided by the founder (Nov 2026):
--   * A Moment whose audience is Everyone gets a city key: the city it shows (posts.city), else
--     the author's profile city (profile_private.city), lower-cased with spaces collapsed.
--   * If the person took the city off that Moment (posts.city_hidden, set by the app), the key is null.
--     Any audience other than Everyone also leaves it null.
--   * The key is never displayed. It lives in public.post_private, which no client can read
--     (RLS on, "members only" restrictive policy, no grant to anon or authenticated), NOT as a column
--     on public.posts: posts grants SELECT on the whole table to clients, so a posts column would be
--     readable through the API by anyone who can see the Moment. Only security definer functions
--     (Top 10, Never been done, the Founding Stub) read it, and they return counts, never a key.
--   * Profile city is used for aggregate activity counts only (draft privacy-policy line:
--     docs/privacy-policy-city-draft.md, for founder approval).
--
-- Backfill, same rule, for Moments already there: audience Everyone, not hidden, and either showing
-- a city or made before 2026-10-30 (before Moments could carry a city at all, so nobody could have
-- removed one). A newer Moment with no city may have had it removed, and that can't be told from
-- one that never had it, so it stays null. On production on Nov 6, 2026 this touches 0 rows
-- (no Moment has audience Everyone yet and no profile has a city).
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).

alter table public.posts add column city_hidden boolean not null default false;

alter table public.post_private
  add column city_key text check (city_key is null or char_length(city_key) between 1 and 80);
create index post_private_city_key_idx on public.post_private (city_key) where city_key is not null;

-- The key for a Moment: null unless it is public and the person didn't remove the city.
create function private.city_key_of(p_user uuid, p_shown text, p_hidden boolean, p_audience text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_hidden or p_audience is distinct from 'everyone' then null
    else nullif(left(lower(regexp_replace(btrim(coalesce(
           nullif(btrim(coalesce(p_shown, '')), ''),
           (select pp.city from public.profile_private pp where pp.user_id = p_user),
           '')), '\s+', ' ', 'g')), 80), '')
  end;
$$;
revoke all on function private.city_key_of(uuid, text, boolean, text) from public, anon, authenticated;

create function private.set_post_city_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.post_private (post_id, user_id, occurred_at, city_key)
  values (new.id, new.user_id, coalesce(new.created_at, now()),
          private.city_key_of(new.user_id, new.city, new.city_hidden, new.audience))
  on conflict (post_id) do update set city_key = excluded.city_key;
  return new;
end;
$$;
revoke all on function private.set_post_city_key() from public, anon, authenticated;

-- Named to run after posts_seed_private (which makes the post_private row) and before
-- posts_zz_award_* (which read the key); same-event triggers fire in name order.
create trigger posts_zy_city_key
  after insert on public.posts
  for each row execute function private.set_post_city_key();

create trigger posts_zy_city_key_on_update
  after update of audience, city, city_hidden on public.posts
  for each row
  when (old.audience is distinct from new.audience or old.city is distinct from new.city
        or old.city_hidden is distinct from new.city_hidden)
  execute function private.set_post_city_key();

-- Backfill (see the header for the rule).
update public.post_private
   set city_key = private.city_key_of(po.user_id, po.city, po.city_hidden, po.audience)
  from public.posts po
 where po.id = public.post_private.post_id
   and public.post_private.city_key is null
   and po.audience = 'everyone'
   and not po.city_hidden
   and (po.city is not null or po.created_at < timestamptz '2026-10-30 00:00:00+00');
