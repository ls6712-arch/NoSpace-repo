-- Rollback for 20261031000000_open_pursuits.sql.
-- Drops the functions, the session tables (with every session and "I'm in"), the
-- join requests (members with status 'requested' are removed so the old status
-- check can come back) and the four pursuits columns. Open Pursuits become plain
-- shared Pursuits; their owners and members stay.

drop function if exists public.answer_join_request(text, uuid, boolean);
drop function if exists public.join_open_pursuit(text);
drop function if exists public.open_pursuits_for_corner(text, text, integer);
drop function if exists private.pursuit_taken(text);

drop table if exists public.pursuit_session_rsvps;
drop table if exists public.pursuit_sessions;

update public.pursuit_members set status = 'declined' where public.pursuit_members.status = 'requested';
alter table public.pursuit_members drop constraint pursuit_members_status_check;
alter table public.pursuit_members
  add constraint pursuit_members_status_check check (status = any (array['invited', 'joined', 'declined']));

drop index if exists public.pursuits_open_corner_idx;
alter table public.pursuits drop constraint if exists pursuits_open_is_shared_with_capacity;
alter table public.pursuits
  drop column if exists ends_at,
  drop column if exists capacity,
  drop column if exists space_id,
  drop column if exists visibility;
