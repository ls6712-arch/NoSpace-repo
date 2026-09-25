-- Sushii: Spaces Rework — expose `featured` on list_event_teasers.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20261001000000_spaces_rework_join_notifications.sql.
--
-- Found in review: the Space page's featured-event banner queries
-- space_events directly, which is RLS-gated to admins, an Open Space, or
-- an active member — a non-member of a Closed Space gets zero rows, so
-- they never saw the banner at all, even when a featured event exists.
-- list_event_teasers already exists for exactly this case (a non-member
-- of a Closed Space's own view of upcoming events), but it never returned
-- which one (if any) is featured — there was no way for the client to
-- pick the right one out of the list without it.
--
-- Full body reproduced from 20260927000000 (already live); only the
-- added `featured` column is new — same predicate, same ordering. Adding
-- a column to a RETURNS TABLE changes the function's return type, which
-- create-or-replace can't do in place (Postgres: "cannot change return
-- type of existing function") — drop it first, so grants are reset and
-- must be restated too.
drop function if exists public.list_event_teasers(uuid);

create function public.list_event_teasers(p_space_id uuid)
returns table (id bigint, title text, starts_at timestamptz, timezone text, featured boolean)
language sql
stable
security definer
set search_path = public
as $$
  select se.id, se.title, se.starts_at, se.timezone, se.featured
  from space_events se
  join spaces s on s.id = se.space_id
  where se.space_id = p_space_id
    and se.status = 'scheduled'
    and se.starts_at > now()
    and (s.status <> 'deleted' or private.is_admin(auth.uid()))
  order by se.starts_at;
$$;
revoke all on function public.list_event_teasers(uuid) from public;
grant execute on function public.list_event_teasers(uuid) to authenticated, anon;
