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
 *                direct_message); my own outgoing direct_message still
 *                waiting on the other person (pending, or declined — a
 *                decline doesn't free me to start a second one, so it's
 *                still "the thread I'm waiting on", not gone); or a
 *                direct_message I declined — I can still message that
 *                person again, which un-declines it (see canSendInto and
 *                SocialContext.tsx's sendMessage).
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
  // already answered it; it doesn't keep asking me to answer again.
  if (p.status === "pending" && p.toUser === myId) return "requests";
  if (p.fromUser === myId) return "chats";
  // I declined this one, but the database still lets me (the recipient)
  // change my mind later — messaging them again un-declines it, so it
  // belongs in Chats, not nowhere.
  if (p.status === "declined" && p.toUser === myId) return "chats";
  return "none";
}

/**
 * Whether I may type into this thread's composer right now, given whether
 * it already has any messages in it.
 *
 * An accepted thread (Make/Explore together or direct_message) is always
 * open. Before that, only a direct_message has anything to send into at
 * all:
 *   - still pending: only its sender, and only until their one allowed
 *     message has landed — a participation row is never created without a
 *     message riding along with it (see SocialContext.tsx's
 *     startAndSendDirectMessage), so `hasMessages` should only ever be
 *     false here for a legacy row from before that was true, or a retry
 *     after the message half of that insert failed. The recipient of a
 *     pending request never gets a composer at all — they see it in
 *     Message requests with Accept/Ignore, not a conversation to reply
 *     into.
 *   - declined: only its RECIPIENT, and regardless of message count —
 *     sending un-declines it (the database allows declined -> accepted
 *     only for the recipient, the same move Accept makes on a pending
 *     one; see SocialContext.tsx's sendMessage). Its sender has no such
 *     move and stays locked out.
 */
export function canSendInto(p: ParticipationLike, myId: string, hasMessages: boolean): boolean {
  if (p.status === "accepted") {
    return p.kind === "make_together" || p.kind === "explore_together" || p.kind === "direct_message";
  }
  if (p.kind !== "direct_message") return false;
  if (p.status === "pending") return p.fromUser === myId && !hasMessages;
  if (p.status === "declined") return p.toUser === myId;
  return false;
}
