import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { supabase } from "../../lib/supabase";
import { useCategories } from "../context/CategoriesContext";
import { LEGACY_SPACES } from "../data/hobbies";
import { NotFound } from "./NotFound";
import { SpacePage } from "./SpacePage";
import type { SpaceRow } from "../lib/spaces";
import { Loadable, Skeleton } from "../components/ui/skeleton";
import { MomentCardSkeleton } from "../components/Skeletons";

/**
 * /space/:slug is shared between two unrelated things that happen to have
 * used the word "Space" at different points in this app's history: the
 * pre-rework Category/hobby-area pages (still reachable by their old
 * slugs, e.g. "crafts-making", "workbench") and this rework's real,
 * host-created Spaces. A real Space's slug can never collide with a
 * reserved one (spaces_slug_not_reserved, enforced at creation), so the
 * two are always unambiguous — this just has to ask which kind :slug is.
 *
 * Categories are internal-only now (nobody picks one directly, per this
 * rework's own spec) — a reserved slug redirects to /discover rather than
 * rendering the old CategoryFeed page, which nothing else links to
 * anymore either.
 */
export function SpaceRoute() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { categories } = useCategories();
  const [space, setSpace] = useState<SpaceRow | null | "loading">("loading");

  const reserved = categories.some((c) => c.slug === slug) || slug in LEGACY_SPACES;

  useEffect(() => {
    if (reserved) {
      navigate("/discover", { replace: true });
      return;
    }
    let cancelled = false;
    async function load() {
      if (!supabase) {
        if (!cancelled) setSpace(null);
        return;
      }
      const { data } = await supabase.from("spaces").select("*").eq("slug", slug).maybeSingle();
      if (!cancelled) setSpace((data as SpaceRow) ?? null);
    }
    setSpace("loading");
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, reserved]);

  if (reserved || space === "loading") {
    return <SpacePageSkeleton />;
  }
  if (space === null) {
    return <NotFound />;
  }
  return <SpacePage space={space} />;
}

/** Holds the Space page's shape (cover, name, meta, Table) while it loads. */
function SpacePageSkeleton() {
  return (
    <Loadable
      loading
      className="ns-space-theme min-h-screen bg-background pb-24"
      skeleton={
        <>
          <div className="mx-auto w-full max-w-3xl px-4 pt-4">
            <Skeleton className="aspect-[21/9] max-h-56 w-full rounded-2xl sm:aspect-[3/1]" />
          </div>
          <div className="mx-auto w-full max-w-3xl px-4 pt-5">
            <Skeleton className="h-3 w-28 rounded-full" />
            <div className="mt-1 flex h-[44px] items-center sm:h-[50px] lg:h-[80px]">
              <Skeleton className="h-9 w-2/3 rounded-full lg:h-14" />
            </div>
            <Skeleton className="mt-3 h-3 w-1/2 rounded-full" />
            <Skeleton className="mt-5 h-3 w-40 rounded-full" />
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <MomentCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </>
      }
    >
      {null}
    </Loadable>
  );
}
