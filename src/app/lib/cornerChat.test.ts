import { describe, expect, it } from "vitest";
import { chatFolder, cornerTabs, firstName, groupMessages, mergeMessages, presenceLine, resolveTab, type ChatMessage } from "./cornerChat";

const msg = (id: number, userId: string, at: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  userId,
  body: `m${id}`,
  mediaPaths: [],
  createdAt: Date.parse(at),
  removed: false,
  ...over,
});

describe("presenceLine", () => {
  it("is hidden when nobody else is here", () => {
    expect(presenceLine([])).toBeNull();
  });
  it("names up to three people, then others", () => {
    expect(presenceLine(["Maya"])).toBe("Maya is here now");
    expect(presenceLine(["Maya", "Sam"])).toBe("Maya and Sam are here now");
    expect(presenceLine(["Maya", "Sam", "Lee"])).toBe("Maya, Sam and Lee are here now");
    expect(presenceLine(["Maya", "Sam", "Lee", "Priya", "Jo"])).toBe("Maya, Sam and others are here now");
  });
  it("never has a digit, however many people are here", () => {
    for (let n = 1; n <= 40; n++) {
      const line = presenceLine(Array.from({ length: n }, (_, i) => ["Maya", "Sam", "Lee", "Priya"][i % 4]));
      expect(line).not.toMatch(/\d/);
    }
  });
});

describe("firstName", () => {
  it("keeps the first word only", () => {
    expect(firstName("Maya Chen")).toBe("Maya");
    expect(firstName("  Sam   Lee ")).toBe("Sam");
    expect(firstName(null)).toBe("");
  });
});

describe("tabs", () => {
  it("shows Chat to members and never to visitors", () => {
    expect(cornerTabs(false)).toEqual(["walls", "chat", "first"]);
    expect(cornerTabs(true)).toEqual(["walls", "first"]);
  });
  it("falls back for a visitor who had Chat remembered", () => {
    expect(resolveTab("chat", true)).toBe("first");
    expect(resolveTab("chat", false)).toBe("chat");
    expect(resolveTab("auto", false)).toBe("walls");
    expect(resolveTab("auto", true)).toBe("first");
  });
});

describe("groupMessages", () => {
  it("groups by day, then by sender, oldest first, and leaves removed ones out", () => {
    const groups = groupMessages([
      msg(4, "b", "2026-11-09T12:00:00"),
      msg(1, "a", "2026-11-08T10:00:00"),
      msg(2, "a", "2026-11-08T10:01:00"),
      msg(3, "b", "2026-11-08T10:02:00"),
      msg(5, "b", "2026-11-09T12:05:00", { removed: true, body: "" }),
    ]);
    expect(groups.map((g) => g.runs.map((r) => [r.userId, r.messages.map((m) => m.id)]))).toEqual([
      [["a", [1, 2]], ["b", [3]]],
      [["b", [4]]],
    ]);
  });
});

describe("mergeMessages", () => {
  it("replaces by id and never brings a removed message back", () => {
    const removed = msg(1, "a", "2026-11-08T10:00:00", { removed: true, body: "" });
    const merged = mergeMessages([removed], [msg(1, "a", "2026-11-08T10:00:00"), msg(2, "a", "2026-11-08T10:01:00")]);
    expect(merged.map((m) => [m.id, m.removed])).toEqual([[1, true], [2, false]]);
  });
});

describe("chatFolder", () => {
  it("spells the key without a colon", () => {
    expect(chatFolder("crafts-making:embroidery")).toBe("crafts-making_embroidery");
  });
});
