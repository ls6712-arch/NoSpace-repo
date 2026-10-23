import { useState } from "react";
import { useHistoryState } from "../lib/useHistoryState";
import { Link, useParams } from "react-router";
import { hobbies } from "../data/hobbies";
import { Post, postCorner } from "../data/posts";
import { useCorners } from "../context/CornersContext";
import { useContent } from "../context/ContentContext";
import { PressLink } from "../components/afterhours/PressLink";
import { Reveal } from "../components/afterhours/Reveal";
import { MomentTile } from "../components/afterhours/MomentTile";
import { cornerStyle } from "../lib/categoryStyle";
import { fillRows } from "../lib/fillRows";
import { PAGE_X } from "../lib/pageGrid";
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
  const { wideCount, narrowCount } = fillRows(n, morePages);
  const shownRest = rest.slice(0, Math.max(wideCount, narrowCount));
  const hiddenWide = n > wideCount;
  const hiddenNarrow = n > narrowCount;

  const dim = "text-[color-mix(in_srgb,var(--ink)_80%,transparent)]";

  return (
    <div className="ns-afterhours min-h-viewport" style={cornerStyle(spaceSlug, corner.slug)}>
      {/* The Corner's category colour, full width, behind its name. */}
      <header className="bg-[var(--cat)] text-[var(--ink)]">
        <div className={`${PAGE_X} py-8 md:py-12`}>
          <Link to={`/space/${spaceSlug}`} className={`inline-flex min-h-11 items-center text-small hover:underline ${dim}`}>
            ← Back to {spaceName}
          </Link>
          <h1 className="mt-6 text-display">{corner.name}</h1>
          {about && <p className={`mt-3 max-w-xl text-body ${dim}`}>{about}</p>}
        </div>
      </header>

      <div className={`${PAGE_X} mt-6`}>
        {/* One concrete first step, from the activity library. A suggestion,
            never a promise (trust rules): just the step and the two ways to
            act on it. */}
        {guide && (
          <Reveal>
            <div className="max-w-2xl rounded-card border border-border bg-card p-5 shadow-card">
              <p className="text-lead text-foreground">{tieNumbers(guide.step)}</p>
              <div className="mt-5 flex flex-col gap-3 md:flex-row">
                <PressLink
                  to={`/pursuits/new?${prefill}`}
                  className="flex min-h-12 w-full items-center justify-center rounded-control bg-[var(--accent)] px-6 text-body font-semibold text-[var(--accent-foreground)] md:w-auto"
                >
                  Start a Pursuit
                </PressLink>
                <PressLink
                  to={`/create?${prefill}`}
                  className="flex min-h-12 w-full items-center justify-center rounded-control border border-border px-6 text-body font-semibold text-foreground md:w-auto"
                >
                  Log a Moment
                </PressLink>
              </div>
            </div>
          </Reveal>
        )}
      </div>

      <section className={`${PAGE_X} pb-16 pt-10 md:pt-12`}>
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
          // Moments lead. The newest is full width (4:5 on a phone, 16:9 from md);
          // the rest are tiles in whole rows, 8 at a time.
          <div className="space-y-10 md:space-y-12">
            <Reveal>
              <MomentTile post={lead} priority width={1200} aspect="aspect-[4/5] md:aspect-[16/9]" onOpen={() => setOpenPost(lead)} />
            </Reveal>
            {shownRest.length > 0 && (
              <div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                  {shownRest.map((post, i) => (
                    <Reveal
                      key={post.id}
                      index={i % 8}
                      className={`${i >= narrowCount ? "max-md:hidden" : ""} ${i >= wideCount ? "md:hidden" : ""}`}
                    >
                      <MomentTile post={post} onOpen={() => setOpenPost(post)} />
                    </Reveal>
                  ))}
                </div>
                {(hiddenWide || hiddenNarrow) && (
                  <div className={`mt-10 border-t border-border pt-4 ${hiddenNarrow ? "" : "max-md:hidden"} ${hiddenWide ? "" : "md:hidden"}`}>
                    <Button variant="outline" onClick={() => setMorePages((m) => m + 1)}>
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
