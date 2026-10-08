// pursuits.cover_image_path / cover_image_preference hand-added from supabase/migrations/20261011000000_pursuit_cover_image.sql until types are regenerated.
// Generated from the live project's public schema (Supabase generate_typescript_types).
// Regenerate rather than hand-edit. Used only to type the visual-test fixtures.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          post_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          examples: string[] | null
          keywords: string[] | null
          name: string
          prompt: string | null
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          examples?: string[] | null
          keywords?: string[] | null
          name: string
          prompt?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          examples?: string[] | null
          keywords?: string[] | null
          name?: string
          prompt?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      category_suggestions: {
        Row: {
          created_at: string
          description: string | null
          examples: string | null
          id: number
          merged_into: string | null
          name: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          suggested_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          examples?: string | null
          id?: never
          merged_into?: string | null
          name: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          examples?: string | null
          id?: never
          merged_into?: string | null
          name?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          suggested_by?: string | null
        }
        Relationships: []
      }
      connections: {
        Row: {
          addressee: string
          created_at: string
          id: number
          note: string | null
          requester: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee: string
          created_at?: string
          id?: never
          note?: string | null
          requester: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee?: string
          created_at?: string
          id?: never
          note?: string | null
          requester?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      conversation_reads: {
        Row: {
          last_read_at: string
          participation_id: number
          user_id: string
        }
        Insert: {
          last_read_at?: string
          participation_id: number
          user_id: string
        }
        Update: {
          last_read_at?: string
          participation_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "participations"
            referencedColumns: ["id"]
          },
        ]
      }
      corners: {
        Row: {
          created_at: string
          description: string | null
          hidden: boolean
          id: number
          moment_count: number
          name: string
          slug: string
          space_slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          hidden?: boolean
          id?: never
          moment_count?: number
          name: string
          slug: string
          space_slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          hidden?: boolean
          id?: never
          moment_count?: number
          name?: string
          slug?: string
          space_slug?: string
        }
        Relationships: []
      }
      event_private_details: {
        Row: {
          event_id: number
          exact_address: string
        }
        Insert: {
          event_id: number
          exact_address: string
        }
        Update: {
          event_id?: number
          exact_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_private_details_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "space_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "space_events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          id: number
          name: string
          props: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          name: string
          props?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          name?: string
          props?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hobby_follows: {
        Row: {
          created_at: string
          hobby_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hobby_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          hobby_key?: string
          user_id?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          expires_at: string
          inviter_id: string
          note: string | null
          revoked_at: string | null
          status: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          expires_at?: string
          inviter_id: string
          note?: string | null
          revoked_at?: string | null
          status?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          inviter_id?: string
          note?: string | null
          revoked_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          from_user: string
          id: number
          kind: string
          media_path: string | null
          participation_id: number | null
          shared_post_id: number | null
          shared_pursuit_id: string | null
          to_user: string | null
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          from_user: string
          id?: never
          kind?: string
          media_path?: string | null
          participation_id?: number | null
          shared_post_id?: number | null
          shared_pursuit_id?: string | null
          to_user?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          from_user?: string
          id?: never
          kind?: string
          media_path?: string | null
          participation_id?: number | null
          shared_post_id?: number | null
          shared_pursuit_id?: string | null
          to_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_participation_id_fkey"
            columns: ["participation_id"]
            isOneToOne: false
            referencedRelation: "participations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_shared_post_id_fkey"
            columns: ["shared_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_shared_pursuit_id_fkey"
            columns: ["shared_pursuit_id"]
            isOneToOne: false
            referencedRelation: "pursuits"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_queue: {
        Row: {
          created_at: string
          id: number
          reason: string
          reported_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: never
          reason: string
          reported_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: never
          reason?: string
          reported_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      moment_drafts: {
        Row: {
          audience: string
          circle_id: number | null
          hobby_slug: string | null
          interest: string
          is_activity: boolean
          location_name: string
          location_privacy: string
          media_type: string | null
          project_id: string
          project_title: string
          space_set: boolean
          starts_at: string
          sub_hobby: string | null
          thought: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: string
          circle_id?: number | null
          hobby_slug?: string | null
          interest?: string
          is_activity?: boolean
          location_name?: string
          location_privacy?: string
          media_type?: string | null
          project_id?: string
          project_title?: string
          space_set?: boolean
          starts_at?: string
          sub_hobby?: string | null
          thought?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: string
          circle_id?: number | null
          hobby_slug?: string | null
          interest?: string
          is_activity?: boolean
          location_name?: string
          location_privacy?: string
          media_type?: string | null
          project_id?: string
          project_title?: string
          space_set?: boolean
          starts_at?: string
          sub_hobby?: string | null
          thought?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          body: string
          created_at: string
          href: string | null
          id: number
          kind: string
          read: boolean
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          body: string
          created_at?: string
          href?: string | null
          id?: never
          kind: string
          read?: boolean
          user_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string
          created_at?: string
          href?: string | null
          id?: never
          kind?: string
          read?: boolean
          user_id?: string
        }
        Relationships: []
      }
      participations: {
        Row: {
          created_at: string
          from_user: string
          hobby_key: string | null
          id: number
          intent: string | null
          kind: string
          note: string | null
          post_id: number | null
          responded_at: string | null
          status: string
          to_user: string | null
        }
        Insert: {
          created_at?: string
          from_user: string
          hobby_key?: string | null
          id?: never
          intent?: string | null
          kind: string
          note?: string | null
          post_id?: number | null
          responded_at?: string | null
          status?: string
          to_user?: string | null
        }
        Update: {
          created_at?: string
          from_user?: string
          hobby_key?: string | null
          id?: never
          intent?: string | null
          kind?: string
          note?: string | null
          post_id?: number | null
          responded_at?: string | null
          status?: string
          to_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reflections: {
        Row: {
          post_id: number
          reflection: string
          updated_at: string
          user_id: string
        }
        Insert: {
          post_id: number
          reflection: string
          updated_at?: string
          user_id: string
        }
        Update: {
          post_id?: number
          reflection?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reflections_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          caption: string
          corner: string | null
          created_at: string
          hobby_slug: string
          id: number
          in_count: number
          interest: string | null
          likes: number
          location_name: string | null
          location_privacy: string | null
          love_count: number
          media_paths: string[]
          media_url: string
          media_urls: string[] | null
          pinned: boolean
          pursuit_id: string | null
          reflection: string | null
          starts_at: string | null
          sub_hobby: string | null
          tags: string[]
          thoughts_private: boolean
          type: string
          user_id: string
          visibility: string
        }
        Insert: {
          caption: string
          corner?: string | null
          created_at?: string
          hobby_slug: string
          id?: never
          in_count?: number
          interest?: string | null
          likes?: number
          location_name?: string | null
          location_privacy?: string | null
          love_count?: number
          media_paths?: string[]
          media_url: string
          media_urls?: string[] | null
          pinned?: boolean
          pursuit_id?: string | null
          reflection?: string | null
          starts_at?: string | null
          sub_hobby?: string | null
          tags?: string[]
          thoughts_private?: boolean
          type: string
          user_id: string
          visibility?: string
        }
        Update: {
          caption?: string
          corner?: string | null
          created_at?: string
          hobby_slug?: string
          id?: never
          in_count?: number
          interest?: string | null
          likes?: number
          location_name?: string | null
          location_privacy?: string | null
          love_count?: number
          media_paths?: string[]
          media_url?: string
          media_urls?: string[] | null
          pinned?: boolean
          pursuit_id?: string | null
          reflection?: string | null
          starts_at?: string | null
          sub_hobby?: string | null
          tags?: string[]
          thoughts_private?: boolean
          type?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_corner_fkey"
            columns: ["hobby_slug", "corner"]
            isOneToOne: false
            referencedRelation: "corners"
            referencedColumns: ["space_slug", "slug"]
          },
          {
            foreignKeyName: "posts_pursuit_id_fkey"
            columns: ["pursuit_id"]
            isOneToOne: false
            referencedRelation: "pursuits"
            referencedColumns: ["id"]
          },
        ]
      }
      private_logs: {
        Row: {
          body: string
          created_at: string
          hobby_slug: string | null
          id: number
          media_type: string | null
          media_url: string | null
          project_id: string | null
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          hobby_slug?: string | null
          id?: never
          media_type?: string | null
          media_url?: string | null
          project_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          hobby_slug?: string | null
          id?: never
          media_type?: string | null
          media_url?: string | null
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pursuits"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_follows: {
        Row: {
          created_at: string
          followed_id: string
          follower_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          followed_id: string
          follower_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          followed_id?: string
          follower_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      profile_links: {
        Row: {
          created_at: string
          id: string
          label: string
          position: number
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          label: string
          position?: number
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position?: number
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_settings: {
        Row: {
          default_visibility: string
          notification_preferences: Json
          paused_until: string | null
          read_receipts: boolean
          user_id: string
          username_changed_at: string | null
        }
        Insert: {
          default_visibility?: string
          notification_preferences?: Json
          paused_until?: string | null
          read_receipts?: boolean
          user_id: string
          username_changed_at?: string | null
        }
        Update: {
          default_visibility?: string
          notification_preferences?: Json
          paused_until?: string | null
          read_receipts?: boolean
          user_id?: string
          username_changed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access: string
          avatar_url: string | null
          bio: string | null
          cover_post_id: number | null
          cover_tagline: string | null
          cover_title: string | null
          created_at: string
          deletion_requested_at: string | null
          discoverable: boolean
          display_name: string
          id: string
          invite_allowance: number
          invited_by: string | null
          is_admin: boolean
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          paused_at: string | null
          show_this_corner: boolean
          tagline: string | null
          theme_preference: string
          username: string
        }
        Insert: {
          access?: string
          avatar_url?: string | null
          bio?: string | null
          cover_post_id?: number | null
          cover_tagline?: string | null
          cover_title?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          discoverable?: boolean
          display_name: string
          id: string
          invite_allowance?: number
          invited_by?: string | null
          is_admin?: boolean
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          paused_at?: string | null
          show_this_corner?: boolean
          tagline?: string | null
          theme_preference?: string
          username: string
        }
        Update: {
          access?: string
          avatar_url?: string | null
          bio?: string | null
          cover_post_id?: number | null
          cover_tagline?: string | null
          cover_title?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          discoverable?: boolean
          display_name?: string
          id?: string
          invite_allowance?: number
          invited_by?: string | null
          is_admin?: boolean
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          paused_at?: string | null
          show_this_corner?: boolean
          tagline?: string | null
          theme_preference?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cover_post_id_fkey"
            columns: ["cover_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pursuit_invite_links: {
        Row: {
          created_at: string
          created_by: string
          pursuit_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          pursuit_id: string
          revoked_at?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          pursuit_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "pursuit_invite_links_pursuit_id_fkey"
            columns: ["pursuit_id"]
            isOneToOne: false
            referencedRelation: "pursuits"
            referencedColumns: ["id"]
          },
        ]
      }
      pursuit_members: {
        Row: {
          created_at: string
          invited_by: string | null
          pursuit_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          pursuit_id: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          pursuit_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pursuit_members_pursuit_id_fkey"
            columns: ["pursuit_id"]
            isOneToOne: false
            referencedRelation: "pursuits"
            referencedColumns: ["id"]
          },
        ]
      }
      pursuit_plans: {
        Row: {
          next_session_at: string | null
          next_session_note: string | null
          pursuit_id: string
          times_per_week: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          next_session_at?: string | null
          next_session_note?: string | null
          pursuit_id: string
          times_per_week?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          next_session_at?: string | null
          next_session_note?: string | null
          pursuit_id?: string
          times_per_week?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pursuit_plans_pursuit_id_fkey"
            columns: ["pursuit_id"]
            isOneToOne: false
            referencedRelation: "pursuits"
            referencedColumns: ["id"]
          },
        ]
      }
      pursuit_progress: {
        Row: {
          amount: number
          created_at: string
          id: string
          image_url: string | null
          note: string | null
          post_id: number | null
          pursuit_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id: string
          image_url?: string | null
          note?: string | null
          post_id?: number | null
          pursuit_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          image_url?: string | null
          note?: string | null
          post_id?: number | null
          pursuit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pursuit_progress_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pursuit_progress_pursuit_id_fkey"
            columns: ["pursuit_id"]
            isOneToOne: false
            referencedRelation: "pursuits"
            referencedColumns: ["id"]
          },
        ]
      }
      pursuits: {
        Row: {
          check_in_days: number | null
          cover_image_path: string | null
          cover_image_preference: string
          custom_space: string | null
          ending_note: string | null
          finished_at: string | null
          goal_current: number | null
          goal_label: string | null
          goal_reached_at: string | null
          goal_shape: string | null
          goal_target_date: string | null
          goal_target_number: number | null
          goal_unit: string | null
          goal_verb: string | null
          hobby_slug: string | null
          id: string
          inspired_by_post_id: number | null
          interest: string | null
          let_go_at: string | null
          measure: Json | null
          mode: string
          paused_at: string | null
          shared: boolean
          started_at: string
          sub_hobby: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in_days?: number | null
          cover_image_path?: string | null
          cover_image_preference?: string
          custom_space?: string | null
          ending_note?: string | null
          finished_at?: string | null
          goal_current?: number | null
          goal_label?: string | null
          goal_reached_at?: string | null
          goal_shape?: string | null
          goal_target_date?: string | null
          goal_target_number?: number | null
          goal_unit?: string | null
          goal_verb?: string | null
          hobby_slug?: string | null
          id: string
          inspired_by_post_id?: number | null
          interest?: string | null
          let_go_at?: string | null
          measure?: Json | null
          mode?: string
          paused_at?: string | null
          shared?: boolean
          started_at?: string
          sub_hobby?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in_days?: number | null
          cover_image_path?: string | null
          cover_image_preference?: string
          custom_space?: string | null
          ending_note?: string | null
          finished_at?: string | null
          goal_current?: number | null
          goal_label?: string | null
          goal_reached_at?: string | null
          goal_shape?: string | null
          goal_target_date?: string | null
          goal_target_number?: number | null
          goal_unit?: string | null
          goal_verb?: string | null
          hobby_slug?: string | null
          id?: string
          inspired_by_post_id?: number | null
          interest?: string | null
          let_go_at?: string | null
          measure?: Json | null
          mode?: string
          paused_at?: string | null
          shared?: boolean
          started_at?: string
          sub_hobby?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          action: string
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          id: number
          post_id: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          post_id: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          post_id?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: number
          note: string | null
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: number | null
          target_kind: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          note?: string | null
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: number | null
          target_kind: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          note?: string | null
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: number | null
          target_kind?: string
          target_user_id?: string
        }
        Relationships: []
      }
      space_corners: {
        Row: {
          added_at: string
          corner_id: number
          is_primary: boolean
          space_id: string
        }
        Insert: {
          added_at?: string
          corner_id: number
          is_primary?: boolean
          space_id: string
        }
        Update: {
          added_at?: string
          corner_id?: number
          is_primary?: boolean
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_corners_corner_id_fkey"
            columns: ["corner_id"]
            isOneToOne: false
            referencedRelation: "corners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_corners_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_deletion_approvals: {
        Row: {
          decision: string
          deletion_request_id: number
          host_user_id: string
          responded_at: string | null
        }
        Insert: {
          decision?: string
          deletion_request_id: number
          host_user_id: string
          responded_at?: string | null
        }
        Update: {
          decision?: string
          deletion_request_id?: number
          host_user_id?: string
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "space_deletion_approvals_deletion_request_id_fkey"
            columns: ["deletion_request_id"]
            isOneToOne: false
            referencedRelation: "space_deletion_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      space_deletion_requests: {
        Row: {
          created_at: string
          expires_at: string
          id: number
          requested_by: string
          space_id: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: never
          requested_by: string
          space_id: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: never
          requested_by?: string
          space_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_deletion_requests_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_events: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          featured: boolean
          id: number
          meets: string
          neighborhood: string | null
          space_id: string
          starts_at: string
          status: string
          timezone: string
          title: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          featured?: boolean
          id?: never
          meets: string
          neighborhood?: string | null
          space_id: string
          starts_at: string
          status?: string
          timezone: string
          title: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          featured?: boolean
          id?: never
          meets?: string
          neighborhood?: string | null
          space_id?: string
          starts_at?: string
          status?: string
          timezone?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_host_invites: {
        Row: {
          created_at: string
          id: number
          invited_by: string
          invited_user_id: string
          responded_at: string | null
          space_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: never
          invited_by: string
          invited_user_id: string
          responded_at?: string | null
          space_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: never
          invited_by?: string
          invited_user_id?: string
          responded_at?: string | null
          space_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_host_invites_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_join_requests: {
        Row: {
          answers: Json | null
          created_at: string
          space_id: string
          user_id: string
        }
        Insert: {
          answers?: Json | null
          created_at?: string
          space_id: string
          user_id: string
        }
        Update: {
          answers?: Json | null
          created_at?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_join_requests_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          invited_by: string | null
          joined_at: string
          role: string
          space_id: string
          status: string
          user_id: string
        }
        Insert: {
          invited_by?: string | null
          joined_at?: string
          role?: string
          space_id: string
          status?: string
          user_id: string
        }
        Update: {
          invited_by?: string | null
          joined_at?: string
          role?: string
          space_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_moments: {
        Row: {
          added_at: string
          featured: boolean
          post_id: number
          removed_by_host: boolean
          space_id: string
          status: string
        }
        Insert: {
          added_at?: string
          featured?: boolean
          post_id: number
          removed_by_host?: boolean
          space_id: string
          status?: string
        }
        Update: {
          added_at?: string
          featured?: boolean
          post_id?: number
          removed_by_host?: boolean
          space_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_moments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_moments_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_private_details: {
        Row: {
          exact_address: string | null
          space_id: string
        }
        Insert: {
          exact_address?: string | null
          space_id: string
        }
        Update: {
          exact_address?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_private_details_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: true
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          access: string
          category_slug: string | null
          city: string | null
          cover_image: string
          created_at: string
          created_by: string | null
          description: string
          events_created_by: string
          host_handoff_started_at: string | null
          id: string
          join_questions: Json
          meets: string
          member_cap: number | null
          name: string
          neighborhood: string | null
          posting_mode: string
          rules: string | null
          slug: string
          status: string
          studio_capacity: number | null
          studio_hourly_rate: number | null
          studio_hours: string | null
        }
        Insert: {
          access?: string
          category_slug?: string | null
          city?: string | null
          cover_image: string
          created_at?: string
          created_by?: string | null
          description: string
          events_created_by?: string
          host_handoff_started_at?: string | null
          id?: string
          join_questions?: Json
          meets: string
          member_cap?: number | null
          name: string
          neighborhood?: string | null
          posting_mode?: string
          rules?: string | null
          slug: string
          status?: string
          studio_capacity?: number | null
          studio_hourly_rate?: number | null
          studio_hours?: string | null
        }
        Update: {
          access?: string
          category_slug?: string | null
          city?: string | null
          cover_image?: string
          created_at?: string
          created_by?: string | null
          description?: string
          events_created_by?: string
          host_handoff_started_at?: string | null
          id?: string
          join_questions?: Json
          meets?: string
          member_cap?: number | null
          name?: string
          neighborhood?: string | null
          posting_mode?: string
          rules?: string | null
          slug?: string
          status?: string
          studio_capacity?: number | null
          studio_hourly_rate?: number | null
          studio_hours?: string | null
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          terms_version: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          terms_version: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      thoughts: {
        Row: {
          body: string
          created_at: string
          id: number
          media_url: string | null
          post_id: number
          prompt: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: never
          media_url?: string | null
          post_id: number
          prompt?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: never
          media_url?: string | null
          post_id?: number
          prompt?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thoughts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          hobby: string | null
          id: number
        }
        Insert: {
          created_at?: string
          email: string
          hobby?: string | null
          id?: never
        }
        Update: {
          created_at?: string
          email?: string
          hobby?: string | null
          id?: never
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_host_handoff: { Args: { p_space_id: string }; Returns: undefined }
      accept_host_invite: { Args: { p_invite_id: number }; Returns: undefined }
      admin_delete_space: { Args: { p_slug: string }; Returns: undefined }
      admin_first_moments_waiting: {
        Args: never
        Returns: {
          admin_can_view: boolean
          author_id: string
          author_name: string
          caption: string
          hours_waiting: number
          inviter_name: string
          post_id: number
          posted_at: string
          visibility: string
        }[]
      }
      admin_hide_corner: {
        Args: { p_corner_id: number; p_hidden: boolean }
        Returns: undefined
      }
      admin_merge_corners: {
        Args: { p_from_id: number; p_into_id: number }
        Returns: Json
      }
      admin_move_space_content: {
        Args: { p_from: string; p_to: string }
        Returns: Json
      }
      admin_rename_corner: {
        Args: { p_corner_id: number; p_new_name: string }
        Returns: undefined
      }
      approve_join_request: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: undefined
      }
      approve_space_moment: {
        Args: { p_post_id: number; p_space_id: string }
        Returns: undefined
      }
      assert_space_active: { Args: { p_space_id: string }; Returns: undefined }
      ban_member: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: undefined
      }
      cancel_deletion_request: {
        Args: { p_request_id: number }
        Returns: undefined
      }
      cancel_event: { Args: { p_event_id: number }; Returns: undefined }
      cancel_join_request: { Args: { p_space_id: string }; Returns: undefined }
      cancel_rsvp: { Args: { p_event_id: number }; Returns: undefined }
      claim_invite: { Args: { p_code: string }; Returns: string }
      corner_activity_30d: {
        Args: never
        Returns: {
          moments_30d: number
          slug: string
          space_slug: string
        }[]
      }
      create_event: {
        Args: {
          p_city: string
          p_description: string
          p_ends_at: string
          p_exact_address?: string
          p_meets: string
          p_neighborhood: string
          p_space_id: string
          p_starts_at: string
          p_timezone: string
          p_title: string
        }
        Returns: number
      }
      create_invite: {
        Args: { p_note?: string }
        Returns: {
          invite_code: string
          invite_expires_at: string
        }[]
      }
      create_space: {
        Args: {
          p_access: string
          p_city?: string
          p_corner_ids: number[]
          p_cover_image: string
          p_description: string
          p_events_created_by: string
          p_exact_address?: string
          p_meets: string
          p_member_cap?: number
          p_name: string
          p_neighborhood?: string
          p_posting_mode: string
          p_rules?: string
          p_slug: string
        }
        Returns: string
      }
      decline_host_invite: { Args: { p_invite_id: number }; Returns: undefined }
      decline_join_request: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: undefined
      }
      decline_space_moment: {
        Args: { p_post_id: number; p_space_id: string }
        Returns: undefined
      }
      demote_host: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: undefined
      }
      enforce_rate_limit: {
        Args: { p_action: string; p_max: number; p_window: string }
        Returns: undefined
      }
      execute_space_deletion: {
        Args: { p_space_id: string }
        Returns: undefined
      }
      feature_event: { Args: { p_event_id: number }; Returns: undefined }
      invite_host: {
        Args: { p_invited_user_id: string; p_space_id: string }
        Returns: undefined
      }
      invite_preview: {
        Args: { p_code: string }
        Returns: {
          inviter_avatar: string
          inviter_name: string
          is_valid: boolean
          note: string
        }[]
      }
      is_blocklisted_name: { Args: { candidate: string }; Returns: boolean }
      is_pursuit_participant: {
        Args: { pid: string; uid: string }
        Returns: boolean
      }
      is_reserved_space_slug: { Args: { check_slug: string }; Returns: boolean }
      is_space_host: { Args: { sid: string; uid: string }; Returns: boolean }
      is_space_member: { Args: { sid: string; uid: string }; Returns: boolean }
      is_visible_profile: { Args: { uid: string }; Returns: boolean }
      join_pursuit_via_link: { Args: { invite_token: string }; Returns: string }
      join_waitlist: {
        Args: { p_email: string; p_hobby?: string }
        Returns: boolean
      }
      leave_space: { Args: { p_space_id: string }; Returns: undefined }
      list_event_teasers: {
        Args: { p_space_id: string }
        Returns: {
          featured: boolean
          id: number
          starts_at: string
          timezone: string
          title: string
        }[]
      }
      mark_conversation_read: { Args: { pid: number }; Returns: undefined }
      my_invite_ask: { Args: never; Returns: number }
      participation_message_summaries: {
        Args: never
        Returns: {
          last_message_body: string
          last_message_created_at: string
          last_message_from_user: string
          last_message_id: number
          message_count: number
          participation_id: number
          unread_count: number
        }[]
      }
      pursuit_invite_preview: {
        Args: { invite_token: string }
        Returns: {
          measure: Json
          member_count: number
          mode: string
          owner_avatar: string
          owner_id: string
          owner_name: string
          pursuit_id: string
          title: string
        }[]
      }
      pursuit_person_name: { Args: { uid: string }; Returns: string }
      remove_member: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: undefined
      }
      request_or_join_space: {
        Args: { p_join_answers?: Json; p_space_id: string }
        Returns: string
      }
      request_space_deletion: { Args: { p_space_id: string }; Returns: string }
      respond_to_deletion_request: {
        Args: { p_decision: string; p_request_id: number }
        Returns: string
      }
      revoke_invite: { Args: { p_code: string }; Returns: boolean }
      rsvp_to_event: { Args: { p_event_id: number }; Returns: undefined }
      set_space_corners: {
        Args: { p_corner_ids: number[]; p_space_id: string }
        Returns: undefined
      }
      space_host_count: { Args: { sid: string }; Returns: number }
      space_moment_count_30d: { Args: { p_space_id: string }; Returns: number }
      space_usage: { Args: { p_slug: string }; Returns: Json }
      sweep_expired_host_handoffs: { Args: never; Returns: undefined }
      thread_seen_at: { Args: { pid: number }; Returns: string }
      unban_member: {
        Args: { p_space_id: string; p_user_id: string }
        Returns: undefined
      }
      unfeature_event: { Args: { p_event_id: number }; Returns: undefined }
      unlink_my_moment: {
        Args: { p_post_id: number; p_space_id: string }
        Returns: undefined
      }
      unsend_message: { Args: { message_id: number }; Returns: undefined }
      update_event: {
        Args: {
          p_city: string
          p_clear_address?: boolean
          p_description: string
          p_ends_at: string
          p_event_id: number
          p_exact_address?: string
          p_meets: string
          p_neighborhood: string
          p_starts_at: string
          p_timezone: string
          p_title: string
        }
        Returns: undefined
      }
      update_space: {
        Args: {
          p_access: string
          p_city?: string
          p_clear_address?: boolean
          p_cover_image: string
          p_description: string
          p_events_created_by: string
          p_exact_address?: string
          p_meets: string
          p_member_cap?: number
          p_name: string
          p_neighborhood?: string
          p_posting_mode: string
          p_rules?: string
          p_space_id: string
        }
        Returns: undefined
      }
      write_blocked: { Args: never; Returns: boolean }
      you_inspired_this_month: {
        Args: never
        Returns: {
          inspiring_post_caption: string
          inspiring_post_id: number
          pursuit_hobby_slug: string
          pursuit_id: string
          pursuit_sub_hobby: string
          pursuit_title: string
          started_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
