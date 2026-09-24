-- Schema baseline, public + private schemas, 2026-09-20.
-- Project eyzokuhhbyidvmuqfmwm. Exported via pg_catalog/information_schema
-- introspection (this managed environment has no pg_dump/psql access), not
-- a literal pg_dump. Reconstructs tables, constraints, indexes, RLS
-- policies, functions, triggers, and anon/authenticated grants as they
-- stood after migration pause_write_checks (v20260920174056), the last
-- one applied as of this export.
--
-- Assumes a fresh Supabase project (auth.users, auth.uid(), the anon/
-- authenticated roles, and the private schema already created empty).
-- Run in the order given below: schema, tables, constraints, indexes,
-- RLS + policies, functions, triggers, grants.
--
-- Known pre-existing issues carried into this baseline as-is (not fixed
-- here — see docs/backend-state-20260920.md and the security follow-up
-- for the intended fixes):
--   * admin_delete_circle, admin_delete_space, admin_move_space_content,
--     circle_usage, space_usage all call public.is_admin(auth.uid()),
--     which does not exist (only private.is_admin(uuid) does). Every
--     call to these five functions currently errors with
--     "function public.is_admin(uuid) does not exist" for ANY caller,
--     admin or not — confirmed by test. Not a privilege-escalation risk
--     (fails closed), but these five are functionally broken today.
--   * circle_invites and shared_milestones tables are referenced by
--     application code (ConnectionsContext.tsx, CirclesContext.tsx) but
--     are not captured in this export — they didn't turn up in the
--     public-schema introspection queries this baseline was built from.
--     Flagged in docs/backend-state-20260920.md as the
--     "circle_invites / shared_milestones / is_admin drift" follow-up;
--     recreating this schema from this file alone will NOT reproduce
--     circle_invites or shared_milestones.

begin;

-- =============================================================================
-- SCHEMAS
-- =============================================================================

create schema if not exists private;

-- =============================================================================
-- TABLES
-- =============================================================================

