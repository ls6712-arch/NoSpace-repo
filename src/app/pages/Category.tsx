import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { postCorner, type Post } from "../data/posts";
import { CORNER_CATEGORIES, categoryOfCorner } from "../data/cornerCategories";
import { cornerKey, homeCornersIn } from "../data/homeCorners";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { MomentDetail } from "../components/MomentDetail";
import { Button } from "../components/ui/button";
import { HorizontalRow } from "../components/HorizontalRow";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { Reveal } from "../components/afterhours/Reveal";
import { MomentTile } from "../components/afterhours/MomentTile";
import { CornerCard } from "../components/corners/CornerCard";
import { WeekEventCard } from "../components/corners/WeekEventCard";
import { categoryStyle } from "../lib/categoryStyle";
import { categoryPhotoCorner } from "../lib/categoryPhoto";
import { cornerPhoto, cornerPhotoAlt } from "../lib/cornerPhoto";
import { cornerSubline } from "../lib/cornerSubline";
import { fetchCornersLive, thisWeek, type CornerLive, type LiveEvent, type LiveSpace } from "../lib/cornersLive";
import { displayStyle } from "../lib/doorList";
import { fillRows } from "../lib/fillRows";
import { PAGE_X, SECTION_GAP } from "../lib/pageGrid";
import { useHistoryState } from "../lib/useHistoryState";

/**
 * One category's page, in the look of the Corners home: a full-width photo
 * (its first curated Corner's) with the category's name and what's in it;
 * this week's events from Open Spaces in its Corners; a grid of its Corner
 * cards (curated first, then A to Z); then its Moments, with a tab per Corner.
 *
 * A Moment is in a category through its Corner. A Moment with no Corner is in
 * none, so it never shows here (it still shows in feeds and on its old Space).
 * The word "category" is never shown: the category's own name is the heading.
 */
export function CategoryPage() {
  const { slug = "" } = useParams();
  const category = CORNER_CATEGORIES.find((c) => c.slug === slug);
  const { publicFeed } = useContent();
  const { user } = useAuth();
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [live, setLive] = useState<Map<string, CornerLive> | null>(null);
  const [tab, setTab] = useHistoryState(`browse.${slug}.tab`, "all");
  const [morePages, setMorePages] = useHistoryState(`browse.${slug}.morePages`, 0);

  // Curated Corners first, then the rest A to Z.
  const corners = useMemo(
    () => [...homeCornersIn(slug)].sort((a, b) => Number(!!b.curated) - Number(!!a.curated) || a.name.localeCompare(b.name)),
    [slug],
  );

  useEffect(() => {
    let cancelled = false;
    setLive(null);
    fetchCornersLive({ targets: corners }).then((m) => !cancelled && setLive(m));
    return () => {
      cancelled = true;
    };
  }, [corners]);

  // This week's events across the category's Corners, each once, soonest first.
  const { weekEvents, spaceById } = useMemo(() => {
    const events = new Map<number, LiveEvent>();
    const spaces = new Map<string, LiveSpace>();
    for (const l of live?.values() ?? []) {
      for (const s of l.spaces) spaces.set(s.id, s);
      for (const e of thisWeek(l.events)) events.set(e.id, e);
    }
    return { weekEvents: [...events.values()].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), spaceById: spaces };
  }, [live]);

  const inCategory = useMemo(
    () =>
      publicFeed.filter((p) => {
        const corner = postCorner(p);
        return !!corner && categoryOfCorner(p.hobbySlug, corner)?.slug === slug;
      }),
    [publicFeed, slug],
  );
  const tabs = useMemo(
    () => corners.filter((c) => inCategory.some((p) => postCorner(p)?.toLowerCase() === c.slug)),
    [corners, inCategory],
  );
  const activeTab = tabs.some((c) => c.slug === tab) ? tab : "all";
  const posts = activeTab === "all" ? inCategory : inCategory.filter((p) => postCorner(p)?.toLowerCase() === activeTab);

  if (!category) return <Navigate to="/discover" replace />;

  const hero = categoryPhotoCorner(category.slug);
  const [lead, ...rest] = posts;
  const n = rest.length;
  const { wideCount, narrowCount } = fillRows(n, morePages);
  const shownRest = rest.slice(0, Math.max(wideCount, narrowCount));
  const hiddenWide = n > wideCount;
  const hiddenNarrow = n > narrowCount;

  return (
    <div className="ns-afterhours min-h-viewport" style={categoryStyle(category.slug)}>
      {/* Hero: the category's photo, with its name and what is in it bottom left. */}
      <header className="relative flex min-h-[48svh] flex-col overflow-hidden bg-[var(--cat)] text-on-media">
        {hero && (
          <ImageWithFallback
            src={cornerPhoto(hero.spaceSlug, hero.slug, 1600)}
            alt={cornerPhotoAlt(hero.slug)}
            priority
            width={1200}
            tint
            className="absolute inset-0 size-full"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-scrim-solid/25" aria-hidden="true" />
        <div className="bg-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="bg-hero-fade pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className={`${PAGE_X} relative flex flex-1 flex-col pb-10 pt-6 md:pb-14`}>
          <Link to="/corners" className="inline-flex min-h-11 items-center text-small hover:underline">
            ← Back to Corners
          </Link>
          <div className="mt-auto flex flex-col items-start gap-3 pt-16">
            <h1 className="max-w-2xl text-display" style={displayStyle(72, { lineHeight: 0.95 })}>
              {category.name}
            </h1>
            <p className="max-w-xl text-body text-on-media/90">{category.about}</p>
          </div>
        </div>
      </header>

      <div className={`${PAGE_X} pb-24 pt-8`}>
        {weekEvents.length > 0 && (
          <section className={SECTION_GAP} aria-labelledby="week-title">
            <h2 id="week-title" className="mb-4" style={displayStyle(26, { lineHeight: 1.1 })}>
              Happening this week
            </h2>
            <HorizontalRow name={`browse.${slug}.week`} label="Happening this week">
              {weekEvents.map((e) => (
                <WeekEventCard key={e.id} event={e} space={spaceById.get(e.spaceId)} />
              ))}
            </HorizontalRow>
          </section>
        )}

        <section className={SECTION_GAP} aria-labelledby="corners-title">
          <h2 id="corners-title" className="sr-only">
            Corners
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {corners.map((c) => (
              <CornerCard key={cornerKey(c)} corner={c} subline={cornerSubline(c, live?.get(cornerKey(c)))} fluid />
            ))}
          </ul>
        </section>

        {lead && (
          <section className={SECTION_GAP} aria-labelledby="moments-title">
            <h2 id="moments-title" className="mb-4" style={displayStyle(26, { lineHeight: 1.1 })}>
              Recent Moments
            </h2>
            {tabs.length > 1 && (
              <ul role="tablist" aria-label="Corners" className="-mx-4 mb-6 flex gap-6 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
                {[{ slug: "all", name: "Everything" }, ...tabs].map((c) => {
                  const active = activeTab === c.slug;
                  return (
                    <li key={c.slug} className="shrink-0">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setTab(c.slug);
                          setMorePages(0);
                        }}
                        className={`min-h-11 border-b-2 text-small font-semibold transition-colors ${
                          active ? "border-[var(--accent)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {c.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
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
          </section>
        )}
      </div>

      <MomentDetail
        post={openPost}
        owned={!!user && openPost?.userId === user.id}
        onOpenChange={(o) => !o && setOpenPost(null)}
      />
    </div>
  );
}
