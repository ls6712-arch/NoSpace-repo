import { Link } from "react-router";
import { Compass, ShoppingBag, Users, UserRound } from "lucide-react";
import { Post } from "../../data/posts";
import { useContent } from "../../context/ContentContext";
import { PostReactions } from "../PostReactions";
import { Thoughts } from "../Thoughts";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AUDIENCE: Record<string, { label: string; icon: typeof Users }> = {
  circle: { label: "A Circle", icon: Users },
  friends: { label: "Connections", icon: UserRound },
};

/** The maker's name and audience — the same byline ContentCard has always
 * shown, pulled out so every masonry card shape (photo, video, quote) shows
 * it identically. */
export function CardByline({ post }: { post: Post }) {
  const audience = AUDIENCE[post.visibility];
  return (
    <div className="mb-2 flex items-center gap-2">
      {post.userId ? (
        <Link
          to={`/u/${encodeURIComponent(post.userId)}`}
          className="flex min-w-0 items-center gap-2 transition-colors hover:text-[var(--coral-text)]"
        >
          <Avatar className="size-6 shrink-0">
            <AvatarFallback className="text-[10px]">{initials(post.creator)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm text-foreground/90">{post.creator}</span>
        </Link>
      ) : (
        <>
          <Avatar className="size-6 shrink-0">
            <AvatarFallback className="text-[10px]">{initials(post.creator)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm text-foreground/90">{post.creator}</span>
        </>
      )}
      {audience && (
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <audience.icon className="size-3" />
          {audience.label}
        </span>
      )}
    </div>
  );
}

/** What it's about, as a real "Explore this Corner" link — ContentCard's own
 * showExploreCorner treatment (see ContentCard.tsx), reused rather than
 * reinvented: a Moment mixing every Corner and Space is exactly what
 * Discover's masonry feed is. */
export function CornerChip({ post }: { post: Post }) {
  if (!post.interest) return null;
  if (post.subHobby) {
    return (
      <Link
        to={`/space/${post.hobbySlug}?hobby=${encodeURIComponent(post.subHobby)}`}
        title={`Explore this Corner: ${post.interest}`}
        aria-label={`Explore this Corner: ${post.interest}`}
        className="mb-3 inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[var(--foreground)]/30 hover:text-foreground"
      >
        <Compass className="size-3 shrink-0" strokeWidth={1.9} />
        {post.interest}
      </Link>
    );
  }
  return (
    <Link
      to={`/discover?about=${encodeURIComponent(post.interest)}`}
      className="mb-3 inline-flex rounded-full border border-[var(--hairline)] bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[var(--foreground)]/30 hover:text-foreground"
    >
      {post.interest}
    </Link>
  );
}

/** The three reactions plus "Add a thought" — PostReactions.tsx and
 * Thoughts.tsx exactly as every other card already uses them, not a new
 * interaction row built for masonry. */
export function CardActions({ post }: { post: Post }) {
  const { findListing } = useContent();
  const listing = post.productId ? findListing(post.productId) : undefined;
  return (
    <>
      <PostReactions postId={post.id} compact className="mb-2" />
      <Thoughts
        postId={post.id}
        postOwnerId={post.userId}
        postOwnerName={post.creator}
        compact
        className="mb-2"
      />
      {listing && (
        <Link to={`/product/${listing.id}`}>
          <Button size="sm" variant="outline" className="w-full">
            <ShoppingBag className="size-3.5" />
            {listing.type === "course" ? "View course" : listing.type === "digital" ? "Get the guide" : "Shop this"}{" "}
            · ${listing.price.toFixed(0)}
          </Button>
        </Link>
      )}
    </>
  );
}
