import { describe, expect, it } from "vitest";
import {
  applyParticipationDelete,
  canAttachInto,
  canSendInto,
  hasVisibleOtherParty,
  isRelevantParticipationEvent,
  messageTabFor,
  upsertParticipation,
  visibleParticipations,
} from "./messageTabs";

const ME = "me";
const THEM = "them";

describe("messageTabFor", () => {
  it("puts join_in nowhere, whatever its status", () => {
    expect(messageTabFor({ kind: "join_in", status: "accepted", fromUser: ME }, ME)).toBe("none");
    expect(messageTabFor({ kind: "join_in", status: "pending", fromUser: ME, toUser: THEM }, ME)).toBe(
      "none",
    );
  });

  it("puts an accepted Make/Explore together or direct_message thread in chats", () => {
    for (const kind of ["make_together", "explore_together", "direct_message"]) {
      expect(
        messageTabFor({ kind, status: "accepted", fromUser: ME, toUser: THEM }, ME),
      ).toBe("chats");
      expect(
        messageTabFor({ kind, status: "accepted", fromUser: THEM, toUser: ME }, ME),
      ).toBe("chats");
    }
  });

  it("puts a pending or declined Make/Explore together request nowhere — no messaging surface until accepted", () => {
    for (const kind of ["make_together", "explore_together"]) {
      for (const status of ["pending", "declined"] as const) {
        expect(messageTabFor({ kind, status, fromUser: ME, toUser: THEM }, ME)).toBe("none");
        expect(messageTabFor({ kind, status, fromUser: THEM, toUser: ME }, ME)).toBe("none");
      }
    }
  });

  it("puts a pending direct_message TO me in requests", () => {
    expect(
      messageTabFor({ kind: "direct_message", status: "pending", fromUser: THEM, toUser: ME }, ME),
    ).toBe("requests");
  });

  it("puts a pending direct_message FROM me in chats — waiting, not a request I answer", () => {
    expect(
      messageTabFor({ kind: "direct_message", status: "pending", fromUser: ME, toUser: THEM }, ME),
    ).toBe("chats");
  });

  it("puts a declined direct_message FROM me in chats too — still the one thread I'm waiting on", () => {
    expect(
      messageTabFor({ kind: "direct_message", status: "declined", fromUser: ME, toUser: THEM }, ME),
    ).toBe("chats");
  });

  it("puts a declined direct_message someone sent me nowhere — I already answered it", () => {
    expect(
      messageTabFor({ kind: "direct_message", status: "declined", fromUser: THEM, toUser: ME }, ME),
    ).toBe("none");
  });

  it("moves it into chats once I un-decline it by messaging them again (canSendInto flips it to accepted first)", () => {
    // Same row, after SocialContext.tsx's sendMessage has flipped its status —
    // messageTabFor only looks at current fields, not history.
    expect(
      messageTabFor({ kind: "direct_message", status: "accepted", fromUser: THEM, toUser: ME }, ME),
    ).toBe("chats");
  });
});

