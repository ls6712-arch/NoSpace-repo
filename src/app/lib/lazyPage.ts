import type { ComponentType } from "react";

const RELOAD_KEY = "soosh.chunkReload";

/**
 * A route loaded on first visit. After a new deploy the old file names are
 * gone, so a tab that has been open since before it can fail to fetch a page
 * it never loaded. That is fixed by loading the app again, once: a second
 * failure within a minute is a real error and is thrown to the crash screen.
 */
export function page<M extends Record<string, unknown>>(
  load: () => Promise<M>,
  name: Extract<keyof M, string>,
): () => Promise<{ Component: ComponentType }> {
  return async () => {
    try {
      const mod = await load();
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* storage can be blocked */
      }
      return { Component: mod[name] as ComponentType };
    } catch (err) {
      let recent = false;
      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        recent = Date.now() - last < 60_000;
        if (!recent) sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch {
        recent = true;
      }
      if (!recent) {
        window.location.reload();
        // Hold the navigation until the reload takes over.
        return new Promise<never>(() => {});
      }
      throw err;
    }
  };
}