-- bookmarks
CREATE TABLE public.bookmarks (
  user_id uuid NOT NULL,
  post_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- categories
CREATE TABLE public.categories (
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  examples text[],
  keywords text[],
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  active boolean DEFAULT true NOT NULL,
  prompt text,
  sort_order integer,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- category_suggestions
CREATE TABLE public.category_suggestions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  suggested_by uuid,
  name text NOT NULL,
  description text,
  examples text,
  status text DEFAULT 'pending'::text NOT NULL,
  merged_into text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- circle_members
CREATE TABLE public.circle_members (
  circle_id bigint NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member'::text NOT NULL,
  joined_at timestamp with time zone DEFAULT now() NOT NULL
);

-- circles
CREATE TABLE public.circles (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  owner uuid NOT NULL,
  hobby_slug text NOT NULL,
  name text NOT NULL,
  location text,
  description text NOT NULL,
  purpose text NOT NULL,
  prompt text DEFAULT 'What are you working on this week?'::text NOT NULL,
  rules text[] DEFAULT ARRAY['Be the kind of member you''d want to find here.'::text, 'Keep it about the doing, not the selling.'::text] NOT NULL,
  visibility text DEFAULT 'Open to read'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- connections (retired feature — kept for schema parity, no active UI writes it)
CREATE TABLE public.connections (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  requester uuid NOT NULL,
  addressee uuid NOT NULL,
  note text,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  responded_at timestamp with time zone
);

-- corners
CREATE TABLE public.corners (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  space_slug text NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  moment_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  description text
);

-- hobby_follows
CREATE TABLE public.hobby_follows (
  user_id uuid NOT NULL,
  hobby_key text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- messages (retired feature — kept for schema parity)
CREATE TABLE public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  participation_id bigint,
  from_user uuid NOT NULL,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  to_user uuid,
  space_id bigint
);

-- moment_drafts
CREATE TABLE public.moment_drafts (
  user_id uuid NOT NULL,
  thought text DEFAULT ''::text NOT NULL,
  hobby_slug text,
  sub_hobby text,
  interest text DEFAULT ''::text NOT NULL,
  space_set boolean DEFAULT false NOT NULL,
  audience text DEFAULT 'private'::text NOT NULL,
  circle_id bigint,
  is_activity boolean DEFAULT false NOT NULL,
  starts_at text DEFAULT ''::text NOT NULL,
  location_name text DEFAULT ''::text NOT NULL,
  location_privacy text DEFAULT 'neighborhood'::text NOT NULL,
  project_id text DEFAULT ''::text NOT NULL,
  project_title text DEFAULT ''::text NOT NULL,
  media_type text,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- notifications
CREATE TABLE public.notifications (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  body text NOT NULL,
  href text,
  actor_name text,
  read boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- participations (retired feature — kept for schema parity)
CREATE TABLE public.participations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  kind text NOT NULL,
  from_user uuid NOT NULL,
  to_user uuid,
  post_id bigint,
  hobby_key text,
  intent text,
  note text,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  responded_at timestamp with time zone
);

-- post_likes
CREATE TABLE public.post_likes (
  user_id uuid NOT NULL,
  post_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- posts
CREATE TABLE public.posts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  hobby_slug text NOT NULL,
  type text NOT NULL,
  media_url text NOT NULL,
  caption text NOT NULL,
  reflection text,
  visibility text DEFAULT 'public'::text NOT NULL,
  likes integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  sub_hobby text,
  starts_at timestamp with time zone,
  location_name text,
  location_privacy text DEFAULT 'neighborhood'::text,
  thoughts_private boolean DEFAULT false NOT NULL,
  interest text,
  pursuit_id text,
  circle_id bigint,
  circle_tab text,
  answered boolean DEFAULT false NOT NULL,
  hidden_from_moments boolean DEFAULT false NOT NULL,
  media_urls text[],
  tags text[] DEFAULT '{}'::text[] NOT NULL,
  pinned boolean DEFAULT false NOT NULL
);

-- private_logs
CREATE TABLE public.private_logs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  body text DEFAULT ''::text NOT NULL,
  media_url text,
  media_type text,
  hobby_slug text,
  project_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- profile_follows
CREATE TABLE public.profile_follows (
  follower_id uuid NOT NULL,
  followed_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  responded_at timestamp with time zone
);

-- profile_links
CREATE TABLE public.profile_links (
  id text NOT NULL,
  user_id uuid NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  position integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- profile_settings
CREATE TABLE public.profile_settings (
  user_id uuid NOT NULL,
  default_visibility text DEFAULT 'private'::text NOT NULL,
  paused_until timestamp with time zone,
  username_changed_at timestamp with time zone,
  notification_preferences jsonb DEFAULT jsonb_build_object('circle_invites', true, 'replies_to_my_moments', true, 'circle_updates_joined', false, 'weekly_digest', false, 'product_news', false) NOT NULL
);

-- profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text NOT NULL,
  display_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  avatar_url text,
  is_admin boolean DEFAULT false NOT NULL,
  tagline text,
  onboarding_completed_at timestamp with time zone,
  onboarding_completed boolean DEFAULT false NOT NULL,
  bio text,
  cover_title text,
  cover_tagline text,
  cover_post_id bigint,
  paused_at timestamp with time zone,
  deletion_requested_at timestamp with time zone,
  discoverable boolean DEFAULT true NOT NULL,
  show_this_corner boolean DEFAULT true NOT NULL
);

-- pursuits
CREATE TABLE public.pursuits (
  id text NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  hobby_slug text,
  sub_hobby text,
  interest text,
  custom_space text,
  inspired_by_post_id bigint,
  shared boolean DEFAULT false NOT NULL,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  finished_at timestamp with time zone,
  goal_shape text,
  goal_label text,
  goal_target_number numeric,
  goal_unit text,
  goal_current numeric,
  goal_target_date timestamp with time zone,
  goal_reached_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  goal_verb text
);

-- rate_limit_hits
CREATE TABLE public.rate_limit_hits (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  action text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- reactions
CREATE TABLE public.reactions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  post_id bigint NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- space_members
CREATE TABLE public.space_members (
  space_id bigint NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member'::text NOT NULL,
  status text DEFAULT 'invited'::text NOT NULL,
  invited_by uuid,
  note text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- spaces
CREATE TABLE public.spaces (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  owner uuid NOT NULL,
  name text NOT NULL,
  description text,
  hobby_slug text,
  interest text,
  visibility text DEFAULT 'invite'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- thoughts
CREATE TABLE public.thoughts (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  post_id bigint NOT NULL,
  user_id uuid NOT NULL,
  prompt text,
  body text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  media_url text
);

-- =============================================================================
-- CONSTRAINTS (primary keys, foreign keys, checks, uniques)
-- =============================================================================

ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_pkey PRIMARY KEY (user_id, post_id);
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;

ALTER TABLE categories ADD CONSTRAINT categories_pkey PRIMARY KEY (slug);
ALTER TABLE categories ADD CONSTRAINT categories_slug_format CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (char_length(slug) <= 48))) NOT VALID;

ALTER TABLE category_suggestions ADD CONSTRAINT category_suggestions_pkey PRIMARY KEY (id);
ALTER TABLE category_suggestions ADD CONSTRAINT category_suggestions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'merged'::text, 'rejected'::text])));
ALTER TABLE category_suggestions ADD CONSTRAINT category_suggestions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE category_suggestions ADD CONSTRAINT category_suggestions_suggested_by_fkey FOREIGN KEY (suggested_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE circle_members ADD CONSTRAINT circle_members_pkey PRIMARY KEY (circle_id, user_id);
ALTER TABLE circle_members ADD CONSTRAINT circle_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])));
ALTER TABLE circle_members ADD CONSTRAINT circle_members_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES circles(id) ON DELETE CASCADE;
ALTER TABLE circle_members ADD CONSTRAINT circle_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE circles ADD CONSTRAINT circles_pkey PRIMARY KEY (id);
ALTER TABLE circles ADD CONSTRAINT circles_visibility_check CHECK ((visibility = ANY (ARRAY['Open to read'::text, 'Members only'::text])));
ALTER TABLE circles ADD CONSTRAINT circles_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE connections ADD CONSTRAINT connections_pkey PRIMARY KEY (id);
ALTER TABLE connections ADD CONSTRAINT connections_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])));
ALTER TABLE connections ADD CONSTRAINT connections_two_people CHECK ((requester <> addressee));
ALTER TABLE connections ADD CONSTRAINT connections_one_per_pair UNIQUE (requester, addressee);
ALTER TABLE connections ADD CONSTRAINT connections_addressee_fkey FOREIGN KEY (addressee) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE connections ADD CONSTRAINT connections_requester_fkey FOREIGN KEY (requester) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE corners ADD CONSTRAINT corners_pkey PRIMARY KEY (id);
ALTER TABLE corners ADD CONSTRAINT corners_space_slug_slug_key UNIQUE (space_slug, slug);

