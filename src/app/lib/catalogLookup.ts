import { CATALOG_CORNERS, CATALOG_ALIAS_ADDITIONS, CATALOG_EXISTING_META, type CatalogCorner } from "../data/catalogCorners";
import { getSubHobby, titleCaseSlug } from "../data/hobbies";
import { normalize } from "./tagMatching";

export interface CatalogHit {
  spaceSlug: string;
  slug: string;
  name: string;
}

/**
 * Finds the Corner a typed name means, by name or any alias from the catalog
 * (case, accents and punctuation ignored): a catalog Corner, or a Corner that
 * already existed and took the catalog row's names as aliases ("wheel throwing"
 * is Pottery). Returns undefined when nothing is called that, so a genuinely
 * new name still creates a Corner. Alias wording lives in data/corners_catalog.csv.
 */
export function catalogCornerByName(text: string, spaceSlug?: string): CatalogHit | undefined {
  const q = normalize(text);
  if (!q) return undefined;
  const pool: CatalogCorner[] = spaceSlug ? CATALOG_CORNERS.filter((c) => c.spaceSlug === spaceSlug) : [...CATALOG_CORNERS];
  const own = pool.find((c) => normalize(c.name) === q) ?? pool.find((c) => c.aliases.some((a) => normalize(a) === q));
  if (own) return { spaceSlug: own.spaceSlug, slug: own.slug, name: own.name };
  for (const [key, names] of Object.entries(CATALOG_ALIAS_ADDITIONS)) {
    const [space, slug] = key.split("/");
    if (spaceSlug && space !== spaceSlug) continue;
    if (!names.some((n) => normalize(n) === q)) continue;
    const label = getSubHobby(space, slug)?.label ?? titleCaseSlug(slug);
    return { spaceSlug: space, slug, name: label };
  }
  return undefined;
}

/** Extra names for a Corner that already existed before the catalog ("space/slug" key). */
export function aliasesForExisting(spaceSlug: string, slug: string): string[] {
  return [...(CATALOG_ALIAS_ADDITIONS[`${spaceSlug}/${slug}`] ?? [])];
}

/** The catalog's nyc_fit and season for a Corner that already existed (merged or held-out rows). */
export function metaForExisting(spaceSlug: string, slug: string) {
  return CATALOG_EXISTING_META[`${spaceSlug}/${slug}`];
}
