-- Rollback for 20260924090000_spaces_rework_export.sql.
--
-- Draft only — staged for review, not run.
--
-- This migration only ever creates archive copies; it doesn't touch a live
-- table. "Rolling back" just means dropping the snapshots. Do NOT run this
-- after 20260924095000_spaces_rework_cleanup.sql has also run — that
-- migration is what actually deletes the live circles/spaces/Circle-only-
-- thread data, and these archive tables are the only remaining copy of it
-- once it has. (To undo the cleanup migration itself, run
-- rollback_20260924095000_spaces_rework_cleanup.sql first — it reads from
-- these archive tables to restore the data — then this file.)

drop table if exists archive.circle_linked_posts_20260924;
drop table if exists archive.old_space_members_20260924;
drop table if exists archive.old_spaces_20260924;
drop table if exists archive.circle_members_20260924;
drop table if exists archive.circles_20260924;
-- Leaves the `archive` schema itself in place in case other snapshots use
-- it; drop it separately (`drop schema archive`) only once nothing does.
