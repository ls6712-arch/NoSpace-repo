import { useState } from "react";
import { Link } from "react-router";
import type { Post } from "../../data/posts";
import { ImageWithFallback } from "../ImageWithFallback";
import { SnapCarousel } from "../ui/SnapCarousel";
import { PillButton } from "../ui/PillButton";
import { ResponsiveSheet } from "../profile/ResponsiveSheet";
import { LoveThis } from "../home/FeedCard";
import { formatWhen } from "../../lib/dates";

/**
 * "Made by others": one strip of small square photos right under the Start
 * page's header. Tapping one opens it in a sheet over the page, so nothing the
 * person has ticked or chosen is lost. The sheet's one button is "Make this
 * too"; "See full Moment" is a small link for anyone who wants to leave.
 * No count anywhere. Hidden when there is nothing to show.
 */

const photoOf = (p: Post) => p.mediaUrls?.[0] ?? p.media;

export function InspirationStrip({ posts, cornerName, onMakeThisToo }: { posts: readonly Post[]; cornerName: string; onMakeThisToo: (post: Post) => void }) {
  const [open, setOpen] = useState<Post | null>(null);
  if (posts.length === 0) return null;
  return (
    <section aria-labelledby="start-others" className="mt-4">
      <h2 id="start-others" className="mb-2 text-small font-semibold text-muted-foreground">
        Made by others
      </h2>
      <SnapCarousel
        name={`start.${cornerName}.others`}
        label={`Moments in ${cornerName}`}
        items={posts}
        getKey={(p) => String(p.id)}
        itemClassName="w-28 tab:w-32"
        renderItem={(p) => (
          <button type="button" onClick={() => setOpen(p)} className="block aspect-square w-full overflow-hidden rounded-card bg-card" aria-label={`${p.creator}, ${cornerName}`}>
            <ImageWithFallback src={photoOf(p)} alt="" width={256} className="size-full" />
          </button>
        )}
      />
      {open && (
        <ResponsiveSheet
          open
          onOpenChange={(o) => !o && setOpen(null)}
          title={open.creator}
          footer={
            <div className="flex w-full flex-col items-center gap-2">
              <PillButton
                className="w-full"
                onClick={() => {
                  onMakeThisToo(open);
                  setOpen(null);
                }}
              >
                Make this too
              </PillButton>
              <Link to={`/moment/${open.id}`} className="inline-flex min-h-11 items-center text-small font-semibold text-accent-text underline-offset-4 hover:underline">
                See full Moment
              </Link>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <ImageWithFallback src={photoOf(open)} alt={open.caption || `${open.creator}, ${cornerName}`} width={640} aspect="1 / 1" className="w-full overflow-hidden rounded-card" />
            <p className="text-small text-muted-foreground">{formatWhen(open.createdAt)}</p>
            {open.caption && <p className="text-body leading-snug">{open.caption}</p>}
            <div>
              <LoveThis post={open} />
            </div>
          </div>
        </ResponsiveSheet>
      )}
    </section>
  );
}
