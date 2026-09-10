import { CalendarDays, Compass, MapPin, Play, ShoppingBag, Users, UserRound } from "lucide-react";
import { PostReactions } from "./PostReactions";
import { PostBookmark } from "./PostBookmark";
import { Thoughts } from "./Thoughts";
import { PersonActions } from "./PersonActions";
import { displayLocation } from "../data/participation";
import { getCircle } from "../data/circles";
import { useSocial } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
import { useCorners } from "../context/CornersContext";
import { Link } from "react-router";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { PostMedia } from "./PostMedia";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * How an entry describes its own audience. Deliberately the same words the
 * maker chose in "Choose who sees this", so nothing is renamed between the
 * moment you set it and the moment someone reads it.
 */
const AUDIENCE: Record<string, { label: string; icon: typeof Users }> = {
  circle: { label: "A Circle", icon: Users },
  friends: { label: "Connections", icon: UserRound },
};

// Varying aspect ratios give the gallery its natural, uneven rhythm even though
// every card is generated art rather than a photo of a different shape.
const ASPECTS = ["aspect-square", "aspect-[4/5]", "aspect-[3/4]", "aspect-[5/4]"];

export function ContentCard({
  post,
  label,
  compact = false,
  showExploreCorner = false,
}: {
  post: Post;
  label?: string;
  /**
   * A tighter, more image-forward presentation of the exact same card —
   * same media, same caption, same three reactions plus the Bookmark badge, same Thoughts
   * and PersonActions, same everything — just less padding and a smaller
   * reaction/action grid, for a denser grid like Discover's All Moments.
   * Every other call site leaves this off and is pixel-identical to before.
   */
  compact?: boolean;
  /**
   * Turns the "what it's about" chip into a real "Explore this Corner"
   * browse link (straight to that Corner's own filtered Space feed) instead
   * of the plain /discover?about= search shortcut every other card still
   * uses. Discover's own feed is the one place a card can come from any
   * Corner or Space at once, so it's the only place this browse action
   * belongs — My Space and a Space's own feed already show one Corner's
   * (or one person's) work, so it would be redundant there.
   */
  showExploreCorner?: boolean;
}) {
  const { findListing } = useContent();
  const social = useSocial();
  const { user } = useAuth();
  const { cornersFor } = useCorners();
  const isOwner = !!user && post.userId === user.id;

  // The narrowest real scope this Moment actually belongs to, if any — so
  // Invite can default straight to it instead of the whole Space. A Circle
  // (a deliberate, existing membership) wins over a Corner (a topic tag) if
  // a Moment somehow carries both; see PersonActions' own narrowContext.
  const postCircle = post.visibility === "circle" && post.circleId ? getCircle(post.circleId) : undefined;
  const postCorner = post.subHobby
    ? cornersFor(post.hobbySlug).find((c) => c.slug === post.subHobby)
    : undefined;

  // An activity is a moment with a time attached — a photo walk, a workshop,
  // a meetup. Everything else is just a moment and gets none of this.
  const isActivity = !!post.startsAt;
  const place = displayLocation(post.locationName, post.locationPrivacy);
  const going = social.goingCount(post.id);
  const listing = post.productId ? findListing(post.productId) : undefined;
  const aspect = ASPECTS[Math.abs(post.id) % ASPECTS.length];
  const audience = AUDIENCE[post.visibility];

  return (
    <div className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card group">
      <div className="relative overflow-hidden">
        <PostMedia
          media={post.media}
          type={post.type}
          hobbySlug={post.hobbySlug}
          seed={post.id}
          className={`w-full ${aspect} transition-transform duration-500 group-hover:scale-105`}
        />
        {post.type === "video" && !/^https?:\/\//.test(post.media) && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--void)]/25">
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--void)]/55 backdrop-blur-md">
              <Play className="size-5 text-white fill-white" />
            </span>
          </div>
        )}
        {label && (
          <Badge variant="brand" className="absolute top-3 left-3">
            {label}
          </Badge>
        )}
        {!label && listing && (
          <Badge variant="brand" className="absolute top-3 left-3">
            For sale
          </Badge>
        )}
        <PostBookmark postId={post.id} />
      </div>

      <div className={compact ? "p-3" : "p-4"}>
        <div className={`flex items-center gap-2 ${compact ? "mb-1.5" : "mb-2"}`}>
          {/* The maker's name is the way to them. Sample posts have no account
              behind them, so those stay plain text rather than a dead link. */}
          {post.userId ? (
            <Link
              to={`/u/${encodeURIComponent(post.userId)}`}
              className="flex min-w-0 items-center gap-2 transition-colors hover:text-[var(--coral-text)]"
            >
              <Avatar className={compact ? "size-6 shrink-0" : "size-7 shrink-0"}>
                <AvatarFallback className="text-[10px]">{initials(post.creator)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-foreground/90">{post.creator}</span>
            </Link>
          ) : (
            <>
              <Avatar className={compact ? "size-6" : "size-7"}>
                <AvatarFallback className="text-[10px]">{initials(post.creator)}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground/90">{post.creator}</span>
            </>
          )}
          {audience && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <audience.icon className="size-3" />
              {audience.label}
            </span>
          )}
        </div>
        <p className={`text-sm text-muted-foreground ${compact ? "mb-2 line-clamp-2" : "mb-3"}`}>{post.caption}</p>

        {/* What it's about, in the maker's words. A subject, not a hashtag.
            On Discover, where one feed mixes every Corner and Space, this
            becomes a real browse action straight to that Corner's own
            filtered feed; everywhere else it stays the plain word-search
            shortcut it always was. Only a post with a real subHobby has an
            actual Corner feed to send someone to — free-text-only interest
            keeps the search fallback rather than fabricating a route. */}
        {post.interest &&
          (showExploreCorner && post.subHobby ? (
            <Link
              to={`/space/${post.hobbySlug}?hobby=${encodeURIComponent(post.subHobby)}`}
              title={`Explore this Corner: ${post.interest}`}
              aria-label={`Explore this Corner: ${post.interest}`}
              className={`inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[var(--foreground)]/30 hover:text-foreground ${compact ? "mb-2" : "mb-3"}`}
            >
              <Compass className="size-3 shrink-0" strokeWidth={1.9} />
              {post.interest}
            </Link>
          ) : (
            <Link
              to={`/discover?about=${encodeURIComponent(post.interest)}`}
              className={`inline-flex rounded-full border border-[var(--hairline)] bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[var(--foreground)]/30 hover:text-foreground ${compact ? "mb-2" : "mb-3"}`}
            >
              {post.interest}
            </Link>
          ))}

        {/* When it's a thing happening, say when and where — and let people in. */}
        {isActivity && (
          <div className={`rounded-xl border border-[var(--hairline)] bg-surface px-3.5 py-3 ${compact ? "mb-2" : "mb-3"}`}>
            <div className="flex items-center gap-1.5 text-xs">
              <CalendarDays className="size-3.5 shrink-0 text-foreground" />
              {new Date(post.startsAt!).toLocaleString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
            {place && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                {place}
              </div>
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              {going} {going === 1 ? "person" : "people"} going
            </div>
          </div>
        )}

        {/* Every moment carries the same three reactions. Save lives on the photo now, as PostBookmark. */}
        <PostReactions postId={post.id} compact={compact} className={compact ? "mb-2" : "mb-3"} />

        <Thoughts
          postId={post.id}
          postOwnerId={post.userId}
          postOwnerName={post.creator}
          isOwner={isOwner}
          privateThoughts={post.thoughtsPrivate}
          compact={compact}
          className={compact ? "mb-2" : "mb-3"}
        />

        {!isOwner && (
          // Explore off: repeating "follow this hobby" on every card of a
          // feed already scoped to a hobby was redundant, and confusable
          // with the Space-hero's own "Explore" a few inches above the
          // whole feed. It's still offered from the Space hero and from a
          // person's own profile — this is only the per-post row.
          <PersonActions
            personName={post.creator}
            personId={post.userId}
            hobbyKeys={[post.subHobby ?? `space:${post.hobbySlug}`]}
            showExplore={false}
            corner={
              postCorner ? { spaceSlug: post.hobbySlug, slug: postCorner.slug, name: postCorner.name } : undefined
            }
            circle={postCircle ? { id: postCircle.id, hobbySlug: postCircle.hobbySlug, name: postCircle.name } : undefined}
            compact={compact}
            className={compact ? "mb-2" : "mb-3"}
          />
        )}

        {listing && (
          <Link to={`/product/${listing.id}`}>
            <Button size="sm" variant="outline" className="w-full">
              <ShoppingBag className="size-3.5" />
              {listing.type === "course"
                ? "View course"
                : listing.type === "digital"
                  ? "Get the guide"
                  : "Shop this"}{" "}
              · ${listing.price.toFixed(0)}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
