-- Step 4 of the Discover v2 brief: the 18 categories.
--
-- Run AFTER 20261026000000_media_buckets_web_safe_types.sql. Mapping, approved
-- by the founder on Oct 22, 2026: docs/categories-18.md (every built-in Corner
-- and its category) and the Step 4 PR description.
--
-- What this does, and what it deliberately does not:
--
--   1. Adds public.corner_categories: the 18. It is a NEW table, not rows in
--      public.categories. The app reads every public.categories row as a Space
--      (hobbies.ts applySpaceRows turns any slug that is not one of the 15
--      built-ins into a custom Space, shown in every picker), so adding the 18
--      there would put 18 empty Spaces in front of members. `home-garden` is
--      both a category here and one of the 15 old Spaces; they are different
--      tables, so there is no clash.
--   2. Adds corners.category_slug and sets it for the 6 Corners that are
--      database rows. The built-in Corners (the other 129) live in code and
--      get their category from src/app/data/cornerCategories.ts.
--   3. Does NOT touch public.categories, the 15 old Spaces. They stay as they
--      are, so every old link and every posts.hobby_slug keeps resolving. They
--      are only marked inactive when the UI stops reading them (the next part
--      of Step 4), because hobbies.ts treats active = false as hidden and doing
--      it now would hide every Space and its Corners on Discover.
--   4. Does NOT change corners.space_slug, posts, or any member's Moment:
--      posts_corner_fkey ties a Moment to (hobby_slug, corner), so re-filing a
--      Corner by moving its space_slug would mean moving Moments. A Corner's
--      category is its own column instead; a Moment's category is its Corner's.
--      Moments with no Corner (9 public ones today) have no category and stay
--      in feeds and on their old Space. No Corner is assigned to anyone's Moment.
--
-- Corners members create from now on start with no category (null). The app
-- falls back to the code-side map and, for a brand-new Corner, to its old
-- Space; that is part of the UI work, not this file.

create table public.corner_categories (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint corner_categories_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 48),
  constraint corner_categories_name_length
    check (char_length(name) between 1 and 60),
  constraint corner_categories_sort_order_key unique (sort_order)
);

alter table public.corner_categories enable row level security;

create policy "corner categories are readable by anyone"
  on public.corner_categories for select
  using (true);

create policy "admins insert corner categories"
  on public.corner_categories for insert
  with check (private.is_admin(auth.uid()));

create policy "admins update corner categories"
  on public.corner_categories for update
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

create policy "admins delete corner categories"
  on public.corner_categories for delete
  using (private.is_admin(auth.uid()));

insert into public.corner_categories (slug, name, description, sort_order) values
  ('yarn-fabric', 'Yarn and fabric', 'Knitting, crochet, sewing, embroidery, weaving, mending, cosplay', 1),
  ('crafts-diy', 'Crafts and DIY', 'Clay, candles, jewelry, paper, wood, leather, glass', 2),
  ('art-design', 'Art and design', 'Drawing, painting, printmaking, lettering, mehndi', 3),
  ('tech-tinkering', 'Tech and tinkering', 'Electronics, 3D printing, keyboards, models, LEGO, drones', 4),
  ('food-drink', 'Food and drink', 'Cooking, baking, brewing, coffee, tea, tasting', 5),
  ('running-fitness', 'Running and fitness', 'Running, walking clubs, gym, yoga, Pilates, cycling, swimming', 6),
  ('sports-martial-arts', 'Sports and martial arts', 'Racket and team sports, climbing, skating, combat sports', 7),
  ('dance-stage', 'Dance and stage', 'Dance styles, improv, stand-up, theatre, karaoke', 8),
  ('outdoors-adventure', 'Outdoors and adventure', 'Hiking, camping, water, snow, stargazing, travel', 9),
  ('home-garden', 'Home and garden', 'Gardens, houseplants, flowers, aquariums, home projects', 10),
  ('games-puzzles', 'Games and puzzles', 'Board games, cards, chess, puzzles, video games, trivia', 11),
  ('music-sound', 'Music and sound', 'Instruments, singing, producing, DJing, podcasts', 12),
  ('photo-film', 'Photo and film', 'Photography, video, short films, channels', 13),
  ('reading-writing', 'Reading and writing', 'Books, book clubs, stories, poems, handwritten pages', 14),
  ('skills-side-projects', 'Skills and side projects', 'Languages, money, speaking, coding, AI tools, freelancing', 15),
  ('collecting-style', 'Collecting and style', 'Records, cards, sneakers, fragrance, thrifting, beauty', 16),
  ('culture-community', 'Culture and community', 'Museums, live music, city walks, food tours, hosting, volunteering', 17),
  ('rest-ritual', 'Rest and ritual', 'Meditation, breathwork, sauna, cold water, screen-free time, tarot, astrology', 18);

-- A Corner's category. Nullable: members create Corners at any time.
-- on update cascade so renaming a slug later carries the Corners with it.
alter table public.corners
  add column category_slug text references public.corner_categories (slug) on update cascade;

create index corners_category_slug_idx on public.corners (category_slug);

-- The 6 Corners that are database rows (checked read-only on Oct 22, 2026).
-- Their space_slug is unchanged.
update public.corners
   set category_slug = mapping.category_slug
  from (values
    ('books-writing', 'reading', 'reading-writing'),
    ('food-cooking', 'cooking', 'food-drink'),
    ('food-cooking', 'storytelling', 'reading-writing'),
    ('photography-film', 'photography', 'photo-film'),
    ('tech-building', 'web-design', 'skills-side-projects'),
    ('travel-adventure', 'travel', 'outdoors-adventure')
  ) as mapping (space_slug, corner_slug, category_slug)
 where corners.space_slug = mapping.space_slug
   and corners.slug = mapping.corner_slug;
