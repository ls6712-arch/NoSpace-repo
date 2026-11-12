import type { Post } from "../../data/posts";

/**
 * Stand-ins for the contexts a Moment reads, for tests. Use inside vi.mock:
 *
 *   const ctx = vi.hoisted(() => ({ user: { id: "me" } as { id: string } | null, posts: [] as Post[] }));
 *   vi.mock("../../context/ContentContext", async () => (await import("../moment/testSupport")).contentMock(ctx));
 */
export interface MomentTestState {
  user: { id: string } | null;
  posts?: Post[];
  ownCounts?: Record<number, { thoughts: number }>;
  reactions?: Record<number, string[]>;
  thoughts?: Record<number, unknown[]>;
  toggleReaction?: (postId: number, type: string) => void;
}

export const authMock = (state: MomentTestState) => ({ useAuth: () => ({ user: state.user, profile: null }) });

export const contentMock = (state: MomentTestState) => ({
  useContent: () => ({
    posts: state.posts ?? [],
    publicFeed: state.posts ?? [],
    ownCounts: state.ownCounts ?? {},
    myReactionsByPostId: state.reactions ?? {},
    toggleReaction: (postId: number, type: string) => state.toggleReaction?.(postId, type),
    updatePost: async () => true,
    deletePost: async () => true,
  }),
});

export const socialMock = (state: MomentTestState) => ({
  useSocial: () => ({
    thoughtsFor: (postId: number) => state.thoughts?.[postId] ?? [],
    findExistingThread: () => undefined,
    participations: [],
    blockedIds: [],
    isShared: true,
    report: async () => ({ error: null }),
  }),
});

export const privateLogsMock = () => ({
  usePrivateLogs: () => ({ logs: [], isShared: true, add: async () => ({}), remove: async () => ({ data: true }), update: async () => ({ data: null }) }),
});

export const cornersMock = () => ({ useCorners: () => ({ allCorners: [], resolveInterest: async () => null }) });

export function testPost(over: Partial<Post> = {}): Post {
  return {
    id: 1,
    hobbySlug: "food-cooking",
    subHobby: "cooking",
    corner: "cooking",
    type: "photo",
    media: "https://example.test/lox.jpg",
    creator: "Priya",
    caption: "Lox on everything bagels, second try.",
    likes: 0,
    createdAt: Date.parse("2026-09-18T12:00:00Z"),
    visibility: "public",
    userId: "u-priya",
    ...over,
  };
}
