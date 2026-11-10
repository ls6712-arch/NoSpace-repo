import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { useRouteHandle } from "./routeHandle";

/** Where back goes when there is nothing inside the app to go back to and the screen declares no parent. */
const FALLBACK_PARENT = "/";

/**
 * The one way back. Back goes where you came from, never "up":
 *  - If you got here by moving inside the app, step back through history.
 *  - If this is the first page of the visit (a shared link, a reload into a
 *    deep page), go to the screen's declared parent instead, replacing the
 *    entry so back never loops and never leaves the app.
 *
 * `location.key` is "default" only for the first entry of a session, which is
 * exactly "nothing in the app before this". window.history.length is never
 * used: it counts pages from other sites too.
 */
export function useBack(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  const { handle, params } = useRouteHandle();
  const { key, search } = location;

  return useCallback(() => {
    if (key !== "default") {
      navigate(-1);
      return;
    }
    const parent = handle?.parent ? handle.parent(params, new URLSearchParams(search)) : FALLBACK_PARENT;
    navigate(parent, { replace: true });
  }, [key, search, handle, params, navigate]);
}
