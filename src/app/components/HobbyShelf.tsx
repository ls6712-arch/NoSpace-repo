import { Link } from "react-router";
import { Post, postCorner } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { getHobby, hobbies, subHobbyLabel, titleCaseSlug } from "../data/hobbies";
import { useCornerNote } from "../lib/cornerNotes";
import { SubHobbyArt } from "./SubHobbyArt";
import { PostMedia } from "./PostMedia";

/** The card's own dark ink color — the cream card is a deliberate,
 * contained exception to the app's dark surfaces (same pairing the flat
 * illustrations already use), so its text needs to be dark-on-cream, not
 * the page's light-on-dark foreground tokens. Local to this file now: only
 * the "By Corner" view still groups by Space/Corner (and so still wants a
 * per-Corner color), since the All-moments grid (WorkGrid.tsx) reads tags
 * with one neutral pill instead — see Fix 1-2. */
export const INK = "#3A2A1F";

/** A colored tag per Space, cycling through the brand's warm-hue tokens —
 * same idea as this file's own book-spine colors. A few Spaces get an
 * explicit color instead of the rotation where one obviously fits (mustard
 * for cooking, green for anything craft-adjacent, plum for travel). */
const TAG_TINTS = [
  "color-mix(in srgb, var(--yellow) 78%, black)",
  "var(--sky-deep)",
  "var(--forest)",
  "var(--coral-deep)",
  "var(--plum)",
];
const TAG_TINT_OVERRIDES: Record<string, string> = {
  "food-cooking": TAG_TINTS[0],
  "art-creative": "var(--forest)",
  "crafts-making": "var(--forest)",
  "travel-adventure": "var(--plum)",
};
export function tagTint(hobbySlug: string) {
  if (TAG_TINT_OVERRIDES[hobbySlug]) return TAG_TINT_OVERRIDES[hobbySlug];
  const idx = hobbies.findIndex((h) => h.slug === hobbySlug);
  return TAG_TINTS[(idx < 0 ? 0 : idx) % TAG_TINTS.length];
}

export interface HobbySession {
  /** Sub-hobby slug where tagged, else `space:<slug>` for untagged entries. */
  key: string;
  label: string;
  hobbySlug: string;
  subSlug?: string;
  /** One session is one logged moment. */
  sessions: number;
  firstAt: number;
  lastAt: number;
  /** The most recently uploaded real photo/video in this hobby, if any —
   * this is what the Corner tile's cover should show. Falls back to the
   * illustration when nothing real has been uploaded yet. */
  lastMediaUrl?: string;
  lastMediaType?: "photo" | "video";
  lastMediaId?: number;
  /** Internal — timestamp used to pick the newest real upload above. */
  lastMediaAt?: number;
}

/** URL-safe id for a hobby book, used as the Hobby Archive route param. A
 * Corner slug is only unique within its own Space — a self-serve tag isn't
 * checked against every other Space's — so once there's a subSlug the Space
 * has to travel with it in the key, or two different Spaces' same-named
 * Corner collide/misresolve. `corner-<space>~<slug>` carries both; `~` never
 * appears in a slug so the split below is unambiguous. `space-<slug>` (no
 * Corner) is unchanged. */
export function archiveKey(item: { subSlug?: string; hobbySlug: string }) {
  return item.subSlug ? `corner-${item.hobbySlug}~${item.subSlug}` : `space-${item.hobbySlug}`;
}

/** Resolves an archive route param back into a hobby tag and its parent
 * Space. Three shapes: the current `corner-<space>~<slug>` format (Space
 * travels with the slug, so a freeform Corner resolves via titleCaseSlug
 * even when it isn't one of the curated subItems below); older bare-slug
 * links from before that, which only ever resolved a curated subItem
 * anyway, kept working by searching every Space's fixed list as before; and
 * `space-<slug>` for an untagged archive. */
