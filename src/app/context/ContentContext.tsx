import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Post, seedPosts, Visibility } from "../data/posts";
import { CircleTabId } from "../data/circles";
import { currentSpaceSlug } from "../data/hobbies";
import { Product, products as seedProducts } from "../data/products";
import { circles as allCircles } from "../data/circles";
import { useRewards } from "./RewardsContext";
import { useAuth } from "./AuthContext";
import { SOCIAL_STORAGE_KEY } from "./SocialContext";
import { supabase } from "../../lib/supabase";

const LISTINGS_KEY = "sushii.listings.v1";
const CIRCLES_KEY = "sushii.circles.joined.v1";

// Matches public.reactions' own check constraint (supabase/migrations/
// 20260919230300_reactions_and_bookmarks.sql) and PostReactions.tsx's own
// REACTIONS ids — kept as a plain literal union here rather than imported,
// so this data-layer file doesn't reach into a component file for a type.
type ReactionId = "love" | "in" | "keepgoing";

/** Whole-Space follows (SocialContext's "space:<slug>" keys) read straight
 * from that context's own signed-out localStorage shape, since
 * SocialProvider sits below ContentProvider in App.tsx's tree and useSocial()
 * isn't reachable from here. Only the shape read here (followedHobbies)
 * needs to stay in sync with SocialContext's own LocalState — nothing here
 * writes to this key. */
function readLocalFollowedSpaceSlugs(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SOCIAL_STORAGE_KEY);
    if (!raw) return [];
    const followed: string[] = JSON.parse(raw)?.followedHobbies ?? [];
    return followed.filter((k) => k.startsWith("space:")).map((k) => k.slice(6));
  } catch {
    return [];
  }
}

const HOUR = 3600 * 1000;

/**
 * Discovery ranking: recency + relevance to the hobbies you actually engage
 * with (posted in, or joined a circle for). No engagement/like term —
 * docs/moment-card-and-reactions-spec.md §4.6 bars counts from sorting,
 * ranking, filtering or promoting anything, and that guardrail applies to
 * this legacy engagementScore too, not only to the new reaction counts.
 */
function scorePost(post: Post, activeHobbies: Set<string>, activeTags: Set<string>): number {
  const ageHours = (Date.now() - post.createdAt) / HOUR;
  const recencyScore = Math.max(0, 240 - ageHours); // decays to 0 over ~10 days
  // A post can be relevant either through the legacy Space it's filed under
  // or through any open tag it carries — a tagged-but-unfollowed Space still
  // surfaces for someone who's posted the same tag themselves.
  const tagOverlap = (post.tags ?? []).some((t) => activeTags.has(t.toLowerCase()));
  const relevanceBonus = activeHobbies.has(post.hobbySlug) || tagOverlap ? 60 : 0;
  return recencyScore + relevanceBonus;
}

export interface ForSaleInput {
  name: string;
  price: number;
  type: "physical" | "digital" | "course";
}

export interface NewPostInput {
  hobbySlug: string;
  /** Optional specific hobby within the space, e.g. "pottery" in "workbench". */
  subHobby?: string;
  /** Which Corner this Moment is filed under — independent of subHobby, set
   * only when the composer's own Corner field was used. Never derived from
   * subHobby here; a post with no Corner chosen simply has none. */
  corner?: string;
  /** What it's about, typed by the person: "Pottery", "Bouldering". */
  interest?: string;
  /** Open, multiple tags — the composer's actual "what's this about" field
   * now (TagsField). interest above still gets the first of these for
   * anything that only reads the legacy single-value field. */
  tags?: string[];
  /** "written" for a Moment with no photo or video attached — the composer
   * decides this at publish time from whether any file was actually picked,
   * not from caption length. See Log.tsx's publish(). */
  type: "photo" | "video" | "written";
  media?: string;
  /** Real picked files (1-8 for a photo Moment, exactly 1 for a video),
   * uploaded to storage in order when a real account is signed in. */
  files?: File[];
  creator: string;
  caption: string;
  reflection?: string;
  visibility: Visibility;
  circleId?: number;
  /** Set when visibility === "circle" — which of the board's sections this
   * thread belongs to. */
  circleTab?: CircleTabId;
  /** True unless the Circle composer's "Also save to Moments" box was
   * checked. See Post.hiddenFromMoments. */
  hiddenFromMoments?: boolean;
  forSale?: ForSaleInput;
  /** Set when this moment is a thing happening at a time. */
  startsAt?: number;
  locationName?: string;
  locationPrivacy?: "exact" | "neighborhood" | "city" | "approximate" | "hidden";
  /** Set when this post is already known to belong to a specific Pursuit at
   * creation time (e.g. arriving via that Pursuit's own "Add progress").
   * Attaching to a brand-new Pursuit created from this same post (the
   * inline "Start a Pursuit" flow) still happens after the fact, since the
   * Pursuit doesn't exist until the post does — see attachPostToPursuit. */
  pursuitId?: string;
}

