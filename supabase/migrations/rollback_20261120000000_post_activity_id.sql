-- Rollback for 20261120000000_post_activity_id.sql: removes the column (and the Moments' memory of their activity).
alter table public.posts drop column activity_id;