ALTER TABLE hobby_follows ADD CONSTRAINT hobby_follows_pkey PRIMARY KEY (user_id, hobby_key);
ALTER TABLE hobby_follows ADD CONSTRAINT hobby_follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE messages ADD CONSTRAINT messages_from_user_fkey FOREIGN KEY (from_user) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_participation_id_fkey FOREIGN KEY (participation_id) REFERENCES participations(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_to_user_fkey FOREIGN KEY (to_user) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE moment_drafts ADD CONSTRAINT moment_drafts_pkey PRIMARY KEY (user_id);
ALTER TABLE moment_drafts ADD CONSTRAINT moment_drafts_media_type_check CHECK ((media_type = ANY (ARRAY['photo'::text, 'video'::text])));
ALTER TABLE moment_drafts ADD CONSTRAINT moment_drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE participations ADD CONSTRAINT participations_pkey PRIMARY KEY (id);
ALTER TABLE participations ADD CONSTRAINT participations_kind_check CHECK ((kind = ANY (ARRAY['join_in'::text, 'make_together'::text, 'explore_together'::text])));
ALTER TABLE participations ADD CONSTRAINT participations_need_a_counterparty CHECK (((kind = 'join_in'::text) OR ((to_user IS NOT NULL) AND (to_user <> from_user))));
ALTER TABLE participations ADD CONSTRAINT participations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])));
ALTER TABLE participations ADD CONSTRAINT participations_from_user_fkey FOREIGN KEY (from_user) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE participations ADD CONSTRAINT participations_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE participations ADD CONSTRAINT participations_to_user_fkey FOREIGN KEY (to_user) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE post_likes ADD CONSTRAINT post_likes_pkey PRIMARY KEY (user_id, post_id);
ALTER TABLE post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE posts ADD CONSTRAINT posts_pkey PRIMARY KEY (id);
ALTER TABLE posts ADD CONSTRAINT posts_circle_tab_check CHECK (((circle_tab IS NULL) OR (circle_tab = ANY (ARRAY['updates'::text, 'pursuits'::text, 'questions'::text, 'events'::text]))));
ALTER TABLE posts ADD CONSTRAINT posts_location_privacy_check CHECK ((location_privacy = ANY (ARRAY['exact'::text, 'neighborhood'::text, 'city'::text, 'approximate'::text, 'hidden'::text])));
ALTER TABLE posts ADD CONSTRAINT posts_type_check CHECK ((type = ANY (ARRAY['photo'::text, 'video'::text])));
ALTER TABLE posts ADD CONSTRAINT posts_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'circle'::text, 'private'::text, 'friends'::text])));
ALTER TABLE posts ADD CONSTRAINT posts_pursuit_id_fkey FOREIGN KEY (pursuit_id) REFERENCES pursuits(id) ON DELETE SET NULL;
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE private_logs ADD CONSTRAINT private_logs_pkey PRIMARY KEY (id);
ALTER TABLE private_logs ADD CONSTRAINT private_logs_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text])));
ALTER TABLE private_logs ADD CONSTRAINT private_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES pursuits(id) ON DELETE SET NULL;
ALTER TABLE private_logs ADD CONSTRAINT private_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE profile_follows ADD CONSTRAINT profile_follows_pkey PRIMARY KEY (follower_id, followed_id);
ALTER TABLE profile_follows ADD CONSTRAINT profile_follows_no_self_follow CHECK ((follower_id <> followed_id));
ALTER TABLE profile_follows ADD CONSTRAINT profile_follows_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])));
ALTER TABLE profile_follows ADD CONSTRAINT profile_follows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profile_follows ADD CONSTRAINT profile_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE profile_links ADD CONSTRAINT profile_links_pkey PRIMARY KEY (id);
ALTER TABLE profile_links ADD CONSTRAINT profile_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE profile_settings ADD CONSTRAINT profile_settings_pkey PRIMARY KEY (user_id);
ALTER TABLE profile_settings ADD CONSTRAINT profile_settings_default_visibility_check CHECK ((default_visibility = ANY (ARRAY['private'::text, 'circle'::text, 'public'::text])));
ALTER TABLE profile_settings ADD CONSTRAINT profile_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD CONSTRAINT profiles_cover_post_id_fkey FOREIGN KEY (cover_post_id) REFERENCES posts(id) ON DELETE SET NULL;

ALTER TABLE pursuits ADD CONSTRAINT pursuits_pkey PRIMARY KEY (id);
ALTER TABLE pursuits ADD CONSTRAINT pursuits_goal_shape_check CHECK ((goal_shape = ANY (ARRAY['number'::text, 'date'::text, 'feeling'::text])));
ALTER TABLE pursuits ADD CONSTRAINT pursuits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE rate_limit_hits ADD CONSTRAINT rate_limit_hits_pkey PRIMARY KEY (id);

ALTER TABLE reactions ADD CONSTRAINT reactions_pkey PRIMARY KEY (id);
ALTER TABLE reactions ADD CONSTRAINT reactions_type_check CHECK ((type = ANY (ARRAY['love'::text, 'in'::text, 'keepgoing'::text])));
ALTER TABLE reactions ADD CONSTRAINT reactions_post_id_user_id_type_key UNIQUE (post_id, user_id, type);
ALTER TABLE reactions ADD CONSTRAINT reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE reactions ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE space_members ADD CONSTRAINT space_members_pkey PRIMARY KEY (space_id, user_id);
ALTER TABLE space_members ADD CONSTRAINT space_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])));
ALTER TABLE space_members ADD CONSTRAINT space_members_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'joined'::text, 'declined'::text])));
ALTER TABLE space_members ADD CONSTRAINT space_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE space_members ADD CONSTRAINT space_members_space_id_fkey FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE;
ALTER TABLE space_members ADD CONSTRAINT space_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE spaces ADD CONSTRAINT spaces_pkey PRIMARY KEY (id);
ALTER TABLE spaces ADD CONSTRAINT spaces_visibility_check CHECK ((visibility = ANY (ARRAY['invite'::text, 'open'::text])));
ALTER TABLE spaces ADD CONSTRAINT spaces_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE thoughts ADD CONSTRAINT thoughts_pkey PRIMARY KEY (id);
ALTER TABLE thoughts ADD CONSTRAINT thoughts_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE thoughts ADD CONSTRAINT thoughts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- =============================================================================
-- INDEXES (beyond those backing the constraints above)
-- =============================================================================

