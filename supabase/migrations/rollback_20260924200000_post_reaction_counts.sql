-- Rollback for 20260924200000_post_reaction_counts.sql.
drop trigger if exists reactions_sync_counts on public.reactions;
drop function if exists public.sync_post_reaction_counts();
alter table public.posts drop column if exists love_count;
alter table public.posts drop column if exists in_count;
