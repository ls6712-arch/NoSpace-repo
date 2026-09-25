import { describe, expect, it } from "vitest";
import { canSendInto, messageTabFor } from "./messageTabs";

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

  it("puts a declined direct_message someone sent me in chats too — I can still message them to un-decline it", () => {
    expect(
      messageTabFor({ kind: "direct_message", status: "declined", fromUser: THEM, toUser: ME }, ME),
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
