-- Rollback for 20261122000000_post_activity_id.sql: removes the column (and the Moments' memory of their activity).
alter table public.posts drop column activity_id;
