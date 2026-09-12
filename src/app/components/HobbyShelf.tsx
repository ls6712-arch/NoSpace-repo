import { Link } from "react-router";
import * as Icons from "lucide-react";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { getHobby, hobbies, subHobbyLabel } from "../data/hobbies";
import { hobbyIconName } from "../data/hobbyIcons";
import { SubHobbyArt } from "./SubHobbyArt";
import { PostMedia } from "./PostMedia";

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
   * this is what the shelf book cover should show. Falls back to the
   * curated stock photo only when nothing real has been uploaded yet. */
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
 * A book's height, fixed rather than left to scale with the grid column's
 * width (the old aspect-[16/9] cover did). A fixed height is what makes the
 * stack math below predictable: with a size that responds to the column
 * width, there's no single overlap value that reliably leaves the same
 * "peek" of the book underneath at every breakpoint.
 */
const BOOK_COVER_HEIGHT = 112;
const BOOK_LABEL_HEIGHT = 54;
const BOOK_HEIGHT = BOOK_COVER_HEIGHT + BOOK_LABEL_HEIGHT;
/** How much of the book underneath still peeks out above the one in front. */
const BOOK_PEEK = 28;
/** How many books a stack shows before folding the rest into "+N more". */
const MAX_BOOKS = 3;
/** Every Space's stack reserves this much height, whether it has one book
 * or the full MAX_BOOKS, so Spaces sitting in the same grid row line up. */
