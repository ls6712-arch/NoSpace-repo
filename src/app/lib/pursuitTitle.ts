import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * A Moment's `{Pursuit}` label in the panel header needs the OTHER
 * person's Pursuit title — something no existing fetch joins in (posts are
 * loaded with a plain `select("*")`, ContentContext.tsx). Rather than add a
 * join that reshapes every post everywhere, this is a small, cached,
 * on-demand lookup against the same `public.pursuits` table the app
 * already reads elsewhere (sql/pursuits.sql) — RLS already lets anyone read
 * a Pursuit marked `shared`, which is the only kind that could appear in
 * someone else's Moment panel to begin with.
 */
const cache = new Map<string, string | null>();

export function usePursuitTitle(pursuitId: string | undefined): string | undefined {
  const [title, setTitle] = useState<string | undefined>(
    pursuitId ? cache.get(pursuitId) ?? undefined : undefined,
  );

  useEffect(() => {
    if (!pursuitId || !supabase) return;
    if (cache.has(pursuitId)) {
      setTitle(cache.get(pursuitId) ?? undefined);
      return;
    }
    let cancelled = false;
    supabase
      .from("pursuits")
      .select("title")
      .eq("id", pursuitId)
      .maybeSingle()
      .then(({ data }) => {
        const found = (data?.title as string | undefined) ?? null;
        cache.set(pursuitId, found);
        if (!cancelled) setTitle(found ?? undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [pursuitId]);

  return title;
}
