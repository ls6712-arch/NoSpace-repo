import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { supabase } from "../../lib/supabase";
import { useCategories } from "../context/CategoriesContext";
import { LEGACY_SPACES } from "../data/hobbies";
import { NotFound } from "./NotFound";
import { SpacePage } from "./SpacePage";
import type { SpaceRow } from "../lib/spaces";

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
    return <div className="min-h-[60vh]" />;
  }
  if (space === null) {
    return <NotFound />;
  }
  return <SpacePage space={space} />;
}