function loadFromStorage<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Every column `rowToPost` reads, deliberately spelled out and never
// `select("*")` — a Reflection is written by its owner alone (post_
// reflections, sql/post-reflections.sql) and must never round-trip to
// anyone else's browser, even as a field the app's own JS ignores. A
// wildcard select would put it on the wire regardless of what the mapper
// below does with it. See docs/moment-card-and-reactions-spec.md's #86.
const BASE_POST_COLUMNS =
  "id, user_id, hobby_slug, sub_hobby, corner, interest, type, media_url, media_urls, caption, likes, created_at, visibility, starts_at, location_name, location_privacy, thoughts_private, pursuit_id, circle_id, circle_tab, answered, hidden_from_moments, tags, pinned";
/** Public reaction totals — only exist once the post_reaction_counts
 * migration is applied. Until then every posts select below retries
 * without them (see selectPosts), so the app never breaks on a missing
 * column; counts just read as 0. */
let POST_COLUMNS = `${BASE_POST_COLUMNS}, love_count, in_count`;
const isMissingCountColumn = (error: { message?: string; code?: string } | null) =>
  !!error && (error.code === "42703" || /love_count|in_count/.test(error.message ?? ""));

/** Maps a row from the real `posts` table into the app's existing Post shape.
 * Never sets `reflection` — that comes from a separate, owner-only fetch
 * (see refetchRealPosts) merged in afterward, only for the signed-in
 * user's own rows. */
export function rowToPost(row: any, creatorName: string): Post {
  return {
    id: row.id,
    // An older post stored one of the eight original Space slugs. Nothing was
    // migrated in the database; it is translated on the way in instead.
    hobbySlug: currentSpaceSlug(row.hobby_slug),
    subHobby: row.sub_hobby ?? undefined,
    // Falls back to sub_hobby only for a row the add_post_corner migration's
    // backfill hasn't reached — every row it did reach already has corner
    // set (possibly to the same value sub_hobby has), so this is a safety
    // net, not the primary path. See postCorner() in data/posts.ts.
    corner: row.corner ?? row.sub_hobby ?? undefined,
    interest: row.interest ?? undefined,
    type: row.type,
    media: row.media_url,
    mediaUrls: row.media_urls ?? (row.media_url ? [row.media_url] : []),
    creator: creatorName,
    caption: row.caption,
    likes: row.likes ?? 0,
    createdAt: new Date(row.created_at).getTime(),
    visibility: row.visibility,
    userId: row.user_id,
    startsAt: row.starts_at ? new Date(row.starts_at).getTime() : undefined,
    locationName: row.location_name ?? undefined,
    locationPrivacy: row.location_privacy ?? undefined,
    thoughtsPrivate: row.thoughts_private ?? false,
    pursuitId: row.pursuit_id ?? undefined,
    circleId: row.circle_id ?? undefined,
    circleTab: row.circle_tab ?? undefined,
    answered: row.answered ?? false,
    hiddenFromMoments: row.hidden_from_moments ?? false,
    tags: row.tags ?? [],
    pinned: row.pinned ?? false,
    loveCount: row.love_count ?? 0,
    inCount: row.in_count ?? 0,
  };
}

