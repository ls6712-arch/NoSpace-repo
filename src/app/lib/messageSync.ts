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
 * with) is left alone — the next refresh() fills it in.
 */
export function patchSummaryWithNewMessage(summaries: ThreadSummary[], incoming: Message): ThreadSummary[] {
  const idx = summaries.findIndex((s) => String(s.participationId) === String(incoming.participationId));
  if (idx === -1) return summaries;
  const existing = summaries[idx];
  if (existing.lastMessageId != null && String(existing.lastMessageId) === String(incoming.id)) return summaries;
  const patched: ThreadSummary = {
    ...existing,
    messageCount: existing.messageCount + 1,
    lastMessageId: incoming.id,
    lastMessageFromUser: incoming.fromUser,
    lastMessageBody: incoming.body,
    lastMessageCreatedAt: incoming.createdAt,
  };
  return [...summaries.slice(0, idx), patched, ...summaries.slice(idx + 1)];
}
