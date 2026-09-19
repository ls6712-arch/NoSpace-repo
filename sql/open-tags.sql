-- Sushii: open tags — replaces the fixed 15-Space picker as the primary
-- way a Moment says what it's about, without touching what's already there.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
--
-- hobby_slug, sub_hobby, and interest are untouched — not dropped, not
-- renamed. They stay exactly as they were for every query that still reads
-- them (Corners, badges, Pursuits, the Space pages). tags is purely additive:
-- the composer, the Shelf's tag row, and feed relevance now read from it,
-- while the legacy columns keep resolving for everything else.
alter table public.posts add column if not exists tags text[] not null default '{}';

-- One-time backfill: every existing post gets tags derived from its current
-- hobby_slug (converted to the same readable name shown everywhere else in
-- the app — see the case list below, which mirrors src/app/data/hobbies.ts
-- exactly), plus sub_hobby and interest where present, deduplicated
-- case-insensitively. hobby_slug is `not null`, so every post always gets at
-- least that one label — no post can finish this with an empty tags array.
update public.posts p
set tags = coalesce((
  select array_agg(t)
  from (
    select distinct on (lower(u.t)) u.t
    from unnest(array_remove(array[
      case p.hobby_slug
        when 'food-cooking' then 'Food & Cooking'
        when 'sports-fitness' then 'Sports & Fitness'
        when 'art-creative' then 'Art & Creative'
        when 'crafts-making' then 'Crafts & Making'
        when 'books-writing' then 'Books & Writing'
        when 'nature-outdoors' then 'Nature & Outdoors'
        when 'home-garden' then 'Home & Garden'
        when 'gaming-tabletop' then 'Gaming & Tabletop'
        when 'music' then 'Music'
        when 'photography-film' then 'Photography & Film'
        when 'health-wellness' then 'Health & Wellness'
        when 'fashion-beauty' then 'Fashion & Beauty'
        when 'tech-building' then 'Tech & Building'
        when 'collecting-fandom' then 'Collecting & Fandom'
        when 'travel-adventure' then 'Travel & Adventure'
        -- Covers any slug this list doesn't know about (a future Space, or
        -- one of the old pre-rename slugs) rather than leaving it null.
        else initcap(replace(p.hobby_slug, '-', ' '))
      end,
      nullif(initcap(replace(p.sub_hobby, '-', ' ')), ''),
      nullif(trim(p.interest), '')
    ], null)) as u(t)
    order by lower(u.t)
  ) dedup
), '{}')
where tags is null or tags = '{}';

-- Verification: should return 0 rows. Run by hand after the update above —
-- this SELECT is inert on its own, kept here as the check this migration's
-- own comment promises.
-- select count(*) from public.posts where tags is null or tags = '{}';

create index if not exists posts_tags_idx on public.posts using gin (tags);