interface ContentContextType {
  posts: Post[];
  myPosts: Post[];
  publicFeed: Post[];
  publicFeedByHobby: (slug: string) => Post[];
  circleFeed: (circleId: number, tab?: CircleTabId) => Post[];
  listings: Product[];
  listingsByHobby: (slug: string) => Product[];
  myListings: Product[];
  findListing: (id: number) => Product | undefined;
  addPost: (input: NewPostInput) => Promise<Post>;
  /**
   * Set when a photo or video failed to reach storage. The entry still saves —
   * losing someone's words because their picture didn't upload would be worse —
   * but the UI has to say so rather than quietly showing generated art.
   */
  mediaError: string | null;
  clearMediaError: () => void;
  /** Set when a post failed to reach the database. Cleared when a save starts. */
  saveError: string | null;
  clearSaveError: () => void;
  /** Edits a moment you own. Returns false if the change couldn't be saved. */
  updatePost: (
    postId: number,
    patch: {
      caption?: string;
      reflection?: string;
      visibility?: Visibility | "private";
      circleId?: number;
      hobbySlug?: string;
      subHobby?: string;
      mediaUrl?: string;
    },
  ) => Promise<boolean>;
  /** Deletes a moment you own. Returns false if it couldn't be deleted — the
   * post stays in the list rather than vanishing from a screen that no
   * longer matches what's actually in the database. */
  deletePost: (postId: number) => Promise<boolean>;
  /** Toggles whether a Moment you own is pinned to the top of your Shelf.
   * Returns false if the post can't be found or the write failed. */
  togglePin: (postId: number) => Promise<boolean>;
  /** Marks a Circle "questions" thread answered — allowed for the thread's
   * own author or the Circle's owner (sql/circle-threads.sql's
   * set_thread_answered RPC checks which). Returns false if neither. */
  setThreadAnswered: (postId: number, answered: boolean) => Promise<boolean>;
  toggleLike: (postId: number) => void;
  /** Whether the signed-in account has liked this post — backed by
   * `post_likes`, so it's correct across devices and after logout/login,
   * not just "did this browser tab toggle it." Always false when signed
   * out (there's no account to check it against). */
  isPostLiked: (postId: number) => boolean;
  joinedCircleIds: number[];
  isCircleJoined: (circleId: number) => boolean;
  joinCircle: (circleId: number) => void;
  leaveCircle: (circleId: number) => void;
  /** Real, cross-account joins per Circle id (accepted invitations), on top
   * of that Circle's own static baseline count in data/circles.ts. Does not
   * include this browser's own local-only join — combine with
   * isCircleJoined at the render site for the full displayed count. */
  circleMemberCounts: Record<number, number>;
  refetchCircleMemberCounts: () => Promise<void>;
  activeHobbySlugs: string[];
  /** Re-reads plain Space follows (SocialContext's "space:<slug>" keys) into
   * activeHobbySlugs. Onboarding calls this right after following the
   * Spaces someone picked, so feed relevance reflects them immediately —
   * without it, this context wouldn't know about a follow written through
   * SocialContext until the next full sign-in. */
  refetchActiveHobbies: () => Promise<void>;
  /** The id of whichever Moment addPost most recently created, for a few
   * seconds after the save. No current surface reads this (WorkGrid's own
   * shared-layout entrance animation was retired when it moved to
   * MomentCard — see docs/moment-card-and-reactions-spec.md's #75 report);
   * left in place since addPost still sets it and it's cheap to keep, but
   * it's effectively unused today. Clears itself either way. */
  justPublishedId: number | null;
  /** Your own reactions, real rows in `public.reactions` (cross-device),
   * keyed by post id — not the old localStorage-only store. Empty when
   * signed out or unconfigured; PostReactions.tsx's useReactionState falls
   * back to its own local store in that case, same shape as likedPostIds. */
  myReactionsByPostId: Record<number, ReactionId[]>;
  toggleReaction: (postId: number, type: ReactionId) => void;
  /** Maker-only Thoughts count for your own Moments. Love this/Count me in
   * are public now (Sept 24, 2026 amendment to docs/moment-card-and-
   * reactions-spec.md §4) and read straight off posts.love_count/in_count
   * instead — only Thoughts stays maker-only, since a thought can be
   * private (thoughts_private). Populated alongside realPosts; empty for a
   * post id not yet in this map (render sites treat that as zero). */
  ownCounts: Record<number, { thoughts: number }>;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export function ContentProvider({ children }: { children: ReactNode }) {
  const rewards = useRewards();
  const { user, profile } = useAuth();
  // See justPublishedId on the context type — set right after a successful
  // addPost, auto-cleared a few seconds later so it never lingers as a
  // stale "this one's new" flag on a Moment from an earlier session.
  const [justPublishedId, setJustPublishedId] = useState<number | null>(null);
  useEffect(() => {
    if (justPublishedId === null) return;
    const t = setTimeout(() => setJustPublishedId(null), 4000);
    return () => clearTimeout(t);
  }, [justPublishedId]);
  // Same convention as SocialContext's `myId`: a stand-in identity for
  // local-only mode (no account, or an account whose write just failed),
  // so "your" posts can still be told apart from the seeded sample content.
  const myId = user?.id ?? "local-user";

  // Real posts, fetched from Supabase — this is the layer that actually
  // persists across devices and sessions once accounts are wired up.
  const [realPosts, setRealPosts] = useState<Post[]>([]);

  const [userListings, setUserListings] = useState<Product[]>(() =>
    loadFromStorage<Product>(LISTINGS_KEY)
  );
  const [joinedCircleIds, setJoinedCircleIds] = useState<number[]>(() =>
    loadFromStorage<number>(CIRCLES_KEY)
  );
  // Real, per-account likes (post_likes) — which post ids *this* signed-in
  // user has liked. Empty when signed out; there's nothing local to fall
  // back to, since a like that only lived in this browser tab is exactly
  // the bug this table exists to fix (gone on reload, invisible on another
  // device for the same account).
  const [likedPostIds, setLikedPostIds] = useState<Set<number>>(new Set());
  // Real, per-account reactions (public.reactions) — see myReactionsByPostId
  // on the context type. Empty when signed out/unconfigured, same shape and
  // same reasoning as likedPostIds above.
  const [myReactionsByPostId, setMyReactionsByPostId] = useState<Record<number, ReactionId[]>>({});
  // Maker-only Thoughts count — see ownCounts on the context type.
  const [ownCounts, setOwnCounts] = useState<Record<number, { thoughts: number }>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);
  /** Set when a post couldn't reach the database, so the flow can say so. */
  const [saveError, setSaveError] = useState<string | null>(null);
  // Real, cross-account Circle joins (an accepted invitation — see
  // ConnectionsContext's circle_invites), counted per Circle. Public data —
  // fetched regardless of login, same as a Circle's own static baseline
  // count, via a SECURITY DEFINER aggregate (sql/circle-invites.sql) that
  // exposes counts without exposing who's actually in each row.
  const [circleMemberCounts, setCircleMemberCounts] = useState<Record<number, number>>({});
  // Plain whole-Space follows (SocialContext's "space:<slug>" keys), read
  // independently here rather than through useSocial() — see
  // readLocalFollowedSpaceSlugs's own comment on why.
  const [followedSpaceSlugs, setFollowedSpaceSlugs] = useState<string[]>(() =>
    readLocalFollowedSpaceSlugs(),
  );

