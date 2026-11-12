-- Rollback for 20261123000000_corner_walls.sql: removes the two RPCs and their two helpers. Nothing else changed.
drop function if exists public.corner_passed_along(text, integer);
drop function if exists public.corner_wall(text, text, timestamptz, integer);
drop function if exists private.pursuit_has_finisher_stub(text);
drop function if exists private.corner_alias_sources(text);
