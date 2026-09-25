import { Message } from "../context/SocialContext";

/**
 * Pure merge/paging/retry logic for Phase 2's live Messages page — kept
 * framework- and Supabase-free so it's directly testable (see
 * messageSync.test.ts) rather than only exercisable through a mocked
 * network.
 *
 * A "pending" message is a locally-created, not-yet-confirmed send: it
 * carries a `clientId` (never a real database id) and a `status` of
 * "sending" or "failed". Once the insert actually lands — whether we learn
 * that from our own request's response or from the Realtime echo, in
 * either order — it's replaced by (or deduped against) the real row.
 */
export interface PendingMessage extends Message {
  clientId: string;
  status: "sending" | "failed";
}

/** One row per thread from participation_message_summaries() — feeds the
 * conversation list preview, the Message requests preview, and the
 * composer's one-message-while-pending rule, without loading full history
 * for every thread. */
export interface ThreadSummary {
  participationId: number | string;
  messageCount: number;
  lastMessageId: number | string | null;
  lastMessageFromUser: string | null;
  lastMessageBody: string | null;
  lastMessageCreatedAt: number | null;
  /** Messages from the other person newer than my own last_read_at (Phase
   * 3) — everything, if I've never opened this thread. A pending request's
   * own unread count is real too; it's up to the caller to route it to the
   * Message requests bucket rather than Chats, same as it already decides
   * which tab the thread itself appears in. */
  unreadCount: number;
}

function sortByCreatedAt(list: Message[]): Message[] {
  return [...list].sort((a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id)));
}

/**
 * Add a confirmed message into a loaded history, deduping by id. Used both
 * for a Realtime INSERT echo and for our own insert's `.select().single()`
 * response — whichever arrives first wins, the second is a no-op.
 */
export function mergeMessage(list: Message[], incoming: Message): Message[] {
  if (list.some((m) => String(m.id) === String(incoming.id))) return list;
  return sortByCreatedAt([...list, incoming]);
}

/**
 * Prepend an older page (fetched newest-first, then reversed to oldest-
 * first before calling this) onto the currently loaded history. Deduped by
 * id in case a page boundary is fetched twice, and always returned in
 * ascending created_at order.
 */
export function prependOlderPage(existing: Message[], olderPage: Message[]): Message[] {
  const seen = new Set(existing.map((m) => String(m.id)));
  const fresh = olderPage.filter((m) => !seen.has(String(m.id)));
  return sortByCreatedAt([...fresh, ...existing]);
}

/**
 * Drop one pending "sending" entry that matches a just-confirmed message —
 * same sender and same body, oldest match first — so a Realtime echo that
 * arrives before our own insert's response still converts the "sending"
 * bubble into the real one right away, instead of showing both until our
 * own request resolves a moment later.
 */
export function reconcilePendingAfterIncoming(pending: PendingMessage[], incoming: Message): PendingMessage[] {
  const idx = pending.findIndex(
    (p) => p.status === "sending" && p.fromUser === incoming.fromUser && p.body === incoming.body,
  );
  if (idx === -1) return pending;
  return [...pending.slice(0, idx), ...pending.slice(idx + 1)];
}

/** Remove a specific pending entry by its clientId — used when our own
 * insert call resolves (success or a hard failure other than a rejected
 * send), since at that point we know exactly which one it was. */
export function removePendingByClientId(pending: PendingMessage[], clientId: string): PendingMessage[] {
  return pending.filter((p) => p.clientId !== clientId);
}

/** Flip a pending entry to "failed" in place (same clientId and body, so a
 * retry can reuse both rather than creating a second request row). */
export function markPendingFailed(pending: PendingMessage[], clientId: string): PendingMessage[] {
  return pending.map((p) => (p.clientId === clientId ? { ...p, status: "failed" as const } : p));
}

/** What a conversation's composer should render: confirmed history plus
 * whatever's still pending for that thread, oldest first. */
export function combineHistoryAndPending(history: Message[], pending: PendingMessage[]): Message[] {
  return sortByCreatedAt([...history, ...pending]);
}

/**
 * Bump a thread's summary locally when a live "messages" INSERT arrives,
 * so the conversation list's preview/count updates instantly rather than
 * waiting for the next refresh(). A thread with no summary loaded yet
 * (e.g. a brand-new request the participations refresh hasn't caught up
 * with) is left alone — the next refresh() fills it in. unreadCount only
 * bumps for a message from the OTHER person — my own send (or its Realtime
 * echo) increments messageCount but never marks itself unread to me.
 */
export function patchSummaryWithNewMessage(summaries: ThreadSummary[], incoming: Message, myId: string): ThreadSummary[] {
  const idx = summaries.findIndex((s) => String(s.participationId) === String(incoming.participationId));
  if (idx === -1) return summaries;
  const existing = summaries[idx];
  if (existing.lastMessageId != null && String(existing.lastMessageId) === String(incoming.id)) return summaries;
  const patched: ThreadSummary = {
    ...existing,
    messageCount: existing.messageCount + 1,
    unreadCount: incoming.fromUser === myId ? existing.unreadCount : existing.unreadCount + 1,
    lastMessageId: incoming.id,
    lastMessageFromUser: incoming.fromUser,
    lastMessageBody: incoming.body,
    lastMessageCreatedAt: incoming.createdAt,
  };
  return [...summaries.slice(0, idx), patched, ...summaries.slice(idx + 1)];
}

/** How many of the given threads have unread messages — used for the Chats
 * badge (a thread count: "how many chats have something new", not a total
 * message count) and for bolding the thread list. */
export function countUnreadThreads(
  participationIds: ReadonlyArray<number | string>,
  summaries: ReadonlyArray<ThreadSummary>,
): number {
  const unreadIds = new Set(
    summaries.filter((s) => s.unreadCount > 0).map((s) => String(s.participationId)),
  );
  return participationIds.filter((id) => unreadIds.has(String(id))).length;
}

/** The header/tab-bar badge never shows an exact count past 9 — just "9+". */
export function formatBadgeCount(n: number): string {
  return n > 9 ? "9+" : String(n);
}

/** "Seen" appears under your own latest message once the other person's
 * last_read_at is at or after it — never for a pending thread (the caller
 * simply never has a myLastMessageCreatedAt to check in that case, since
 * mark_conversation_read never ran for it) and never when either side's
 * read_receipts made thread_seen_at() return null (otherLastReadAt is then
 * also null here). */
export function isSeenByOther(myLastMessageCreatedAt: number | null, otherLastReadAt: number | null): boolean {
  if (myLastMessageCreatedAt == null || otherLastReadAt == null) return false;
  return otherLastReadAt >= myLastMessageCreatedAt;
}

/** When to call mark_conversation_read: the conversation is open, the tab
 * is actually visible, and you're scrolled to the newest message. Scrolled
 * up reading history doesn't count as having read the latest. */
export function shouldMarkThreadRead(input: { threadOpen: boolean; tabVisible: boolean; atBottom: boolean }): boolean {
  return input.threadOpen && input.tabVisible && input.atBottom;
}
