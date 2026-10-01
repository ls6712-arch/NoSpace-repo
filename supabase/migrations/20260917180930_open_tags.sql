-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded.

alter table public.posts add column if not exists tags text[] not null default '{}';

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
        else initcap(replace(p.hobby_slug, '-', ' '))
      end,
      nullif(initcap(replace(p.sub_hobby, '-', ' ')), ''),
      nullif(trim(p.interest), '')
    ], null)) as u(t)
    order by lower(u.t)
  ) dedup
), '{}')
where tags is null or tags = '{}';

create index if not exists posts_tags_idx on public.posts using gin (tags);
