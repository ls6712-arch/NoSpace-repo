// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { CORNERS_URL, cornerUrl } from "../../../api/mcp";
import { hobbies } from "../data/hobbies";
import { router } from "../routes";

/** api/mcp.ts hands these links to AI assistants: each must be an address the app still serves. */
describe("MCP endpoint links", () => {
  type Node = { path?: string; children?: Node[] };
  const walk = (nodes: Node[]): (string | undefined)[] => nodes.flatMap((r) => [r.path, ...walk(r.children ?? [])]);
  const paths = walk(router.routes as Node[]);

  it("a hobby links to its Corner page, a route that exists", () => {
    expect(paths).toContain("corners/:slug");
    expect(cornerUrl("pottery")).toBe("https://www.onsoosh.com/#/corners/pottery");
    expect(cornerUrl("a b")).toBe("https://www.onsoosh.com/#/corners/a%20b");
  });

  it("the list of groups links to the Corners page, a route that exists", () => {
    expect(paths).toContain("corners");
    expect(CORNERS_URL).toBe("https://www.onsoosh.com/#/corners");
  });

  it("no link points at an old group page, which only redirects to Discover", () => {
    for (const h of hobbies) {
      expect(CORNERS_URL).not.toContain(`/space/${h.slug}`);
      for (const item of h.subItems) expect(cornerUrl(item.slug)).not.toContain("/space/");
    }
  });
});
