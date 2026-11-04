-- Shared hard cost rules and soft private preferences for Home's SQL consumer.
create or replace function private.recommendation_price_max(p text) returns numeric
language plpgsql immutable set search_path='' as $$
declare amounts text[]; result numeric := null;
begin
  if p is null or p ~* '\$[0-9,.]+\s*[-–]\s*[0-9]|[€£¥]|\m(EUR|GBP|INR|from|starting|plus)\M|fees extra' then return null; end if;
  for amounts in select a.value from regexp_matches(p,'\$\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)','g') as a(value) loop
    result := greatest(result,replace(amounts[1],',','')::numeric);
  end loop;
  if result is not null then return result; end if;
  return case when p ~* '^\s*(free|no cost|0)\s*[.!]?\s*$' then 0 else null end;
end $$;
revoke all on function private.recommendation_price_max(text) from public,anon;
grant execute on function private.recommendation_price_max(text) to authenticated;

create or replace function private.personalization_score(p jsonb,f jsonb,k text) returns double precision
language plpgsql immutable set search_path='' as $$
declare result double precision:=0; interest jsonb; duration numeric;
begin
  if f is null then return 0; end if;
  result := 3*(select count(*) from jsonb_array_elements_text(coalesce(p->'motivations','[]')) as m(value) where coalesce(f->'motivations','[]') ? m.value);
  interest := (select i.value from jsonb_array_elements(coalesce(p->'interests','[]')) as i(value) where i.value->>'key'=k limit 1);
  if interest is not null then
    result:=result+case interest->>'relationship' when 'try' then 3 when 'returning' then 4 else 2 end;
    if interest->>'experience'='beginner' and f->'beginner'='true'::jsonb then result:=result+3; end if;
  end if;
  duration := (f->>'durationMinutes')::numeric;
  if p->>'durationMax' is not null and duration is not null and duration <= (p->>'durationMax')::numeric then result:=result+4; end if;
  if coalesce(p->'rhythm','[]') ? 'small' and duration is not null and duration<=20 then result:=result+3; end if;
  return result;
end $$;
revoke all on function private.personalization_score(jsonb,jsonb,text) from public,anon;
grant execute on function private.personalization_score(jsonb,jsonb,text) to authenticated;

