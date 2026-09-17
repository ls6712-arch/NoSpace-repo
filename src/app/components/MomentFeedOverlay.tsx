import { useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { Post } from "../data/posts";
import { PostMedia } from "./PostMedia";

function dateLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Every grid Moment is a click target into this: a full-screen, scrollable
 * feed with the clicked Moment leading and the rest following in their
 * existing (newest-first) order underneath — not a scroll-to-position on a
 * flat timeline. Reads as "here's this one, and everything else nearby,"
 * the same instinct behind opening a single post on any photo app.
 *
 * The lead image shares a layoutId with its grid tile (see WorkGrid.tsx),
 * so opening this visibly grows the photo from its place in the grid
 * instead of the screen just fading over it. Reduced motion drops straight
 * to the open state — no morph, no fade, no delay.
 *
 * A feed entry is a quiet read, not the place to edit/react/delete — click
 * one to hand off to the real MomentDetail dialog for that.
 */
export function MomentFeedOverlay({
  posts,
  leadIndex,
  onClose,
  onOpenDetail,
}: {
  posts: Post[];
  leadIndex: number | null;
  onClose: () => void;
  onOpenDetail: (post: Post) => void;
}) {
  const reduceMotion = useReducedMotion();
  const ordered = useMemo(() => {
    if (leadIndex === null) return [];
    const lead = posts[leadIndex];
    const rest = posts.filter((_, i) => i !== leadIndex);
    return [lead, ...rest];
  }, [posts, leadIndex]);

  const open = leadIndex !== null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="ns-paper-theme fixed inset-0 z-[70] overflow-y-auto bg-[var(--paper)]"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper)] px-5 py-4 sm:px-7">
            <span
              className="text-sm italic text-[var(--ink-soft)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Every moment
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--paper-raised)] text-[var(--ink)] transition-colors hover:border-[var(--coral-deep)]"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mx-auto max-w-[640px] px-6 pb-24 pt-8 sm:px-8 sm:pt-10">
            {ordered.map((post, i) => {
              const tag = post.tags?.[0];
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => onOpenDetail(post)}
                  className={`block w-full text-left ${i === 0 ? "" : "mt-10"}`}
                >
                  {i === 0 ? (
                    <motion.div
                      layout={!reduceMotion}
                      layoutId={reduceMotion ? undefined : `moment-${post.id}`}
                      transition={{ type: "spring", stiffness: 260, damping: 30 }}
                      className="aspect-[4/3] w-full overflow-hidden border border-[var(--line)] sm:h-[420px] sm:aspect-auto"
                    >
                      <PostMedia
                        media={post.media}
                        type={post.type}
                        hobbySlug={post.hobbySlug}
                        seed={post.id}
                        preview
                        className="h-full w-full object-cover"
                      />
                    </motion.div>
                  ) : (
                    <div className="aspect-[4/3] w-full overflow-hidden border border-[var(--line)] sm:h-[420px] sm:aspect-auto">
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
                  <p
                    className="mt-4 text-lg italic leading-snug text-[var(--ink)] sm:text-xl"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {post.caption}
                  </p>
                  <p className="mt-1.5 text-[13px] text-[var(--ink-faint)]">
                    {tag ? `${tag} · ` : ""}
                    {dateLabel(post.createdAt)}
                  </p>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