CREATE INDEX category_suggestions_status_idx ON public.category_suggestions USING btree (status, created_at DESC);
CREATE INDEX circle_members_user_idx ON public.circle_members USING btree (user_id);
CREATE INDEX circles_hobby_idx ON public.circles USING btree (hobby_slug);
CREATE INDEX connections_addressee_idx ON public.connections USING btree (addressee, status);
CREATE UNIQUE INDEX connections_pair_unordered ON public.connections USING btree (LEAST(requester, addressee), GREATEST(requester, addressee));
CREATE INDEX corners_space_idx ON public.corners USING btree (space_slug, moment_count DESC);
CREATE INDEX messages_pair_idx ON public.messages USING btree (to_user, from_user, created_at);
CREATE INDEX messages_participation_idx ON public.messages USING btree (participation_id, created_at);
CREATE INDEX messages_space_idx ON public.messages USING btree (space_id, created_at);
CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX participations_one_pending_ask ON public.participations USING btree (from_user, to_user, kind) WHERE ((status = 'pending'::text) AND (kind = ANY (ARRAY['make_together'::text, 'explore_together'::text])));
CREATE INDEX participations_post_idx ON public.participations USING btree (post_id);
CREATE INDEX participations_to_user_idx ON public.participations USING btree (to_user, status);
CREATE INDEX post_likes_post_idx ON public.post_likes USING btree (post_id);
CREATE INDEX posts_circle_idx ON public.posts USING btree (circle_id, circle_tab, created_at DESC);
CREATE INDEX posts_interest_idx ON public.posts USING btree (lower(interest));
CREATE INDEX posts_pinned_idx ON public.posts USING btree (user_id, pinned);
CREATE INDEX posts_pursuit_id_idx ON public.posts USING btree (pursuit_id);
CREATE INDEX posts_tags_idx ON public.posts USING gin (tags);
CREATE INDEX private_logs_user_idx ON public.private_logs USING btree (user_id, created_at DESC);
CREATE INDEX profile_follows_followed_idx ON public.profile_follows USING btree (followed_id);
CREATE INDEX profile_follows_follower_idx ON public.profile_follows USING btree (follower_id);
CREATE INDEX profile_links_user_idx ON public.profile_links USING btree (user_id, "position");
CREATE INDEX pursuits_shared_user_idx ON public.pursuits USING btree (user_id, shared);
CREATE INDEX pursuits_user_idx ON public.pursuits USING btree (user_id);
CREATE INDEX rate_limit_hits_lookup ON public.rate_limit_hits USING btree (action, user_id, created_at);
CREATE INDEX thoughts_post_idx ON public.thoughts USING btree (post_id, created_at DESC);
CREATE INDEX thoughts_user_idx ON public.thoughts USING btree (user_id);

-- =============================================================================
-- ROW LEVEL SECURITY — enable
-- =============================================================================

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hobby_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moment_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pursuits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thoughts ENABLE ROW LEVEL SECURITY;

-- Note: rate_limit_hits has RLS enabled but NO policies (pre-existing,
-- INFO-level advisor finding) — only SECURITY DEFINER functions
-- (enforce_rate_limit et al.) ever touch it, so this is effectively
-- "nobody via the API," which is the intended state, just implicit.

-- =============================================================================
-- FUNCTIONS — private schema
-- =============================================================================

