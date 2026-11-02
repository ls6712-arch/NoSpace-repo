-- Rollback for 20261107000000_log_punch_cards.sql.
-- Drops log_progress() and the Corner-needs-a-Space check, then makes posts.hobby_slug required
-- again. That last step fails while any Moment has no Space: those Moments were logged with
-- nothing picked, and no Space is honestly theirs. Decide what to do with them first (the app
-- treats them as Moments in no Corner), then run this.

drop trigger if exists posts_pursuit_auto_finish_on_update on public.posts;
drop trigger if exists posts_zz_award_moment_stubs_on_update on public.posts;

drop function if exists public.log_progress();

alter table public.posts drop constraint if exists posts_corner_needs_space;

alter table public.posts alter column hobby_slug set not null;
