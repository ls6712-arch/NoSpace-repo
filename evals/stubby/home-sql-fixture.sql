-- Synthetic schema for executing the real Home recommendation function in isolated PGlite.
-- It models input relations, not a hosted Supabase project or its complete migration history.
alter table public.profile_private add column area text, add column city text,add column free_windows text[],add column monthly_budget smallint;
create function private.is_member() returns boolean language sql stable as $$select coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false$$;
create function private.is_active(uuid) returns boolean language sql stable as $$select true$$;
create function private.is_blocked_between(uuid,uuid) returns boolean language sql stable as $$select false$$;
create function private.pursuit_taken(text) returns integer language sql stable as $$select 0$$;
create function public.is_space_member(uuid,uuid) returns boolean language sql stable as $$select false$$;
create function public.my_corner_affinity() returns table(hobby_slug text,corner text,mine double precision) language sql stable as $$select null::text,null::text,0::double precision where false$$;
create table public.user_passes(id uuid,user_id uuid,kind text,label text,place text);
create table public.profiles(id uuid,is_test boolean,display_name text);
create table public.profile_follows(follower_id uuid,followed_id uuid,status text);
create table public.spaces(id uuid primary key,slug text,status text,access text,neighborhood text,city text);
create table public.space_events(id bigint,title text,starts_at timestamptz,space_id uuid,neighborhood text,city text,meets text,price text,status text,created_by uuid,capacity integer);
create table public.event_rsvps(event_id bigint,user_id uuid,created_at timestamptz);
create table public.space_members(space_id uuid,user_id uuid,role text,status text);
create table public.corners(id bigint,space_slug text,slug text,hidden boolean);
create table public.space_corners(space_id uuid,corner_id bigint,is_primary boolean);
create table public.pursuits(id text,space_id uuid,title text,user_id uuid,hobby_slug text,sub_hobby text,visibility text,finished_at timestamptz,let_go_at timestamptz,paused_at timestamptz,ends_at timestamptz,capacity integer,started_at timestamptz);
create table public.pursuit_sessions(pursuit_id text,starts_at timestamptz,place text);
create table public.pursuit_members(pursuit_id text,user_id uuid,status text,created_at timestamptz);
insert into public.spaces values('00000000-0000-4000-8000-000000000010','test-space','active','open','Test area','Test city');
insert into public.corners values(1,'music','guitar',false);
insert into public.space_corners values('00000000-0000-4000-8000-000000000010',1,true);
insert into public.space_events(id,title,starts_at,space_id,meets,price,status) values
 (1,'Free practice',now()+interval '1 day','00000000-0000-4000-8000-000000000010','online','Free','scheduled'),
 (2,'Price unknown',now()+interval '1 day','00000000-0000-4000-8000-000000000010','online',null,'scheduled'),
 (3,'Twenty dollars',now()+interval '1 day','00000000-0000-4000-8000-000000000010','online','$20','scheduled'),
 (4,'Thirty dollars',now()+interval '1 day','00000000-0000-4000-8000-000000000010','online','$30','scheduled');
insert into public.app_config (key, value)
values (
  'home_ranking_v1',
  $json${
    "version": 1,
    "weights": {
      "window": 0.22, "picked": 0.20, "affinity": 0.08, "friends": 0.16, "nearby": 0.12,
      "trending": 0.06, "budget": 0.04, "pass": 0.06, "soon": 0.06
    },
    "window_neutral": 0.5,
    "friends_cap": 2,
    "nearby": { "area": 1.0, "city": 0.6, "elsewhere": 0.0, "online": 0.3, "unknown": 0.3 },
    "trending": { "recent_hours": 48, "baseline_days": 28, "scale": 2.0 },
    "soon_hours": 48,
    "log_retention_days": 90,
    "jitter": 0.03,
    "distinct_top": 4,
    "pass_corners": {
      "climbing": ["sports-fitness/climbing"],
      "bike": ["sports-fitness/cycling"],
      "fitness": ["sports-fitness/strength-training", "health-wellness/yoga", "sports-fitness/running"],
      "museum": ["art-creative/drawing", "art-creative/life-drawing"],
      "library": ["books-writing/reading", "books-writing/book-clubs", "art-creative/drawing", "art-creative/life-drawing"]
    }
  }$json$::jsonb
)
on conflict (key) do nothing;

alter table public.user_passes enable row level security;
grant select,insert,update,delete on public.user_passes to authenticated;
create policy own_pass on public.user_passes for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

grant select on public.app_config to authenticated;

create table public.stubby_profiles(user_id uuid,interests text[]);
alter table public.stubby_profiles enable row level security;
grant select on public.stubby_profiles to authenticated;
create policy own_stub_profile on public.stubby_profiles for select to authenticated using(user_id=auth.uid());