CREATE OR REPLACE FUNCTION private.are_connected(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester = a and c.addressee = b) or (c.requester = b and c.addressee = a))
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_admin(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce((select p.is_admin from public.profiles p where p.id = u), false);
$function$;

CREATE OR REPLACE FUNCTION private.is_circle_member(c bigint, u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.circle_members m where m.circle_id = c and m.user_id = u
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_space_member(s bigint, u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.space_members m
    where m.space_id = s and m.user_id = u and m.status = 'joined'
  );
$function$;

CREATE OR REPLACE FUNCTION private.knows_space(s bigint, u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.space_members m where m.space_id = s and m.user_id = u
  );
$function$;

CREATE OR REPLACE FUNCTION private.owns_circle(c bigint, u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.circles ci where ci.id = c and ci.owner = u);
$function$;

CREATE OR REPLACE FUNCTION private.owns_space(s bigint, u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.spaces sp where sp.id = s and sp.owner = u);
$function$;

-- =============================================================================
-- FUNCTIONS — public schema
-- =============================================================================

-- NOTE (2026-09-20): the five admin/usage functions below call
-- public.is_admin(auth.uid()) — a function that does not exist (only
-- private.is_admin(uuid) does). Reproduced verbatim from the live
-- database; a fix is pending a separate, explicitly-approved migration.
-- Calling any of these five today raises
-- "function public.is_admin(uuid) does not exist" for every caller.

CREATE OR REPLACE FUNCTION public.admin_delete_circle(p_id bigint, p_threads text DEFAULT 'keep_private'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n_threads int;
  n_invites int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  if p_threads not in ('keep_private', 'delete') then
    raise exception 'Choose what happens to the threads: keep_private or delete.';
  end if;

  if not exists (select 1 from public.circles where id = p_id) then
    raise exception 'That Circle doesn''t exist. (Demo Circles are built into the app and can''t be deleted here.)';
  end if;

  if p_threads = 'keep_private' then
    update public.posts
       set circle_id = null,
           circle_tab = null,
           hidden_from_moments = false
     where circle_id = p_id + 1000000;
  else
    delete from public.posts where circle_id = p_id + 1000000;
  end if;
  get diagnostics n_threads = row_count;

  delete from public.circle_invites where circle_id = p_id;
  get diagnostics n_invites = row_count;

  delete from public.circles where id = p_id;

  return jsonb_build_object('threads', n_threads, 'invites', n_invites, 'mode', p_threads);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_space(p_slug text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  usage jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  if p_slug = any (array[
    'food-cooking', 'sports-fitness', 'art-creative', 'crafts-making',
    'books-writing', 'nature-outdoors', 'home-garden', 'gaming-tabletop',
    'music', 'photography-film', 'health-wellness', 'fashion-beauty',
    'tech-building', 'collecting-fandom', 'travel-adventure'
  ]) then
    raise exception 'Built-in Spaces can be hidden but not deleted.';
  end if;

  if not exists (select 1 from public.categories where slug = p_slug) then
    raise exception 'That Space doesn''t exist.';
  end if;

  delete from public.corners where space_slug = p_slug and moment_count = 0;

  usage := public.space_usage(p_slug);
  if (usage->>'posts')::int > 0
     or (usage->>'pursuits')::int > 0
     or (usage->>'circles')::int > 0
     or (usage->>'corners')::int > 0 then
    raise exception 'Still in use: % Moments, % Pursuits, % Circles. Move them to another Space first, or hide this one instead.',
      usage->>'posts', usage->>'pursuits', usage->>'circles';
  end if;

  delete from public.categories where slug = p_slug;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_move_space_content(p_from text, p_to text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n_posts int;
  n_pursuits int;
  n_circles int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'Pick two different Spaces.';
  end if;

  update public.posts set hobby_slug = p_to where hobby_slug = p_from;
  get diagnostics n_posts = row_count;

  update public.pursuits set hobby_slug = p_to where hobby_slug = p_from;
  get diagnostics n_pursuits = row_count;

  update public.circles set hobby_slug = p_to where hobby_slug = p_from;
  get diagnostics n_circles = row_count;

  return jsonb_build_object('posts', n_posts, 'pursuits', n_pursuits, 'circles', n_circles);
end;
$function$;

CREATE OR REPLACE FUNCTION public.circle_usage(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  return jsonb_build_object(
    'members', (select count(*) from public.circle_members where circle_id = p_id),
    'invites', (select count(*) from public.circle_invites where circle_id = p_id),
    'threads', (select count(*) from public.posts          where circle_id = p_id + 1000000)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.space_usage(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  return jsonb_build_object(
    'posts',    (select count(*) from public.posts    where hobby_slug = p_slug),
    'pursuits', (select count(*) from public.pursuits where hobby_slug = p_slug),
    'circles',  (select count(*) from public.circles  where hobby_slug = p_slug),
    'corners',  (select count(*) from public.corners  where space_slug = p_slug and moment_count > 0)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_rate_limit(p_action text, p_max integer, p_window interval)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cnt bigint;
  actor uuid := auth.uid();
begin
  if actor is null then
    return;
  end if;

  select count(*) into cnt
  from public.rate_limit_hits
  where action = p_action and user_id = actor and created_at > now() - p_window;

  if cnt >= p_max then
    raise exception 'Slow down — too many % actions recently. Try again in a bit.', p_action
      using errcode = '55000';
  end if;

  insert into public.rate_limit_hits (action, user_id) values (p_action, actor);

  if random() < 0.002 then
    delete from public.rate_limit_hits where created_at < now() - interval '2 days';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'creator'),
    coalesce(split_part(new.email, '@', 1), 'creator')
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_visible_profile(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select uid = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = uid
          and p.paused_at is null
          and p.deletion_requested_at is null
      );
$function$;

CREATE OR REPLACE FUNCTION public.real_circle_member_counts()
 RETURNS TABLE(circle_id bigint, member_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select circle_id, count(*) as member_count
  from public.circle_members
  group by circle_id;
$function$;

CREATE OR REPLACE FUNCTION public.reject_test_display_names()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.display_name is not null and lower(trim(new.display_name)) = any (array[
    'test', 'testing', 'test account', 'test user', 'test profile',
    'qa', 'qa test', 'qa account', 'qa user',
    'alex tester', 'bailey qa',
    'dummy', 'dummy account', 'sample account', 'do not use', 'placeholder'
  ]) then
    raise exception 'That display name is reserved for testing and can''t be used.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_category_suggestions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('category_suggestions_insert', 5, interval '1 day');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_circle_members()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('circle_members_insert', 30, interval '1 hour');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_circles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('circles_insert', 5, interval '1 day');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_connections()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('connections_insert', 20, interval '1 hour');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_corners()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('corners_insert', 10, interval '1 hour');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_messages()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('messages_insert', 60, interval '10 minutes');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('notifications_insert', 100, interval '10 minutes');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_participations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('participations_insert', 30, interval '1 hour');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_post_likes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('post_likes_insert', 100, interval '10 minutes');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_posts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('posts_insert', 20, interval '10 minutes');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_space_members()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('space_members_insert', 30, interval '1 hour');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rl_thoughts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.enforce_rate_limit('thoughts_insert', 40, interval '10 minutes');
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_thread_answered(p_post_id bigint, p_answered boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_owner uuid;
  v_circle bigint;
begin
  select user_id, circle_id into v_owner, v_circle from public.posts where id = p_post_id;
  if v_owner is null then
    return false;
  end if;
  if auth.uid() is distinct from v_owner
     and (v_circle is null or not private.owns_circle(v_circle, auth.uid())) then
    return false;
  end if;
  update public.posts set answered = p_answered where id = p_post_id;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_corner_moment_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (tg_op = 'DELETE') then
    if old.sub_hobby is not null and old.visibility = 'public' then
      update public.corners set moment_count = greatest(moment_count - 1, 0)
        where space_slug = old.hobby_slug and slug = old.sub_hobby;
    end if;
    return old;
  end if;

  if (tg_op = 'UPDATE') then
    if old.sub_hobby is distinct from new.sub_hobby
       or old.hobby_slug is distinct from new.hobby_slug
       or old.visibility is distinct from new.visibility then
      if old.sub_hobby is not null and old.visibility = 'public' then
        update public.corners set moment_count = greatest(moment_count - 1, 0)
          where space_slug = old.hobby_slug and slug = old.sub_hobby;
      end if;
      if new.sub_hobby is not null and new.visibility = 'public' then
        insert into public.corners (space_slug, slug, name, moment_count)
        values (new.hobby_slug, new.sub_hobby, new.sub_hobby, 1)
        on conflict (space_slug, slug)
          do update set moment_count = public.corners.moment_count + 1;
      end if;
    end if;
    return new;
  end if;

  if new.sub_hobby is not null and new.visibility = 'public' then
    insert into public.corners (space_slug, slug, name, moment_count)
    values (new.hobby_slug, new.sub_hobby, new.sub_hobby, 1)
    on conflict (space_slug, slug)
      do update set moment_count = public.corners.moment_count + 1;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_post_likes_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    update public.posts set likes = likes + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set likes = greatest(0, likes - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.write_blocked()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (p.paused_at is not null or p.deletion_requested_at is not null)
  );
$function$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER rl_category_suggestions_insert BEFORE INSERT ON public.category_suggestions FOR EACH ROW EXECUTE FUNCTION rl_category_suggestions();
CREATE TRIGGER rl_circle_members_insert BEFORE INSERT ON public.circle_members FOR EACH ROW EXECUTE FUNCTION rl_circle_members();
CREATE TRIGGER rl_circles_insert BEFORE INSERT ON public.circles FOR EACH ROW EXECUTE FUNCTION rl_circles();
CREATE TRIGGER rl_connections_insert BEFORE INSERT ON public.connections FOR EACH ROW EXECUTE FUNCTION rl_connections();
CREATE TRIGGER rl_corners_insert BEFORE INSERT ON public.corners FOR EACH ROW EXECUTE FUNCTION rl_corners();
CREATE TRIGGER rl_messages_insert BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION rl_messages();
CREATE TRIGGER rl_notifications_insert BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION rl_notifications();
CREATE TRIGGER rl_participations_insert BEFORE INSERT ON public.participations FOR EACH ROW EXECUTE FUNCTION rl_participations();
CREATE TRIGGER post_likes_sync_count AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION sync_post_likes_count();
CREATE TRIGGER rl_post_likes_insert BEFORE INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION rl_post_likes();
CREATE TRIGGER corners_sync AFTER INSERT OR DELETE OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION sync_corner_moment_count();
CREATE TRIGGER rl_posts_insert BEFORE INSERT ON public.posts FOR EACH ROW EXECUTE FUNCTION rl_posts();
CREATE TRIGGER reject_test_display_names BEFORE INSERT OR UPDATE OF display_name ON public.profiles FOR EACH ROW EXECUTE FUNCTION reject_test_display_names();
CREATE TRIGGER rl_space_members_insert BEFORE INSERT ON public.space_members FOR EACH ROW EXECUTE FUNCTION rl_space_members();
CREATE TRIGGER rl_thoughts_insert BEFORE INSERT ON public.thoughts FOR EACH ROW EXECUTE FUNCTION rl_thoughts();

-- =============================================================================
-- ROW LEVEL SECURITY — policies
-- =============================================================================

CREATE POLICY "you manage your own bookmarks" ON public.bookmarks FOR ALL TO public
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "reviewers manage categories" ON public.categories FOR ALL TO public
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY "categories are readable by anyone" ON public.categories FOR SELECT TO public
  USING (true);

CREATE POLICY "you can withdraw your own suggestion" ON public.category_suggestions FOR DELETE TO public
  USING (((suggested_by = auth.uid()) OR private.is_admin(auth.uid())));
CREATE POLICY "anyone signed in can suggest" ON public.category_suggestions FOR INSERT TO authenticated
  WITH CHECK ((suggested_by = auth.uid()));
CREATE POLICY "you see your own suggestions" ON public.category_suggestions FOR SELECT TO public
  USING (((suggested_by = auth.uid()) OR private.is_admin(auth.uid())));
CREATE POLICY "reviewers decide" ON public.category_suggestions FOR UPDATE TO public
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "you can leave a circle" ON public.circle_members FOR DELETE TO public
  USING ((user_id = auth.uid()));
CREATE POLICY "you can join a circle yourself" ON public.circle_members FOR INSERT TO authenticated
  WITH CHECK (((user_id = auth.uid()) AND ((role = 'member'::text) OR private.owns_circle(circle_id, auth.uid()))));
CREATE POLICY "you see the roster of a circle you're in" ON public.circle_members FOR SELECT TO public
  USING (((user_id = auth.uid()) OR private.is_circle_member(circle_id, auth.uid()) OR private.owns_circle(circle_id, auth.uid())));

CREATE POLICY "you create your own circle" ON public.circles FOR INSERT TO authenticated
  WITH CHECK ((owner = auth.uid()));
CREATE POLICY "circles are readable when signed in" ON public.circles FOR SELECT TO public
  USING ((auth.uid() IS NOT NULL));
CREATE POLICY "the owner edits their own circle" ON public.circles FOR UPDATE TO public
  USING ((owner = auth.uid()))
  WITH CHECK ((owner = auth.uid()));

CREATE POLICY "either side can withdraw or disconnect" ON public.connections FOR DELETE TO public
  USING (((auth.uid() = requester) OR (auth.uid() = addressee)));
CREATE POLICY "you can ask to connect" ON public.connections FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = requester) AND (requester <> addressee)));
CREATE POLICY "you see your own connections" ON public.connections FOR SELECT TO public
  USING (((auth.uid() = requester) OR (auth.uid() = addressee)));
CREATE POLICY "only the addressee answers" ON public.connections FOR UPDATE TO public
  USING ((auth.uid() = addressee))
  WITH CHECK ((auth.uid() = addressee));

CREATE POLICY "anyone signed in can create a corner" ON public.corners FOR INSERT TO authenticated
  WITH CHECK (((space_slug = ANY (ARRAY['food-cooking'::text, 'sports-fitness'::text, 'art-creative'::text, 'crafts-making'::text, 'books-writing'::text, 'nature-outdoors'::text, 'home-garden'::text, 'gaming-tabletop'::text, 'music'::text, 'photography-film'::text, 'health-wellness'::text, 'fashion-beauty'::text, 'tech-building'::text, 'collecting-fandom'::text, 'travel-adventure'::text])) OR (EXISTS ( SELECT 1
   FROM categories c
  WHERE (c.slug = corners.space_slug)))));
CREATE POLICY "space members can create a corner" ON public.corners FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1
   FROM spaces s
  WHERE ((s.hobby_slug = corners.space_slug) AND ((s.owner = auth.uid()) OR private.is_space_member(s.id, auth.uid()))))));
CREATE POLICY "corners are readable when signed in" ON public.corners FOR SELECT TO public
  USING ((auth.uid() IS NOT NULL));

CREATE POLICY "you manage your own hobby follows" ON public.hobby_follows FOR ALL TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "hobby follows are readable" ON public.hobby_follows FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND is_visible_profile(user_id)));

CREATE POLICY "you can write in an accepted thread" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = from_user) AND (EXISTS ( SELECT 1
   FROM participations p
  WHERE ((p.id = messages.participation_id) AND (p.status = 'accepted'::text) AND (p.kind = ANY (ARRAY['make_together'::text, 'explore_together'::text])) AND ((auth.uid() = p.from_user) OR (auth.uid() = p.to_user)))))));
