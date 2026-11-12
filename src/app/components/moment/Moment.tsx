import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import type { Post } from "../../data/posts";
import { useAuth } from "../../context/AuthContext";
import { useContent } from "../../context/ContentContext";
import { MomentActions, useLove } from "./MomentActions";
import { MomentCaption } from "./MomentCaption";
import { MomentHeader } from "./MomentHeader";
import { MomentMedia } from "./MomentMedia";
import { isOwnMoment } from "./momentMeta";
import { wantThoughts } from "./thoughtsIntent";

/** The newest copy of a Moment the app holds, so an edit (who sees it, its Corner) shows at once on every card. */
export function useLivePost(post: Post): Post {
  const { posts } = useContent();
  if (post.isPrivateLog) return post;
  return posts.find((p) => p.id === post.id) ?? post;
}

/**
 * One Moment, the same everywhere: Home, Discover, Spaces, Corner walls,
 * Pursuit pages and profiles. Header, media, the icon row, the caption. There
 * is no action button on a Moment; Save is the one "I want this".
 *
 * `onOpen` opens the Moment itself (each surface has its own way: a URL
 * param, local state). The Thoughts icon and "See thoughts" use it; with none,
 * they go to the Moment's own page.
 */
export function Moment({
  post: given,
  onOpen,
  priority = false,
  avatarUrl,
  note,
  onFollowed,
  className = "",
}: {
  post: Post;
  onOpen?: (post: Post) => void;
  /** Above the fold: the photo loads now. */
  priority?: boolean;
  avatarUrl?: string;
  /** Lines a surface adds under the caption (a Corner wall's "Started because of…"). Never a button. */
  note?: ReactNode;
  onFollowed?: (post: Post) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const post = useLivePost(given);
  const mine = isOwnMoment(post, user?.id);
  const { love } = useLove(post.id);

  const openThoughts = () => {
    wantThoughts(post.id);
    if (onOpen) onOpen(post);
    else navigate(`/moment/${post.id}?reply=1`);
  };

  return (
    <article className={`flex min-w-0 flex-col border-b border-border pb-5 ${className}`} aria-label={`${post.creator}’s Moment`} data-moment={post.id}>
      <MomentHeader post={post} mine={mine} avatarUrl={avatarUrl} onFollowed={onFollowed ? () => onFollowed(post) : undefined} />
      <MomentMedia post={post} priority={priority} onDoubleTap={mine || post.isPrivateLog ? undefined : () => love("double_tap")} />
      <div className="mt-1">
        <MomentActions post={post} mine={mine} onThoughts={openThoughts} />
      </div>
      <MomentCaption post={post} onThoughts={openThoughts} />
      {note && <div className="mt-2 flex flex-col gap-1 text-small">{note}</div>}
    </article>
  );
}

/** The grid a list of Moments sits in: one column on a phone, two from desktop width. */
export const MOMENT_LIST = "grid items-start gap-x-6 gap-y-2 desk:grid-cols-2";
