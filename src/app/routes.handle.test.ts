// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { router } from "./routes";
import type { RouteHandle } from "./lib/routeHandle";

interface R {
  path?: string;
  index?: boolean;
  handle?: RouteHandle;
  children?: R[];
  lazy?: unknown;
  Component?: unknown;
  element?: unknown;
}

/** Every route that renders a screen, with the full path it answers to. */
function screens(routes: R[], base = ""): { path: string; route: R }[] {
  return routes.flatMap((r) => {
    const here = r.path ? `${base}/${r.path}`.replace(/\/+/g, "/") : base;
    const own = r.Component || r.lazy || r.element ? [{ path: r.index ? base || "/" : here, route: r }] : [];
    return [...own, ...screens(r.children ?? [], here)];
  });
}

// The shell route (Root) has children, so it is not a screen; a screen is a leaf. Redirects have no component, so they never appear.
const all = screens(router.routes as unknown as R[]);
const exempt = (p: string) => p === "/*" || p === "*" || p.startsWith("/dev/") || p.startsWith("/landing-preview/");
const mustHave = all.filter((s) => !exempt(s.path) && !(s.route.children && s.route.children.length > 0));

describe("every route says what kind of screen it is", () => {
  it("finds the screens", () => {
    expect(mustHave.length).toBeGreaterThan(40);
  });

  it.each(mustHave.map((s) => [s.path, s.route] as const))("%s has a handle", (path, route) => {
    expect(route.handle, `${path} has no handle`).toBeTruthy();
    expect(["tab", "page", "flow"]).toContain(route.handle!.kind);
  });

  it.each(mustHave.map((s) => [s.path, s.route] as const))("%s: a page or flow names its parent", (path, route) => {
    if (route.handle?.kind === "page" || route.handle?.kind === "flow") {
      expect(typeof route.handle.parent, `${path} is a ${route.handle.kind} with no parent`).toBe("function");
      const parent = route.handle.parent!({ slug: "x", id: "x", username: "x", spaceSlug: "x", cornerSlug: "x", token: "x", hobbyKey: "x" }, new URLSearchParams());
      expect(parent.startsWith("/")).toBe(true);
    }
  });

  it("a tab screen names only tabs the bar knows", () => {
    const tabs = new Set(["my-space", "discover", "create", "calendar", "inbox", "you", undefined]);
    for (const s of mustHave) expect(tabs.has(s.route.handle!.tab), s.path).toBe(true);
  });
});
