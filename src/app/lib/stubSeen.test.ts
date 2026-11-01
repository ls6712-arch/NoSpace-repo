import { describe, expect, it } from "vitest";
import { highestId, stubToReveal } from "./stubSeen";

const items = [
  { id: 3, kind: "finish" },
  { id: 5, kind: "event" },
  { id: 7, kind: "event" },
  { id: 9, kind: "regular" },
];

describe("stubToReveal", () => {
  it("reveals nothing on a first visit", () => expect(stubToReveal(items, null)).toBeNull());
  it("reveals the newest unseen Was there Stub", () => expect(stubToReveal(items, 4)?.id).toBe(7));
  it("ignores kinds that reveal where they are earned", () => expect(stubToReveal(items, 7)).toBeNull());
  it("finds the highest id to remember", () => expect(highestId(items)).toBe(9));
});
