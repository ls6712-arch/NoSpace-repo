import { Link } from "react-router";
import type { Post } from "../../data/posts";
import { GeneratedArt } from "../GeneratedArt";
import { ImageWithFallback } from "../ImageWithFallback";
import { withFirstFrame } from "../../lib/mediaUrl";
import { formatDateTime } from "../../lib/dates";
import { hasRealMedia, PlayBadge, tileTokenFor } from "./MomentMedia";
import { isUpcomingSession } from "./momentMeta";

/** Three square tiles to a row, a hair apart: profiles, Corner pages and Saved. */
export const MOMENT_TILE_GRID = "grid grid-cols-3 gap-[3px]";

/**
 * A Moment in a grid: a square of its media and nothing else. A video carries
 * the play badge, a session that has not happened yet carries its day and
 * time, and tapping the tile opens the Moment.
 */
export function MomentGridTile({
  post,
  onOpen,
  priority = false,
}: {
  post: Post;
  /** Opens the Moment in place. Without it, the tile links to the Moment's own page. */
  onOpen?: (post: Post) => void;
  priority?: boolean;
}) {
  const real = hasRealMedia(post);
  const video = real && post.type === "video";
  const src = post.mediaUrls?.[0] ?? post.media;
  const tile = tileTokenFor(post.id);
  const label = `Open ${post.creator}’s Moment`;
  const shape = "relative block aspect-square w-full overflow-hidden rounded-control outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const inside = (
    <>
      {!real ? (
        <span className="flex size-full items-center justify-center p-[9%]" style={{ background: tile.bg, color: tile.fg }}>
          <span className="line-clamp-4 text-center text-caption italic">{post.caption}</span>
        </span>
      ) : video ? (
        <video src={withFirstFrame(src)} muted playsInline preload="metadata" tabIndex={-1} className="pointer-events-none size-full object-cover" />
      ) : (
        <ImageWithFallback
          src={src}
          alt=""
          width={240}
          priority={priority}
          className="size-full"
          fallback={<GeneratedArt hobbySlug={post.hobbySlug} seed={post.id} className="size-full" />}
        />
      )}
      {video && <PlayBadge small />}
      {isUpcomingSession(post) && (
        <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded-full bg-scrim-solid/70 px-2 py-0.5 text-caption font-semibold text-on-media" data-date-chip>
          {formatDateTime(post.startsAt!)}
        </span>
      )}
    </>
  );

  return onOpen ? (
    <button type="button" onClick={() => onOpen(post)} aria-label={label} className={shape} data-moment-tile={post.id}>
      {inside}
    </button>
  ) : (
    <Link to={`/moment/${post.id}`} aria-label={label} className={shape} data-moment-tile={post.id}>
      {inside}
    </Link>
  );
}
