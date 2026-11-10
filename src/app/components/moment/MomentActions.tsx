import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import type { Post } from "../../data/posts";
import { useContent } from "../../context/ContentContext";
import { useReactionState } from "../../lib/reactionState";
import { isOnlyYou } from "../../lib/visibility";
import { formatCount } from "../../lib/formatCount";
import { haptic, pop } from "../../lib/motionTokens";
import { track } from "../../lib/analytics";
import { SendToChatDialog } from "../SendToChatDialog";
import { useSaved } from "./useSaved";
import { momentLink } from "./momentMeta";

const ICON_BTN =
  "relative flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-control px-2.5 text-body font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
const ICON = "size-6 shrink-0";

/** Love a Moment from anywhere in `components/moment`: the icon and a double tap share it. Never un-loves. */
export function useLove(postId: number) {
  const { mine, toggle } = useReactionState(postId);
  const loved = mine.includes("love");
  return {
    loved,
    toggle: () => toggle("love"),
    /** Loves it if it is not loved yet. Returns whether it changed. */
    love: (via: "icon" | "double_tap") => {
      if (loved) return false;
      haptic();
      toggle("love");
      if (via === "double_tap") track({ name: "moment_double_tap_loved", postId });
      return true;
    },
  };
}

/** A count next to an icon. Zero shows the bare icon, never "0". */
function Count({ n }: { n: number }) {
  return n > 0 ? <span className="tabular-nums">{formatCount(n)}</span> : null;
}

/**
 * The one icon row under every Moment: Love this, Thoughts and Send to on the
 * left, Save on the right. All icons, 44px, no words.
 *
 * Counts (loves, thoughts, saves) show only on your own Moment, each next to
 * its icon. Nobody else sees a number.
 */
export function MomentActions({
  post,
  mine,
  onThoughts,
}: {
  post: Post;
  /** Your own Moment: counts instead of Love and Save. */
  mine: boolean;
  /** Opens the Moment at its thoughts. */
  onThoughts: () => void;
}) {
  const { posts, ownCounts } = useContent();
  const reduceMotion = useReducedMotion();
  const { loved, toggle, love } = useLove(post.id);
  const { saved, toggle: toggleSave } = useSaved(post.id);
  const [burst, setBurst] = useState(0);
  const [sendOpen, setSendOpen] = useState(false);

  // A private-log stand-in was never a row anyone could react to, and nobody but you sees an "Only you" Moment.
  if (post.isPrivateLog || (mine && isOnlyYou(post))) return null;

  // The live row, so a number moves even when the caller holds an older copy of the Moment.
  const live = posts.find((p) => p.id === post.id) ?? post;
  const canSend = !isOnlyYou(post);

  const sendButton = canSend && (
    <button type="button" aria-label="Send to" onClick={() => setSendOpen(true)} className={ICON_BTN}>
      <Send className={ICON} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );

  return (
    <div className="-mx-2.5 flex items-center" data-moment-actions>
      {mine ? (
        <>
          <span role="img" aria-label={`Love this, ${live.loveCount ?? 0}`} className={ICON_BTN} data-count="loves">
            <Heart className={ICON} strokeWidth={1.8} aria-hidden="true" />
            <Count n={live.loveCount ?? 0} />
          </span>
          <button type="button" aria-label={`Thoughts, ${ownCounts[post.id]?.thoughts ?? 0}`} onClick={onThoughts} className={ICON_BTN} data-count="thoughts">
            <MessageCircle className={ICON} strokeWidth={1.8} aria-hidden="true" />
            <Count n={ownCounts[post.id]?.thoughts ?? 0} />
          </button>
          {sendButton}
          <span className="flex-1" />
          <span role="img" aria-label={`Saved, ${live.saveCount ?? 0}`} className={ICON_BTN} data-count="saves">
            <Bookmark className={ICON} strokeWidth={1.8} aria-hidden="true" />
            <Count n={live.saveCount ?? 0} />
          </span>
        </>
      ) : (
        <>
          <button
            type="button"
            aria-pressed={loved}
            aria-label={loved ? "Loved" : "Love this"}
            onClick={() => {
              if (loved) return toggle();
              love("icon");
              if (!reduceMotion) setBurst((n) => n + 1);
            }}
            className={`${ICON_BTN} ${loved ? "text-[var(--accent-text)]" : ""}`}
          >
            <span className="relative flex">
              <Heart className={ICON} strokeWidth={1.8} fill={loved ? "currentColor" : "none"} aria-hidden="true" />
              <AnimatePresence>
                {burst > 0 && loved && (
                  <motion.span
                    key={burst}
                    aria-hidden="true"
                    initial={{ scale: 0.6, opacity: 0.9 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={pop}
                    className="absolute inset-0 rounded-full border border-current"
                  />
                )}
              </AnimatePresence>
            </span>
          </button>
          <button type="button" aria-label="Thoughts" onClick={onThoughts} className={ICON_BTN}>
            <MessageCircle className={ICON} strokeWidth={1.8} aria-hidden="true" />
          </button>
          {sendButton}
          <span className="flex-1" />
          <button type="button" aria-pressed={saved} aria-label={saved ? "Saved" : "Save"} onClick={toggleSave} className={ICON_BTN}>
            <Bookmark className={ICON} strokeWidth={1.8} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        </>
      )}
      {canSend && <SendToChatDialog open={sendOpen} onOpenChange={setSendOpen} kind="moment" postId={post.id} share={{ url: momentLink(post.id), text: post.caption }} />}
    </div>
  );
}
