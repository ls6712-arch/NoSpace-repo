import { Link } from "react-router";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { getHobby, hobbies, subHobbyLabel } from "../data/hobbies";
import { useCornerNote } from "../lib/cornerNotes";
import { hashSeed } from "./GeneratedArt";
import { SubHobbyArt } from "./SubHobbyArt";
import { PostMedia } from "./PostMedia";

/** One of the five chart colors, deterministic per Corner (same hashed-seed
 * pattern GeneratedArt uses to pick a stable variant) — a small, consistent
 * accent rather than a fresh random color on every render. */
function chartAccent(key: string) {
  return `var(--chart-${(hashSeed(key) % 5) + 1})`;
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

/** URL-safe id for a hobby book, used as the Hobby Archive route param. */
export function archiveKey(item: { subSlug?: string; hobbySlug: string }) {
  return item.subSlug ?? `space-${item.hobbySlug}`;
}

/** Resolves an archive route param back into a hobby tag and its parent Space. */
export function parseArchiveKey(param: string) {
  if (param.startsWith("space-")) {
    const hobbySlug = param.slice("space-".length);
    const space = getHobby(hobbySlug);
    if (!space) return null;
    return { hobbySlug, subSlug: undefined, label: space.shortName };
  }
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
    const key = post.subHobby ?? `space:${post.hobbySlug}`;
    const existing = tally.get(key);
    if (existing) {
      existing.sessions += 1;
      existing.firstAt = Math.min(existing.firstAt, post.createdAt);
      existing.lastAt = Math.max(existing.lastAt, post.createdAt);
      // The cover should be whichever real upload is newest, independent of
      // whether the very latest moment happened to be a text-only note.
      if (hasRealMedia(post) && post.createdAt >= (existing.lastMediaAt ?? 0)) {
        existing.lastMediaUrl = post.media;
        existing.lastMediaType = post.type;
        existing.lastMediaId = post.id;
        existing.lastMediaAt = post.createdAt;
      }
      continue;
    }
    tally.set(key, {
      key,
      label: post.subHobby
        ? subHobbyLabel(post.subHobby) ?? post.subHobby
        : getHobby(post.hobbySlug)?.shortName ?? post.hobbySlug,
      hobbySlug: post.hobbySlug,
      subSlug: post.subHobby,
      sessions: 1,
      firstAt: post.createdAt,
      lastAt: post.createdAt,
      lastMediaUrl: hasRealMedia(post) ? post.media : undefined,
      lastMediaType: hasRealMedia(post) ? post.type : undefined,
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
 * One Corner, as a flat tile: a square cover (the most recent real photo
 * among that Corner's Moments, or the illustration when there isn't one —
 * no stock-photo tier in between that a hotlinked image could fail out of
 * invisibly), the Corner's name, and — if you've written one, from the
 * Corner's own detail view — your private note about it. A small dot in a
 * deterministic chart color sits next to the name: a narrow, specific
 * exception to this page's neutral-plus-coral rule, not a reopening of it —
 * still no colored badge or tinted background anywhere on the tile. Same
 * aspect-square + hairline-border + coral-hover treatment as every other
 * flat photo tile in the app.
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
  const accent = chartAccent(item.key);

  return (
    <Link to={linkTo ? linkTo(item) : `/you/work/${archiveKey(item)}`} className="group block">
      <div className="aspect-square overflow-hidden rounded-lg border border-[var(--hairline)] transition-colors group-hover:border-[var(--coral-deep)]">
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
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
        <p
          className="truncate text-sm leading-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
          title={item.label}
        >
          {item.label}
        </p>
      </div>
      {note && (
        <p className="truncate text-[11px] text-muted-foreground" title={note}>
          {note}
        </p>
      )}
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

  return (
    // bg-card, not --surface-elevated: that token resolves to --plum-night-2,
    // a visibly more saturated purple than every other surface on this page
    // (they resolve to --surface/--card = --plum-night). Using it here was
    // the same "dark-purple atmosphere" problem the profile reduction pass
    // already called out once — bg-card keeps this grid's background the
    // same as every other card on the page instead of a shade off from it.
    <div className="rounded-3xl bg-card p-1 sm:p-1.5">
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 sm:gap-1.5 lg:grid-cols-6">
        {sorted.map((item) => (
          <CornerTile key={item.key} item={item} linkTo={linkTo} />
        ))}
      </div>
    </div>
  );
}
