import { subHobbyLabel } from "./hobbies";

/**
 * Spaces Rework: the new vocabulary is `just_me | followers | space | public`.
 * `private` stays in this union as an accepted legacy value — it's the
 * pre-rename spelling of `just_me`; existing data was already migrated (see
 * supabase/migrations/20260924100000_spaces_rework_visibility.sql), but the
 * type stays wide until every write path is updated to stop producing it.
 */
export type Visibility = "public" | "followers" | "space" | "just_me" | "private";

export interface Post {
  id: number;
  hobbySlug: string;
  /** The specific hobby within the space, e.g. "pottery" inside "workbench" —
   * still what badges, Pursuits, and the shelf group a Moment by. */
  subHobby?: string;
  /** Which Corner (the Discover/Space browsing category — sql's `corners`
   * table) this Moment sits in, set independently of subHobby: a Moment can
   * be tagged Woodwork (subHobby) and filed under the Gift-making Corner at
   * the same time. Null on a post logged before this field existed — see
   * postCorner() below for the fallback every Corner-facing read should use. */
  corner?: string;
  /** What the post is about, in the maker's own words: "Pottery", "Bouldering". */
  interest?: string;
  /** "written" carries no real photo or video — see NewPostInput.type in
   * ContentContext.tsx for how the composer decides it. */
  type: "photo" | "video" | "written";
  /** Set only on the local-only fallback copy addPost() returns when a
   * signed-in save to Supabase actually failed (as opposed to a genuine
   * signed-out/offline post, which is also local-only but never sets this).
   * Distinguishes the two so a failed save doesn't silently earn rewards or
   * count toward share-card numbers. */
  unsaved?: boolean;
  media: string;
  /** The full ordered set of photos when this Moment carries more than one
   * (1-8; videos stay single-item). media always mirrors mediaUrls[0], for
   * anywhere that only ever reads one URL. */
  mediaUrls?: string[];
  /** Step 1 (private Moment photos): the real storage paths in the
   * `moment-media` bucket this Moment's photos live at — `media`/
   * `mediaUrls` above are always the signed URLs resolved from these, kept
   * separately so a Moment can be deleted (or have its photo replaced)
   * with the actual objects cleaned up, not just the display URL forgotten.
   * Undefined for a legacy post that still uses `media_url`/`media_urls`
   * directly (pre-Step-1, or not yet reached by the backfill), and for
   * anything that was never a real Supabase-backed post at all. */
  mediaPaths?: string[];
  creator: string;
  caption: string;
  likes: number;
  /** Public reaction totals (posts.love_count / posts.in_count, kept in step
   * by a trigger on public.reactions). Visible to anyone who can see the
   * Moment — see supabase/migrations/20260924200000_post_reaction_counts.sql. */
  loveCount?: number;
  inCount?: number;
  createdAt: number;
  visibility: Visibility;
  /** Links this post to a sellable listing in products.ts, if the creator is selling something. */
  productId?: number;
  /** Set on real (Supabase-backed) posts — the Supabase auth user id that made this post. */
  userId?: string;
  /** Set when this moment is a thing happening at a time — a walk, a workshop. */
  startsAt?: number;
  locationName?: string;
  locationPrivacy?: "exact" | "neighborhood" | "city" | "approximate" | "hidden";
  /** When on, only the poster and each thought's author can read the thoughts. */
  thoughtsPrivate?: boolean;
  /** Set when this Moment is an update on a specific Pursuit (sql/pursuits.sql,
   * sql/pursuit-updates.sql) — what a Pursuit's own page (/pursuit/:id) filters
   * its feed by. Real posts mirror this to the database so it survives across
   * devices and is visible to anyone the Pursuit itself is shared with; the
   * local-only entryProject map in lib/journal.ts remains the fast path for
   * the owner's own browser and for posts made before this field existed. */
  pursuitId?: string;
  /** Open, multiple tags — what a Moment is actually about, replacing the
   * fixed Space+interest pair as the primary way to describe it (see
   * sql/open-tags.sql). hobbySlug/subHobby/interest above are kept exactly
   * as they were and still resolve for anything that reads them (Corners,
   * badges, Pursuits) — tags is the new, additive field the composer and
   * the Shelf's tag row actually read from now. Never empty for a real
   * post; the SQL migration backfills it for existing database rows. */
  tags?: string[];
  /** Set by the owner to feature this Moment first on their Shelf — see
   * sql/post-pinning.sql. */
  pinned?: boolean;
  /** Set when this entry is actually a private log shown in the main
   * archive, not a real row in `posts`. `id` here is a negative stand-in
   * to avoid colliding with real post ids in the same list; privateLogId
   * holds the real id to use when calling private-log update/delete. */
  isPrivateLog?: boolean;
  privateLogId?: number;
}

/** Which Corner a Moment belongs to, for every Corner-facing read (Discover's
 * filter, a Space's "Follow a Corner" grid, a Corner's own page, "Explore
 * this Corner"). corner is the real field going forward; subHobby is the
 * fallback for a post logged before it existed — see supabase/migrations'
 * add_post_corner migration, which backfills corner = sub_hobby once, but
 * can't retroactively backfill a post written after that migration ran on
 * a build that predates this field. */
export function postCorner(post: Pick<Post, "corner" | "subHobby">): string | undefined {
  return post.corner ?? post.subHobby;
}

/**
 * No sample Moments ship with the app: every Moment on screen belongs to a
 * real account. Kept as an empty export so the demo-Pursuit lookup in
 * pages/Pursuit.tsx has nothing to match.
 */
export const seedPosts: Post[] = [];
