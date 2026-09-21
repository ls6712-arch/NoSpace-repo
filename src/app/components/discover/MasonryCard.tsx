import { Post } from "../../data/posts";
import { hasRealMedia } from "./discoverMedia";
import { PhotoCard } from "./PhotoCard";
import { VideoCard } from "./VideoCard";
import { QuoteCard } from "./QuoteCard";

/** Picks the right tile shape for a Moment: a real video gets VideoCard, a
 * real photo gets PhotoCard, and anything with no real media of its own
 * gets QuoteCard — words carried by a caption rather than a picture of the
 * thing itself. */
export function MasonryCard({ post }: { post: Post }) {
  if (!hasRealMedia(post)) return <QuoteCard post={post} />;
  if (post.type === "video") return <VideoCard post={post} />;
  return <PhotoCard post={post} />;
}
