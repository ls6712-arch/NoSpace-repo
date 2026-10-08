-- D5 (round 2): overlapping Corners are merged.
--   * "Food photography" (filed under Food & Cooking) merges into Photography.
--   * Moments and Pursuits that sit directly in the Food & Cooking group with
--     no Corner of their own move to Cooking; the same for Photography & Film
--     and Photography. (The group names are internal and were showing up as
--     Corner labels for these Moments.)
--
-- Same moves public.admin_merge_corners() makes (20260924099000), written out
-- here because that function checks auth.uid() for an admin and a migration
-- has no session. The corners_sync trigger on posts recounts moment_count as
-- the Moments move.
--
-- Live state when this was written: Corner food-photography has 2 Moments,
-- 8 Moments sit in Food & Cooking with no Corner, 4 in Photography & Film
-- with no Corner. NOT YET RUN on the live project.

-- 1. The two Corners everything lands in must exist.
insert into public.corners (space_slug, slug, name)
values ('food-cooking', 'cooking', 'cooking'),
       ('photography-film', 'photography', 'photography')
on conflict (space_slug, slug) do nothing;

-- 2. Food photography into Photography: Moments.
update public.posts
   set corner = 'photography',
       sub_hobby = 'photography',
       hobby_slug = 'photography-film'
 where hobby_slug = 'food-cooking'
   and coalesce(corner, sub_hobby) = 'food-photography';

-- Pursuits.
update public.pursuits
   set sub_hobby = 'photography',
       hobby_slug = 'photography-film',
       interest = case when lower(btrim(interest)) in ('food photography', 'food-photography') then 'Photography' else interest end
 where hobby_slug = 'food-cooking'
   and sub_hobby = 'food-photography';

-- Space links: move, or drop where the Space already links Photography.
update public.space_corners sc
   set corner_id = (select c.id from public.corners c where c.space_slug = 'photography-film' and c.slug = 'photography')
 where sc.corner_id = (select c.id from public.corners c where c.space_slug = 'food-cooking' and c.slug = 'food-photography')
   and not exists (
     select 1 from public.space_corners x
     where x.space_id = sc.space_id
       and x.corner_id = (select c.id from public.corners c where c.space_slug = 'photography-film' and c.slug = 'photography')
   );
delete from public.space_corners
 where corner_id = (select c.id from public.corners c where c.space_slug = 'food-cooking' and c.slug = 'food-photography');

-- Corner follows: move, or drop where the person already follows Photography.
update public.hobby_follows hf
   set hobby_key = 'photography-film:photography'
 where hf.hobby_key = 'food-cooking:food-photography'
   and not exists (
     select 1 from public.hobby_follows x
     where x.user_id = hf.user_id and x.hobby_key = 'photography-film:photography'
   );
delete from public.hobby_follows where hobby_key = 'food-cooking:food-photography';

delete from public.corners where space_slug = 'food-cooking' and slug = 'food-photography';

-- 3. Moments and Pursuits with no Corner move to the group's merged Corner.
update public.posts
   set corner = 'cooking', sub_hobby = 'cooking'
 where hobby_slug = 'food-cooking' and coalesce(corner, sub_hobby) is null;

update public.posts
   set corner = 'photography', sub_hobby = 'photography'
 where hobby_slug = 'photography-film' and coalesce(corner, sub_hobby) is null;

update public.pursuits set sub_hobby = 'cooking'
 where hobby_slug = 'food-cooking' and sub_hobby is null;

update public.pursuits set sub_hobby = 'photography'
 where hobby_slug = 'photography-film' and sub_hobby is null;
