/**
 * Which tab (if any) a participation belongs to on the Messages page.
 * Pure and framework-free so it's testable on its own — SocialContext.tsx
 * (messageRequests/myPendingRequests) and Messages.tsx (chatThreads) both
 * call this rather than each re-deriving the same rule slightly
 * differently.
 *
 *   "requests" — a pending direct_message someone else sent me, waiting
 *                for me to accept or ignore.
 *   "chats"    — an accepted thread of any kind (Make/Explore together or
 *                direct_message), or my own outgoing direct_message still
 *                waiting on the other person (pending, or declined — a
 *                decline doesn't free me to start a second one, so it's
 *                still "the thread I'm waiting on", not gone).
 *   "none"     — anything else: join_in (no messaging surface at all), or
 *                a pending/declined Make/Explore together request (those
 *                only unlock messaging once accepted).
 */
export type MessageTab = "chats" | "requests" | "none";

export interface ParticipationLike {
  kind: string;
  status: "pending" | "accepted" | "declined";
  fromUser: string;
  toUser?: string;
}

export function messageTabFor(p: ParticipationLike, myId: string): MessageTab {
  if (p.kind === "join_in") return "none";

  if (p.status === "accepted") {
    return p.kind === "make_together" || p.kind === "explore_together" || p.kind === "direct_message"
      ? "chats"
      : "none";
  }

  // Only a direct_message has any messaging surface before it's accepted.
  if (p.kind !== "direct_message") return "none";
  // Only while still pending — once I've declined one sent to me, I've
  // already answered it; it doesn't keep asking.
  if (p.status === "pending" && p.toUser === myId) return "requests";
  if (p.fromUser === myId) return "chats";
  return "none";
}
