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
 *   "none"     — anything else: join_in (no messaging surface at all), a
 *                pending/declined Make/Explore together request (those
 *                only unlock messaging once accepted), or a direct_message
 *                I declined — I answered it, it's gone from my Chats too,
 *                not sitting there as a thread with nothing in it. I can
 *                still un-decline it by messaging that person again from
 *                their profile — canSendInto allows it and
 *                SocialContext.tsx's sendMessage flips it to accepted,
 *                which is what actually moves it into Chats. That flow
 *                goes through a fresh draft (see PublicProfile.tsx and
 *                Messages.tsx's startThreadWith), never through this
 *                still-declined row appearing here first.
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

/**
 * Whether this participation's other party actually resolved to a visible
 * profile. A blocked-and-hidden account (RLS's is_visible_profile), a
 * deleted one, or a paused one all look identical from here: the profiles
 * fetch simply never returns that row, so `resolvedProfileIds` — the ids
 * that DID come back — won't contain it.
 *
 * A thread whose other party didn't resolve has to be dropped everywhere
 * (the conversation list, a `?thread=` deep link, the composer) rather
 * than shown with a "Someone" placeholder and an open composer: there's no
 * one there to receive a message, and — same rule as everywhere else in
 * Phase 1 — a block must never be revealed by how it looks different from
 * an ordinary deleted or paused account.
 */
export function hasVisibleOtherParty(
  p: { fromUser: string; toUser?: string },
  myId: string,
  resolvedProfileIds: ReadonlySet<string>,
): boolean {
  const otherId = p.fromUser === myId ? p.toUser : p.fromUser;
  // No specific other person to resolve — e.g. a public join_in ask with no
  // to_user — so there's nothing here that could go missing.
  if (!otherId) return true;
  return resolvedProfileIds.has(otherId);
}

/**
 * Ghost-thread filtering for a whole participations list — but only when
 * the profiles lookup that `resolvedProfileIds` came from actually
 * succeeded. If that lookup itself failed, `resolvedProfileIds` is empty
 * for a reason that has nothing to do with any of these other parties
 * being hidden — it looks identical to "everyone got blocked", and
 * filtering on it would wipe every chat out of state (and then have
 * startAndSendDirectMessage hit the unique index trying to "start" a
 * thread that already exists). Safer to show every thread, unfiltered,
 * than to drop them all over an unrelated fetch failure.
 */
export function visibleParticipations<T extends { fromUser: string; toUser?: string }>(
  participations: T[],
  myId: string,
  resolvedProfileIds: ReadonlySet<string>,
  profileLookupSucceeded: boolean,
): T[] {
  if (!profileLookupSucceeded) return participations;
  return participations.filter((p) => hasVisibleOtherParty(p, myId, resolvedProfileIds));
}