CREATE POLICY "you write to connections and your spaces" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = from_user) AND (((to_user IS NOT NULL) AND private.are_connected(auth.uid(), to_user)) OR ((space_id IS NOT NULL) AND private.is_space_member(space_id, auth.uid())))));
CREATE POLICY "messages need an accepted participation" ON public.messages FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM participations p
  WHERE ((p.id = messages.participation_id) AND (p.status = 'accepted'::text) AND (p.kind = ANY (ARRAY['make_together'::text, 'explore_together'::text])) AND ((auth.uid() = p.from_user) OR (auth.uid() = p.to_user))))));
CREATE POLICY "you read messages meant for you" ON public.messages FOR SELECT TO public
  USING ((((to_user IS NOT NULL) AND ((auth.uid() = from_user) OR (auth.uid() = to_user)) AND private.are_connected(from_user, to_user)) OR ((space_id IS NOT NULL) AND private.is_space_member(space_id, auth.uid()))));

CREATE POLICY "you clear your own draft" ON public.moment_drafts FOR DELETE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "you save your own draft" ON public.moment_drafts FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "you see only your own draft" ON public.moment_drafts FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "you update your own draft" ON public.moment_drafts FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "signed-in users can notify" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "you read your own notifications" ON public.notifications FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "you mark your own as read" ON public.notifications FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "you can withdraw" ON public.participations FOR DELETE TO public
  USING ((auth.uid() = from_user));
