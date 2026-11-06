-- Rollback for 20261118000000_post_city_key.sql.
-- Removes the triggers, the key function, the index and the columns. Run
-- rollback_20261118000100_founding_stub.sql first if the Founding Stub is applied (it reads the key).

drop trigger if exists posts_zy_city_key on public.posts;
drop trigger if exists posts_zy_city_key_on_update on public.posts;
drop function if exists private.set_post_city_key();
drop function if exists private.city_key_of(uuid, text, boolean, text);
drop index if exists public.post_private_city_key_idx;
alter table public.post_private drop column city_key;
alter table public.posts drop column city_hidden;