-- Public catalog facts only; personal values stay in owner-scoped tables.
insert into public.app_config(key,value) values('recommendation_traits_v1',$catalog${"art-creative/calligraphy":{"motivations":["make"],"social":"either","durationMinutes":10,"beginner":null},"art-creative/drawing":{"motivations":["learn","explore"],"social":"either","durationMinutes":10,"beginner":true},"art-creative/illustration":{"motivations":["make","personal_time","explore"],"social":"solo","durationMinutes":null,"beginner":true},"art-creative/improv":{"motivations":["move","company","learn"],"social":"together","durationMinutes":120,"beginner":null},"art-creative/indian-classical-dance":{"motivations":["move","learn"],"social":"either","durationMinutes":90,"beginner":null},"art-creative/life-drawing":{"motivations":["company","learn"],"social":"together","durationMinutes":120,"beginner":null},"art-creative/open-mics":{"motivations":["company"],"social":"together","durationMinutes":120,"beginner":null},"art-creative/painting":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"art-creative/sculpture":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"art-creative/theater":{"motivations":["move","company","learn","explore"],"social":"together","durationMinutes":null,"beginner":null},"art-creative/watercolor":{"motivations":["learn"],"social":"either","durationMinutes":null,"beginner":null},"books-writing/book-clubs":{"motivations":["company","learn"],"social":"together","durationMinutes":null,"beginner":null},"books-writing/books":{"motivations":["learn","explore"],"social":"either","durationMinutes":null,"beginner":true},"books-writing/creative-writing":{"motivations":["learn","explore"],"social":"either","durationMinutes":null,"beginner":true},"books-writing/language-learning":{"motivations":["learn","explore"],"social":"either","durationMinutes":60,"beginner":null},"books-writing/letter-writing":{"motivations":["make","explore"],"social":"either","durationMinutes":30,"beginner":null},"books-writing/poetry":{"motivations":["learn","explore"],"social":"either","durationMinutes":null,"beginner":true},"books-writing/reading":{"motivations":["learn","explore"],"social":"either","durationMinutes":null,"beginner":true},"books-writing/writing":{"motivations":["learn","explore"],"social":"either","durationMinutes":null,"beginner":true},"collecting-fandom/anime":{"motivations":["learn","explore"],"social":"either","durationMinutes":null,"beginner":null},"collecting-fandom/antiques":{"motivations":[],"social":"either","durationMinutes":null,"beginner":null},"collecting-fandom/lego":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"collecting-fandom/trading-cards":{"motivations":["company","explore"],"social":"together","durationMinutes":null,"beginner":null},"collecting-fandom/vinyl":{"motivations":[],"social":"either","durationMinutes":null,"beginner":null},"crafts-making/block-printing":{"motivations":["make"],"social":"either","durationMinutes":120,"beginner":null},"crafts-making/candle-making":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"crafts-making/crochet":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"crafts-making/embroidery":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"crafts-making/jewelry-making":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"crafts-making/knitting":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":true},"crafts-making/makerspaces":{"motivations":["company","learn"],"social":"together","durationMinutes":null,"beginner":null},"crafts-making/miniatures":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"crafts-making/model-making":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"crafts-making/paper-crafts":{"motivations":["make","explore"],"social":"either","durationMinutes":null,"beginner":null},"crafts-making/pottery":{"motivations":["make"],"social":"either","durationMinutes":180,"beginner":null},"crafts-making/scrapbooking":{"motivations":["make","explore"],"social":"either","durationMinutes":null,"beginner":null},"crafts-making/sewing":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"crafts-making/soap-making":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"crafts-making/upcycling":{"motivations":["make","personal_time","explore"],"social":"solo","durationMinutes":null,"beginner":null},"crafts-making/woodworking":{"motivations":["make"],"social":"either","durationMinutes":240,"beginner":null},"crafts-making/zines":{"motivations":["make","explore"],"social":"either","durationMinutes":null,"beginner":null},"fashion-beauty/fashion":{"motivations":["make","explore"],"social":"either","durationMinutes":null,"beginner":null},"fashion-beauty/fragrance":{"motivations":["explore"],"social":"either","durationMinutes":null,"beginner":null},"fashion-beauty/makeup":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"fashion-beauty/nails":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"fashion-beauty/sneakers":{"motivations":["personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"fashion-beauty/thrifting":{"motivations":[],"social":"either","durationMinutes":null,"beginner":null},"food-cooking/baking":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":true},"food-cooking/bbq":{"motivations":["make","explore"],"social":"either","durationMinutes":null,"beginner":null},"food-cooking/cocktail-making":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"food-cooking/coffee":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"food-cooking/cooking":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":true},"food-cooking/espresso":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"food-cooking/fermentation":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":60,"beginner":null},"food-cooking/food-tours":{"motivations":["explore","learn"],"social":"either","durationMinutes":180,"beginner":null},"food-cooking/home-brewing":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"food-cooking/home-coffee":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":true},"food-cooking/kombucha":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"food-cooking/pasta":{"motivations":["make"],"social":"either","durationMinutes":90,"beginner":null},"food-cooking/sourdough":{"motivations":["make"],"social":"either","durationMinutes":240,"beginner":true},"food-cooking/supper-clubs":{"motivations":["make","company"],"social":"together","durationMinutes":240,"beginner":null},"food-cooking/tea":{"motivations":["learn"],"social":"either","durationMinutes":null,"beginner":null},"gaming-tabletop/board-games":{"motivations":["company","explore"],"social":"together","durationMinutes":180,"beginner":null},"gaming-tabletop/carrom":{"motivations":["company","explore"],"social":"together","durationMinutes":45,"beginner":null},"gaming-tabletop/chess":{"motivations":["explore"],"social":"either","durationMinutes":30,"beginner":null},"gaming-tabletop/d-d":{"motivations":["company","explore"],"social":"together","durationMinutes":null,"beginner":null},"gaming-tabletop/mahjong":{"motivations":["company","explore"],"social":"together","durationMinutes":120,"beginner":null},"gaming-tabletop/puzzles":{"motivations":["explore"],"social":"either","durationMinutes":null,"beginner":null},"gaming-tabletop/trading-cards":{"motivations":["company","explore"],"social":"together","durationMinutes":null,"beginner":null},"gaming-tabletop/trivia":{"motivations":["company","explore"],"social":"together","durationMinutes":120,"beginner":null},"gaming-tabletop/video-games":{"motivations":["company","explore"],"social":"together","durationMinutes":null,"beginner":null},"health-wellness/breathwork":{"motivations":["explore"],"social":"either","durationMinutes":5,"beginner":null},"health-wellness/meditation":{"motivations":["explore"],"social":"either","durationMinutes":10,"beginner":null},"health-wellness/pilates":{"motivations":["move","explore"],"social":"either","durationMinutes":null,"beginner":null},"health-wellness/sauna-cold-plunge":{"motivations":["company"],"social":"together","durationMinutes":90,"beginner":null},"health-wellness/sound-baths":{"motivations":["company"],"social":"together","durationMinutes":75,"beginner":null},"health-wellness/yoga":{"motivations":["move","explore"],"social":"either","durationMinutes":null,"beginner":null},"home-garden/composting":{"motivations":["make","personal_time","explore"],"social":"solo","durationMinutes":null,"beginner":null},"home-garden/diy":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"home-garden/furniture-flipping":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"home-garden/gardening":{"motivations":["explore"],"social":"either","durationMinutes":null,"beginner":null},"home-garden/houseplants":{"motivations":["personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"home-garden/interior-design":{"motivations":["make","personal_time","explore"],"social":"solo","durationMinutes":null,"beginner":null},"home-garden/vegetable-gardens":{"motivations":["explore"],"social":"either","durationMinutes":null,"beginner":null},"music/choir":{"motivations":["company","explore"],"social":"together","durationMinutes":90,"beginner":null},"music/djing":{"motivations":["learn","explore"],"social":"either","durationMinutes":null,"beginner":null},"music/guitar":{"motivations":["learn"],"social":"either","durationMinutes":null,"beginner":true},"music/indian-classical-music":{"motivations":["learn"],"social":"either","durationMinutes":60,"beginner":null},"music/karaoke":{"motivations":["move","company"],"social":"together","durationMinutes":120,"beginner":null},"music/live-music":{"motivations":["company"],"social":"together","durationMinutes":180,"beginner":null},"music/make-a-beat":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"music/music-production":{"motivations":["make","personal_time","explore"],"social":"solo","durationMinutes":90,"beginner":null},"music/piano":{"motivations":["personal_time","learn"],"social":"solo","durationMinutes":30,"beginner":null},"music/singing":{"motivations":["learn","explore"],"social":"either","durationMinutes":null,"beginner":null},"music/songwriting":{"motivations":["learn","explore"],"social":"either","durationMinutes":null,"beginner":null},"nature-outdoors/birdwatching":{"motivations":["explore"],"social":"either","durationMinutes":15,"beginner":null},"nature-outdoors/camping":{"motivations":["company","explore"],"social":"together","durationMinutes":null,"beginner":null},"nature-outdoors/fishing":{"motivations":["explore"],"social":"either","durationMinutes":null,"beginner":null},"nature-outdoors/foraging":{"motivations":["company","explore"],"social":"together","durationMinutes":null,"beginner":null},"nature-outdoors/hiking":{"motivations":["explore"],"social":"either","durationMinutes":240,"beginner":null},"nature-outdoors/kayaking":{"motivations":["explore"],"social":"either","durationMinutes":180,"beginner":null},"nature-outdoors/stargazing":{"motivations":["explore","learn"],"social":"either","durationMinutes":90,"beginner":null},"nature-outdoors/surfing":{"motivations":["explore","learn"],"social":"either","durationMinutes":180,"beginner":null},"nature-outdoors/wild-swimming":{"motivations":["explore"],"social":"either","durationMinutes":60,"beginner":null},"photography-film/film-clubs":{"motivations":["company","learn","explore"],"social":"together","durationMinutes":180,"beginner":null},"photography-film/film-photography":{"motivations":["explore","learn"],"social":"either","durationMinutes":null,"beginner":null},"photography-film/filmmaking":{"motivations":["company","learn","explore"],"social":"together","durationMinutes":120,"beginner":null},"photography-film/photography":{"motivations":["learn","explore"],"social":"either","durationMinutes":60,"beginner":null},"photography-film/video":{"motivations":["learn","explore"],"social":"either","durationMinutes":null,"beginner":null},"sports-fitness/badminton":{"motivations":["move","company","learn"],"social":"together","durationMinutes":60,"beginner":null},"sports-fitness/basketball":{"motivations":["move","explore","learn"],"social":"either","durationMinutes":null,"beginner":null},"sports-fitness/boxing":{"motivations":["move","company","learn"],"social":"together","durationMinutes":60,"beginner":null},"sports-fitness/climbing":{"motivations":["move","company","learn"],"social":"together","durationMinutes":120,"beginner":null},"sports-fitness/cricket":{"motivations":["move","company","explore","learn"],"social":"together","durationMinutes":120,"beginner":null},"sports-fitness/cycling":{"motivations":["move","explore"],"social":"either","durationMinutes":15,"beginner":null},"sports-fitness/dance":{"motivations":["move","company","learn"],"social":"together","durationMinutes":90,"beginner":null},"sports-fitness/hyrox":{"motivations":["move","company"],"social":"together","durationMinutes":90,"beginner":null},"sports-fitness/martial-arts":{"motivations":["move","company","learn","explore"],"social":"together","durationMinutes":null,"beginner":null},"sports-fitness/padel":{"motivations":["move","company","learn"],"social":"together","durationMinutes":null,"beginner":null},"sports-fitness/pickleball":{"motivations":["move","company","learn"],"social":"together","durationMinutes":60,"beginner":null},"sports-fitness/run-clubs":{"motivations":["move","company","explore"],"social":"together","durationMinutes":60,"beginner":null},"sports-fitness/running":{"motivations":["move","explore","learn"],"social":"either","durationMinutes":15,"beginner":null},"sports-fitness/skateboarding":{"motivations":["move","explore","learn"],"social":"either","durationMinutes":60,"beginner":null},"sports-fitness/skating":{"motivations":["move","learn"],"social":"either","durationMinutes":60,"beginner":null},"sports-fitness/soccer":{"motivations":["move","company","explore","learn"],"social":"together","durationMinutes":null,"beginner":null},"sports-fitness/strength-training":{"motivations":["move"],"social":"either","durationMinutes":null,"beginner":null},"sports-fitness/swimming":{"motivations":["move","learn"],"social":"either","durationMinutes":null,"beginner":null},"sports-fitness/table-tennis":{"motivations":["move","company","learn"],"social":"together","durationMinutes":60,"beginner":null},"sports-fitness/tennis":{"motivations":["move","company","explore","learn"],"social":"together","durationMinutes":15,"beginner":null},"sports-fitness/ultimate-frisbee":{"motivations":["move","company","explore","learn"],"social":"together","durationMinutes":90,"beginner":null},"sports-fitness/volleyball":{"motivations":["move","company","learn","explore"],"social":"together","durationMinutes":null,"beginner":null},"sports-fitness/walking-clubs":{"motivations":["move","company","explore"],"social":"together","durationMinutes":60,"beginner":null},"tech-building/3d-printing":{"motivations":["make","personal_time","explore"],"social":"solo","durationMinutes":null,"beginner":null},"tech-building/ai-projects":{"motivations":["make","explore"],"social":"either","durationMinutes":null,"beginner":null},"tech-building/arduino":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"tech-building/coding":{"motivations":["make","explore"],"social":"either","durationMinutes":120,"beginner":null},"tech-building/drones":{"motivations":["personal_time","explore","learn"],"social":"solo","durationMinutes":15,"beginner":null},"tech-building/electronics":{"motivations":["make","personal_time"],"social":"solo","durationMinutes":null,"beginner":null},"tech-building/game-development":{"motivations":["make","personal_time","explore"],"social":"solo","durationMinutes":null,"beginner":null},"tech-building/robotics":{"motivations":["make"],"social":"either","durationMinutes":null,"beginner":null},"tech-building/web-design":{"motivations":["make","personal_time","explore"],"social":"solo","durationMinutes":null,"beginner":null},"travel-adventure/backpacking":{"motivations":["company","explore"],"social":"together","durationMinutes":null,"beginner":null},"travel-adventure/city-walks":{"motivations":["explore","learn"],"social":"either","durationMinutes":120,"beginner":null},"travel-adventure/exploration":{"motivations":["explore"],"social":"either","durationMinutes":15,"beginner":null},"travel-adventure/rafting":{"motivations":["company","explore"],"social":"together","durationMinutes":240,"beginner":null},"travel-adventure/road-trips":{"motivations":["company","explore"],"social":"together","durationMinutes":null,"beginner":null},"travel-adventure/skiing":{"motivations":["company","explore","learn"],"social":"together","durationMinutes":15,"beginner":null},"travel-adventure/travel":{"motivations":["explore"],"social":"either","durationMinutes":null,"beginner":null},"travel-adventure/volunteering":{"motivations":["company","explore"],"social":"together","durationMinutes":180,"beginner":null}}$catalog$::jsonb) on conflict(key) do update set value=excluded.value;
create or replace function public.home_suggestions(p_limit integer default 8)
returns table (
  kind text,
  ref_id text,
  corner_key text,
  starts_at timestamptz,
  place_label text,
  score double precision,
  reasons text[],
  title text,
  space_slug text,
  friend_name text,
  pass_kind text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 8), 20));
  v_cfg jsonb := (select c.value from public.app_config c where c.key = 'home_ranking_v1');
  v_tz text := coalesce((select z.name from pg_timezone_names as z where z.name=(select c.profile->>'timeZone' from public.stubby_capabilities as c where c.user_id=auth.uid()) limit 1),'America/New_York');
  v_personal jsonb := coalesce((select c.personalization from public.stubby_capabilities as c where c.user_id=auth.uid()),'{}');
  v_traits jsonb := coalesce((select a.value from public.app_config as a where a.key='recommendation_traits_v1'),'{}');
  v_today date := (now() at time zone v_tz)::date;
  v_area text := lower(btrim(coalesce((select pp.area from public.profile_private pp where pp.user_id = auth.uid()), '')));
  v_city text := lower(btrim(coalesce((select pp.city from public.profile_private pp where pp.user_id = auth.uid()), '')));
  v_picks text[] := coalesce((select pp.picks from public.profile_private pp where pp.user_id = auth.uid()), '{}');
  v_windows text[] := coalesce((select pp.free_windows from public.profile_private pp where pp.user_id = auth.uid()), '{}');
  v_activity_budget numeric := (select (c.profile->>'perActivityBudget')::numeric from public.stubby_capabilities as c where c.user_id=auth.uid());
  v_budget smallint := (select pp.monthly_budget from public.profile_private pp where pp.user_id = auth.uid());
  v_passes text[] := coalesce((select array_agg(distinct up.kind) from public.user_passes up where up.user_id = auth.uid() and up.kind not in ('gear','bike')), '{}');
  w_window double precision;
  w_picked double precision;
  w_affinity double precision;
  w_friends double precision;
  w_nearby double precision;
  w_trending double precision;
  w_budget double precision;
  w_pass double precision;
  w_soon double precision;
  v_window_neutral double precision;
  v_friends_cap double precision;
  v_n_area double precision;
  v_n_city double precision;
  v_n_else double precision;
  v_n_online double precision;
  v_n_unknown double precision;
  v_tr_recent integer;
  v_tr_base integer;
  v_tr_scale double precision;
  v_soon_hours double precision;
  v_jitter double precision;
  v_top integer;
  v_pass_map jsonb;
