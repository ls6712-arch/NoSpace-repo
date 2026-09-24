-- Pause/deletion, migration (c): add 'private' to posts.visibility and
-- convert existing 'friends' rows. Draft only.
--
-- 'friends' stays a legal value in the constraint even though nothing new
-- should be written with it — the composer (Log.tsx's "Connections"
-- audience option) still writes 'friends' (see the frontend notes), and
-- dropping it from the constraint before that caller changes would break
-- posting outright. Once the client only ever writes 'private', a
-- follow-up migration can drop 'friends' from the constraint for good.

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility = any (array['public', 'circle', 'private', 'friends']));

do $$
declare
  friends_count integer;
begin
  select count(*) into friends_count from public.posts where visibility = 'friends';
  raise notice 'Converting % posts from friends to private', friends_count;
end $$;

update public.posts set visibility = 'private' where visibility = 'friends';
