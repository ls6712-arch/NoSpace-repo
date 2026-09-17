import { Pin } from "lucide-react";
import { Post } from "../data/posts";
import { momentLabel, momentTint } from "../lib/momentDisplay";
import { AUDIENCE } from "./MomentDetail";
import { PostMedia } from "./PostMedia";

function dateLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Same check MomentDetail.tsx uses to decide whether a Moment has a real
 * photo/video to show or is just words — reused here to decide whether a
 * tile renders as an image card or a text-forward one, rather than adding a
 * second, separately maintained definition of "has media." */
function isNote(post: Post) {
  return !post.media || !/^https?:\/\//.test(post.media);
}

/** One tile's grid span. Pinned Moments always get the larger "feature"
 * treatment — a real, owner-chosen signal, not a guess. Past that, every
 * 6th tile also gets it, purely for editorial rhythm on a long, all-regular
 * grid; harmless at any count since it's just a size, not a content change.
 * Text-only Moments span two rows instead of one so their caption has room
 * to actually read as a quote rather than being clipped to a single line. */
function tileSpan(post: Post, index: number): string {
  if (post.pinned || (index > 0 && index % 6 === 0)) return "sm:col-span-2 sm:row-span-2";
  if (isNote(post)) return "sm:row-span-2";
  return "";
}

function MomentTile({
  post,
  index,
  pinPending,
  onOpen,
  onTogglePin,
  editable,
}: {
  post: Post;
  index: number;
  pinPending: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  /** False on a visitor's view of someone else's profile — the pin control
   * is hidden entirely, not just disabled: a visitor shouldn't see it as an
   * option at all, let alone trigger it. */
  editable: boolean;
}) {
  const label = momentLabel(post);
  const tint = momentTint(post);
  const audience = AUDIENCE[post.visibility];
  const note = isNote(post);

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-transparent bg-surface-muted transition-colors hover:border-[var(--coral-deep)] ${tileSpan(post, index)}`}
    >
      <button type="button" onClick={onOpen} className="flex h-full w-full flex-col text-left">
        {note ? (
          <div className="flex h-full flex-col justify-center gap-3 p-4">
            <p
              className="line-clamp-5 text-base italic leading-snug"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              "{post.caption}"
            </p>
          </div>
        ) : (
          <div className="relative min-h-[140px] flex-1">
            <PostMedia
              media={post.media}
              type={post.type}
              hobbySlug={post.hobbySlug}
              seed={post.id}
              preview
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Top row: tag/Corner color badge, audience tier, date — all real
            data, none of it fabricated for the tile. */}
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1.5">
          <span className="min-w-0 max-w-[70%]">
            {label && (
              <span
                className="inline-block max-w-full truncate rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
                style={{ backgroundColor: tint }}
              >
                {label}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-white/90">
            {audience && (
              <audience.icon className="size-3" aria-label={audience.label} />
            )}
            {dateLabel(post.createdAt)}
          </span>
        </div>

        {/* Caption, bottom-left — only for image tiles; a text tile already
            shows its caption as the tile's own content above. */}
        {!note && post.caption && (
          <div className="absolute inset-x-2 bottom-2">
            <p
              className="line-clamp-2 text-sm italic leading-snug text-white"
              style={{ fontFamily: "var(--font-serif)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}
            >
              {post.caption}
            </p>
          </div>
        )}
      </button>

      {/* Pin control — visible on hover when unpinned, always visible (and
          filled) once pinned, so a featured Moment doesn't lose its own
          indicator the moment the pointer moves away. Wired straight to
          ContentContext's existing togglePin — no local-only pin state.
          Hidden entirely (not just disabled) on a visitor's view — nothing
          here should suggest they could re-pin someone else's Moment. */}
      {editable && (
        <button
          type="button"
          onClick={onTogglePin}
          disabled={pinPending}
          aria-pressed={!!post.pinned}
          aria-label={post.pinned ? "Unpin this Moment" : "Pin this Moment"}
          title={post.pinned ? "Unpin" : "Pin as a feature"}
          className={`absolute right-2 top-9 flex size-6 items-center justify-center rounded-full border transition-opacity ${
            post.pinned
              ? "border-transparent bg-[var(--coral-deep)] text-white opacity-100"
              : "border-white/40 bg-black/35 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          } disabled:opacity-60`}
        >
          <Pin className="size-3" fill={post.pinned ? "currentColor" : "none"} />
        </button>
      )}
    </div>
  );
}

/**
 * The full Every-Moment list — every Moment the owner has, not paginated or
 * capped, laid out as a varied editorial grid rather than a uniform one.
 * `grid-auto-flow: dense` (set via an arbitrary Tailwind value, since it
 * has no dedicated utility) backfills the gaps a spanning tile leaves
 * behind instead of leaving holes.
 */
export function EditorialMomentsGrid({
  posts,
  pendingPinId = null,
  onOpen,
  onTogglePin,
  emptyLabel,
  editable = true,
}: {
  posts: Post[];
  /** The id currently mid-write to Supabase, so a second click can't fire
   * before the first one resolves. Irrelevant (and omittable) when
   * `editable` is false. */
  pendingPinId?: number | null;
  onOpen: (post: Post) => void;
  /** Required only when editable — a visitor's grid never calls this since
   * its pin buttons don't render at all. */
  onTogglePin?: (postId: number) => void;
  emptyLabel: string;
  /** False on a visitor's view of someone else's profile — see MomentTile's
   * own doc. Defaults to true so You.tsx needs no change. */
  editable?: boolean;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-9 text-center">
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  const ordered = [...posts].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  return (
    <div className="grid grid-cols-2 gap-2 [grid-auto-flow:dense] sm:auto-rows-[150px] sm:grid-cols-4">
      {ordered.map((post, index) => (
        <MomentTile
          key={post.id}
          post={post}
          index={index}
          pinPending={pendingPinId === post.id}
          onOpen={() => onOpen(post)}
          onTogglePin={() => onTogglePin?.(post.id)}
          editable={editable}
        />
      ))}
    </div>
  );
}
