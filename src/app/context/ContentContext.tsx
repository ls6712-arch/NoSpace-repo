import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Post, seedPosts, Visibility } from "../data/posts";
import { Product, products as seedProducts } from "../data/products";
import { circles as allCircles } from "../data/circles";
import { useRewards } from "./RewardsContext";
import { useAuth } from "./AuthContext";
import { supabase } from "../../lib/supabase";

const LISTINGS_KEY = "nospace.listings.v1";
const CIRCLES_KEY = "nospace.circles.joined.v1";

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
  /** A real picked file, uploaded to storage when a real account is signed in. */
  file?: File;
  creator: string;
  caption: string;
  reflection?: string;
  visibility: Visibility;
  circleId?: number;
  forSale?: ForSaleInput;
  /** Set when this moment is a thing happening at a time. */
  startsAt?: number;
  locationName?: string;
  locationPrivacy?: "exact" | "neighborhood" | "city" | "approximate" | "hidden";
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
    hobbySlug: row.hobby_slug,
    subHobby: row.sub_hobby ?? undefined,
    interest: row.interest ?? undefined,
    type: row.type,
    media: row.media_url,
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
  };
}

interface ContentContextType {
  posts: Post[];
  myPosts: Post[];
  publicFeed: Post[];
  publicFeedByHobby: (slug: string) => Post[];
  circleFeed: (circleId: number) => Post[];
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
  toggleLike: (postId: number) => void;
  joinedCircleIds: number[];
  isCircleJoined: (circleId: number) => boolean;
  joinCircle: (circleId: number) => void;
  leaveCircle: (circleId: number) => void;
  activeHobbySlugs: string[];
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export function ContentProvider({ children }: { children: ReactNode }) {
  const rewards = useRewards();
  const { user, profile } = useAuth();

  // Real posts, fetched from Supabase — this is the layer that actually
  // persists across devices and sessions once accounts are wired up.
  const [realPosts, setRealPosts] = useState<Post[]>([]);

  const [userListings, setUserListings] = useState<Product[]>(() =>
    loadFromStorage<Product>(LISTINGS_KEY)
  );
  const [joinedCircleIds, setJoinedCircleIds] = useState<number[]>(() =>
    loadFromStorage<number>(CIRCLES_KEY)
  );
  const [likeDeltas, setLikeDeltas] = useState<Record<number, number>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);
  /** Set when a post couldn't reach the database, so the flow can say so. */
  const [saveError, setSaveError] = useState<string | null>(null);

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

  useEffect(() => {
    refetchRealPosts();
    // Re-fetch when the logged-in user changes, so switching accounts (or
    // logging in) picks up posts visible to that session.
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

  const applyLikeDeltas = (list: Post[]) =>
    list.map((p) => ({ ...p, likes: p.likes + (likeDeltas[p.id] ?? 0) }));

  // Real posts belonging to the signed-in user, mixed with the app's sample
  // content everywhere else — the seed data keeps every space feeling
  // populated while real posts layer in on top of it.
  const myRealPosts = user ? realPosts.filter((p) => p.userId === user.id) : [];
  const myPosts: Post[] = applyLikeDeltas(myRealPosts);
  const posts: Post[] = applyLikeDeltas([...realPosts, ...seedPosts]);

  const myListings: Product[] = userListings;
  const listings: Product[] = [...userListings, ...seedProducts];

  // Hobbies you actually engage with — posted in, or joined a circle for.
  // Used both for feed relevance scoring and for "hobby tags" on the profile.
  const activeHobbySlugsSet = new Set<string>([
    ...myRealPosts.map((p) => p.hobbySlug),
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
  const circleFeed = (circleId: number) =>
    posts
      .filter((p) => p.visibility === "circle" && p.circleId === circleId)
      .sort((a, b) => b.createdAt - a.createdAt);

  const listingsByHobby = (slug: string) => listings.filter((p) => p.hobbySlug === slug);
  const findListing = (id: number) => listings.find((p) => p.id === id);

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
      let mediaUrl = input.media ?? "";
      if (input.file) {
        // Storage keys reject most punctuation and anything non-ASCII, which a
        // phone's own filename ("Foto 5 sept. 2026, 10.32.png") routinely has.
        const dot = input.file.name.lastIndexOf(".");
        const ext = (dot > -1 ? input.file.name.slice(dot + 1) : "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 5);
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? `.${ext}` : ""}`;

        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(path, input.file, {
            contentType: input.file.type || undefined,
            upsert: false,
          });

        if (uploadError) {
          setMediaError(
            `Your ${input.type === "video" ? "video" : "photo"} didn't upload — ${uploadError.message}. The entry was saved without it.`,
          );
        } else {
          mediaUrl = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
          setMediaError(null);
        }
      }

      const { data, error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          hobby_slug: input.hobbySlug,
          sub_hobby: input.subHobby ?? null,
          interest: input.interest?.trim() ? input.interest.trim() : null,
          type: input.type,
          media_url: mediaUrl,
          caption: input.caption,
          reflection: input.reflection?.trim() ? input.reflection.trim() : null,
          visibility: input.visibility,
          starts_at: input.startsAt ? new Date(input.startsAt).toISOString() : null,
          location_name: input.locationName ?? null,
          location_privacy: input.locationPrivacy ?? "neighborhood",
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
    const newPost: Post = {
      id: Date.now() + 1,
      hobbySlug: input.hobbySlug,
      subHobby: input.subHobby,
      interest: input.interest?.trim() || undefined,
      type: input.type,
      // The signed-out path used to drop the picked file entirely, so the photo
      // someone had just chosen silently became generated art. This local post
      // only lives as long as the tab does, and so does the object URL — they
      // disappear together, which is at least honest.
      media: input.media ?? (input.file ? URL.createObjectURL(input.file) : ""),
      creator: input.creator || "You",
      caption: input.caption,
      reflection: input.reflection?.trim() ? input.reflection.trim() : undefined,
      likes: 0,
      createdAt: Date.now(),
      visibility: input.visibility,
      circleId: input.visibility === "circle" ? input.circleId : undefined,
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

  const toggleLike = (postId: number) => {
    const nowLiked = rewards.toggleLikePost(postId);
    setLikeDeltas((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? 0) + (nowLiked ? 1 : -1),
    }));
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
        mediaError,
        clearMediaError: () => setMediaError(null),
        saveError,
        clearSaveError: () => setSaveError(null),
        toggleLike,
        joinedCircleIds,
        isCircleJoined,
        joinCircle,
        leaveCircle,
        activeHobbySlugs,
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
