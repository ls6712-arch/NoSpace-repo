import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Post } from "../data/posts";
import { momentLabel } from "../lib/momentDisplay";
import { PostMedia } from "./PostMedia";
import { Button } from "./ui/button";

/**
 * A compact strip, not a hero: a small thumbnail, the cover Moment's own
 * headline (its caption) and a line of context, and one action. There's no
 * dedicated "cover" field anywhere in the schema — this task is scoped to
 * page rendering only — so the cover is derived from data that already
 * exists: the owner's pinned Moments (togglePin, sql/post-pinning.sql),
 * newest first, falling back to their single most recent Moment when
 * nothing is pinned yet. "Change cover" cycles to the next pinned Moment
 * when there's more than one; with zero or one, it hands back a request to
 * scroll down to the grid instead, where pinning one (the same star control
 * every tile already has) makes it the cover.
 */
export function ProfileCoverStrip({
  post,
  canCycle,
  onChangeCover,
  editable = true,
}: {
  post: Post | undefined;
  canCycle: boolean;
  onChangeCover: () => void;
  /** False on a visitor's view of someone else's profile (PublicProfile.tsx)
   * — "Change cover" is an owner-only action, so it's hidden entirely
   * rather than shown disabled. Defaults to true so You.tsx (the owner's
   * own page) needs no change at all. */
  editable?: boolean;
}) {
  // The edit action reveals on hover/focus of the whole strip, not just the
  // button itself — tracked here (rather than pure CSS) so the reveal can
  // be a real Framer Motion fade + scale-in instead of an opacity snap.
  // React's onFocus/onBlur bubble (via focusin/focusout), so tabbing
  // straight to the button below still reveals it correctly.
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useReducedMotion();

  if (!post) {
    return (
      <div className="mb-8 rounded-2xl border-t-2 border-[var(--yellow)] bg-surface-muted px-5 py-6 text-center">
        <p className="text-sm text-muted-foreground">
          {editable
            ? "Nothing logged yet — your first Moment becomes your cover automatically."
            : "Nothing here yet."}
        </p>
      </div>
    );
  }

  const label = momentLabel(post);

  return (
    <div
      className="mb-8 flex flex-col gap-4 rounded-2xl border-t-2 border-[var(--yellow)] bg-surface-muted px-5 py-5 sm:flex-row sm:items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div className="size-20 shrink-0 overflow-hidden rounded-xl border border-[var(--hairline)] sm:size-24">
        <PostMedia
          media={post.media}
          type={post.type}
          hobbySlug={post.hobbySlug}
          seed={post.id}
          preview
          className="h-full w-full"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--yellow)]">
          Cover story{label ? ` · ${label}` : ""}
        </div>
        <h2
          className="mt-1 text-xl leading-snug italic sm:text-2xl"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {post.caption}
        </h2>
      </div>
      {editable && (
        // A real state change (the edit control becoming available), not
        // decoration — see the module doc comment on WHERE this fires.
        // initial={false} + reduced-motion both skip straight to the final
        // opacity/scale so nothing animates in "for free" on page load.
        <motion.div
          initial={false}
          animate={
            reduceMotion
              ? { opacity: hovered ? 1 : 0 }
              : { opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.9 }
          }
          transition={{ duration: 0.15 }}
          className="shrink-0 self-start sm:self-center"
        >
          <Button variant="outline" size="sm" onClick={onChangeCover}>
            {canCycle ? "Change cover" : "Pin a cover"}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
