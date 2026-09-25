import { describe, expect, it } from "vitest";
import {
  combineHistoryAndPending,
  countUnreadThreads,
  formatBadgeCount,
  isSeenByOther,
  markPendingFailed,
  mergeMessage,
  patchSummaryWithNewMessage,
  PendingMessage,
  prependOlderPage,
  reconcilePendingAfterIncoming,
  removePendingByClientId,
  shouldMarkThreadRead,
  ThreadSummary,
} from "./messageSync";
import { Message } from "../context/SocialContext";

const msg = (id: number | string, createdAt: number, fromUser = "them", body = "hi"): Message => ({
  id,
  participationId: 1,
  fromUser,
  body,
  createdAt,
});

const pending = (clientId: string, createdAt: number, body = "hi", status: "sending" | "failed" = "sending"): PendingMessage => ({
  id: clientId,
  clientId,
  participationId: 1,
  fromUser: "me",
  body,
  createdAt,
  status,
});

describe("mergeMessage", () => {
  it("appends a genuinely new message", () => {
    const list = [msg(1, 100)];
    const result = mergeMessage(list, msg(2, 200));
    expect(result.map((m) => m.id)).toEqual([1, 2]);
  });

  it("ignores a duplicate echo of a message already in the list", () => {
    const list = [msg(1, 100), msg(2, 200)];
    const result = mergeMessage(list, msg(2, 200, "them", "hi"));
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual([1, 2]);
  });

  it("keeps ascending created_at order regardless of insertion order", () => {
    const list = [msg(1, 300)];
    const result = mergeMessage(list, msg(2, 100));
    expect(result.map((m) => m.id)).toEqual([2, 1]);
  });
});

describe("prependOlderPage", () => {
  it("prepends an older page in ascending order, before the existing history", () => {
    const existing = [msg(10, 1000), msg(11, 1100)];
    // Fetched newest-first from the DB, then reversed to oldest-first by
    // the caller before handing it here — same as the real load path.
    const olderPage = [msg(8, 800), msg(9, 900)];
    const result = prependOlderPage(existing, olderPage);
    expect(result.map((m) => m.id)).toEqual([8, 9, 10, 11]);
  });

  it("dedupes a page boundary fetched twice", () => {
    const existing = [msg(9, 900), msg(10, 1000)];
    const olderPage = [msg(8, 800), msg(9, 900)];
    const result = prependOlderPage(existing, olderPage);
    expect(result.map((m) => m.id)).toEqual([8, 9, 10]);
  });
});

describe("reconcilePendingAfterIncoming", () => {
  it("clears a matching pending 'sending' entry when the Realtime echo arrives before our own insert response", () => {
    const pendingList = [pending("c1", 500, "hello")];
    const result = reconcilePendingAfterIncoming(pendingList, msg(42, 505, "me", "hello"));
    expect(result).toHaveLength(0);
  });

  it("leaves a non-matching pending entry alone", () => {
    const pendingList = [pending("c1", 500, "hello")];
    const result = reconcilePendingAfterIncoming(pendingList, msg(42, 505, "them", "hi there"));
    expect(result).toHaveLength(1);
  });

  it("never touches an already-failed entry", () => {
    const pendingList = [pending("c1", 500, "hello", "failed")];
    const result = reconcilePendingAfterIncoming(pendingList, msg(42, 505, "me", "hello"));
    expect(result).toHaveLength(1);
  });
});

describe("failed then retried", () => {
  it("marks a send failed in place, then a retry with the same clientId/body clears it once it succeeds", () => {
    let pendingList = [pending("c1", 500, "hello")];
    pendingList = markPendingFailed(pendingList, "c1");
    expect(pendingList[0].status).toBe("failed");
    expect(pendingList[0].body).toBe("hello");

    // Retry reuses the same clientId and body — no second entry appears.
    pendingList = pendingList.map((p) => (p.clientId === "c1" ? { ...p, status: "sending" as const } : p));
    expect(pendingList).toHaveLength(1);

    // The retried insert succeeds — resolved by clientId, not by matching.
    pendingList = removePendingByClientId(pendingList, "c1");
    expect(pendingList).toHaveLength(0);
  });
});