CREATE POLICY "you can ask" ON public.participations FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = from_user));
CREATE POLICY "you see participations you are part of" ON public.participations FOR SELECT TO public
  USING (((auth.uid() = from_user) OR (auth.uid() = to_user) OR (to_user IS NULL)));
CREATE POLICY "the recipient answers" ON public.participations FOR UPDATE TO public
  USING (((auth.uid() = to_user) OR (auth.uid() = from_user)))
  WITH CHECK (((auth.uid() = to_user) OR (auth.uid() = from_user)));

CREATE POLICY "you manage your own likes" ON public.post_likes FOR ALL TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "post likes are readable" ON public.post_likes FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND is_visible_profile(user_id)));

CREATE POLICY "You can delete your own posts" ON public.posts FOR DELETE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "you delete your own moments" ON public.posts FOR DELETE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "you post your own moments" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (NOT ( SELECT write_blocked() AS write_blocked))));
CREATE POLICY "posts are readable by their audience" ON public.posts FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) = user_id) OR ((visibility = 'public'::text) AND is_visible_profile(user_id)) OR ((visibility = 'circle'::text) AND (circle_id IS NOT NULL) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND is_visible_profile(user_id) AND (EXISTS ( SELECT 1
   FROM circles c
  WHERE ((c.id = (posts.circle_id - 1000000)) AND ((c.visibility = ANY (ARRAY['open_to_read'::text, 'Open to read'::text])) OR (c.owner = ( SELECT auth.uid() AS uid)) OR private.is_circle_member(c.id, ( SELECT auth.uid() AS uid)))))))));
CREATE POLICY "own posts are editable" ON public.posts FOR UPDATE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (NOT ( SELECT write_blocked() AS write_blocked))));

CREATE POLICY "you delete your own private logs" ON public.private_logs FOR DELETE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "you create your own private logs" ON public.private_logs FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "you see only your own private logs" ON public.private_logs FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "you edit your own private logs" ON public.private_logs FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "either side can end a follow" ON public.profile_follows FOR DELETE TO public
  USING (((auth.uid() = follower_id) OR (auth.uid() = followed_id)));
CREATE POLICY "you follow people as yourself" ON public.profile_follows FOR INSERT TO authenticated
  WITH CHECK (((auth.uid() = follower_id) AND (status = 'pending'::text)));
