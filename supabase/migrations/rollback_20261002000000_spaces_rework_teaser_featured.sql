-- Rollback for 20261002000000_spaces_rework_teaser_featured.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores list_event_teasers to its pre-migration signature (no
-- `featured` column), verbatim from 20260927000000.
--
-- Not a recommendation: rolling this back means a non-member of a
-- Closed Space can no longer be shown which upcoming event (if any) is
-- featured, since the client has no other way to tell.

drop function if exists public.list_event_teasers(uuid);

create function public.list_event_teasers(p_space_id uuid)
returns table (id bigint, title text, starts_at timestamptz, timezone text)
language sql
stable
security definer
set search_path = public
as $$
  select se.id, se.title, se.starts_at, se.timezone
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