begin
  if not private.is_member() or v_me is null or not private.is_active(v_me) or v_cfg is null then
    return;
  end if;

  w_window := (v_cfg #>> '{weights,window}')::double precision;
  w_picked := (v_cfg #>> '{weights,picked}')::double precision;
  w_affinity := (v_cfg #>> '{weights,affinity}')::double precision;
  w_friends := (v_cfg #>> '{weights,friends}')::double precision;
  w_nearby := (v_cfg #>> '{weights,nearby}')::double precision;
  w_trending := (v_cfg #>> '{weights,trending}')::double precision;
  w_budget := (v_cfg #>> '{weights,budget}')::double precision;
  w_pass := (v_cfg #>> '{weights,pass}')::double precision;
  w_soon := (v_cfg #>> '{weights,soon}')::double precision;
  v_window_neutral := (v_cfg ->> 'window_neutral')::double precision;
  v_friends_cap := greatest(1, (v_cfg ->> 'friends_cap')::double precision);
  v_n_area := (v_cfg #>> '{nearby,area}')::double precision;
  v_n_city := (v_cfg #>> '{nearby,city}')::double precision;
  v_n_else := (v_cfg #>> '{nearby,elsewhere}')::double precision;
  v_n_online := (v_cfg #>> '{nearby,online}')::double precision;
  v_n_unknown := (v_cfg #>> '{nearby,unknown}')::double precision;
  v_tr_recent := greatest(1, (v_cfg #>> '{trending,recent_hours}')::integer);
  v_tr_base := greatest(1, (v_cfg #>> '{trending,baseline_days}')::integer);
  v_tr_scale := greatest(0.1, (v_cfg #>> '{trending,scale}')::double precision);
  v_soon_hours := greatest(1, (v_cfg ->> 'soon_hours')::double precision);
  v_jitter := (v_cfg ->> 'jitter')::double precision;
  v_top := greatest(1, (v_cfg ->> 'distinct_top')::integer);
  v_pass_map := coalesce(v_cfg -> 'pass_corners', '{}'::jsonb);

  return query
  with
  aff as (
    select a.hobby_slug || '/' || a.corner as k, a.mine
    from public.my_corner_affinity() a
    where a.corner <> ''
  ),
  friends as (
    select f.followed_id as uid
    from public.profile_follows f
    where f.follower_id = v_me and f.status = 'accepted'
      and not private.is_blocked_between(v_me, f.followed_id)
      and not coalesce((select p.is_test from public.profiles p where p.id = f.followed_id), false)
  ),
  ev as (
    select e.id::text as ref_id, 'event'::text as kind, e.title, e.starts_at, s.slug as space_slug, s.id as space_id,
           -- the event's own place when it has one, else its Space's; never half of each
           case when nullif(btrim(e.neighborhood), '') is not null or nullif(btrim(e.city), '') is not null
                then nullif(btrim(e.neighborhood), '') else nullif(btrim(s.neighborhood), '') end as hood,
           case when nullif(btrim(e.neighborhood), '') is not null or nullif(btrim(e.city), '') is not null
                then nullif(btrim(e.city), '') else nullif(btrim(s.city), '') end as city,
           (e.meets = 'online') as online,
           e.price as price
    from public.space_events e
    join public.spaces s on s.id = e.space_id and s.status = 'active' and s.access = 'open'
    where e.status is distinct from 'cancelled'
      and e.starts_at > now()
      and e.starts_at <= now() + interval '7 days'
      and e.created_by is distinct from v_me
      and not exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = v_me)
      and not exists (
        select 1 from public.space_members sm
        where sm.space_id = s.id and sm.user_id = v_me and sm.role = 'host' and sm.status = 'active'
      )
      and (e.capacity is null or (select count(*) from public.event_rsvps r2 where r2.event_id = e.id) < e.capacity)
      and (e.created_by is null or not private.is_blocked_between(v_me, e.created_by))
      and not coalesce((select p.is_test from public.profiles p where p.id = e.created_by), false)
  ),
  evc as (
    select distinct on (ev.ref_id)
           ev.ref_id, ev.kind, ev.title, ev.starts_at, ev.space_slug, ev.hood, ev.city, ev.online, ev.price, coalesce(ev.hood, ev.city) as place_label, ev.space_id,
           (c.space_slug || '/' || c.slug) as corner_key
    from ev
    join public.space_corners sc on sc.space_id = ev.space_id
    join public.corners c on c.id = sc.corner_id and not c.hidden
    left join aff on aff.k = c.space_slug || '/' || c.slug
    order by ev.ref_id,
             ((c.space_slug || '/' || c.slug) = any (v_picks)) desc,
             coalesce(aff.mine, 0) desc,
             sc.is_primary desc,
             c.space_slug, c.slug
  ),
  pu as (
    select p.id as ref_id, 'open_pursuit'::text as kind, p.title, sess.starts_at, s.slug as space_slug,
           nullif(btrim(s.neighborhood), '') as hood, nullif(btrim(s.city), '') as city,
           false as online, null::text as price,
           coalesce(nullif(btrim(sess.place), ''), nullif(btrim(s.neighborhood), ''), nullif(btrim(s.city), '')) as place_label,
           (p.hobby_slug || '/' || p.sub_hobby) as corner_key
    from public.pursuits p
    join public.spaces s on s.id = p.space_id and s.status = 'active' and s.access = 'open'
    join lateral (
      select ps.starts_at, ps.place
      from public.pursuit_sessions ps
      where ps.pursuit_id = p.id and ps.starts_at > now()
      order by ps.starts_at
      limit 1
    ) sess on true
    where p.visibility = 'open'
      and p.hobby_slug is not null and p.sub_hobby is not null
      and p.finished_at is null and p.let_go_at is null and p.paused_at is null
      and (p.ends_at is null or p.ends_at > now())
      and sess.starts_at <= now() + interval '7 days'
      and p.user_id <> v_me
      and private.pursuit_taken(p.id) < coalesce(p.capacity, 0)
      and not exists (select 1 from public.pursuit_members m where m.pursuit_id = p.id and m.user_id = v_me)
      and not private.is_blocked_between(v_me, p.user_id)
      and not coalesce((select pr.is_test from public.profiles pr where pr.id = p.user_id), false)
  ),
  cand as (
    select evc.kind, evc.ref_id, evc.title, evc.starts_at, evc.space_slug, evc.corner_key, evc.hood, evc.city, evc.online, evc.price, evc.place_label, evc.space_id from evc
    union all
    select pu.kind, pu.ref_id, pu.title, pu.starts_at, pu.space_slug, pu.corner_key, pu.hood, pu.city, pu.online, pu.price, pu.place_label, null::uuid from pu
  ),
  -- Who is going: people the caller follows, by candidate.
  going as (
    select 'event'::text as kind, r.event_id::text as ref_id, r.user_id as uid, r.created_at as seen_at
    from public.event_rsvps r
    join friends on friends.uid = r.user_id
    union all
    select 'open_pursuit'::text, m.pursuit_id, m.user_id, m.created_at
    from public.pursuit_members m
    join friends on friends.uid = m.user_id
    where m.status = 'joined'
    union all
    select 'open_pursuit'::text, p2.id, p2.user_id, p2.started_at
    from public.pursuits p2
    join friends on friends.uid = p2.user_id
  ),
  -- New people joining a Corner: RSVPs and Pursuit joins, by Corner.
  joins as (
    select (c2.space_slug || '/' || c2.slug) as corner_key, r2.user_id as uid, r2.created_at as seen_at
    from public.event_rsvps r2
    join public.space_events e2 on e2.id = r2.event_id
    join public.space_corners sc2 on sc2.space_id = e2.space_id
    join public.corners c2 on c2.id = sc2.corner_id and not c2.hidden
    where r2.created_at > now() - make_interval(days => v_tr_base)
    union all
    select (p3.hobby_slug || '/' || p3.sub_hobby), m3.user_id, m3.created_at
    from public.pursuit_members m3
    join public.pursuits p3 on p3.id = m3.pursuit_id
    where m3.status = 'joined' and p3.hobby_slug is not null and p3.sub_hobby is not null
      and m3.created_at > now() - make_interval(days => v_tr_base)
  ),
  trend as (
    select j.corner_key,
           count(distinct j.uid) filter (where j.seen_at > now() - make_interval(hours => v_tr_recent)) as recent,
           count(distinct j.uid) filter (where j.seen_at <= now() - make_interval(hours => v_tr_recent)) as base
    from joins j
    group by j.corner_key
  ),
  signals as (
    select cand.*,
           -- the window the start time falls in, New York time
           case
             when extract(hour from (cand.starts_at at time zone v_tz)) >= 18 then
               (array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from (cand.starts_at at time zone v_tz))::integer] || '-eve'
             when extract(hour from (cand.starts_at at time zone v_tz)) >= 6 then
               (array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from (cand.starts_at at time zone v_tz))::integer] || '-day'
             else null
           end as wkey,
           (cand.corner_key = any (v_picks)) as is_pick,
           coalesce((select a.mine from aff a where a.k = cand.corner_key), 0)::double precision as s_aff,
           (select count(distinct g.uid) from going g where g.kind = cand.kind and g.ref_id = cand.ref_id)::integer as n_friends,
           -- may the caller already see who is going? (event: member of the Space; Pursuit: joined member)
           (case
              when cand.kind = 'event' then coalesce(public.is_space_member(cand.space_id, v_me), false)
              else exists (select 1 from public.pursuit_members mv where mv.pursuit_id = cand.ref_id and mv.user_id = v_me and mv.status = 'joined')
            end) as can_see,
           coalesce((select t.recent from trend t where t.corner_key = cand.corner_key), 0)::double precision as tr_recent,
           coalesce((select t.base from trend t where t.corner_key = cand.corner_key), 0)::double precision as tr_base,
           (select pk from unnest(v_passes) as pk
             where jsonb_exists(v_pass_map -> pk, cand.corner_key)
             order by pk limit 1) as pass_kind
    from cand
  ),
  scored as (
    select sg.*,
           case
             when cardinality(v_windows) = 0 then v_window_neutral
             when sg.wkey = any (v_windows) then 1.0
             else 0.0
           end as s_window,
           (case when sg.is_pick then 1.0 else 0.0 end) as s_pick,
           (case when sg.can_see then
              (select split_part(btrim(pr2.display_name), ' ', 1)
                 from going g2
                 join public.profiles pr2 on pr2.id = g2.uid
                where g2.kind = sg.kind and g2.ref_id = sg.ref_id and btrim(coalesce(pr2.display_name, '')) <> ''
                order by g2.seen_at, g2.uid
                limit 1)
            end) as friend_first,
           least(sg.n_friends, v_friends_cap) / v_friends_cap as s_friends,
           case
             when sg.online then v_n_online
             when v_area = '' and v_city = '' then v_n_unknown
             when v_area <> '' and lower(coalesce(sg.hood, '')) = v_area then v_n_area
             when v_city <> '' and lower(coalesce(sg.city, '')) = v_city then v_n_city
             else v_n_else
           end as s_near,
           case when sg.tr_recent > 0 then 1.0 - exp(- (sg.tr_recent / (sg.tr_base / greatest(1.0, (v_tr_base * 24.0) / v_tr_recent) + 1.0)) / v_tr_scale) else 0.0 end as s_trend,
           (case
              when v_budget = 0 and private.recommendation_price_max(sg.price)=0 then 1.0
              else 0.0
            end) as s_budget,
           (case when sg.pass_kind is not null then 1.0 else 0.0 end) as s_pass,
           greatest(0.0, 1.0 - (extract(epoch from (sg.starts_at - now())) / 3600.0) / v_soon_hours) as s_soon,
           ((abs(hashtextextended(v_me::text || v_today::text || sg.kind || sg.ref_id, 0)) % 1000) / 1000.0) * v_jitter as jit
    from signals sg
    where v_budget is distinct from 0 or private.recommendation_price_max(sg.price)=0
  ),
  final_scores as (
    select sc.*,
           (w_window * sc.s_window + w_picked * sc.s_pick + w_affinity * sc.s_aff + w_friends * sc.s_friends
            + w_nearby * sc.s_near + w_trending * sc.s_trend + w_budget * sc.s_budget + w_pass * sc.s_pass
            + w_soon * sc.s_soon + sc.jit + private.personalization_score(v_personal,v_traits->sc.corner_key,sc.corner_key)/100.0) as total
    from scored sc
  ),
  reasoned as (
    select fs.*,
           (select array_agg(x.code order by x.c desc, x.code)
              from (
                select v.code, v.c
                from (values
                  ('fits_window', case when cardinality(v_windows) > 0 and fs.wkey = any (v_windows) then w_window else 0.0 end),
                  ('picked', case when fs.is_pick then w_picked else 0.0 end),
                  ('affinity', case when not fs.is_pick then w_affinity * fs.s_aff else 0.0 end),
                  ('friend_going', case when fs.can_see then w_friends * fs.s_friends else 0.0 end),
                  ('nearby', case when not fs.online and fs.s_near >= v_n_city and fs.s_near > v_n_unknown then w_nearby * fs.s_near else 0.0 end),
                  ('trending', w_trending * fs.s_trend),
                  ('pass', w_pass * fs.s_pass),
                  ('soon', w_soon * fs.s_soon)
                ) as v(code, c)
                where v.c > 0
                order by v.c desc, v.code
                limit 2
              ) x) as why
    from final_scores fs
  ),
  ranked as (
    select r.*, row_number() over (partition by r.corner_key order by r.total desc, r.ref_id) as rn_in_corner
    from reasoned r
  ),
  firsts as (
    select rk.* from ranked rk where rk.rn_in_corner = 1 order by rk.total desc, rk.ref_id limit v_top
  ),
  ordered as (
    select f.kind, f.ref_id, f.corner_key, f.starts_at, f.place_label, f.total, f.why, f.title, f.space_slug,
           f.friend_first, f.pass_kind, f.is_pick, f.n_friends, 0 as grp
    from firsts f
    union all
    select rk.kind, rk.ref_id, rk.corner_key, rk.starts_at, rk.place_label, rk.total, rk.why, rk.title, rk.space_slug,
           rk.friend_first, rk.pass_kind, rk.is_pick, rk.n_friends, 1
    from ranked rk
    where not exists (select 1 from firsts f2 where f2.kind = rk.kind and f2.ref_id = rk.ref_id)
  )
  select o.kind, o.ref_id, o.corner_key, o.starts_at, o.place_label,
         round(o.total::numeric, 4)::double precision,
         coalesce(o.why, '{}'::text[]),
         o.title, o.space_slug,
         case when o.why @> array['friend_going']::text[] then left(o.friend_first, 60) else null end,
         case when o.why @> array['pass']::text[] then o.pass_kind else null end
  from ordered o
  order by o.grp, o.total desc, o.ref_id
  limit v_limit;
end
$$;
revoke all on function public.home_suggestions(integer) from public, anon;
grant execute on function public.home_suggestions(integer) to authenticated;
