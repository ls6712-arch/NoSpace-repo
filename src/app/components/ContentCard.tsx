import { Heart, Play, ShoppingBag, Users, UserRound } from "lucide-react";
import { Link } from "react-router";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { useRewards } from "../context/RewardsContext";
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

// Varying aspect ratios per post gives the masonry feed its natural, uneven rhythm
// even though every card is generated art rather than a photo of a different shape.
const ASPECTS = ["aspect-square", "aspect-[4/5]", "aspect-[3/4]", "aspect-[5/4]"];

export function ContentCard({ post }: { post: Post }) {
  const { toggleLike, findListing } = useContent();
  const { isPostLiked } = useRewards();
  const liked = isPostLiked(post.id);
  const listing = post.productId ? findListing(post.productId) : undefined;
  const aspect = ASPECTS[Math.abs(post.id) % ASPECTS.length];

  return (
    <div className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-card group">
      <div className="relative overflow-hidden">
        <PostMedia
          media={post.media}
          type={post.type}
          hobbySlug={post.hobbySlug}
          seed={post.id}
          className={`w-full ${aspect} transition-transform duration-500 group-hover:scale-105`}
        />
        {post.type === "video" && !/^https?:\/\//.test(post.media) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="flex size-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-md">
              <Play className="size-5 text-white fill-white" />
            </span>
          </div>
        )}
        <button
          onClick={() => toggleLike(post.id)}
          className={`absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs backdrop-blur-md transition-colors ${
            liked ? "bg-[#D8739B] text-white" : "bg-black/40 text-white hover:bg-black/60"
          }`}
        >
          <Heart className={`size-3.5 ${liked ? "fill-white" : ""}`} />
          {post.likes}
        </button>
        {listing && (
          <Badge variant="brand" className="absolute top-3 left-3">
            For sale
          </Badge>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="size-7">
            <AvatarFallback className="text-[10px]">{initials(post.creator)}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-foreground/90">{post.creator}</span>
          {post.visibility !== "public" && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
              {post.visibility === "circle" ? (
                <Users className="size-3" />
              ) : (
                <UserRound className="size-3" />
              )}
              {post.visibility === "circle" ? "Circle" : "Friends"}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-3">{post.caption}</p>

        {listing && (
          <Link to={`/product/${listing.id}`}>
            <Button size="sm" variant="outline" className="w-full">
              <ShoppingBag className="size-3.5" />
              {listing.type === "course" ? "View course" : listing.type === "digital" ? "Get the guide" : "Shop this"} · ${listing.price.toFixed(0)}
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
