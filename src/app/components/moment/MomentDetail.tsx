import { useEffect, useRef, useState } from "react";
import type { Post } from "../../data/posts";
import { useAuth } from "../../context/AuthContext";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { Thoughts } from "../Thoughts";
import { scrollBehavior } from "../../lib/scrollToElement";
import { useLivePost } from "./Moment";
import { MomentActions, useLove } from "./MomentActions";
import { MomentCaption } from "./MomentCaption";
import { MomentHeader } from "./MomentHeader";
import { MomentMedia } from "./MomentMedia";
import { isOwnMoment } from "./momentMeta";
import { takeThoughtsIntent } from "./thoughtsIntent";

/**
 * One Moment, opened: the same header, media, icon row and caption as its
 * card, then its thoughts. Everything that changes it (details, who sees it,
 * its Pursuit, deleting it) is behind ⋯ in the header.
 */
function Opened({ post: given, owned, replyOpen, onClose }: { post: Post; owned?: boolean; replyOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const post = useLivePost(given);
  const mine = owned === true || isOwnMoment(post, user?.id);
  const { love } = useLove(post.id);
  const thoughts = useRef<HTMLDivElement>(null);
  // Arriving from a Thoughts icon or "See thoughts" (or ?reply=1) lands on the thoughts, with the box open.
  const [composer, setComposer] = useState(() => (takeThoughtsIntent(post.id) || replyOpen ? 1 : 0));

  useEffect(() => {
    if (composer === 0) return;
    const el = thoughts.current;
    if (!el || typeof el.scrollIntoView !== "function") return;
    // After the dialog has laid out, or there is nothing to scroll yet.
    const t = window.setTimeout(() => el.scrollIntoView({ block: "start", behavior: scrollBehavior() }), 50);
    return () => window.clearTimeout(t);
  }, [composer]);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <DialogTitle className="sr-only">{`${post.creator}’s Moment`}</DialogTitle>
      <DialogDescription className="sr-only">{post.caption.slice(0, 120) || `${post.creator}’s Moment`}</DialogDescription>
      {/* The close button sits in the corner above; the header starts under it. */}
      <div className="pt-3">
        <MomentHeader post={post} mine={mine} onDeleted={onClose} />
      </div>
      <div className="mx-auto w-full max-w-[min(100%,62vh)]">
        <MomentMedia post={post} aspect="aspect-square" full onDoubleTap={mine || post.isPrivateLog ? undefined : () => love("double_tap")} />
      </div>
      <div>
        <MomentActions post={post} mine={mine} onThoughts={() => setComposer((n) => n + 1)} />
        <MomentCaption post={post} full />
      </div>
      {!post.isPrivateLog && (
        <section ref={thoughts} aria-labelledby={`thoughts-${post.id}`} className="scroll-mt-4 border-t border-border pt-4">
          <h2 id={`thoughts-${post.id}`} className="mb-3 text-body font-semibold">
            Thoughts
          </h2>
          <Thoughts
            key={composer}
            postId={post.id}
            postOwnerId={post.userId}
            postOwnerName={post.creator}
            isOwner={mine}
            privateThoughts={post.thoughtsPrivate}
            startOpen={composer > 0 && !mine}
          />
        </section>
      )}
    </div>
  );
}

export function MomentDetail({
  post: openPost,
  owned,
  onOpenChange,
  replyOpen = false,
}: {
  post: Post | null;
  /** Whose Moment it is, when the surface already knows. Worked out from the Moment otherwise. */
  owned?: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open on the thoughts with the box showing (MomentPage's ?reply=1). */
  replyOpen?: boolean;
}) {
  // Keep showing the last Moment while the dialog closes; the parent clears `post` first.
  const last = useRef<Post | null>(openPost);
  if (openPost) last.current = openPost;
  const post = openPost ?? last.current;
  if (!post) return null;
  return (
    <Dialog open={!!openPost} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-lg gap-2 overflow-y-auto !outline-none"
        data-moment-detail={post.id}
        // Focus the Moment itself, not its first control: opening it should not light up a button.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
        }}
      >
        <Opened key={post.id} post={post} owned={owned} replyOpen={replyOpen} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
