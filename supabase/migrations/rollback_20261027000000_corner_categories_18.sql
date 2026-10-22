-- Rollback for 20261027000000_corner_categories_18.sql.
-- Drops the column first (it references the table), then the table. Nothing else
-- was touched by the migration: public.categories, corners.space_slug and posts
-- are exactly as they were, so there is nothing to restore.

drop index if exists public.corners_category_slug_idx;
alter table public.corners drop column if exists category_slug;
drop table if exists public.corner_categories;
