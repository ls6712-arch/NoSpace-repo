import { useState } from "react";
import { Link } from "react-router";
import { Globe2, Lock, UserRound } from "lucide-react";
import type { Post } from "../../data/posts";
import { isOnlyYou, visibilityWord } from "../../lib/visibility";
import { ERROR_LINE } from "../../lib/stateCopy";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { notifyError } from "../ui/toaster";
import { MomentMenu } from "./MomentMenu";
import { momentCorner, momentPlace, momentWhen } from "./momentMeta";
import { useFollowState } from "./useFollowState";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

const DOT = <span aria-hidden="true"> · </span>;

/**
 * The top of every Moment: the avatar and name (they open the profile), one
 * meta line, `{Corner} · {place} · {when}`, with the Corner's name linking to
 * the Corner, then Follow and ⋯ on the right.
 *
 * - Follow ("Follow", "Follow back", "Requested") shows when it is not your
 *   Moment and you do not follow them yet, on every surface.
 * - On your own Moment the meta line ends with who sees it; tapping that opens
 *   "Change who sees this".
 */
export function MomentHeader({
  post,
  mine,
  avatarUrl,
  onFollowed,
  onDeleted,
}: {
  post: Post;
  mine: boolean;
  avatarUrl?: string;
  /** After a follow request from this card is saved. */
  onFollowed?: () => void;
  onDeleted?: () => void;
}) {
  const corner = momentCorner(post);
  const place = momentPlace(post);
  const when = momentWhen(post);
  const { label, request } = useFollowState(mine ? undefined : post.userId);
  const [asking, setAsking] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const profile = post.userId ? `/u/${encodeURIComponent(post.userId)}` : undefined;
  const AudienceIcon = isOnlyYou(post) ? Lock : post.visibility === "followers" ? UserRound : Globe2;
  const audience = visibilityWord(post);

  const follow = async () => {
    if (asking) return;
    setAsking(true);
    const ok = await request();
    setAsking(false);
    if (!ok) return notifyError(ERROR_LINE);
    onFollowed?.();
  };

  const face = (
    <Avatar className="size-10 shrink-0">
      {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
      <AvatarFallback className="text-small">{initials(post.creator)}</AvatarFallback>
    </Avatar>
  );

  return (
    <header className="flex items-center gap-3 py-3" data-moment-header>
      {profile ? (
        <Link to={profile} aria-hidden="true" tabIndex={-1} className="shrink-0">
          {face}
        </Link>
      ) : (
        face
      )}
      <div className="min-w-0 flex-1">
        {profile ? (
          <Link to={profile} className="block truncate text-body font-semibold hover:underline">
            {post.creator}
          </Link>
        ) : (
          <p className="truncate text-body font-semibold">{post.creator}</p>
        )}
        {/* Wraps onto a second line before it would cut off the day and time of a session. */}
        <p className="break-words text-small text-muted-foreground" data-moment-meta>
          <span>
            {corner && (
              <Link to={corner.to} className="underline underline-offset-2 hover:text-foreground">
                {corner.name}
              </Link>
            )}
            {corner && place && DOT}
            {place}
            {(corner || place) && when && DOT}
            {when}
          </span>
          {mine && !post.isPrivateLog && (
            <>
              {DOT}
              <button
                type="button"
                onClick={() => setAudienceOpen(true)}
                aria-label={`Change who sees this. ${audience}`}
                className="-my-3 inline-flex items-center gap-1 whitespace-nowrap py-3 align-bottom hover:text-foreground"
              >
                <AudienceIcon className="size-3.5" aria-hidden="true" />
                {audience}
              </button>
            </>
          )}
        </p>
      </div>
      {label && (
        <button
          type="button"
          disabled={label === "Requested" || asking}
          onClick={() => void follow()}
          // 36px tall to sit in the row; the ::before stretches the tap area to 44px.
          className="relative inline-flex min-h-9 shrink-0 items-center rounded-full border border-foreground/25 px-4 text-small font-semibold text-foreground outline-none before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-foreground"
        >
          {label}
        </button>
      )}
      <MomentMenu post={post} mine={mine} onDeleted={onDeleted} audienceOpen={audienceOpen} onAudienceOpenChange={setAudienceOpen} />
    </header>
  );
}