CREATE POLICY "profile follows are readable when signed in" ON public.profile_follows FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND is_visible_profile(follower_id) AND is_visible_profile(followed_id)));
CREATE POLICY "only the followed person answers" ON public.profile_follows FOR UPDATE TO public
  USING ((auth.uid() = followed_id))
  WITH CHECK ((auth.uid() = followed_id));

CREATE POLICY "you delete your own links" ON public.profile_links FOR DELETE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "you create your own links" ON public.profile_links FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "profile links are readable when signed in" ON public.profile_links FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) IS NOT NULL) AND is_visible_profile(user_id)));
CREATE POLICY "you edit your own links" ON public.profile_links FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "you create your own settings" ON public.profile_settings FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "you see your own settings" ON public.profile_settings FOR SELECT TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "you update your own settings" ON public.profile_settings FOR UPDATE TO public
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "you can create your own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = id));
CREATE POLICY "profiles are visible unless paused or deleting" ON public.profiles FOR SELECT TO public
  USING ((((paused_at IS NULL) AND (deletion_requested_at IS NULL)) OR (( SELECT auth.uid() AS uid) = id)));
CREATE POLICY "You can update your own profile" ON public.profiles FOR UPDATE TO public
  USING ((auth.uid() = id));

CREATE POLICY "you can delete your own pursuit" ON public.pursuits FOR DELETE TO authenticated
  USING ((auth.uid() = user_id));
CREATE POLICY "you delete your own pursuits" ON public.pursuits FOR DELETE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "you create your own pursuits" ON public.pursuits FOR INSERT TO authenticated
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (NOT ( SELECT write_blocked() AS write_blocked))));
CREATE POLICY "you see your own pursuits, others see only shared ones" ON public.pursuits FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) = user_id) OR ((shared = true) AND is_visible_profile(user_id))));
CREATE POLICY "you edit your own pursuits" ON public.pursuits FOR UPDATE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (NOT ( SELECT write_blocked() AS write_blocked))));

CREATE POLICY "you remove your own reaction" ON public.reactions FOR DELETE TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "you react as yourself" ON public.reactions FOR INSERT TO public
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "the reactor and the post's author can see a reaction" ON public.reactions FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) = user_id) OR (( SELECT auth.uid() AS uid) = ( SELECT p.user_id
   FROM posts p
  WHERE (p.id = reactions.post_id)))));

CREATE POLICY "you can leave, the owner can remove" ON public.space_members FOR DELETE TO public
  USING (((user_id = auth.uid()) OR private.owns_space(space_id, auth.uid())));
CREATE POLICY "members invite" ON public.space_members FOR INSERT TO authenticated
  WITH CHECK (((invited_by = auth.uid()) AND (private.is_space_member(space_id, auth.uid()) OR private.owns_space(space_id, auth.uid()))));
CREATE POLICY "you see membership of spaces you are in" ON public.space_members FOR SELECT TO public
  USING (((user_id = auth.uid()) OR private.is_space_member(space_id, auth.uid()) OR private.owns_space(space_id, auth.uid())));
CREATE POLICY "you answer your own invitation" ON public.space_members FOR UPDATE TO public
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "the owner removes the space" ON public.spaces FOR DELETE TO public
  USING ((auth.uid() = owner));
CREATE POLICY "you can make a space" ON public.spaces FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = owner));
CREATE POLICY "spaces are visible to members and by invitation" ON public.spaces FOR SELECT TO public
  USING (((visibility = 'open'::text) OR (owner = auth.uid()) OR private.knows_space(id, auth.uid())));
CREATE POLICY "the owner edits the space" ON public.spaces FOR UPDATE TO public
  USING ((auth.uid() = owner))
  WITH CHECK ((auth.uid() = owner));

CREATE POLICY "you can remove your own thought" ON public.thoughts FOR DELETE TO public
  USING ((auth.uid() = user_id));
CREATE POLICY "anyone signed in can add a thought" ON public.thoughts FOR INSERT TO authenticated
  WITH CHECK (((( SELECT auth.uid() AS uid) = user_id) AND (NOT ( SELECT write_blocked() AS write_blocked))));
CREATE POLICY "thoughts follow the moment's setting" ON public.thoughts FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) = user_id) OR (is_visible_profile(user_id) AND (EXISTS ( SELECT 1
   FROM posts p
  WHERE ((p.id = thoughts.post_id) AND ((p.thoughts_private = false) OR (p.user_id = ( SELECT auth.uid() AS uid)))))))));

-- =============================================================================
-- GRANTS — tables (anon/authenticated hold the same broad grant set on
-- every public table below; RLS is what actually restricts row access)
-- =============================================================================

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE
  public.bookmarks, public.categories, public.category_suggestions,
  public.circle_members, public.circles, public.connections, public.corners,
  public.hobby_follows, public.messages, public.moment_drafts,
  public.notifications, public.participations, public.post_likes,
  public.posts, public.private_logs, public.profile_follows,
  public.profile_links, public.profile_settings, public.profiles,
  public.pursuits, public.rate_limit_hits, public.reactions,
  public.space_members, public.spaces, public.thoughts
  TO anon, authenticated;

-- =============================================================================
-- GRANTS — functions
-- =============================================================================

GRANT EXECUTE ON FUNCTION private.are_connected(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_circle_member(bigint, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_space_member(bigint, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.knows_space(bigint, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.owns_circle(bigint, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.owns_space(bigint, uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_delete_circle(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_space(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_move_space_content(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.circle_usage(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_visible_profile(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.real_circle_member_counts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_test_display_names() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rl_post_likes() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_thread_answered(bigint, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.space_usage(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_post_likes_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_blocked() TO authenticated;

commit;