export function parseArchiveKey(param: string) {
  if (param.startsWith("space-")) {
    const hobbySlug = param.slice("space-".length);
    const space = getHobby(hobbySlug);
    if (!space) return null;
    return { hobbySlug, subSlug: undefined, label: space.shortName };
  }
  if (param.startsWith("corner-")) {
    const rest = param.slice("corner-".length);
    const sep = rest.indexOf("~");
    if (sep === -1) return null;
    const hobbySlug = rest.slice(0, sep);
    const subSlug = rest.slice(sep + 1);
    const space = getHobby(hobbySlug);
    if (!space || !subSlug) return null;
    return { hobbySlug, subSlug, label: subHobbyLabel(subSlug) ?? titleCaseSlug(subSlug) };
  }
  // Legacy links made before a Corner's Space traveled with it in the key —
  // can only ever land on a curated subItem, since a freeform Corner was
  // never resolvable without knowing its Space up front.
  for (const space of hobbies) {
    const sub = space.subItems.find((s) => s.slug === param);
    if (sub) return { hobbySlug: space.slug, subSlug: sub.slug, label: sub.label };
  }
  return null;
}

/** True only for a real, loadable upload — not a generated-art placeholder. */
function hasRealMedia(post: Post) {
  return !!post.media && /^https?:\/\//.test(post.media);
}

/** Turns a set of logged moments into per-hobby books, most-logged first. */
export function sessionsFromPosts(posts: Post[]): HobbySession[] {
  const tally = new Map<string, HobbySession>();
  for (const post of posts) {
    // postCorner(), not post.subHobby directly — a Moment retagged to a
    // different Corner via the composer only ever writes post.corner, and
    // subHobby-only grouping never saw that change (the bug this fixes).
    const corner = postCorner(post);
    const key = corner ?? `space:${post.hobbySlug}`;
    const existing = tally.get(key);
    if (existing) {
      existing.sessions += 1;
      existing.firstAt = Math.min(existing.firstAt, post.createdAt);
      existing.lastAt = Math.max(existing.lastAt, post.createdAt);
      // The cover should be whichever real upload is newest, independent of
      // whether the very latest moment happened to be a text-only note.
      if (hasRealMedia(post) && post.createdAt >= (existing.lastMediaAt ?? 0)) {
        existing.lastMediaUrl = post.media;
        // hasRealMedia(post) rules out "written" (it never carries a real
        // upload), so this is always "photo" or "video" here.
        existing.lastMediaType = post.type as "photo" | "video";
        existing.lastMediaId = post.id;
        existing.lastMediaAt = post.createdAt;
      }
      continue;
    }
    tally.set(key, {
      key,
      // subHobbyLabel only resolves a curated subItem; a freeform Corner
      // (self-serve, not in the fixed hobbies[] list) falls back to its
      // title-cased slug rather than the raw dashed slug.
      label: corner
        ? subHobbyLabel(corner) ?? titleCaseSlug(corner)
        : getHobby(post.hobbySlug)?.shortName ?? post.hobbySlug,
      hobbySlug: post.hobbySlug,
      subSlug: corner,
      sessions: 1,
      firstAt: post.createdAt,
      lastAt: post.createdAt,
      lastMediaUrl: hasRealMedia(post) ? post.media : undefined,
      lastMediaType: hasRealMedia(post) ? (post.type as "photo" | "video") : undefined,
      lastMediaId: hasRealMedia(post) ? post.id : undefined,
      lastMediaAt: hasRealMedia(post) ? post.createdAt : undefined,
    });
  }
  return [...tally.values()].sort((a, b) => b.sessions - a.sessions || a.firstAt - b.firstAt);
}

/** Your own hobbies, counted. One session is one logged moment. */
export function useSessionsByHobby(): HobbySession[] {
  const { myPosts } = useContent();
  return sessionsFromPosts(myPosts);
}

