-- Rollback for 20260924110000_spaces_rework_schema.sql.
--
-- Draft only — staged for review, not run.
--
-- Drops everything the schema migration added, in dependency-safe order
-- (children/constraints before parents). Purely additive tables, so this
-- is a clean drop with no data to preserve — if Spaces have real rows by
-- the time this runs, export them first (same as the Circle/old-Space
-- backup this phase already does).

alter table if exists public.spaces drop constraint if exists spaces_slug_not_reserved;
drop function if exists public.is_reserved_space_slug(text);

drop trigger if exists space_corners_sync_category on public.space_corners;
drop function if exists public.sync_space_category_from_corner();
drop trigger if exists space_corners_limit on public.space_corners;
drop function if exists public.check_space_corners_limit();
drop policy if exists "hosts manage their space's corners" on public.space_corners;
drop policy if exists "space corners are as visible as the space" on public.space_corners;
drop table if exists public.space_corners;

drop policy if exists "hosts or the poster delete the link" on public.space_moments;
drop policy if exists "hosts feature or remove, the poster unlinks their own" on public.space_moments;
drop policy if exists "the poster or a host links/unlinks a moment" on public.space_moments;
drop policy if exists "space moments follow the space's access" on public.space_moments;
drop table if exists public.space_moments;

drop policy if exists "a host answers their own approval row" on public.space_deletion_approvals;
drop policy if exists "hosts see and answer their own approval row" on public.space_deletion_approvals;
drop table if exists public.space_deletion_approvals;

drop policy if exists "a host starts a deletion request" on public.space_deletion_requests;
drop policy if exists "hosts see deletion requests" on public.space_deletion_requests;
drop table if exists public.space_deletion_requests;

drop policy if exists "the invitee answers" on public.space_host_invites;
drop policy if exists "hosts invite co-hosts" on public.space_host_invites;
drop policy if exists "hosts and the invitee see the invite" on public.space_host_invites;
drop table if exists public.space_host_invites;

drop policy if exists "leave or be removed" on public.space_members;
drop policy if exists "hosts manage members, members manage themselves" on public.space_members;
drop policy if exists "join or request to join" on public.space_members;
drop policy if exists "members see the roster" on public.space_members;
drop table if exists public.space_members;

drop function if exists public.space_host_count(uuid);
drop function if exists public.is_space_host(uuid, uuid);
drop function if exists public.is_space_member(uuid, uuid);

drop policy if exists "hosts set the exact address" on public.space_private_details;
drop policy if exists "members read the exact address" on public.space_private_details;
drop table if exists public.space_private_details;

drop policy if exists "hosts edit their space" on public.spaces;
drop policy if exists "signed-in users create a space" on public.spaces;
drop policy if exists "spaces are publicly readable" on public.spaces;
drop table if exists public.spaces;
