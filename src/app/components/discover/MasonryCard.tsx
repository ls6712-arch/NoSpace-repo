import { Post } from "../../data/posts";
import { PhotoCard } from "./PhotoCard";
import { VideoCard } from "./VideoCard";
import { QuoteCard } from "./QuoteCard";

/** Picks the right tile shape for a Moment by its own postType — not by
 * whether a real photo happens to be attached, so a "photo" Moment whose
 * upload failed to load still renders as PhotoCard (with GeneratedArt as
 * its own internal fallback) rather than getting reclassified as Written. */
export function MasonryCard({ post }: { post: Post }) {
  if (post.type === "written") return <QuoteCard post={post} />;
  if (post.type === "video") return <VideoCard post={post} />;
  return <PhotoCard post={post} />;
}
