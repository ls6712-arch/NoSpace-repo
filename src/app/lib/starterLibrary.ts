import catalog from "../data/starterContent.json";
import { CORNER_IDEAS } from "../data/cornerIdeas";
import { canonicalCorner, isBrowsableCorner, subHobbyLabel } from "../data/hobbies";
import { isSafeResourceUrl, type CornerResource, type StarterPursuit } from "./starterContent";

export type StarterCollection = "resources" | "pursuits";
export const COLLECTION_PARAMS = ["browse", "browseQuery", "browseCorner"] as const;

function canonicalKey(key: string) {
  const [space, slug] = key.split("/");
  const c = canonicalCorner(space, slug ?? "");
  return `${c.spaceSlug}/${c.slug}`;
}

// This public editorial library does not expose adults-only Corners or depend
// on which unfollowed Corners happened to load in the recommendation carousel.
function publicCorner(key: string) {
  const canonical = canonicalKey(key);
  const [space, slug] = canonical.split("/");
  return !!CORNER_IDEAS[canonical] && !CORNER_IDEAS[canonical].adultsOnly && isBrowsableCorner(space, slug);
}

export function starterKeys(item: CornerResource | StarterPursuit): string[] {
  return ("corner_keys" in item ? item.corner_keys : [item.corner_key]).map(canonicalKey);
}

export function starterCornerLabel(key: string) {
  return subHobbyLabel(canonicalKey(key).split("/")[1]) ?? "";
}

export function publicStarterLibrary() {
  const seenUrls = new Set<string>();
  const resources = catalog.resources.flatMap(item => {
    if (!isSafeResourceUrl(item.url)) return [];
    const url = new URL(item.url).href;
    if (seenUrls.has(url)) return [];
    const corner_keys = [...new Set(starterKeys(item).filter(publicCorner))];
    if (!corner_keys.length) return [];
    seenUrls.add(url);
    return [{ ...item, corner_keys }];
  });
  const pursuits = catalog.pursuits.filter(item => publicCorner(item.corner_key));
  const keys = [...new Set([...resources, ...pursuits].flatMap(starterKeys))];
  const corners = keys.map(key => ({ key, label: starterCornerLabel(key) })).sort((a, b) => a.label.localeCompare(b.label));
  return { resources, pursuits, corners };
}

/** Editorial defaults, with a stable catalog fallback when a featured entry is removed. */
function preferred<T extends { id: string }>(items: T[], ids: string[]) {
  return [...items].sort((a, b) => {
    const rank = (id: string) => ids.includes(id) ? ids.indexOf(id) : ids.length;
    return rank(a.id) - rank(b.id);
  });
}

export function starterPreviews(library = publicStarterLibrary()) {
  return {
    resources: preferred(library.resources, ["standard-ebooks", "public-domain-review", "chrome-music-lab"]).slice(0, 3),
    pursuits: preferred(library.pursuits, ["reading-pursuit-01", "painting-pursuit-01"]).slice(0, 2),
  };
}

export function matchesStarter(item: CornerResource | StarterPursuit, query: string, corner: string) {
  const keys = starterKeys(item);
  if (corner && !keys.includes(canonicalKey(corner))) return false;
  const text = ["name" in item ? item.name : item.title, item.description, ...keys.map(starterCornerLabel)].join(" ").toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).every(word => text.includes(word));
}

export function readStarterBrowse(params: URLSearchParams, library = publicStarterLibrary()) {
  const raw = params.get("browse");
  const kind: StarterCollection | null = raw === "resources" || raw === "pursuits" ? raw : null;
  const key = canonicalKey(params.get("browseCorner") ?? "");
  return {
    kind,
    query: (params.get("browseQuery") ?? "").slice(0, 160),
    corner: library.corners.some(c => c.key === key) ? key : "",
  };
}

export function starterBrowseParams(params: URLSearchParams, kind: StarterCollection | null) {
  const next = new URLSearchParams(params);
  for (const key of COLLECTION_PARAMS) next.delete(key);
  if (kind) next.set("browse", kind);
  return next;
}

export function starterCover(key: string) {
  return catalog.covers.find(item => canonicalKey(item.corner_key) === canonicalKey(key));
}
