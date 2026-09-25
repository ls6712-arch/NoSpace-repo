import { describe, expect, it } from "vitest";
import { messageTabFor } from "./messageTabs";

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
});