describe("combineHistoryAndPending", () => {
  it("interleaves pending sends after confirmed history, in created_at order", () => {
    const history = [msg(1, 100)];
    const pendingList = [pending("c1", 200)];
    const result = combineHistoryAndPending(history, pendingList);
    expect(result.map((m) => m.id)).toEqual([1, "c1"]);
  });
});

describe("patchSummaryWithNewMessage", () => {
  const summary = (participationId: number, count: number, unread = 0): ThreadSummary => ({
    participationId,
    messageCount: count,
    lastMessageId: count > 0 ? 1 : null,
    lastMessageFromUser: count > 0 ? "them" : null,
    lastMessageBody: count > 0 ? "old" : null,
    lastMessageCreatedAt: count > 0 ? 100 : null,
    unreadCount: unread,
  });

  it("bumps count, unread count, and last-message fields for a message from someone else", () => {
    const result = patchSummaryWithNewMessage([summary(1, 1, 0)], msg(2, 200, "them", "new one"), "me");
    expect(result[0]).toMatchObject({ messageCount: 2, unreadCount: 1, lastMessageId: 2, lastMessageBody: "new one" });
  });

  it("bumps count but never unread count for my own message", () => {
    const result = patchSummaryWithNewMessage([summary(1, 1, 0)], msg(2, 200, "me", "new one"), "me");
    expect(result[0]).toMatchObject({ messageCount: 2, unreadCount: 0 });
  });

  it("leaves a thread with no loaded summary alone (next refresh() fills it in)", () => {
    // participationId 999 has no summary row yet — unaffected.
    const incoming: Message = { ...msg(3, 200, "me", "hi"), participationId: 999 };
    const result = patchSummaryWithNewMessage([summary(1, 1)], incoming, "me");
    expect(result).toEqual([summary(1, 1)]);
  });
});

describe("countUnreadThreads", () => {
  const summary = (participationId: number, unread: number): ThreadSummary => ({
    participationId,
    messageCount: unread + 1,
    lastMessageId: 1,
    lastMessageFromUser: "them",
    lastMessageBody: "hi",
    lastMessageCreatedAt: 100,
    unreadCount: unread,
  });

  it("counts only threads with unread > 0, among the given ids", () => {
    const summaries = [summary(1, 2), summary(2, 0), summary(3, 1)];
    expect(countUnreadThreads([1, 2, 3], summaries)).toBe(2);
  });

  it("ignores an unread thread whose id isn't in the given list", () => {
    const summaries = [summary(1, 2)];
    expect(countUnreadThreads([2, 3], summaries)).toBe(0);
  });

  it("returns 0 for an empty id list", () => {
    expect(countUnreadThreads([], [summary(1, 5)])).toBe(0);
  });
});

describe("formatBadgeCount", () => {
  it("shows the exact count up to 9", () => {
    expect(formatBadgeCount(0)).toBe("0");
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(9)).toBe("9");
  });

  it("caps anything over 9 at '9+'", () => {
    expect(formatBadgeCount(10)).toBe("9+");
    expect(formatBadgeCount(42)).toBe("9+");
  });
});

describe("isSeenByOther", () => {
  it("is true once the other party's read time is at or after my last message", () => {
    expect(isSeenByOther(100, 100)).toBe(true);
    expect(isSeenByOther(100, 150)).toBe(true);
  });

  it("is false when the other party read before my last message", () => {
    expect(isSeenByOther(100, 50)).toBe(false);
  });

  it("is false when either side is null (never read, or thread_seen_at() returned null)", () => {
    expect(isSeenByOther(null, 100)).toBe(false);
    expect(isSeenByOther(100, null)).toBe(false);
    expect(isSeenByOther(null, null)).toBe(false);
  });
});

describe("shouldMarkThreadRead", () => {
  it("is true only when the thread is open, the tab is visible, and you're at the bottom", () => {
    expect(shouldMarkThreadRead({ threadOpen: true, tabVisible: true, atBottom: true })).toBe(true);
  });

  it("is false if any one condition fails", () => {
    expect(shouldMarkThreadRead({ threadOpen: false, tabVisible: true, atBottom: true })).toBe(false);
    expect(shouldMarkThreadRead({ threadOpen: true, tabVisible: false, atBottom: true })).toBe(false);
    expect(shouldMarkThreadRead({ threadOpen: true, tabVisible: true, atBottom: false })).toBe(false);
  });
});
