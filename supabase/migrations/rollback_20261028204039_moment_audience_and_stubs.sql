-- Rollback for 20261101000000_moment_audience_and_stubs.sql.
-- Drops the triggers, functions, read policy and the audience column, removes every
-- session and gold Stub (event Stubs stay), and puts the stubs table back to its
-- earlier shape: event_id and space_id required, primary key (user_id, event_id).
-- Group Moments keep their visibility 'just_me' and so become readable by their
-- makers only.

drop trigger if exists pursuits_issue_gold_stubs on public.pursuits;
drop trigger if exists posts_issue_session_stub on public.posts;
drop trigger if exists posts_audience_guard on public.posts;
drop trigger if exists stubs_assign_serial on public.stubs;
drop function if exists private.issue_gold_stubs();
drop function if exists private.issue_session_stub();
drop function if exists private.stubs_assign_serial();
drop function if exists private.posts_audience_guard();

drop policy if exists "group posts are readable by the group" on public.posts;
alter table public.posts drop column if exists audience;

delete from public.stubs where public.stubs.kind <> 'event';

alter table public.stubs drop constraint if exists stubs_kind_fields;
drop index if exists public.stubs_session_post_key;
drop index if exists public.stubs_gold_key;
drop index if exists public.stubs_user_serial_key;
drop index if exists public.stubs_pursuit_idx;

alter table public.stubs
  drop column if exists serial,
  drop column if exists pursuit_id,
  drop column if exists post_id,
  drop column if exists kind;

alter table public.stubs drop constraint if exists stubs_pkey;
alter table public.stubs drop constraint if exists stubs_user_event_key;
alter table public.stubs drop column if exists id;
alter table public.stubs
  alter column event_id set not null,
  alter column space_id set not null;
alter table public.stubs add constraint stubs_pkey primary key (user_id, event_id);
