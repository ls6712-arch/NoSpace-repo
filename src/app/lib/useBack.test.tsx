// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, Link, matchRoutes, RouterProvider, useLocation, type RouteObject } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { useBack } from "./useBack";
import { cornerParentPath, rememberCornerCategory } from "./cornerParent";
import { router as appRouter } from "../routes";
import type { RouteHandle } from "./routeHandle";

afterEach(cleanup);

function Screen({ name }: { name: string }) {
  const goBack = useBack();
  const loc = useLocation();
  return (
    <div>
      <p data-testid="where">{`${name}|${loc.pathname}${loc.search}`}</p>
      <button type="button" onClick={goBack}>
        back
      </button>
      <Link to="/page">to page</Link>
      <Link to="/other">to other</Link>
    </div>
  );
}

const routes = (flowParent = "/home") => [
  { path: "/home", element: <Screen name="home" />, handle: { kind: "tab", tab: "my-space" } satisfies RouteHandle },
  { path: "/other", element: <Screen name="other" />, handle: { kind: "page", parent: () => "/home" } satisfies RouteHandle },
  { path: "/page", element: <Screen name="page" />, handle: { kind: "page", parent: (_p: unknown, s: URLSearchParams) => (s.get("from") === "x" ? "/other" : "/home") } satisfies RouteHandle },
  { path: "/flow", element: <Screen name="flow" />, handle: { kind: "flow", parent: () => flowParent } satisfies RouteHandle },
  { path: "/bare", element: <Screen name="bare" /> },
];

const where = () => screen.getByTestId("where").textContent;
const press = (name: string) => act(() => screen.getByRole("button", { name }).click());
const follow = (name: string) => act(() => screen.getByRole("link", { name }).click());

describe("useBack", () => {
  it("steps back through history when you moved inside the app", () => {
    const r = createMemoryRouter(routes(), { initialEntries: ["/home"] });
    render(<RouterProvider router={r} />);
    follow("to other");
    follow("to page");
    expect(where()).toBe("page|/page");
    press("back");
    expect(where()).toBe("other|/other");
    press("back");
    expect(where()).toBe("home|/home");
  });

  it("goes to the declared parent on the first page of the visit, replacing the entry", () => {
    const r = createMemoryRouter(routes(), { initialEntries: ["/page?from=x"] });
    render(<RouterProvider router={r} />);
    expect(r.state.location.key).toBe("default");
    press("back");
    expect(where()).toBe("other|/other");
    // Replaced, not pushed: there is nothing behind it to bounce back to.
    expect(r.state.historyAction).toBe("REPLACE");
  });

  it("does the same for a flow opened first", () => {
    const r = createMemoryRouter(routes("/home"), { initialEntries: ["/flow"] });
    render(<RouterProvider router={r} />);
    press("back");
    expect(where()).toBe("home|/home");
  });

  it("falls back to the landing page when a screen declares no parent", () => {
    const r = createMemoryRouter([...routes(), { path: "/", element: <Screen name="landing" /> }], { initialEntries: ["/bare"] });
    render(<RouterProvider router={r} />);
    press("back");
    expect(where()).toBe("landing|/");
  });

  it("never reads window.history.length", () => {
    const r = createMemoryRouter(routes(), { initialEntries: ["/page"] });
    const spy = Object.getOwnPropertyDescriptor(History.prototype, "length");
    let read = false;
    Object.defineProperty(History.prototype, "length", { configurable: true, get: () => ((read = true), 1) });
    try {
      render(<RouterProvider router={r} />);
      press("back");
    } finally {
      if (spy) Object.defineProperty(History.prototype, "length", spy);
    }
    expect(read).toBe(false);
  });
});

describe("a Corner opened on a shared link", () => {
  const cornerHandle = () => {
    const find = (rs: { path?: string; handle?: RouteHandle; children?: unknown[] }[]): RouteHandle | undefined => {
      for (const r of rs) {
        if (r.path === "corners/:slug") return r.handle;
        const hit = find((r.children ?? []) as never);
        if (hit) return hit;
      }
    };
    return find(appRouter.routes as never)!;
  };

  it("goes back to its group, never out of the app", () => {
    rememberCornerCategory("pottery", "crafts-diy");
    expect(cornerHandle().parent!({ slug: "pottery" }, new URLSearchParams())).toBe("/browse/crafts-diy");
  });

  it("goes to the Corners page when its group is not known", () => {
    expect(cornerParentPath("no-such-corner")).toBe("/corners");
  });
});

describe("the tab each route belongs to is what the bar used to highlight", () => {
  // The prefix rules the bar, the rail and the header each carried before routes said so themselves.
  const old = {
    "my-space": (p: string) => p.startsWith("/my-space"),
    discover: (p: string) => p.startsWith("/discover") || p.startsWith("/corners") || p.startsWith("/browse") || p.startsWith("/space") || p.startsWith("/people"),
    create: (p: string) => p.startsWith("/create") || p.startsWith("/log"),
    calendar: (p: string) => p.startsWith("/calendar") || p.startsWith("/week"),
    you: (p: string) => p.startsWith("/you"),
  } as const;
  const paths = ["/my-space", "/my-space/all", "/discover", "/corners", "/corners/pottery", "/browse/crafts-diy", "/space/crafting", "/space/crafting/edit", "/people", "/create", "/create-space", "/calendar", "/week/free", "/you", "/you/work/pottery", "/search", "/settings", "/inbox", "/messages", "/pursuit/1", "/pursuit/1/recap", "/moment/1", "/u/mia", "/studio", "/pursuits/new", "/start/a/b", "/shop", "/"];

  it.each(paths)("%s", (path) => {
    const match = findHandle(path);
    const expected = (Object.keys(old) as (keyof typeof old)[]).find((k) => old[k](path));
    // "inbox" has no slot on the bar (the header's bell and chats), so nothing was ever highlighted for it.
    expect(match?.tab === "inbox" ? undefined : match?.tab).toBe(expected);
  });
});

function findHandle(path: string): RouteHandle | undefined {
  const m = matchRoutes(appRouter.routes as unknown as RouteObject[], path);
  return m?.at(-1)?.route.handle as RouteHandle | undefined;
}
