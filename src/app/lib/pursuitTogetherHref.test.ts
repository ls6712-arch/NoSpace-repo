import { describe, expect, it } from "vitest";
import { pursuitTogetherHref } from "./pursuitsRemote";

describe("pursuitTogetherHref (Step 4c)", () => {
  it("pre-invites the author, remembers the moment, and seeds the title", () => {
    const href = pursuitTogetherHref({ id: 42, userId: "abc-123", caption: "Sourdough round two. Much better crumb." });
    const url = new URL(href, "https://x.test");
    expect(url.pathname).toBe("/pursuits/new");
    expect(url.searchParams.get("with")).toBe("abc-123");
    expect(url.searchParams.get("from")).toBe("42");
    expect(url.searchParams.get("title")).toBe("Sourdough round two");
  });

  it("leaves the title out when the caption is empty", () => {
    const url = new URL(pursuitTogetherHref({ id: 7, userId: "u1", caption: "" }), "https://x.test");
    expect(url.searchParams.has("title")).toBe(false);
  });
});
