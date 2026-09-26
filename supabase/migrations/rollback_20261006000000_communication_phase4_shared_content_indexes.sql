-- Rollback for 20261006000000_communication_phase4_shared_content_indexes.sql.
-- Drops the two covering indexes. Purely a performance rollback — nothing
-- else depends on these existing, so this is always safe to run.

drop index if exists public.messages_shared_post_id_idx;
drop index if exists public.messages_shared_pursuit_id_idx;
