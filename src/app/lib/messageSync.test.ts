import { describe, expect, it } from "vitest";
import {
  combineHistoryAndPending,
  markPendingFailed,
  mergeMessage,
  patchSummaryWithNewMessage,
  PendingMessage,
  prependOlderPage,
  reconcilePendingAfterIncoming,
  removePendingByClientId,
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
  const summary = (participationId: number, count: number): ThreadSummary => ({
    participationId,
    messageCount: count,
    lastMessageId: count > 0 ? 1 : null,
    lastMessageFromUser: count > 0 ? "them" : null,
    lastMessageBody: count > 0 ? "old" : null,
    lastMessageCreatedAt: count > 0 ? 100 : null,
  });

  it("bumps count and last-message fields for a live INSERT on a known thread", () => {
    const result = patchSummaryWithNewMessage([summary(1, 1)], msg(2, 200, "me", "new one"));
    expect(result[0]).toMatchObject({ messageCount: 2, lastMessageId: 2, lastMessageBody: "new one" });
  });

  it("leaves a thread with no loaded summary alone (next refresh() fills it in)", () => {
    // participationId 999 has no summary row yet — unaffected.
    const incoming: Message = { ...msg(3, 200, "me", "hi"), participationId: 999 };
    const result = patchSummaryWithNewMessage([summary(1, 1)], incoming);
    expect(result).toEqual([summary(1, 1)]);
  });
});