  const refetchRealPosts = async () => {
    if (!supabase) return;
    let { data, error } = await supabase
      .from("posts")
      .select(POST_COLUMNS)
      .order("created_at", { ascending: false });
    // The reaction-count columns aren't in this database yet — drop them
    // for this and every later posts select, and try once more.
    if (isMissingCountColumn(error) && POST_COLUMNS !== BASE_POST_COLUMNS) {
      POST_COLUMNS = BASE_POST_COLUMNS;
      ({ data, error } = await supabase
        .from("posts")
        .select(POST_COLUMNS)
        .order("created_at", { ascending: false }));
    }
    if (error || !data) return;

    const userIds = [...new Set(data.map((row: any) => row.user_id as string))];
    const { data: profilesData } = userIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] as { id: string; display_name: string }[] };
    const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));

    // Your own Reflections only — a separate, owner-only table (sql/post-
    // reflections.sql), never folded into the shared posts select above.
    // RLS on post_reflections already caps this to `user`'s own rows even
    // without the .eq below; the filter is kept anyway so the query reads
    // as exactly what it is.
    const reflectionByPostId = new Map<number, string>();
    if (user) {
      const { data: reflectionRows } = await supabase
        .from("post_reflections")
        .select("post_id, reflection")
        .eq("user_id", user.id);
      for (const row of reflectionRows ?? []) {
        reflectionByPostId.set(row.post_id, row.reflection);
      }
    }

    setRealPosts(
      data.map((row: any) => {
        const post = rowToPost(row, nameById.get(row.user_id) ?? "Someone");
        if (user && row.user_id === user.id) {
          post.reflection = reflectionByPostId.get(row.id);
        }
        return post;
      }),
    );

    if (user) {
      const ownPostIds = data
        .filter((row: any) => row.user_id === user.id)
        .map((row: any) => row.id as number);
      await refetchOwnCounts(ownPostIds);
    } else {
      setOwnCounts({});
    }
  };

  /**
   * Maker-only Thoughts count (docs/moment-card-and-reactions-spec.md §4.3's
   * "no new view, no new function" still applies): a plain count, batched
   * once per page of your own Moments rather than one query per card. Love
   * this/Count me in are public now and come from posts.love_count/in_count
   * directly (rowToPost), so this only ever queries thoughts. Only ever
   * called with YOUR OWN post ids; RLS on `thoughts` already lets a post's
   * author read every row on it regardless of who wrote it, including a
   * private one — this is what makes "the maker's own view of their own
   * Moment" the one place a true total is correct.
   */
  const refetchOwnCounts = async (ownPostIds: number[]) => {
    if (!supabase || !user || ownPostIds.length === 0) {
      setOwnCounts({});
      return;
    }
    const { data: thoughtRows } = await supabase
      .from("thoughts")
      .select("post_id")
      .in("post_id", ownPostIds);

    const counts: Record<number, { thoughts: number }> = {};
    for (const id of ownPostIds) counts[id] = { thoughts: 0 };
    for (const row of (thoughtRows ?? []) as { post_id: number }[]) {
      if (counts[row.post_id]) counts[row.post_id].thoughts++;
    }
    setOwnCounts(counts);
  };

  /** Your own reactions across every post — one query, not one per post,
   * same shape as refetchLikedPosts above. */
  const refetchMyReactions = async () => {
    if (!supabase || !user) {
      setMyReactionsByPostId({});
      return;
    }
    const { data, error } = await supabase
      .from("reactions")
      .select("post_id, type")
      .eq("user_id", user.id);
    if (error || !data) return;
    const map: Record<number, ReactionId[]> = {};
    for (const row of data as { post_id: number; type: ReactionId }[]) {
      (map[row.post_id] ??= []).push(row.type);
    }
    setMyReactionsByPostId(map);
  };

  /**
   * Toggles Love this or Count me in on a Moment — a real row in
   * `public.reactions`, cross-device, not the old localStorage-only store
   * (PostReactions.tsx still falls back to that store when signed out or
   * unconfigured). Optimistic, same pattern as toggleLike: flip local state
   * immediately, revert if the write fails.
   */
  const toggleReaction = (postId: number, type: ReactionId) => {
    if (!supabase || !user) return;
    const current = myReactionsByPostId[postId] ?? [];
    const reacted = current.includes(type);

    const apply = (list: ReactionId[]) =>
      reacted ? list.filter((t) => t !== type) : [...list, type];
    const revertList = (list: ReactionId[]) =>
      reacted ? [...list, type] : list.filter((t) => t !== type);

    setMyReactionsByPostId((prev) => ({ ...prev, [postId]: apply(prev[postId] ?? []) }));
    // The public total moves with your own tap right away; the trigger on
    // public.reactions makes the same change server-side.
    const bump = (delta: number) =>
      setRealPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          if (type === "love") return { ...p, loveCount: Math.max(0, (p.loveCount ?? 0) + delta) };
          if (type === "in") return { ...p, inCount: Math.max(0, (p.inCount ?? 0) + delta) };
          return p;
        }),
      );
    bump(reacted ? -1 : 1);

    const write = reacted
      ? supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", user.id).eq("type", type)
      : supabase.from("reactions").insert({ post_id: postId, user_id: user.id, type });

    void write.then(({ error }) => {
      if (error) {
        setMyReactionsByPostId((prev) => ({ ...prev, [postId]: revertList(prev[postId] ?? []) }));
        bump(reacted ? 1 : -1);
      }
    });
  };

  const refetchCircleMemberCounts = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("circle_member_counts");
    if (error || !data) return;
    const counts: Record<number, number> = {};
    for (const row of data as any[]) counts[row.circle_id] = Number(row.member_count) || 0;
    setCircleMemberCounts(counts);
  };

  const refetchLikedPosts = async () => {
    if (!supabase || !user) {
      setLikedPostIds(new Set());
      return;
    }
    const { data, error } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id);
    if (error || !data) return;
    setLikedPostIds(new Set(data.map((row: any) => row.post_id as number)));
  };

  const refetchActiveHobbies = async () => {
    if (!supabase || !user) {
      setFollowedSpaceSlugs(readLocalFollowedSpaceSlugs());
      return;
    }
    const { data, error } = await supabase
      .from("hobby_follows")
      .select("hobby_key")
      .eq("user_id", user.id);
    if (error || !data) return;
    setFollowedSpaceSlugs(
      (data as any[])
        .map((row) => row.hobby_key as string)
        .filter((k) => k.startsWith("space:"))
        .map((k) => k.slice(6)),
    );
  };

  useEffect(() => {
    refetchRealPosts();
    refetchCircleMemberCounts();
    refetchLikedPosts();
    refetchMyReactions();
    refetchActiveHobbies();
    // Re-fetch when the logged-in user changes, so switching accounts (or
    // logging in) picks up posts visible to that session, and this
    // account's own likes and Space follows rather than the previous
    // one's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LISTINGS_KEY, JSON.stringify(userListings));
    } catch {
      // best effort
    }
  }, [userListings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CIRCLES_KEY, JSON.stringify(joinedCircleIds));
    } catch {
      // best effort
    }
  }, [joinedCircleIds]);

  // Real posts belonging to the signed-in user, mixed with the app's sample
  // content everywhere else — the seed data keeps every space feeling
  // populated while real posts layer in on top of it. `realPosts.likes`
  // already reflects post_likes (kept in sync by a DB trigger, patched
  // optimistically here on toggle — see toggleLike), so this no longer
  // needs a separate delta layered on top of it.
  const myRealPosts = realPosts.filter((p) => p.userId === myId);
  // A Circle contribution defaults to hidden here unless its own composer's
  // "Also save to Moments" box was checked — see Post.hiddenFromMoments.
  // Before this filter existed, every Circle thread doubled as a personal
  // Moment with no way to opt out.
  const myPosts: Post[] = myRealPosts.filter((p) => !p.hiddenFromMoments);
  const posts: Post[] = [...realPosts, ...seedPosts];

  const myListings: Product[] = userListings;
  const listings: Product[] = [...userListings, ...seedProducts];

  // Hobbies you actually engage with — posted in, followed the whole Space
  // for (onboarding's own picker writes exactly these follows), or joined a
  // circle for. Used both for feed relevance scoring and for "hobby tags" on
  // the profile.
  const activeHobbySlugsSet = new Set<string>([
    ...myRealPosts.map((p) => p.hobbySlug),
    ...followedSpaceSlugs,
    ...joinedCircleIds
      .map((id) => allCircles.find((c) => c.id === id)?.hobbySlug)
      .filter((s): s is string => !!s),
  ]);
  const activeHobbySlugs = [...activeHobbySlugsSet];
  // Same "things you actually engage with" idea as activeHobbySlugsSet, but
  // for the open tags a fixed Space list can't cover — someone who's posted
  // "sourdough" should see other "sourdough" Moments even if neither side
  // ever explicitly followed a Space for it.
  const activeTagsSet = new Set<string>(
    myRealPosts.flatMap((p) => (p.tags ?? []).map((t) => t.toLowerCase())),
  );

  const rankPublic = (list: Post[]) =>
    list
      .filter((p) => p.visibility === "public")
      .sort(
        (a, b) =>
          scorePost(b, activeHobbySlugsSet, activeTagsSet) -
          scorePost(a, activeHobbySlugsSet, activeTagsSet),
      );

  const publicFeed = rankPublic(posts);
  const publicFeedByHobby = (slug: string) => rankPublic(posts.filter((p) => p.hobbySlug === slug));
  const circleFeed = (circleId: number, tab?: CircleTabId) =>
    posts
      .filter(
        (p) =>
          p.visibility === "circle" &&
          p.circleId === circleId &&
          (tab === undefined || p.circleTab === tab),
      )
      .sort((a, b) => b.createdAt - a.createdAt);

  const listingsByHobby = (slug: string) => listings.filter((p) => p.hobbySlug === slug);
  const findListing = (id: number) => listings.find((p) => p.id === id);

  // Deliberately still local-only (localStorage), not written to
  // `circle_members` — this is the *seed* Circle direct-join (data/circles.ts
  // ids), which has no corresponding row in the real `circles` table at all.
  // `circle_members.circle_id` is a real foreign key into that table, so
  // writing a seed id there would either fail outright (today: `circles`
  // has zero rows, so it always would) or, once real Circles exist, could
  // silently attach someone to an unrelated *real* Circle that happens to
  // reuse the same low id — real Circle ids aren't offset until they leave
  // CirclesContext (see REAL_CIRCLE_ID_OFFSET there). A genuinely real,
  // Supabase-backed Circle already persists its join for real: see
  // CirclesContext.tsx's joinRealCircle/leaveRealCircle/myRealCircleIds,
  // which read and write `circle_members` directly against the real,
  // un-offset database id. Cross-account joining of a *seed* Circle already
  // has its own dedicated mechanism too — circle_invites, invite-and-accept
  // (sql/circle-invites.sql) — deliberately not this direct-join path.
  const isCircleJoined = (circleId: number) => joinedCircleIds.includes(circleId);
  const joinCircle = (circleId: number) =>
    setJoinedCircleIds((prev) => (prev.includes(circleId) ? prev : [...prev, circleId]));
  const leaveCircle = (circleId: number) =>
    setJoinedCircleIds((prev) => prev.filter((id) => id !== circleId));

  const addPost = async (input: NewPostInput): Promise<Post> => {
    setSaveError(null);
    let productId: number | undefined;
    // What this session counts toward for the craft badges: the specific
    // hobby when tagged, otherwise just the space it went into.
    const hobbyKey = input.subHobby ?? `space:${input.hobbySlug}`;

    if (input.forSale) {
      const newListing: Product = {
        id: Date.now(),
        name: input.forSale.name,
        price: input.forSale.price,
        hobbySlug: input.hobbySlug,
        image: input.media ?? "",
        description: input.caption,
        rating: 5,
        reviews: 0,
        creator: input.creator || "You",
        type: input.forSale.type,
      };
      setUserListings((prev) => [newListing, ...prev]);
      productId = newListing.id;
    }

    if (input.visibility === "circle" && input.circleId) {
      joinCircle(input.circleId);
    }

    // Real, persisted post — goes to Supabase when signed in and connected.
    if (supabase && user) {
      let mediaUrls: string[] = input.media ? [input.media] : [];
      const files = input.files ?? [];

      if (files.length > 0) {
        // Uploaded one at a time, in order — not Promise.all. Keeps the
        // photos in the order they were picked and doesn't hammer storage
        // with N parallel uploads from a single tap.
        const uploaded: string[] = [];
        let failCount = 0;
        for (const f of files) {
          // Storage keys reject most punctuation and anything non-ASCII, which
          // a phone's own filename ("Foto 5 sept. 2026, 10.32.png") routinely has.
          const dot = f.name.lastIndexOf(".");
          const ext = (dot > -1 ? f.name.slice(dot + 1) : "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")
            .slice(0, 5);
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? `.${ext}` : ""}`;

          const { error: uploadError } = await supabase.storage
            .from("post-media")
            .upload(path, f, {
              contentType: f.type || undefined,
              upsert: false,
            });

          if (uploadError) {
            failCount++;
          } else {
            uploaded.push(supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl);
          }
        }

        const noun = input.type === "video" ? "video" : files.length > 1 ? "photos" : "photo";
        if (uploaded.length === 0) {
          setMediaError(`Your ${noun} didn't upload. The Moment was saved without it.`);
        } else if (failCount > 0) {
          // Some made it, some didn't — the post still saves with whatever
          // succeeded rather than losing the whole Moment over one bad file.
          setMediaError(
            `${failCount} of ${files.length} photos didn't upload. The Moment was saved with the rest.`,
          );
        } else {
          setMediaError(null);
        }
        mediaUrls = uploaded;
      }

      const mediaUrl = mediaUrls[0] ?? "";

      const { data, error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          hobby_slug: input.hobbySlug,
          sub_hobby: input.subHobby ?? null,
          corner: input.corner ?? null,
          interest: input.interest?.trim() ? input.interest.trim() : null,
          type: input.type,
          media_url: mediaUrl,
          media_urls: mediaUrls.length ? mediaUrls : null,
          caption: input.caption,
          visibility: input.visibility,
          starts_at: input.startsAt ? new Date(input.startsAt).toISOString() : null,
          location_name: input.locationName ?? null,
          location_privacy: input.locationPrivacy ?? "neighborhood",
          pursuit_id: input.pursuitId ?? null,
          circle_id: input.visibility === "circle" ? (input.circleId ?? null) : null,
          circle_tab: input.visibility === "circle" ? (input.circleTab ?? null) : null,
          hidden_from_moments: input.hiddenFromMoments ?? false,
          tags: input.tags ?? [],
        })
        .select(POST_COLUMNS)
        .single();

      if (!error && data) {
        const newPost = rowToPost(data, profile?.display_name ?? (input.creator || "You"));
        // A Reflection is never written to `posts` (see #86) — its own
        // owner-only table, set right after the post exists since it needs
        // the new row's id.
        const trimmedReflection = input.reflection?.trim();
        if (trimmedReflection) {
          newPost.reflection = trimmedReflection;
          await supabase
            .from("post_reflections")
            .upsert({ post_id: newPost.id, user_id: user.id, reflection: trimmedReflection });
        }
        // A sale listing is tracked separately from the post row; without
        // this, a real post never knew it was for sale and the buy link
        // disappeared the moment the page reloaded.
        const withListing = productId ? { ...newPost, productId } : newPost;
        setRealPosts((prev) => [withListing, ...prev]);
        rewards.recordPostCreated(hobbyKey);
        setJustPublishedId(withListing.id);
        return withListing;
      }

      // The insert failed while signed in. It still falls through to a local
      // copy so nothing typed is thrown away on screen — but that copy lives
      // only in this tab, so the flow must not claim it was saved. Telling
      // someone "Saved." and then losing the post is worse than an error.
      setSaveError(
        error?.message
          ? `This didn't save to your account: ${error.message}`
          : "This didn't save to your account. It's still on screen, but it will go when you reload.",
      );
    }

    // Local-only fallback — used when accounts aren't set up on this build,
    // or nobody's logged in. Doesn't persist beyond this browser tab.
    // The signed-out path used to drop the picked file(s) entirely, so a
    // photo someone had just chosen silently became generated art. This
    // local post only lives as long as the tab does, and so do the object
    // URLs — they disappear together, which is at least honest.
    const localMediaUrls = input.media
      ? [input.media]
      : (input.files ?? []).map((f) => URL.createObjectURL(f));
    const newPost: Post = {
      id: Date.now() + 1,
      userId: myId,
      hobbySlug: input.hobbySlug,
      subHobby: input.subHobby,
      corner: input.corner,
      interest: input.interest?.trim() || undefined,
      tags: input.tags ?? [],
      type: input.type,
      media: localMediaUrls[0] ?? "",
      mediaUrls: localMediaUrls.length ? localMediaUrls : undefined,
      creator: input.creator || "You",
      caption: input.caption,
      reflection: input.reflection?.trim() ? input.reflection.trim() : undefined,
      likes: 0,
      createdAt: Date.now(),
      visibility: input.visibility,
      circleId: input.visibility === "circle" ? input.circleId : undefined,
      circleTab: input.visibility === "circle" ? input.circleTab : undefined,
      hiddenFromMoments: input.hiddenFromMoments ?? false,
      productId,
      startsAt: input.startsAt,
      locationName: input.locationName,
      locationPrivacy: input.locationPrivacy,
    };
    const cameFromFailedSave = Boolean(supabase && user);
    setRealPosts((prev) => [{ ...newPost, unsaved: cameFromFailedSave }, ...prev]);
    if (!cameFromFailedSave) {
      rewards.recordPostCreated(hobbyKey);
      setJustPublishedId(newPost.id);
    }
    return newPost;
  };

  /**
   * Editing a moment. Writes through to Supabase when the row is a real one
   * you own, and always updates locally so the UI stays truthful either way.
   * Requires an UPDATE policy on public.posts — without one Postgres accepts
   * the statement and changes nothing, which is why the caller is told
   * whether the row actually came back changed.
   */
  const updatePost = async (
    postId: number,
    patch: {
      caption?: string;
      reflection?: string;
      visibility?: Visibility | "private";
      circleId?: number;
      hobbySlug?: string;
      subHobby?: string;
      mediaUrl?: string;
    },
  ): Promise<boolean> => {
    const target = realPosts.find((p) => p.id === postId);
    const apply = (list: Post[]) =>
      list.map((p) =>
        p.id === postId
          ? {
              ...p,
              caption: patch.caption ?? p.caption,
              reflection:
                patch.reflection === undefined
                  ? p.reflection
                  : patch.reflection.trim() || undefined,
              // "private" isn't in the Visibility type yet (see lib/visibility.ts's
              // isOnlyYou) even though the live posts.visibility column already
              // allows it — same tolerance rowToPost's own `row.visibility`
              // assignment already relies on.
              visibility: (patch.visibility ?? p.visibility) as Visibility,
              circleId: patch.visibility === undefined ? p.circleId : patch.circleId,
              hobbySlug: patch.hobbySlug ?? p.hobbySlug,
              subHobby: patch.subHobby === undefined ? p.subHobby : patch.subHobby || undefined,
              media: patch.mediaUrl ?? p.media,
              mediaUrls: patch.mediaUrl ? [patch.mediaUrl] : p.mediaUrls,
            }
          : p,
      );

    if (supabase && user && target?.userId === user.id) {
      const postsPatch: Record<string, unknown> = {};
      if (patch.caption !== undefined) postsPatch.caption = patch.caption;
      // circle_id always travels with visibility: switching away from
      // "circle" must clear it, same as a fresh post's own write below.
      if (patch.visibility !== undefined) {
        postsPatch.visibility = patch.visibility;
        postsPatch.circle_id = patch.visibility === "circle" ? (patch.circleId ?? null) : null;
      }
      if (patch.hobbySlug !== undefined) postsPatch.hobby_slug = patch.hobbySlug;
      if (patch.subHobby !== undefined) postsPatch.sub_hobby = patch.subHobby || null;
      if (patch.mediaUrl !== undefined) {
        postsPatch.media_url = patch.mediaUrl;
        postsPatch.media_urls = [patch.mediaUrl];
      }

      // A no-op `.update({})` (only the Reflection changed) is skipped
      // entirely — Reflection never touches `posts` at all (see #86), and
      // an empty patch object is nothing worth sending.
      if (Object.keys(postsPatch).length > 0) {
        const { data, error } = await supabase
          .from("posts")
          .update(postsPatch)
          .eq("id", postId)
          .select(POST_COLUMNS);
        if (error || !data || data.length === 0) return false;
      }

      if (patch.reflection !== undefined) {
        const trimmed = patch.reflection.trim();
        const { error: reflectionError } = trimmed
          ? await supabase
              .from("post_reflections")
              .upsert({ post_id: postId, user_id: user.id, reflection: trimmed })
          : await supabase
              .from("post_reflections")
              .delete()
              .eq("post_id", postId)
              .eq("user_id", user.id);
        if (reflectionError) return false;
      }
    }

    setRealPosts(apply);
    return true;
  };

  /**
   * Deletes a moment you own. Requires a DELETE policy on public.posts, same
   * caveat as updatePost — checked here via the row's own userId rather than
   * trusted from the caller, since the confirm dialog only ever offers this
   * to the owner but the request itself shouldn't rely on that.
   */
  const deletePost = async (postId: number): Promise<boolean> => {
    const target = realPosts.find((p) => p.id === postId);
    if (!target) return false;

    if (supabase && user && target.userId === user.id) {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) return false;
    }

    setRealPosts((prev) => prev.filter((p) => p.id !== postId));
    return true;
  };

  /**
   * Features a Moment first on your own Shelf. Same ownership check as
   * updatePost/deletePost — trusted from the row's own userId, not from the
   * caller — and the same RLS backs it (sql/post-pinning.sql: "own posts are
   * editable" already restricts every update, this column included, to the
   * post's owner).
   */
  const togglePin = async (postId: number): Promise<boolean> => {
    const target = realPosts.find((p) => p.id === postId);
    if (!target) return false;
    const next = !target.pinned;

    if (supabase && user && target.userId === user.id) {
      const { error } = await supabase.from("posts").update({ pinned: next }).eq("id", postId);
      if (error) return false;
    }

    setRealPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, pinned: next } : p)));
    return true;
  };

  /**
   * Marks a Circle "questions" thread answered or not. Goes through a
   * SECURITY DEFINER RPC (set_thread_answered, sql/circle-threads.sql)
   * rather than a plain update — the two people allowed to do this are the
   * thread's own author and the Circle's owner, and a broad posts UPDATE
   * policy covering "the Circle owner" would also let them rewrite a
   * member's caption or photo, not just this one flag.
   */
  const setThreadAnswered = async (postId: number, answered: boolean): Promise<boolean> => {
    if (!supabase || !user) return false;
    const { data, error } = await supabase.rpc("set_thread_answered", {
      p_post_id: postId,
      p_answered: answered,
    });
    if (error || !data) return false;
    setRealPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, answered } : p)));
    return true;
  };

  const isPostLiked = (postId: number) => likedPostIds.has(postId);

  /**
   * Likes a post you can see, or un-likes one you already liked — a real
   * row in `post_likes`, not a per-tab delta. Signed-out visitors still see
   * whatever count `posts.likes` already carries; they just can't toggle
   * it, same auth-gate shape as everything else here that needs an
   * account (addPost, updatePost, deletePost).
   *
   * Deliberately doesn't call rewards.toggleLikePost anymore: that hook's
   * own "did I like this" state is a separate, single-browser local copy,
   * and once likes are the cross-device fact this table makes them, the
   * two can disagree about which direction a tap even means (liked vs.
   * un-liked) on a second device for the same account — which used to
   * silently award or dock gamification points backwards.
   */
  const toggleLike = (postId: number) => {
    if (!supabase || !user) return;
    const alreadyLiked = likedPostIds.has(postId);
    const bump = alreadyLiked ? -1 : 1;

    // Optimistic: flip the UI immediately, then reconcile if the write
    // fails rather than making every tap wait on a round trip.
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      if (alreadyLiked) next.delete(postId);
      else next.add(postId);
      return next;
    });
    setRealPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, likes: Math.max(0, p.likes + bump) } : p)),
    );

    const revert = () => {
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (alreadyLiked) next.add(postId);
        else next.delete(postId);
        return next;
      });
      setRealPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likes: Math.max(0, p.likes - bump) } : p)),
      );
    };

    const write = alreadyLiked
      ? supabase.from("post_likes").delete().eq("user_id", user.id).eq("post_id", postId)
      : supabase.from("post_likes").insert({ user_id: user.id, post_id: postId });

    void write.then(({ error }) => {
      // Liking a seed post (not a real row in `posts`) fails its foreign
      // key the same way any other bad id would — nothing currently offers
      // that button on seed content, but this stays a quiet revert rather
      // than an unhandled rejection if it ever does.
      if (error) revert();
    });
  };

  return (
    <ContentContext.Provider
      value={{
        posts,
        myPosts,
        publicFeed,
        publicFeedByHobby,
        circleFeed,
        listings,
        listingsByHobby,
        myListings,
        findListing,
        addPost,
        updatePost,
        deletePost,
        togglePin,
        setThreadAnswered,
        mediaError,
        clearMediaError: () => setMediaError(null),
        saveError,
        clearSaveError: () => setSaveError(null),
        toggleLike,
        isPostLiked,
        joinedCircleIds,
        isCircleJoined,
        joinCircle,
        leaveCircle,
        circleMemberCounts,
        refetchCircleMemberCounts,
        activeHobbySlugs,
        refetchActiveHobbies,
        justPublishedId,
        myReactionsByPostId,
        toggleReaction,
        ownCounts,
      }}
    >
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error("useContent must be used within a ContentProvider");
  return ctx;
}