const STACK_HEIGHT = BOOK_HEIGHT + (MAX_BOOKS - 1) * BOOK_PEEK;

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
  linkTo,
}: {
  item: HobbySession;
  index: number;
  count: number;
  /** Where this book opens. Defaults to your own archive. */
  linkTo?: (item: HobbySession) => string;
}) {
  const Icon = (Icons as any)[hobbyIconName(item.subSlug, item.hobbySlug)] ?? Icons.Sparkles;

  const spine = SPINES[index % SPINES.length];
  const tilt = TILT[index % TILT.length];
  // Later books sit lower and further right, so the stack fans out. Kept
  // small enough that a stack of 3-4 doesn't run out of a narrow column.
  const offset = index * 10;

  return (
    <Link
      to={linkTo ? linkTo(item) : `/you/work/${archiveKey(item)}`}
      title={`${item.label}: ${item.sessions} ${item.sessions === 1 ? "moment" : "moments"}, ${updatedLabel(item.lastAt).toLowerCase()}`}
      className="group relative block origin-top transition-transform duration-300 ease-out hover:z-20 hover:-translate-y-2 hover:rotate-0 focus-visible:z-20 focus-visible:-translate-y-2 focus-visible:rotate-0"
      style={{
        height: BOOK_HEIGHT,
        transform: `rotate(${tilt}deg)`,
        marginLeft: offset,
        // A flat -10px used to leave almost the whole book showing (each
        // extra Corner pushed the section down by nearly a full book's
        // height instead of fanning). This overlaps down to BOOK_PEEK px
        // of visible edge, which is what actually keeps a 3-book stack
        // compact instead of turning into a long vertical list.
        marginTop: index === 0 ? 0 : -(BOOK_HEIGHT - BOOK_PEEK),
        zIndex: count - index,
      }}
    >
      <div
        className="flex h-full overflow-hidden rounded-r-lg rounded-l-sm bg-[var(--surface-elevated)]"
        style={{ boxShadow: "0 14px 26px -14px rgba(11,62,46,0.45), 0 2px 4px rgba(11,62,46,0.12)" }}
      >
        {/* The spine */}
        <span
          className="w-2.5 shrink-0 sm:w-3"
          style={{ backgroundColor: spine }}
          aria-hidden="true"
        />

        <span className="flex h-full min-w-0 flex-1 flex-col">
          {/* The cover — your own most recent upload for this hobby when
              you have one, so ten pottery photos actually show your tenth
              pottery photo rather than a generic stand-in. Falls straight
              to the illustration otherwise (no stock-photo tier in
              between): a hotlinked photo can fail to load invisibly —
              network policy, an ad blocker, a slow connection — and the
              gap it leaves behind is a flat, broken-looking box. The
              illustration always draws something, so there's nothing left
              to fail. A fixed height (not the old aspect-[16/9], which
              scaled with the grid column's width) is also what makes
              BOOK_HEIGHT above a number this component can actually rely
              on for the stack's overlap math. */}
          <span className="block shrink-0 overflow-hidden bg-surface-muted" style={{ height: BOOK_COVER_HEIGHT }}>
            {item.lastMediaUrl ? (
              <PostMedia
                media={item.lastMediaUrl}
                type={item.lastMediaType}
                hobbySlug={item.hobbySlug}
                seed={item.lastMediaId ?? item.key}
                preview
                className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
              />
            ) : (
              <SubHobbyArt
                hobbySlug={item.hobbySlug}
                subSlug={item.subSlug ?? ""}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            )}
          </span>

          {/* The label band — flex-1 so it absorbs whatever's left of
              BOOK_HEIGHT after the fixed-height cover above, rather than
              needing its own hardcoded height to match. */}
          <span className="flex flex-1 items-center gap-2.5 overflow-hidden px-3.5 py-2">
            <Icon
              className="size-4 shrink-0 text-[var(--coral-deep)]"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              {/* overflow:hidden + text-overflow:ellipsis + white-space:nowrap
                  (Tailwind's `truncate`) on this fixed-width cell — the
                  previous version had no `truncate` here at all, so long
                  names just clipped raw with no "…". (An earlier attempt at
                  word-boundary truncation via line-clamp instead produced
                  worse breakage — it wrapped onto extra lines rather than
                  clamping to one — so this reverts to the standard,
                  reliable single-line ellipsis; a `title` attribute below
                  covers the full name on hover for whatever it still cuts
                  mid-word.) */}
              <span
                className="block truncate text-[15px] leading-tight text-foreground"
                style={{ fontFamily: "var(--font-serif)" }}
                title={item.label}
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
export function HobbyShelf({
  items: override,
  linkTo,
  emptyCopy,
  emptyCta = true,
}: {
  items?: HobbySession[];
  /**
   * Where each book opens. On your own profile that's your archive; on
   * someone else's it has to stay on their profile, or you end up looking at
   * your own empty Space wondering where their work went.
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
            "Your shelf is empty. Every hobby you log gets its own book here, with everything you've made in it inside."}
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

  // Group the books by the Space they sit in, keeping Spaces in the app's
  // canonical order rather than whichever happened to be logged first.
  const bySpace = new Map<string, HobbySession[]>();
  for (const item of items) {
    bySpace.set(item.hobbySlug, [...(bySpace.get(item.hobbySlug) ?? []), item]);
  }
  // Capped rather than left to grow with however many Corners a Space has —
  // an uncapped stack made a Space with one Corner sit noticeably shorter
  // than one with five, so every row in the grid below ended up a
  // different height. MAX_BOOKS keeps every stack the same footprint; a
  // "+N more" line under it says the rest still exist rather than hiding
  // them.
  const groups = hobbies
    .filter((h) => bySpace.has(h.slug))
    .map((h) => {
      const books = bySpace.get(h.slug)!;
      return { space: h, books: books.slice(0, MAX_BOOKS), moreCount: Math.max(0, books.length - MAX_BOOKS) };
    });

  return (
    <div className="rounded-3xl bg-[var(--surface-elevated)] px-4 py-8 sm:px-6">
      {/* auto-fit/minmax responds to the space this shelf actually has,
          not the viewport — sm:/lg: breakpoints kept forcing 3 columns even
          when this sits in a narrow half-width column next to Your
          Pursuits, which squeezed every book down to unreadable fragments
          ("C...", "1..."). This shrinks to fewer columns automatically
          whenever the container itself is narrow. items-start keeps a
          shorter stack sitting at the top of its row instead of being
          stretched to match a taller neighbor. */}
      <div className="grid items-start gap-x-6 gap-y-10 [grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))]">
        {groups.map(({ space, books, moreCount }) => (
          <section key={space.slug}>
            <h3
              className="mb-5 truncate text-center text-xs font-semibold uppercase tracking-[0.14em] text-foreground"
              style={{ fontFamily: "var(--font-body)" }}
              title={space.name}
            >
              {space.name}
            </h3>

            {/* The stack. Extra right padding leaves room for the fan-out.
                Fixed to STACK_HEIGHT regardless of how many books are
                actually in it, so a Space with one Corner reserves the
                same row height as one at the MAX_BOOKS cap — otherwise a
                short stack would sit noticeably shorter than a full one
                right next to it in the same grid row. */}
            <div className="relative pr-6" style={{ height: STACK_HEIGHT }}>
              {books.map((item, i) => (
                <HobbyBook key={item.key} item={item} index={i} count={books.length} linkTo={linkTo} />
              ))}
            </div>
            {moreCount > 0 && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">+{moreCount} more</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
