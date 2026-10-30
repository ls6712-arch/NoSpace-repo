-- Rollback for 20261110010000_profile_backfill_moments.sql.
-- Undoes only what the backfill could have written: a visible_at equal to the
-- Moment's created_at, and a private row with no place whose time is created_at.
-- A Moment whose owner set its own time or place afterwards is left alone.
update public.posts po set visible_at = null where po.visible_at = po.created_at;
delete from public.post_private pp
 using public.posts po
 where po.id = pp.post_id and pp.place_name is null and pp.occurred_at = po.created_at;
