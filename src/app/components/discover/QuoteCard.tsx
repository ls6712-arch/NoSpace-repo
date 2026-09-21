import { Post } from "../../data/posts";
import { CardActions, CardByline, CornerChip } from "./DiscoverCardChrome";

/**
 * Masonry's "Written" tile — a Moment with no real uploaded photo or video
 * (see discoverMedia.ts). No image, so nothing here needs to reserve
 * height for one: the card is just the words, set in the app's serif
 * (var(--font-serif)) and italicized like a pull-quote, with a left accent
 * bar standing in for the photo every other card leads with.
 */
export function QuoteCard({ post }: { post: Post }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex gap-4 p-5">
        <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: "var(--coral-deep)" }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <CardByline post={post} />
          <p
            className="mb-3 text-lg italic leading-snug text-foreground"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {post.caption}
          </p>
          <CornerChip post={post} />
          <CardActions post={post} />
        </div>
      </div>
    </div>
  );
}
