import { useState } from "react";
import { Link } from "react-router";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { getHobby, hobbies, subHobbyLabel } from "../data/hobbies";
import { hobbyPhoto } from "../data/hobbyPhotos";
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

/**
 * One hobby, as a book on the shelf. The cover is a photograph of the craft,
 * falling back to that hobby's own illustration if the photo can't load, so a
 * dead URL never leaves a hole. Everything on the face is information someone
 * would actually use to decide whether to open it: what it is, which Space it
 * belongs to, how much is in there, and when it last moved.
 */
function HobbyBook({ item }: { item: HobbySession }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = photoFailed ? undefined : hobbyPhoto(item.subSlug ?? "", item.hobbySlug, 600);
  const space = getHobby(item.hobbySlug);

  return (
    <Link
      to={`/you/work/${archiveKey(item)}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-[var(--coral-deep)] hover:shadow-[0_16px_30px_-18px_rgba(11,62,46,0.5)] focus-visible:-translate-y-1"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-muted">
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            onError={() => setPhotoFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <SubHobbyArt
            hobbySlug={item.hobbySlug}
            subSlug={item.subSlug ?? ""}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 py-3">
        <div className="text-base leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
          {item.label}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{space?.name ?? item.hobbySlug}</div>
        <div className="mt-auto pt-2 text-xs text-muted-foreground">
          {item.sessions} {item.sessions === 1 ? "moment" : "moments"} ·{" "}
          {updatedLabel(item.lastAt)}
        </div>
      </div>
    </Link>
  );
}

/**
 * Your work, shelved. Hobbies group under the Space they belong to — Pottery
 * under The Studio, Running under In Motion — with a thin rule under each
 * group standing in for the shelf board.
 *
 * The old version was a dark wooden cabinet with tiny spines and decorative
 * plants: nice to look at once, useless to use. The bookshelf feeling now
 * comes from the grouping and the dividers, and every pixel of a book is
 * information or a target.
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
    <div className="space-y-8">
      {groups.map(({ space, books }) => (
        <section key={space.slug}>
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h3 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              {space.name}
            </h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {books.length} {books.length === 1 ? "hobby" : "hobbies"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {books.map((item) => (
              <HobbyBook key={item.key} item={item} />
            ))}
          </div>

          {/* The shelf board: one thin rule, not a slab of wood. */}
          <div
            className="mt-4 h-px w-full"
            style={{ backgroundColor: "var(--border)" }}
            aria-hidden="true"
          />
        </section>
      ))}
    </div>
  );
}
