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

const LISTINGS_KEY = "nospace.listings.v1";
const CIRCLES_KEY = "nospace.circles.joined.v1";

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
 * Discovery ranking: recency + relevance to the hobbies you actually engage with
 * (posted in, or joined a circle for) dominate; raw like count only nudges the
 * order, so this doesn't collapse into an engagement-maximizing sort.
 */
function scorePost(post: Post, activeHobbies: Set<string>): number {
  const ageHours = (Date.now() - post.createdAt) / HOUR;
  const recencyScore = Math.max(0, 240 - ageHours); // decays to 0 over ~10 days
  const relevanceBonus = activeHobbies.has(post.hobbySlug) ? 60 : 0;
  const engagementScore = Math.min(post.likes, 100) * 0.3; // capped, minor influence
  return recencyScore + relevanceBonus + engagementScore;
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
  /** What it's about, typed by the person: "Pottery", "Bouldering". */
  interest?: string;
  type: "photo" | "video";
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

/** Maps a row from the real `posts` table into the app's existing Post shape. */
function rowToPost(row: any, creatorName: string): Post {
  return {
    id: row.id,
    // An older post stored one of the eight original Space slugs. Nothing was
    // migrated in the database; it is translated on the way in instead.
    hobbySlug: currentSpaceSlug(row.hobby_slug),
    subHobby: row.sub_hobby ?? undefined,
    interest: row.interest ?? undefined,
    type: row.type,
    media: row.media_url,
    mediaUrls: row.media_urls ?? (row.media_url ? [row.media_url] : []),
    creator: creatorName,
    caption: row.caption,
    reflection: row.reflection ?? undefined,
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
    patch: { caption?: string; reflection?: string },
  ) => Promise<boolean>;
  /** Deletes a moment you own. Returns false if it couldn't be deleted — the
   * post stays in the list rather than vanishing from a screen that no
   * longer matches what's actually in the database. */
  deletePost: (postId: number) => Promise<boolean>;
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
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export function ContentProvider({ children }: { children: ReactNode }) {
  const rewards = useRewards();
  const { user, profile } = useAuth();
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
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return;

    const userIds = [...new Set(data.map((row: any) => row.user_id as string))];
    const { data: profilesData } = userIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] as { id: string; display_name: string }[] };
    const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));

    setRealPosts(data.map((row: any) => rowToPost(row, nameById.get(row.user_id) ?? "Someone")));
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

  const rankPublic = (list: Post[]) =>
    list
      .filter((p) => p.visibility === "public")
      .sort((a, b) => scorePost(b, activeHobbySlugsSet) - scorePost(a, activeHobbySlugsSet));

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
          interest: input.interest?.trim() ? input.interest.trim() : null,
          type: input.type,
          media_url: mediaUrl,
          media_urls: mediaUrls.length ? mediaUrls : null,
          caption: input.caption,
          reflection: input.reflection?.trim() ? input.reflection.trim() : null,
          visibility: input.visibility,
          starts_at: input.startsAt ? new Date(input.startsAt).toISOString() : null,
          location_name: input.locationName ?? null,
          location_privacy: input.locationPrivacy ?? "neighborhood",
          pursuit_id: input.pursuitId ?? null,
          circle_id: input.visibility === "circle" ? (input.circleId ?? null) : null,
          circle_tab: input.visibility === "circle" ? (input.circleTab ?? null) : null,
          hidden_from_moments: input.hiddenFromMoments ?? false,
        })
        .select()
        .single();

      if (!error && data) {
        const newPost = rowToPost(data, profile?.display_name ?? (input.creator || "You"));
        // A sale listing is tracked separately from the post row; without
        // this, a real post never knew it was for sale and the buy link
        // disappeared the moment the page reloaded.
        const withListing = productId ? { ...newPost, productId } : newPost;
        setRealPosts((prev) => [withListing, ...prev]);
        rewards.recordPostCreated(hobbyKey);
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
      interest: input.interest?.trim() || undefined,
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
    setRealPosts((prev) => [newPost, ...prev]);
    rewards.recordPostCreated(hobbyKey);
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
    patch: { caption?: string; reflection?: string },
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
            }
          : p,
      );

    if (supabase && user && target?.userId === user.id) {
      const { data, error } = await supabase
        .from("posts")
        .update({
          ...(patch.caption !== undefined ? { caption: patch.caption } : {}),
          ...(patch.reflection !== undefined
            ? { reflection: patch.reflection.trim() || null }
            : {}),
        })
        .eq("id", postId)
        .select();
      if (error || !data || data.length === 0) return false;
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