describe("canSendInto", () => {
  it("is always open once accepted, for Make/Explore together or direct_message", () => {
    for (const kind of ["make_together", "explore_together", "direct_message"]) {
      expect(canSendInto({ kind, status: "accepted", fromUser: ME, toUser: THEM }, ME, true)).toBe(true);
      expect(canSendInto({ kind, status: "accepted", fromUser: THEM, toUser: ME }, ME, false)).toBe(true);
    }
  });

  it("is never open for join_in, whatever its status", () => {
    expect(canSendInto({ kind: "join_in", status: "accepted", fromUser: ME }, ME, false)).toBe(false);
  });

  it("is never open for a pending or declined Make/Explore together request", () => {
    for (const kind of ["make_together", "explore_together"]) {
      for (const status of ["pending", "declined"] as const) {
        expect(canSendInto({ kind, status, fromUser: ME, toUser: THEM }, ME, false)).toBe(false);
        expect(canSendInto({ kind, status, fromUser: THEM, toUser: ME }, ME, false)).toBe(false);
      }
    }
  });

  it("lets the sender of a pending direct_message send while it has no messages yet", () => {
    expect(
      canSendInto({ kind: "direct_message", status: "pending", fromUser: ME, toUser: THEM }, ME, false),
    ).toBe(true);
  });

  it("closes the sender's composer once their one message has landed", () => {
    expect(
      canSendInto({ kind: "direct_message", status: "pending", fromUser: ME, toUser: THEM }, ME, true),
    ).toBe(false);
  });

  it("never opens a composer for the recipient of a pending direct_message — they accept or ignore, they don't reply", () => {
    expect(
      canSendInto({ kind: "direct_message", status: "pending", fromUser: THEM, toUser: ME }, ME, false),
    ).toBe(false);
    expect(
      canSendInto({ kind: "direct_message", status: "pending", fromUser: THEM, toUser: ME }, ME, true),
    ).toBe(false);
  });

  it("stays closed for the SENDER of a declined direct_message, whatever its message count", () => {
    expect(
      canSendInto({ kind: "direct_message", status: "declined", fromUser: ME, toUser: THEM }, ME, false),
    ).toBe(false);
    expect(
      canSendInto({ kind: "direct_message", status: "declined", fromUser: ME, toUser: THEM }, ME, true),
    ).toBe(false);
  });

  it("opens the composer for the RECIPIENT of a declined direct_message — sending un-declines it", () => {
    expect(
      canSendInto({ kind: "direct_message", status: "declined", fromUser: THEM, toUser: ME }, ME, false),
    ).toBe(true);
    expect(
      canSendInto({ kind: "direct_message", status: "declined", fromUser: THEM, toUser: ME }, ME, true),
    ).toBe(true);
  });
});

describe("canAttachInto", () => {
  it("is open for an accepted Make/Explore together or direct_message thread, from either side", () => {
    for (const kind of ["make_together", "explore_together", "direct_message"]) {
      expect(canAttachInto({ kind, status: "accepted", fromUser: ME, toUser: THEM })).toBe(true);
      expect(canAttachInto({ kind, status: "accepted", fromUser: THEM, toUser: ME })).toBe(true);
    }
  });

  it("is never open for join_in, whatever its status", () => {
    expect(canAttachInto({ kind: "join_in", status: "accepted", fromUser: ME })).toBe(false);
  });

  it("is closed for a pending or declined thread, even the one case canSendInto allows (sender of a pending/declined direct_message)", () => {
    for (const status of ["pending", "declined"] as const) {
      expect(canAttachInto({ kind: "direct_message", status, fromUser: ME, toUser: THEM })).toBe(false);
      expect(canAttachInto({ kind: "direct_message", status, fromUser: THEM, toUser: ME })).toBe(false);
    }
  });
});

describe("hasVisibleOtherParty", () => {
  const RESOLVED = new Set([THEM]);
  const NONE_RESOLVED = new Set<string>();

  it("is visible when the other party's profile resolved, whichever side I'm on", () => {
    expect(hasVisibleOtherParty({ fromUser: ME, toUser: THEM }, ME, RESOLVED)).toBe(true);
    expect(hasVisibleOtherParty({ fromUser: THEM, toUser: ME }, ME, RESOLVED)).toBe(true);
  });

  it("is hidden when the other party's profile didn't resolve — blocked, deleted, or paused all look the same", () => {
    expect(hasVisibleOtherParty({ fromUser: ME, toUser: THEM }, ME, NONE_RESOLVED)).toBe(false);
    expect(hasVisibleOtherParty({ fromUser: THEM, toUser: ME }, ME, NONE_RESOLVED)).toBe(false);
  });

  it("is always visible when there's no specific other person to resolve (e.g. a public join_in ask)", () => {
    expect(hasVisibleOtherParty({ fromUser: ME, toUser: undefined }, ME, NONE_RESOLVED)).toBe(true);
  });

  it("doesn't confuse my own id with the other party's — I always resolve myself", () => {
    // Regardless of what's in resolvedProfileIds, the "other" party here is
    // THEM, not ME, so only THEM's presence in the set matters.
    expect(hasVisibleOtherParty({ fromUser: ME, toUser: THEM }, ME, new Set([ME]))).toBe(false);
  });
});

