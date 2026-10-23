import { motion } from "motion/react";
import { ImageWithFallback } from "../ImageWithFallback";
import { GeneratedArt } from "../GeneratedArt";
import { MomentMedia, hasRealMedia } from "../MomentCard";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { postCorner, type Post } from "../../data/posts";
import { categoryOfCorner } from "../../data/cornerCategories";
import { catStyle, categoryColor, type CatColor } from "../../lib/categoryStyle";
import { HOVER_SCALE, PRESS_SCALE, springs } from "../../lib/springs";

/**
 * A Moment as a card (spec v1), the same everywhere it is a tile.
 *
 * - A photo or video fills the card, with a bottom scrim, the caption (2 lines)
 *   and the maker over it.
 * - A text-only Moment is filled with its category's colour: the text in the
 *   display face at 22px, `--ink`, up to 6 lines, the maker under it. No black
 *   boxes.
 *
 * Tapping opens the Moment, where reacting and saving live.
 */
const ALL: CatColor[] = ["rose", "orange", "violet", "blue", "amber", "lime", "teal", "pink"];

/** The colour of a Moment's category, via its Corner. With no Corner, one dealt from its old Space. */
function momentColor(post: Post): CatColor {
  const corner = postCorner(post);
  const cat = corner ? categoryOfCorner(post.hobbySlug, corner) : undefined;
  if (cat) return categoryColor(cat.slug);
  let n = 0;
  for (let i = 0; i < post.hobbySlug.length; i++) n = (n * 31 + post.hobbySlug.charCodeAt(i)) >>> 0;
  return ALL[n % ALL.length];
}

function Maker({ name, tone }: { name: string; tone: "photo" | "ink" }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar className="size-5 shrink-0">
        <AvatarFallback className="text-caption">{name.trim().charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span
        className={`truncate text-caption ${tone === "photo" ? "text-[var(--photo-text)]" : "text-[var(--ink)]"}`}
      >
        {name}
      </span>
    </span>
  );
}

export function MomentTile({
  post,
  onOpen,
  aspect = "aspect-[4/5]",
  className = "",
  priority = false,
  width = 480,
}: {
  post: Post;
  onOpen: () => void;
  aspect?: string;
  className?: string;
  priority?: boolean;
  /** Display width in CSS px, for the resized copy of the photo. */
  width?: number;
}) {
  const real = hasRealMedia(post);
  const photo = real && post.type !== "video";
  const src = post.mediaUrls?.[0] ?? post.media;
  const base = `group relative block w-full overflow-hidden rounded-card text-left ${aspect} ${className}`;
  const motionProps = {
    whileTap: { scale: PRESS_SCALE },
    whileHover: { scale: HOVER_SCALE },
    transition: springs.press,
  };

  if (!real) {
    return (
      <motion.button
        type="button"
        onClick={onOpen}
        {...motionProps}
        className={`${base} flex flex-col justify-between bg-[var(--cat)] p-4 text-[var(--ink)]`}
        style={catStyle(momentColor(post))}
      >
        <p
          className="line-clamp-6"
          // The display face at 22px, per spec v1 (between the lead and title sizes).
          style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "22px", lineHeight: 1.2, letterSpacing: "-0.01em" }}
        >
          {post.caption}
        </p>
        <Maker name={post.creator} tone="ink" />
      </motion.button>
    );
  }

  return (
    <motion.button type="button" onClick={onOpen} {...motionProps} className={`${base} bg-surface-muted`}>
      {photo ? (
        <ImageWithFallback
          src={src}
          alt=""
          width={width}
          priority={priority}
          className="absolute inset-0 size-full"
          fallback={<GeneratedArt hobbySlug={post.hobbySlug} seed={post.id} className="size-full" />}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 [&>*]:!aspect-auto [&>*]:!h-full [&>*]:!rounded-none">
          <MomentMedia post={post} />
        </div>
      )}
      <div className="absolute inset-0 bg-[image:var(--scrim-card)]" aria-hidden="true" />
      <div className="absolute inset-x-3.5 bottom-3.5 flex flex-col gap-2">
        {post.caption && (
          <p className="line-clamp-2 text-small font-semibold text-[var(--photo-text)]">{post.caption}</p>
        )}
        <Maker name={post.creator} tone="photo" />
      </div>
    </motion.button>
  );
}
