import { motion } from "motion/react";
import { ImageWithFallback } from "../ImageWithFallback";
import { GeneratedArt } from "../GeneratedArt";
import { hasRealMedia } from "../MomentCard";
import { hobbies, subHobbyLabel } from "../../data/hobbies";
import { postCorner, type Post } from "../../data/posts";
import { categoryOfCorner } from "../../data/cornerCategories";
import { catStyle, categoryColor } from "../../lib/categoryStyle";
import { formatWhen } from "../../lib/dates";
import { momentAlt, momentCaption } from "../../lib/momentCaption";
import { SECTION_GAP } from "../../lib/pageGrid";
import { PRESS_SCALE, springs } from "../../lib/springs";
import { scrollBehavior } from "../../lib/scrollToElement";

const DAYS = 24 * 3_600_000;

/** 3 photos and 1 quote from the public Moments of the last 7 days, newest first. */
export function seenTonight(posts: readonly Post[], now: number = Date.now()): { photos: Post[]; quote: Post | null } {
  const recent = posts
    .filter((p) => p.visibility === "public" && now - p.createdAt < 7 * DAYS)
    .sort((a, b) => b.createdAt - a.createdAt);
  const photos = recent.filter((p) => p.type === "photo" && hasRealMedia(p)).slice(0, 3);
  const quote = recent.find((p) => !hasRealMedia(p) && momentCaption(p).length > 0) ?? null;
  return { photos, quote };
}

function cornerLabel(post: Post): string {
  const corner = postCorner(post);
  const hobby = hobbies.find((h) => h.slug === post.hobbySlug);
  return (corner && hobby?.subItems.find((s) => s.slug === corner)?.label) || (post.subHobby ? subHobbyLabel(post.subHobby) : undefined) || hobby?.shortName || "";
}

function Photo({ post, className, onOpen }: { post: Post; className: string; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: PRESS_SCALE }}
      transition={springs.press}
      className={`relative block w-full overflow-hidden rounded-card bg-[var(--cat)] text-left ${className}`}
      style={catStyle(categoryColor(categoryOfCorner(post.hobbySlug, postCorner(post) ?? "")?.slug ?? ""))}
    >
      <ImageWithFallback
        src={post.mediaUrls?.[0] ?? post.media}
        alt={momentAlt(post, cornerLabel(post))}
        width={640}
        tint
        className="absolute inset-0 size-full"
        fallback={<GeneratedArt hobbySlug={post.hobbySlug} seed={post.id} className="size-full" />}
      />
      <div className="absolute inset-0 bg-[image:var(--scrim-card)]" aria-hidden="true" />
      {/* A second, stronger scrim under the caption: on the small stacked photos the caption sits well up the image. */}
      <div
        className="absolute inset-x-0 bottom-0 h-3/4"
        style={{ backgroundImage: "linear-gradient(to top, color-mix(in srgb, var(--ink) 92%, transparent), transparent)" }}
        aria-hidden="true"
      />
      <p className="absolute inset-x-3 bottom-3 line-clamp-2 text-caption text-[var(--photo-text)]">
        <span className="font-semibold">{post.creator}</span>
        {` in ${cornerLabel(post)} · ${formatWhen(post.createdAt, { ago: true })}`}
      </p>
    </motion.button>
  );
}

/**
 * "Seen tonight": a collage of three photos (one tall, two stacked) and a pull
 * quote card. Each caption is the maker's name in their Corner and how long ago.
 */
export function SeenTonight({ posts, onOpen }: { posts: Post[]; onOpen: (post: Post) => void }) {
  const { photos, quote } = seenTonight(posts);
  if (photos.length === 0 && !quote) return null;
  const [tall, ...stacked] = photos;
  const cat = quote ? (() => {
    const corner = postCorner(quote);
    return corner ? categoryOfCorner(quote.hobbySlug, corner) : undefined;
  })() : undefined;
  return (
    <section className={SECTION_GAP} aria-labelledby="seen-title">
      <div className="mb-4 flex items-baseline justify-between gap-4 border-t-2 border-foreground pt-3">
        <h2 id="seen-title" className="text-title">
          Seen tonight
        </h2>
        <a
          href="#all-moments"
          className="inline-flex min-h-11 shrink-0 items-center text-small text-accent-text hover:underline"
          onClick={(e) => {
            // A plain href would be read by the hash router as a route.
            e.preventDefault();
            document.getElementById("all-moments")?.scrollIntoView({ behavior: scrollBehavior() });
          }}
        >
          See all
        </a>
      </div>
      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        {tall && (
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <Photo post={tall} className="h-[300px]" onOpen={() => onOpen(tall)} />
            </div>
            {stacked.length > 0 && (
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                {stacked.map((p) => (
                  <Photo key={p.id} post={p} className="h-[136px]" onOpen={() => onOpen(p)} />
                ))}
              </div>
            )}
          </div>
        )}
        {quote && (
          <motion.button
            type="button"
            onClick={() => onOpen(quote)}
            whileTap={{ scale: PRESS_SCALE }}
            transition={springs.press}
            style={catStyle(categoryColor(cat?.slug ?? ""))}
            className="flex min-h-[200px] flex-col justify-between gap-6 rounded-card bg-[var(--cat)] p-5 text-left text-[var(--ink)]"
          >
            <span className="line-clamp-6 text-title">
              {`“${momentCaption(quote)}”`}
            </span>
            <span className="text-caption font-semibold">
              {`${quote.creator}, in ${cat?.name ?? hobbies.find((h) => h.slug === quote.hobbySlug)?.shortName ?? ""}`}
            </span>
          </motion.button>
        )}
      </div>
    </section>
  );
}
