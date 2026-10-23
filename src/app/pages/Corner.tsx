import { useState } from "react";
import { useDarkByDefault } from "../context/ThemeContext";
import { useHistoryState } from "../lib/useHistoryState";
import { Link, useParams } from "react-router";
import { hobbies } from "../data/hobbies";
import { Post, postCorner } from "../data/posts";
import { useCorners } from "../context/CornersContext";
import { useContent } from "../context/ContentContext";
import { PosterTitle } from "../components/afterhours/PosterTitle";
import { PressLink } from "../components/afterhours/PressLink";
import { BlurFade } from "../components/afterhours/BlurFade";
import { MomentFigure } from "../components/afterhours/MomentFigure";
import { cornerStyle } from "../lib/categoryStyle";
import { fillRows } from "../lib/fillRows";
import { tieNumbers } from "../lib/typography";
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
  // Designed dark first: dark unless the person chose Light themselves.
  useDarkByDefault();
  const { slug = "" } = useParams();
  const { cornersFor } = useCorners();
  const { publicFeed, postsStatus } = useContent();
  const { user } = useAuth();
  const [openPost, setOpenPost] = useState<Post | null>(null);
  // After the lead Moment: 3 or 6 first (a full last row at 2 and 3 across), then 6 more.
  const [morePages, setMorePages] = useHistoryState(`corner.${slug}.morePages`, 0);

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

  const spaceName = hobbies.find((h) => h.slug === spaceSlug)?.shortName ?? spaceSlug;
  const [lead, ...rest] = posts;
  // Whole rows only (see lib/fillRows.ts); "Show more" brings in the rest.
  const n = rest.length;
  const { lgCount, smCount } = fillRows(n, morePages);
  const shownRest = rest.slice(0, Math.max(lgCount, smCount));
  const hiddenLg = n > lgCount;
  const hiddenSm = n > smCount;

  return (
    <div className="min-h-viewport" style={cornerStyle(spaceSlug, corner.slug)}>
      {/* The page's one bold colour moment: a full-width band in the Space's
          colour behind the name. Everything else is paper and type. */}
      <header className="bg-[var(--field)] text-[var(--on-field)]">
        <div className="container mx-auto max-w-5xl px-4 pb-10 pt-6 sm:pb-14 sm:pt-10">
          <Link
            to={`/space/${spaceSlug}`}
            className="mb-10 inline-flex min-h-11 items-center text-small underline-offset-4 hover:underline"
          >
            ← Back to {spaceName}
          </Link>
          <PosterTitle onField>{corner.name}</PosterTitle>
          {about && (
            <BlurFade delay={0.3}>
              <p className="mt-5 max-w-xl text-title italic" style={{ fontFamily: "var(--font-serif)" }}>
                {about}
              </p>
            </BlurFade>
          )}
        </div>
      </header>

      <div className="container mx-auto max-w-5xl px-4">
        {/* One concrete first step, from the activity library. A suggestion,
            never a promise (trust rules): just the step and the two ways to
            act on it. */}
        {guide && (
          <BlurFade delay={0.45} inView>
            <div className="max-w-2xl border-b border-border py-8">
              <p className="text-title leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
                {tieNumbers(guide.step)}
              </p>
              <div className="mt-5 flex flex-col items-stretch gap-x-6 gap-y-1 sm:flex-row sm:items-center">
                <PressLink
                  to={`/pursuits/new?${prefill}`}
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-control bg-accent px-5 text-body font-medium text-accent-foreground sm:w-auto"
                >
                  Start a Pursuit
                </PressLink>
                <Link
                  to={`/create?${prefill}`}
                  className="inline-flex min-h-12 items-center justify-center text-body font-medium text-[var(--field-text)] underline underline-offset-4 sm:min-h-11"
                >
                  Log a Moment
                </Link>
              </div>
            </div>
          </BlurFade>
        )}
      </div>

      <section className="pb-16 pt-8">
        {postsStatus === "loading" && posts.length === 0 ? (
          <div className="container mx-auto max-w-5xl px-4">
            <Loadable loading skeleton={<MomentGridSkeleton count={6} />}>{null}</Loadable>
          </div>
        ) : posts.length === 0 ? (
          <div className="container mx-auto max-w-5xl px-4">
            <EmptyState
              line={`No ${corner.name.toLowerCase()} Moments yet.`}
              hint="Be the first."
              // With a guide, Log a Moment is already right above.
              action={guide ? undefined : { label: "Log a Moment", to: `/create?${prefill}` }}
            />
          </div>
        ) : (
          // Moments lead, as plates. The newest runs edge to edge on a phone
          // (4:5 or taller), the rest sit in a grid whose count always fills
          // its last row: 6 at a time, which is whole rows at 2 and 3 across.
          <div className="space-y-12">
            <BlurFade inView>
              <div className="sm:container sm:mx-auto sm:max-w-5xl sm:px-4">
                <MomentFigure
                  post={lead}
                  priority
                  large
                  bleed
                  aspect="aspect-[4/5] sm:aspect-[16/9]"
                  onOpen={() => setOpenPost(lead)}
                />
              </div>
            </BlurFade>
            {shownRest.length > 0 && (
              <div className="container mx-auto max-w-5xl px-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3">
                  {shownRest.map((post, i) => (
                    <BlurFade
                      key={post.id}
                      delay={Math.min(i, 8) * 0.04}
                      inView
                      className={`${i >= smCount ? "max-lg:hidden" : ""} ${i >= lgCount ? "lg:hidden" : ""}`}
                    >
                      <MomentFigure post={post} onOpen={() => setOpenPost(post)} />
                    </BlurFade>
                  ))}
                </div>
                {(hiddenLg || hiddenSm) && (
                  <div
                    className={`mt-10 border-t border-border pt-4 ${hiddenSm ? "" : "max-lg:hidden"} ${hiddenLg ? "" : "lg:hidden"}`}
                  >
                    <Button variant="outline" onClick={() => setMorePages((n) => n + 1)}>
                      Show more
                    </Button>
                  </div>
                )}
              </div>
            )}
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
