import { useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { Heart } from "lucide-react";
import type { Post } from "../../data/posts";
import { subHobbyLabel } from "../../data/hobbies";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { PillButton } from "../ui/PillButton";
import { RollNumber } from "../ui/RollNumber";
import { SnapCarousel } from "../ui/SnapCarousel";
import { PostMediaCarousel } from "../PostMediaCarousel";
import { useReactionState } from "../../lib/reactionState";
import { formatWhen } from "../../lib/dates";
import { haptic, pop } from "../../lib/motionTokens";
import { cornerPath } from "../../lib/cornerPath";
import type { FeedSource } from "../../lib/homeFeed";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/** The "Love this" reaction: a heart burst, the count rolls, a light tap on a phone. */
function LoveThis({ post }: { post: Post }) {
  const { mine, toggle } = useReactionState(post.id);
  const loved = mine.includes("love");
  const count = post.loveCount ?? 0;
  const [burst, setBurst] = useState(0);
  return (
    <PillButton
      variant="outline"
      aria-pressed={loved}
      aria-label={loved ? "Loved. Tap to undo" : "Love this"}
      className="relative"
      onClick={() => {
        if (!loved) {
          haptic();
          setBurst((n) => n + 1);
        }
        toggle("love");
      }}
    >
      <span className="relative inline-flex items-center gap-1.5">
        <span className="relative inline-flex size-4 items-center justify-center">
          <Heart className="size-4" fill={loved ? "currentColor" : "none"} aria-hidden="true" />
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
        <span>Love this</span>
        {count > 0 && <RollNumber value={count} />}
      </span>
    </PillButton>
  );
}

/**
 * One Moment on Home: who and where, the photo (a snap carousel for several),
 * the caption, then Love this and one action that fits the Moment.
 */
export function FeedCard({
  post,
  source,
  onOpen,
  priority,
}: {
  post: Post;
  source: FeedSource;
  onOpen: (post: Post) => void;
  priority?: boolean;
}) {
  const corner = post.corner ?? post.subHobby;
  const cornerName = (post.interest || (corner ? subHobbyLabel(corner) : undefined)) ?? "";
  const meta = [cornerName, post.city, post.locationName, formatWhen(post.createdAt)].filter(Boolean).join(" · ");
  const media = post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls : post.media ? [post.media] : [];
  const upcoming = post.startsAt != null && post.startsAt > Date.now();
  const { mine, toggle } = useReactionState(post.id);
  const going = mine.includes("in");
  const hasPhoto = post.type !== "written" && media.length > 0;

  return (
    <article className="border-b border-border pb-5" aria-label={`${post.creator}, ${meta}`} data-feed-source={source}>
      <div className="flex items-center gap-3 py-3">
        <Avatar className="size-10 shrink-0">
          <AvatarFallback className="text-small">{initials(post.creator)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-body font-semibold">{post.creator}</p>
          <p className="truncate text-small text-muted-foreground">{meta}</p>
        </div>
      </div>

      {hasPhoto &&
        (media.length > 1 && post.type === "photo" ? (
          <SnapCarousel
            items={media}
            getKey={(u, i) => `${u}-${i}`}
            label="Photos"
            name={`home-${post.id}`}
            dots
            itemClassName="w-[calc(100%-1.5rem)]"
            renderItem={(url) => (
              <button type="button" onClick={() => onOpen(post)} className="block aspect-[4/3] w-full overflow-hidden rounded-card" aria-label="Open this Moment">
                <PostMediaCarousel media={[url]} type="photo" hobbySlug={post.hobbySlug} seed={post.id} className="size-full object-cover" width={640} />
              </button>
            )}
          />
        ) : (
          <button type="button" onClick={() => onOpen(post)} className="block aspect-[4/3] w-full overflow-hidden rounded-card" aria-label="Open this Moment">
            <PostMediaCarousel media={media} type={post.type} hobbySlug={post.hobbySlug} seed={post.id} className="size-full object-cover" width={640} priority={priority} preview />
          </button>
        ))}

      {post.caption && (
        <button type="button" onClick={() => onOpen(post)} className="mt-3 block w-full text-left text-body leading-snug">
          <span className="line-clamp-3">{post.caption}</span>
        </button>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <LoveThis post={post} />
        {upcoming ? (
          <PillButton variant="primary" done={going} doneLabel="You’re in" onClick={() => toggle("in")}>
            Count me in
          </PillButton>
        ) : source === "space" && corner ? (
          <Link
            to={cornerPath(post.hobbySlug, corner)}
            className="inline-flex min-h-11 items-center rounded-full bg-foreground px-5 text-body font-semibold text-background"
          >
            See {cornerName || "this Corner"}
          </Link>
        ) : null}
      </div>
    </article>
  );
}
