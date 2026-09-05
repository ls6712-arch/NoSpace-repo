import { CalendarDays, MapPin, Play, ShoppingBag, Users, UserRound } from "lucide-react";
import { PostReactions } from "./PostReactions";
import { Thoughts } from "./Thoughts";
import { PersonActions } from "./PersonActions";
import { displayLocation } from "../data/participation";
import { useSocial } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
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

export function ContentCard({ post, label }: { post: Post; label?: string }) {
  const { findListing } = useContent();
  const social = useSocial();
  const { user } = useAuth();
  const isOwner = !!user && post.userId === user.id;

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
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--forest-ink)]/25">
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--forest-ink)]/55 backdrop-blur-md">
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
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {/* The maker's name is the way to them. Sample posts have no account
              behind them, so those stay plain text rather than a dead link. */}
          {post.userId ? (
            <Link
              to={`/u/${encodeURIComponent(post.userId)}`}
              className="flex min-w-0 items-center gap-2 transition-colors hover:text-[var(--coral-text)]"
            >
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="text-[10px]">{initials(post.creator)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-foreground/90">{post.creator}</span>
            </Link>
          ) : (
            <>
              <Avatar className="size-7">
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
        <p className="text-sm text-muted-foreground mb-3">{post.caption}</p>

        {/* What it's about, in the maker's words. A subject, not a hashtag —
            it links to everyone else working on the same thing. */}
        {post.interest && (
          <Link
            to={`/discover?about=${encodeURIComponent(post.interest)}`}
            className="mb-3 inline-flex rounded-full border border-[var(--hairline)] bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[var(--foreground)]/30 hover:text-foreground"
          >
            {post.interest}
          </Link>
        )}

        {/* When it's a thing happening, say when and where — and let people in. */}
        {isActivity && (
          <div className="mb-3 rounded-xl border border-[var(--hairline)] bg-surface px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-xs">
              <CalendarDays className="size-3.5 shrink-0 text-[var(--forest)]" />
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

        {/* Every entry carries the same reactions, Save among them. */}
        <PostReactions postId={post.id} className="mb-3" />

        <Thoughts
          postId={post.id}
          postOwnerId={post.userId}
          postOwnerName={post.creator}
          isOwner={isOwner}
          privateThoughts={post.thoughtsPrivate}
          className="mb-3"
        />

        {!isOwner && (
          <PersonActions
            personName={post.creator}
            personId={post.userId}
            hobbyKeys={[post.subHobby ?? `space:${post.hobbySlug}`]}
            className="mb-3"
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
