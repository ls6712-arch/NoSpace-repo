import { useLayoutEffect, useRef, useState } from "react";
import type { Post } from "../../data/posts";
import { useSocial } from "../../context/SocialContext";
import { hasRealMedia } from "./MomentMedia";

/**
 * The caption under a Moment: two lines, then "more", which opens it in place.
 * Under it, "See thoughts" when there are any (it opens the Moment at them).
 * A text-only Moment already shows its words in the tile, so they are not
 * repeated here.
 */
export function MomentCaption({
  post,
  full = false,
  onThoughts,
}: {
  post: Post;
  /** The Moment itself: the whole caption, and its thoughts are right below. */
  full?: boolean;
  onThoughts?: () => void;
}) {
  const social = useSocial();
  const [open, setOpen] = useState(full);
  const [clamped, setClamped] = useState(false);
  const text = useRef<HTMLParagraphElement>(null);
  const caption = hasRealMedia(post) ? post.caption.trim() : "";
  const hasThoughts = !post.isPrivateLog && social.thoughtsFor(post.id).length > 0;

  useLayoutEffect(() => {
    const el = text.current;
    if (!el || open) return;
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [caption, open]);

  if (!caption && !(hasThoughts && onThoughts)) return null;

  return (
    <div className="mt-0.5 flex flex-col items-start" data-moment-caption>
      {caption && (
        <div className="w-full text-body leading-snug">
          <p ref={text} className={`whitespace-pre-line break-words ${open ? "" : "line-clamp-2"}`}>
            {caption}
          </p>
          {clamped && !open && (
            <button type="button" onClick={() => setOpen(true)} className="-my-2.5 py-2.5 text-muted-foreground hover:text-foreground">
              more
            </button>
          )}
        </div>
      )}
      {hasThoughts && onThoughts && !full && (
        <button type="button" onClick={onThoughts} className="mt-1.5 -mb-2.5 py-2.5 text-small text-muted-foreground hover:text-foreground">
          See thoughts
        </button>
      )}
    </div>
  );
}