/** "Updated today" reads better than a date for the thing you did this morning. */
export function updatedLabel(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 7) return `Updated ${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return `Updated ${w} ${w === 1 ? "week" : "weeks"} ago`;
  }
  return `Updated ${new Date(ts).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`;
}

/**
 * One Corner, built to the exact same cream-card treatment as an
 * All-moments card (WorkGrid.tsx): the cover (the most recent real photo
 * among that Corner's Moments, or the illustration when there isn't one —
 * no stock-photo tier in between that a hotlinked image could fail out of
 * invisibly) with the same colored, per-Space tag pill over its top-left
 * corner, the Corner's own name in the same serif below, and — if you've
 * written one, from the Corner's own detail view — your private note under
 * that in quiet, muted text. INK and tagTint are imported from WorkGrid
 * rather than redefined here, so a tile's tag always agrees with that same
 * Space's tag on an All-moments card.
 */
function CornerTile({
  item,
  linkTo,
}: {
  item: HobbySession;
  /** Where this tile opens. Defaults to your own archive. */
  linkTo?: (item: HobbySession) => string;
}) {
  const note = useCornerNote(item.key);

  return (
    <Link to={linkTo ? linkTo(item) : `/you/work/${archiveKey(item)}`} className="group flex h-full">
      {/* flex-col + h-full so this fills the grid row's height (CSS Grid
          already stretches every tile to match) — otherwise a Corner with
          no note was shorter than one with a note, exposing the dark page
          background below it and making the row look ragged. */}
      <div
        className="flex h-full w-full flex-col overflow-hidden border border-transparent bg-[var(--cream)] transition-colors group-hover:border-[var(--coral-deep)]"
        style={{ color: INK }}
      >
        <div className="relative aspect-square overflow-hidden">
          {item.lastMediaUrl ? (
            <PostMedia
              media={item.lastMediaUrl}
              type={item.lastMediaType}
              hobbySlug={item.hobbySlug}
              seed={item.lastMediaId ?? item.key}
              preview
              className="h-full w-full object-cover"
            />
          ) : (
            <SubHobbyArt
              hobbySlug={item.hobbySlug}
              subSlug={item.subSlug ?? ""}
              className="h-full w-full object-cover"
            />
          )}
          <span
            className="absolute left-2.5 top-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
            style={{ backgroundColor: tagTint(item.hobbySlug) }}
          >
            {item.label}
          </span>
        </div>
        <div className="flex-1 px-3.5 py-3">
          <p
            className="truncate text-sm leading-snug sm:text-base"
            style={{ fontFamily: "var(--font-serif)" }}
            title={item.label}
          >
            {item.label}
          </p>
          {note && (
            <p className="mt-0.5 truncate text-xs opacity-60" title={note}>
              {note}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Your work, shelved. One flat, gapless-feeling grid of every Corner you
 * have Moments in, most-recently-updated first — no Space-level grouping
 * here. Space stays the top-level structure everywhere else in the app
 * (Discover, the composer, Circles); this view is the one deliberate
 * exception, since its whole point is to browse by the more specific thing
 * rather than re-derive the Space hierarchy a click away on every other tab.
 */
export function HobbyShelf({
  items: override,
  linkTo,
  emptyCopy,
  emptyCta = true,
}: {
  items?: HobbySession[];
  /**
   * Where each tile opens. On your own profile that's your archive; on
   * someone else's it has to stay on their profile, or you end up looking at
   * your own empty Corner wondering where their work went.
   */
  linkTo?: (item: HobbySession) => string;
  emptyCopy?: string;
  emptyCta?: boolean;
} = {}) {
  const derived = useSessionsByHobby();
  const items = override ?? derived;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {emptyCopy ??
            "Your shelf is empty. Every hobby you log gets its own tile here, with everything you've made in it inside."}
        </p>
        {emptyCta && (
          <Link
            to="/create"
            className="mt-4 inline-block rounded-full px-5 py-2 text-sm text-white [background-color:var(--coral-deep)]"
          >
            Create your first moment
          </Link>
        )}
      </div>
    );
  }

  // Most-recently-updated Corner first. A local sort, not a change to
  // sessionsFromPosts's own order (most-logged first) — that order still
  // backs the hobby chips near the top of the profile, which this view
  // shouldn't reach back and affect.
  const sorted = [...items].sort((a, b) => b.lastAt - a.lastAt);

  // No wrapping card here: each tile is now its own opaque cream card (the
  // same treatment as WorkGrid's All-moments cards), so a dark frame behind
  // them would just be a purple-tinted box peeking through the gaps — the
  // exact "dark-purple atmosphere" problem already fixed once for this grid.
  // Same column/gap treatment as WorkGrid for the same reason: one visual
  // system, not two grids that happen to sit near each other.
  return (
    <div className="grid grid-cols-3 gap-0.5 sm:grid-cols-4">
      {sorted.map((item) => (
        <CornerTile key={item.key} item={item} linkTo={linkTo} />
      ))}
    </div>
  );
}
