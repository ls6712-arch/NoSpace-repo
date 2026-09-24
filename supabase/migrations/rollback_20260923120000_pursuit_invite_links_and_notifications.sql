-- Rollback for 20260923120000_pursuit_invite_links_and_notifications.sql.
-- Existing invite links stop working. Notifications already sent stay.
drop trigger if exists notify_pursuit_progress on public.pursuit_progress;
drop trigger if exists notify_pursuit_membership on public.pursuit_members;
drop function if exists public.notify_pursuit_progress();
drop function if exists public.notify_pursuit_membership();
drop function if exists public.pursuit_person_name(uuid);
drop function if exists public.join_pursuit_via_link(text);
drop function if exists public.pursuit_invite_preview(text);
drop table if exists public.pursuit_invite_links;
