import { useState } from "react";
import { Link } from "react-router";
import * as Icons from "lucide-react";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { getHobby, hobbies, subHobbyLabel } from "../data/hobbies";
import { hobbyPhoto } from "../data/hobbyPhotos";
import { hobbyIconName } from "../data/hobbyIcons";
import { SubHobbyArt } from "./SubHobbyArt";

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

/** The same fact, short enough to sit on a book spine label without clipping. */
function compactUpdated(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Book spines, cycled within a Space so a stack of three never repeats a
 * colour. Straight from the brand set — forest, coral, sky, mustard.
 */
const SPINES = ["var(--forest)", "var(--coral)", "var(--sky)", "var(--yellow)"];

/** Each book in a stack sits a little askew, the way real ones do. */
const TILT = [-2.2, 1.6, -1.1, 2.4];

/**
 * One hobby, as a hardcover book: coloured spine down the left edge, a
 * photograph of the craft as the cover, and a cream label band across the
 * bottom carrying a small line icon and the hobby's name.
 *
 * Books in a stack overlap and tilt slightly. Hovering lifts the book and
 * straightens it, which is also what makes it obvious the whole thing is one
 * target rather than decoration.
 */
function HobbyBook({
  item,
  index,
  count,
}: {
  item: HobbySession;
  index: number;
  count: number;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = photoFailed ? undefined : hobbyPhoto(item.subSlug ?? "", item.hobbySlug, 600);
  const Icon = (Icons as any)[hobbyIconName(item.subSlug, item.hobbySlug)] ?? Icons.Sparkles;

  const spine = SPINES[index % SPINES.length];
  const tilt = TILT[index % TILT.length];
  // Later books sit lower and further right, so the stack fans out.
  const offset = index * 16;

  return (
    <Link
      to={`/you/work/${archiveKey(item)}`}
      title={`${item.label} — ${item.sessions} ${item.sessions === 1 ? "moment" : "moments"}, ${updatedLabel(item.lastAt).toLowerCase()}`}
      className="group relative block origin-top transition-transform duration-300 ease-out hover:z-20 hover:-translate-y-2 hover:rotate-0 focus-visible:z-20 focus-visible:-translate-y-2 focus-visible:rotate-0"
      style={{
        transform: `rotate(${tilt}deg)`,
        marginLeft: offset,
        marginTop: index === 0 ? 0 : -10,
        zIndex: count - index,
      }}
    >
      <div
        className="flex overflow-hidden rounded-r-lg rounded-l-sm bg-[var(--cream)]"
        style={{ boxShadow: "0 14px 26px -14px rgba(11,62,46,0.45), 0 2px 4px rgba(11,62,46,0.12)" }}
      >
        {/* The spine */}
        <span
          className="w-2.5 shrink-0 sm:w-3"
          style={{ backgroundColor: spine }}
          aria-hidden="true"
        />

        <span className="min-w-0 flex-1">
          {/* The cover */}
          <span className="block aspect-[16/9] overflow-hidden bg-surface-muted">
            {photo ? (
              <img
                src={photo}
                alt=""
                loading="lazy"
                onError={() => setPhotoFailed(true)}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            ) : (
              <SubHobbyArt
                hobbySlug={item.hobbySlug}
                subSlug={item.subSlug ?? ""}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            )}
          </span>

          {/* The label band */}
          <span className="flex items-center gap-2.5 px-3.5 py-2.5">
            <Icon
              className="size-4 shrink-0 text-[var(--coral-deep)]"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span
                className="block truncate text-[15px] leading-tight text-[var(--forest-ink)]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {item.label}
              </span>
              {/* The facts stay on the book, just quieter than the name. */}
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {item.sessions} {item.sessions === 1 ? "moment" : "moments"} ·{" "}
                {compactUpdated(item.lastAt)}
              </span>
            </span>
          </span>
        </span>
      </div>
    </Link>
  );
}

/**
 * Your work, shelved. Hobbies group under the Space they belong to — Pottery
 * under The Studio, Running under In Motion — as a small stack of books per
 * Space, with the Space name above it in caps.
 *
 * No wooden carcass, no plants, no tiny unreadable spines: the shelf feeling
 * comes from the stacking and the label bands, and every book is a link into
 * that hobby's own archive.
 */
export function HobbyShelf({ items: override }: { items?: HobbySession[] } = {}) {
  const derived = useSessionsByHobby();
  const items = override ?? derived;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          Your shelf is empty. Every hobby you log gets its own book here, with
          everything you've made in it inside.
        </p>
        <Link
          to="/log"
          className="mt-4 inline-block rounded-full px-5 py-2 text-sm text-white [background-color:var(--coral-deep)]"
        >
          Log your first moment
        </Link>
      </div>
    );
  }

  // Group the books by the Space they sit in, keeping Spaces in the app's
  // canonical order rather than whichever happened to be logged first.
  const bySpace = new Map<string, HobbySession[]>();
  for (const item of items) {
    bySpace.set(item.hobbySlug, [...(bySpace.get(item.hobbySlug) ?? []), item]);
  }
  const groups = hobbies
    .filter((h) => bySpace.has(h.slug))
    .map((h) => ({ space: h, books: bySpace.get(h.slug)! }));

  return (
    <div className="rounded-3xl bg-[var(--cream)] px-4 py-8 sm:px-6">
      <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(({ space, books }) => (
          <section key={space.slug}>
            <h3
              className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--forest)]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {space.name}
            </h3>

            {/* The stack. Extra right padding leaves room for the fan-out. */}
            <div className="relative pr-8">
              {books.map((item, i) => (
                <HobbyBook key={item.key} item={item} index={i} count={books.length} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
