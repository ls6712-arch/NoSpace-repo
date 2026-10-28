-- Rollback for 20261029000000_corner_affinity.sql. The migration only added
-- this function; nothing else was touched.

drop function if exists public.my_corner_affinity();
