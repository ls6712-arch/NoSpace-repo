import { useState } from "react";
import { Link } from "react-router";
import { Heart, Play, Plus } from "lucide-react";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { getHobby } from "../data/hobbies";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { PostMedia } from "./PostMedia";

export function MyPostsGrid() {
  const { myPosts, findListing } = useContent();
  const [selected, setSelected] = useState<Post | null>(null);

  if (myPosts.length === 0) {
    return (
      <div className="text-center py-14 rounded-2xl border border-dashed border-border">
        <p className="text-muted-foreground mb-4">
          Nothing here yet — your work will show up in a grid, just like this.
        </p>
        <Link to="/log">
          <Button variant="brand">
            <Plus className="size-4" />
            Log your first thing
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {myPosts.map((post) => (
          <button
            key={post.id}
            onClick={() => setSelected(post)}
            className="relative aspect-square overflow-hidden rounded-md sm:rounded-xl group"
          >
            <PostMedia
              media={post.media}
              type={post.type}
              hobbySlug={post.hobbySlug}
              seed={post.id}
              className="h-full w-full transition-transform duration-300 group-hover:scale-105"
            />
            {post.type === "video" && (
              <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-black/50">
                <Play className="size-2.5 text-white fill-white" />
              </span>
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 group-hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-all text-white text-sm">
              <Heart className="size-3.5 fill-white" />
              {post.likes}
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
          {selected && (
            <>
              <DialogTitle className="sr-only">{selected.caption}</DialogTitle>
              <div className="aspect-square overflow-hidden">
                <PostMedia
                  media={selected.media}
                  type={selected.type}
                  hobbySlug={selected.hobbySlug}
                  seed={selected.id}
                  className="h-full w-full"
                />
              </div>
              <div className="p-5">
                <div className="text-xs text-[var(--coral-text)] mb-1">
                  {getHobby(selected.hobbySlug)?.shortName}
                </div>
                <p className="text-sm mb-3">{selected.caption}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Heart className="size-3.5" />
                  {selected.reflection ? "Has a private reflection" : "No private reflection"}
                </div>
                {selected.reflection && (
                  <div className="mt-3 rounded-xl border border-border bg-surface-muted p-3">
                    <div className="text-[10px] text-muted-foreground tracking-wide mb-1">
                      YOUR REFLECTION · PRIVATE
                    </div>
                    <p className="text-xs text-muted-foreground">{selected.reflection}</p>
                  </div>
                )}
                {selected.productId && findListing(selected.productId) && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Listed for ${findListing(selected.productId)!.price.toFixed(0)} in the marketplace
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
