import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { badges, RewardStats } from "../data/badges";
import { useAuth } from "./AuthContext";
import { shareMilestone, unshareMilestone } from "../lib/milestonesRemote";

const STORAGE_KEY = "nospace.rewards.v1";

interface StoredState {
  points: number;
  postsCreated: number;
  likesGiven: number;
  purchases: number;
  hobbiesVisited: string[];
  /** One entry per logged session, holding that session's hobby. */
  hobbiesPosted: string[];
  likedPostIds: number[];
  /**
   * Which unlocked badges the owner has explicitly shared to their public
   * profile — everything else here stays visible only to them. Mirrored,
   * best-effort, to the `shared_milestones` table (lib/milestonesRemote.ts)
   * so a stranger's browser can see it; this local copy is what the owner's
   * own view always reads first.
   */
  sharedBadgeIds: string[];
}

interface ActivityEntry {
  id: string;
  label: string;
  delta: number;
  at: number;
}

const defaultState: StoredState = {
  points: 0,
  postsCreated: 0,
  likesGiven: 0,
  purchases: 0,
  hobbiesVisited: [],
  hobbiesPosted: [],
  likedPostIds: [],
  sharedBadgeIds: [],
};

function loadState(): StoredState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    return { ...defaultState, ...parsed };
  } catch {
    return defaultState;
  }
}

interface RewardsContextType {
  points: number;
  stats: RewardStats;
  unlockedBadgeIds: string[];
  activity: ActivityEntry[];
  lastUnlockedBadgeId: string | null;
  dismissLastBadge: () => void;
  recordPostCreated: (hobbyKey?: string) => void;
  recordPurchase: (count?: number) => void;
  visitHobby: (slug: string) => void;
  toggleLikePost: (postId: number) => boolean;
  isPostLiked: (postId: number) => boolean;
  /** Whether this unlocked milestone is currently visible on the public profile. */
  isBadgeShared: (badgeId: string) => boolean;
  /** No-ops on a locked badge — sharing is never possible before it's earned. */
  shareBadge: (badgeId: string) => void;
  unshareBadge: (badgeId: string) => void;
}

const RewardsContext = createContext<RewardsContextType | undefined>(undefined);

export function RewardsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<StoredState>(loadState);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [lastUnlockedBadgeId, setLastUnlockedBadgeId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // best effort only — a private window or full storage shouldn't break the app
    }
  }, [state]);

  const stats: RewardStats = useMemo(
    () => ({
      points: state.points,
      postsCreated: state.postsCreated,
      likesGiven: state.likesGiven,
      purchases: state.purchases,
      hobbiesVisited: state.hobbiesVisited,
      hobbiesPosted: state.hobbiesPosted,
    }),
    [state]
  );

  const unlockedBadgeIds = useMemo(
    () => badges.filter((b) => b.test(stats)).map((b) => b.id),
    [stats]
  );

  const logActivity = (label: string, delta: number) => {
    setActivity((prev) =>
      [{ id: `${Date.now()}-${Math.random()}`, label, delta, at: Date.now() }, ...prev].slice(0, 20)
    );
  };

  // Takes both the previous and next stats explicitly, rather than reading
  // the outer `stats` (last-render's value) as "before" — every call site
  // runs inside a setState updater, so when two reward-earning actions land
  // in the same batch (e.g. two rapid likes before a re-render), the second
  // call's `stats` closure is still the pre-*either*-update value. Using it
  // as "before" could re-detect a badge the first call already reported as
  // newly unlocked, popping the "badge unlocked" toast twice for one burst.
  const checkNewBadges = (prevStats: RewardStats, nextStats: RewardStats) => {
    const before = new Set(badges.filter((b) => b.test(prevStats)).map((b) => b.id));
    const after = badges.filter((b) => b.test(nextStats)).map((b) => b.id);
    const newly = after.find((id) => !before.has(id));
    if (newly) setLastUnlockedBadgeId(newly);
  };

  /**
   * @param hobbyKey the session's hobby — a sub-hobby slug where the post was
   * tagged with one, else `space:<slug>`. Drives the craft-specific badges.
   */
  const recordPostCreated = (hobbyKey?: string) => {
    setState((prev) => {
      const hobbiesPosted = hobbyKey
        ? [...prev.hobbiesPosted, hobbyKey]
        : prev.hobbiesPosted;
      const next = {
        ...prev,
        points: prev.points + 50,
        postsCreated: prev.postsCreated + 1,
        hobbiesPosted,
      };
      checkNewBadges(prev, next);
      return next;
    });
    logActivity("Posted new content", 50);
  };

  const recordPurchase = (count = 1) => {
    setState((prev) => {
      const next = {
        ...prev,
        points: prev.points + 10 * count,
        purchases: prev.purchases + count,
      };
      checkNewBadges(prev, next);
      return next;
    });
    logActivity(count > 1 ? `Checked out ${count} items` : "Checked out", 10 * count);
  };

  const visitHobby = (slug: string) => {
    setState((prev) => {
      if (prev.hobbiesVisited.includes(slug)) return prev;
      const next = {
        ...prev,
        points: prev.points + 5,
        hobbiesVisited: [...prev.hobbiesVisited, slug],
      };
      checkNewBadges(prev, next);
      return next;
    });
  };

  const isPostLiked = (postId: number) => state.likedPostIds.includes(postId);

  const toggleLikePost = (postId: number) => {
    let nowLiked = false;
    setState((prev) => {
      const already = prev.likedPostIds.includes(postId);
      nowLiked = !already;
      const likedPostIds = already
        ? prev.likedPostIds.filter((id) => id !== postId)
        : [...prev.likedPostIds, postId];
      const likesGiven = already ? Math.max(0, prev.likesGiven - 1) : prev.likesGiven + 1;
      const points = already ? Math.max(0, prev.points - 2) : prev.points + 2;
      const next = { ...prev, likedPostIds, likesGiven, points };
      if (!already) checkNewBadges(prev, next);
      return next;
    });
    return nowLiked;
  };

  const dismissLastBadge = () => setLastUnlockedBadgeId(null);

  const isBadgeShared = (badgeId: string) => state.sharedBadgeIds.includes(badgeId);

  // A locked milestone is never shareable, no matter what calls this — the
  // UI already hides the affordance, but the guard lives here too rather
  // than trusting every call site to check first.
  const shareBadge = (badgeId: string) => {
    if (!unlockedBadgeIds.includes(badgeId)) return;
    setState((prev) =>
      prev.sharedBadgeIds.includes(badgeId)
        ? prev
        : { ...prev, sharedBadgeIds: [...prev.sharedBadgeIds, badgeId] },
    );
    if (user) void shareMilestone(user.id, badgeId);
  };

  const unshareBadge = (badgeId: string) => {
    setState((prev) => ({
      ...prev,
      sharedBadgeIds: prev.sharedBadgeIds.filter((id) => id !== badgeId),
    }));
    if (user) void unshareMilestone(user.id, badgeId);
  };

  return (
    <RewardsContext.Provider
      value={{
        points: state.points,
        stats,
        unlockedBadgeIds,
        activity,
        lastUnlockedBadgeId,
        dismissLastBadge,
        recordPostCreated,
        recordPurchase,
        visitHobby,
        toggleLikePost,
        isPostLiked,
        isBadgeShared,
        shareBadge,
        unshareBadge,
      }}
    >
      {children}
    </RewardsContext.Provider>
  );
}

export function useRewards() {
  const ctx = useContext(RewardsContext);
  if (!ctx) throw new Error("useRewards must be used within a RewardsProvider");
  return ctx;
}