describe("visibleParticipations", () => {
  const ANOTHER = "another";
  const list = [
    { fromUser: ME, toUser: THEM },
    { fromUser: ANOTHER, toUser: ME },
  ];

  it("drops a participation whose other party didn't resolve, when the lookup succeeded", () => {
    // Only THEM resolved — ANOTHER didn't, so their thread is dropped.
    expect(visibleParticipations(list, ME, new Set([THEM]), true)).toEqual([{ fromUser: ME, toUser: THEM }]);
  });

  it("drops nothing when the profiles lookup itself failed, even with an empty resolved set", () => {
    // An empty resolvedProfileIds is indistinguishable from "everyone got
    // blocked" unless we also know whether the lookup that built it
    // actually ran — this is the case a failed query produces, and it must
    // never wipe every thread out of state.
    expect(visibleParticipations(list, ME, new Set(), false)).toEqual(list);
  });

  it("drops everything when the lookup succeeded but genuinely resolved no one", () => {
    // Distinguishes "lookup failed" from "lookup succeeded and came back
    // empty" — the latter really does mean no one here resolved.
    expect(visibleParticipations(list, ME, new Set(), true)).toEqual([]);
  });
});

describe("upsertParticipation + visibleParticipations (live participations updates)", () => {
  it("removes a thread from the visible list once a live update makes its other party unresolved (e.g. a fresh block)", () => {
    const thread = { id: 1, fromUser: ME, toUser: THEM, status: "accepted" as const };
    const prev = [thread];

    // A Realtime UPDATE for the same thread arrives (status unchanged here —
    // a block itself never touches participations, but the same upsert path
    // is what any other live participations change goes through too).
    const updated = upsertParticipation(prev, { ...thread });

    // THEM no longer resolves — is_visible_profile() now hides them, same
    // shape as the ghost-thread case this filter already existed for.
    const visible = visibleParticipations(updated, ME, new Set(), true);
    expect(visible.find((p) => p.id === 1)).toBeUndefined();
  });

  it("keeps a thread visible when the other party still resolves", () => {
    const thread = { id: 1, fromUser: ME, toUser: THEM, status: "accepted" as const };
    const updated = upsertParticipation([thread], { ...thread, status: "accepted" as const });
    const visible = visibleParticipations(updated, ME, new Set([THEM]), true);
    expect(visible.map((p) => p.id)).toEqual([1]);
  });

  it("inserts a brand-new participation row at the front", () => {
    const existing = [{ id: 1, fromUser: ME, toUser: THEM }];
    const result = upsertParticipation(existing, { id: 2, fromUser: THEM, toUser: ME });
    expect(result.map((p) => p.id)).toEqual([2, 1]);
  });
});

describe("applyParticipationDelete", () => {
  it("removes a participation matching a live DELETE event's id", () => {
    const list = [{ id: 1 }, { id: 2 }];
    expect(applyParticipationDelete(list, 1).map((p) => p.id)).toEqual([2]);
  });

  it("ignores a DELETE for a participation not already in local state (e.g. someone else's join_in leave)", () => {
    const list = [{ id: 1 }, { id: 2 }];
    expect(applyParticipationDelete(list, 999)).toEqual(list);
  });
});

describe("isRelevantParticipationEvent", () => {
  const knownIds = new Set(["1", "2"]);

  it("is relevant when I'm the from_user", () => {
    expect(isRelevantParticipationEvent("INSERT", { id: 99, from_user: ME, to_user: THEM }, ME, knownIds)).toBe(true);
  });

  it("is relevant when I'm the to_user", () => {
    expect(isRelevantParticipationEvent("UPDATE", { id: 99, from_user: THEM, to_user: ME }, ME, knownIds)).toBe(true);
  });

  it("is relevant when the row is already in local state, even if neither party is me", () => {
    expect(isRelevantParticipationEvent("UPDATE", { id: 1, from_user: THEM, to_user: "other" }, ME, knownIds)).toBe(
      true,
    );
  });

  it("is NOT relevant for a stranger's public join_in I have no stake in — the case that used to trigger a full refresh", () => {
    expect(
      isRelevantParticipationEvent("INSERT", { id: 99, from_user: "stranger", to_user: undefined }, ME, knownIds),
    ).toBe(false);
  });

  it("DELETE is judged by local state alone, since it carries no from_user/to_user", () => {
    expect(isRelevantParticipationEvent("DELETE", { id: 1 }, ME, knownIds)).toBe(true);
    expect(isRelevantParticipationEvent("DELETE", { id: 999 }, ME, knownIds)).toBe(false);
  });
});
