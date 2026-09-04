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
    type: row.type,
    media: row.media_url,
    creator: creatorName,
    caption: row.caption,
    reflection: row.reflection ?? undefined,
    likes: row.likes ?? 0,
    createdAt: new Date(row.created_at).getTime(),
    visibility: row.visibility,
    userId: row.user_id,
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
        const path = `${user.id}/${Date.now()}-${input.file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(path, input.file);
        if (!uploadError) {
          mediaUrl = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
        }
      }

      const { data, error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          hobby_slug: input.hobbySlug,
          sub_hobby: input.subHobby ?? null,
          type: input.type,
          media_url: mediaUrl,
          caption: input.caption,
          reflection: input.reflection?.trim() ? input.reflection.trim() : null,
          visibility: input.visibility,
        })
        .select()
        .single();

      if (!error && data) {
        const newPost = rowToPost(data, profile?.display_name ?? (input.creator || "You"));
        setRealPosts((prev) => [newPost, ...prev]);
        rewards.recordPostCreated(hobbyKey);
        return newPost;
      }
      // Falls through to the local-only path below if the insert failed,
      // so posting still works even if something's misconfigured.
    }

    // Local-only fallback — used when accounts aren't set up on this build,
    // or nobody's logged in. Doesn't persist beyond this browser tab.
    const newPost: Post = {
      id: Date.now() + 1,
      hobbySlug: input.hobbySlug,
      subHobby: input.subHobby,
      type: input.type,
      media: input.media ?? "",
      creator: input.creator || "You",
      caption: input.caption,
      reflection: input.reflection?.trim() ? input.reflection.trim() : undefined,
      likes: 0,
      createdAt: Date.now(),
      visibility: input.visibility,
      circleId: input.visibility === "circle" ? input.circleId : undefined,
      productId,
    };
    setRealPosts((prev) => [newPost, ...prev]);
    rewards.recordPostCreated(hobbyKey);
    return newPost;
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
