import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { router } from "../routes";

/**
 * For tests: the app's real route table (paths and handles) with every screen
 * replaced by `element`, rendered at `path`. Lets a component that reads the
 * route handle (the tab bar, the rail, the back chevron) see exactly what it
 * sees in the app, without loading any page.
 */
function strip(routes: RouteObject[], element: ReactElement): RouteObject[] {
  return routes.flatMap((r): RouteObject[] => {
    const kids = r.children ? strip(r.children, element) : [];
    // A pathless wrapper (the shell, the error boundary group) only contributes its children.
    if (!r.path && !r.index) return kids;
    if (r.index) return [{ index: true, handle: r.handle, element }];
    return [{ path: r.path, handle: r.handle, element, children: kids.length ? kids : undefined }];
  });
}

export function RouterAt({ path, element }: { path: string; element: ReactElement }) {
  const r = createMemoryRouter(strip(router.routes as unknown as RouteObject[], element), { initialEntries: [path] });
  return <RouterProvider router={r} />;
}
