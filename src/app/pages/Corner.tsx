import { useState } from "react";
import { Link, useParams } from "react-router";
import { hobbies } from "../data/hobbies";
import { Post, postCorner } from "../data/posts";
import { useCorners } from "../context/CornersContext";
import { useContent } from "../context/ContentContext";
import { MomentCard, MOMENT_GRID } from "../components/MomentCard";
import { MomentDetail } from "../components/MomentDetail";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/StateViews";
import { Loadable } from "../components/ui/skeleton";
import { MomentGridSkeleton } from "../components/Skeletons";
import { cornerGuide } from "../data/cornerGuides";

/**
 * A single Corner's own page — Feed/Moments only, no Home/People/Events/
 * Manage sub-tabs like the full Space page has. The one way back is the
 * link to the parent Space; there's no other navigation here.
 */
export function CornerPage() {
  const { slug = "" } = useParams();
  const { cornersFor } = useCorners();
  const { publicFeed, postsStatus } = useContent();
  const { user } = useAuth();
  const [openPost, setOpenPost] = useState<Post | null>(null);

  // A Corner's slug is only unique within its own Space — two different
  // Spaces could each have a corner slugged "basics". This flat route can't
  // disambiguate that, so it resolves to the first match across every
  // Space's corners.
  // TODO: hobbies.ts's subItems already has a few slugs that collide across
  // Spaces today (e.g. "trading-cards" in both Gaming & Tabletop and
  // Collecting & Fandom) — this silently opens whichever Space's corner
  // comes first in `hobbies`. Needs a real disambiguation key
  // (spaceSlug + slug) if this becomes a visible problem.
  let corner: { spaceSlug: string; slug: string; name: string; description?: string } | undefined;
  for (const hobby of hobbies) {
    const found = cornersFor(hobby.slug).find((c) => c.slug === slug);
    if (found) {
      corner = found;
      break;
    }
  }

  if (!corner) {
    return (
      <div className="min-h-viewport flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-title mb-4">That Corner doesn’t exist</h2>
          <Link to="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const spaceSlug = corner.spaceSlug;
  // A description someone gave the Corner wins; otherwise the library's.
  const guide = cornerGuide(spaceSlug, corner.slug);
  const about = corner.description?.trim() || guide?.about;
  const prefill = `hobby=${encodeURIComponent(spaceSlug)}&sub=${encodeURIComponent(corner.slug)}`;
  const posts = publicFeed.filter((p) => p.hobbySlug === spaceSlug && postCorner(p) === corner.slug);

  return (
    <div className="min-h-viewport">
      <section className="container mx-auto px-4 pt-12">
        <Link
          to={`/space/${spaceSlug}`}
          className="mb-3 inline-block text-caption text-muted-foreground hover:text-foreground"
        >
          ← Back to {hobbies.find((h) => h.slug === spaceSlug)?.shortName ?? spaceSlug}
        </Link>
        <h1 className="text-display" style={{ fontFamily: "var(--font-serif)" }}>
          {corner.name}
        </h1>
        {about && <p className="mt-3 max-w-prose text-body text-muted-foreground">{about}</p>}

        {/* One concrete first step, from the activity library. A suggestion,
            never a promise (trust rules), so it carries no label claiming
            more than it is: just the step and the two ways to act on it. */}
        {guide && (
          <div className="mt-6 max-w-xl rounded-card border border-border bg-card p-5">
            <p className="text-lead" style={{ fontFamily: "var(--font-serif)" }}>
              {guide.step}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to={`/pursuits/new?${prefill}`}>
                <Button size="lg">Start a Pursuit</Button>
              </Link>
              <Link to={`/create?${prefill}`}>
                <Button size="lg" variant="outline">
                  Log a Moment
                </Button>
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 pt-8 pb-12">
        {postsStatus === "loading" && posts.length === 0 ? (
          <Loadable loading skeleton={<MomentGridSkeleton count={6} />}>{null}</Loadable>
        ) : posts.length === 0 ? (
          <EmptyState
            line={`No ${corner.name.toLowerCase()} Moments yet.`}
            hint="Be the first."
            // With a guide, Log a Moment is already right above.
            action={guide ? undefined : { label: "Log a Moment", to: `/create?${prefill}` }}
          />
        ) : (
          <div className={MOMENT_GRID}>
            {posts.map((post) => (
              <MomentCard
                key={post.id}
                post={post}
                surface="feed"
                size="standard"
                onOpen={() => setOpenPost(post)}
              />
            ))}
          </div>
        )}
      </section>

      <MomentDetail
        post={openPost}
        owned={!!user && openPost?.userId === user.id}
        onOpenChange={(o) => !o && setOpenPost(null)}
      />
    </div>
  );
}
