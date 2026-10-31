import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router";
import { type Post } from "../data/posts";
import { CORNER_CATEGORIES, categoryOfCorner } from "../data/cornerCategories";
import { cornerMeta } from "../data/curatedCorners";
import { cornerKey, homeCornersIn } from "../data/homeCorners";
import { DURATION_LIMITS } from "../data/curatedCorners";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { MomentDetail } from "../components/MomentDetail";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/StateViews";
import { HorizontalRow } from "../components/HorizontalRow";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { Reveal } from "../components/common/Reveal";
import { MomentTile } from "../components/common/MomentTile";
import { ChipGroup } from "../components/corners/ChipGroup";
import { CornerCard } from "../components/corners/CornerCard";
import { WeekEventCard } from "../components/corners/WeekEventCard";
import { categoryStyle } from "../lib/categoryStyle";
import { categoryPhotoCorner } from "../lib/categoryPhoto";
import { isInCorner } from "../lib/cornerAlias";
import { NO_PICK, SETTING_OPTIONS, hasPick, matches, paramsFromPicker, pickerFromParams } from "../lib/cornerFilters";
import { cornerPhoto, cornerPhotoAlt } from "../lib/cornerPhoto";
import { fetchCornersLive, thisWeek, type CornerLive, type LiveEvent, type LiveSpace } from "../lib/cornersLive";
import { fillRows } from "../lib/fillRows";
import { PAGE_X, SECTION_GAP } from "../lib/pageGrid";
import { plural } from "../lib/plural";
import { useHistoryState } from "../lib/useHistoryState";

const DURATION_OPTIONS = DURATION_LIMITS.map((m) => ({ id: m as number, label: `Up to ${plural(m / 60, "hour")}` }));

/**
 * One category's page, in the look of the Corners home: a full-width photo
 * (its first curated Corner's) with the category's name and what is in it;
 * time and place filters (in the URL, like /corners); this week's events from
 * Open Spaces in its Corners; a grid of its Corners (curated first, then A to
 * Z; browsable ones only); then its Moments, with a tab per Corner.
 *
 * A Moment is in a category through its Corner (a Corner merged into another
 * counts as the kept one). A Moment with no Corner is in none, so it never
 * shows here (it still shows in feeds and on its old Space). The word
 * "category" is never shown: the category's own name is the heading.
 */
export function CategoryPage() {
  const { slug = "" } = useParams();
  const category = CORNER_CATEGORIES.find((c) => c.slug === slug);
  const { publicFeed } = useContent();
  const { user } = useAuth();
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [live, setLive] = useState<Map<string, CornerLive> | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useHistoryState(`browse.${slug}.tab`, "all");
  const [morePages, setMorePages] = useHistoryState(`browse.${slug}.morePages`, 0);

  // Time and place only: this page has no mood filter. A pick adds a history entry, as on /corners.
  const picker = { ...(pickerFromParams(searchParams) ?? NO_PICK), mood: null };
  const picked = hasPick(picker);
  const update = (patch: { duration?: number | null; setting?: "home" | "outdoors" | null }) =>
    setSearchParams(paramsFromPicker({ ...picker, ...patch }));

  // Every browsable Corner in the category: curated first, then A to Z.
  const corners = useMemo(
    () => [...homeCornersIn(slug)].sort((a, b) => Number(!!b.curated) - Number(!!a.curated) || a.name.localeCompare(b.name)),
    [slug],
  );
  const shown = useMemo(() => corners.filter((c) => matches(c, picker)), [corners, picker.duration, picker.setting]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const c = p.corner ?? p.subHobby;
        return !!c && categoryOfCorner(p.hobbySlug, c.toLowerCase())?.slug === slug;
      }),
    [publicFeed, slug],
  );
  const tabs = useMemo(() => corners.filter((c) => inCategory.some((p) => isInCorner(p, c.spaceSlug, c.slug))), [corners, inCategory]);
  const activeTab = tabs.some((c) => c.slug === tab) ? tab : "all";
  const posts = useMemo(() => {
    if (activeTab === "all") return inCategory;
    const c = tabs.find((x) => x.slug === activeTab);
    return c ? inCategory.filter((p) => isInCorner(p, c.spaceSlug, c.slug)) : inCategory;
  }, [inCategory, activeTab, tabs]);

  if (!category) return <Navigate to="/discover" replace />;

  const hero = categoryPhotoCorner(category.slug);
  const [lead, ...rest] = posts;
  const n = rest.length;
  const { wideCount, narrowCount } = fillRows(n, morePages);
  const shownRest = rest.slice(0, Math.max(wideCount, narrowCount));
  const hiddenWide = n > wideCount;
  const hiddenNarrow = n > narrowCount;

  return (
    <div className="min-h-viewport" style={categoryStyle(category.slug)}>
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
        <div className={`${PAGE_X} relative flex flex-1 flex-col pb-10 pt-6 tab:pb-14`}>
          <Link to="/corners" className="inline-flex min-h-11 items-center text-small hover:underline">
            ← Back to Corners
          </Link>
          <div className="mt-auto flex flex-col items-start gap-3 pt-16">
            <h1 className="max-w-2xl text-display">
              {category.name}
            </h1>
            <p className="max-w-xl text-body text-on-media/90">{category.about}</p>
          </div>
        </div>
      </header>

      <div className={`${PAGE_X} pb-24 pt-6`}>
        <section className={`${SECTION_GAP} flex flex-col gap-3`} aria-label="Choose what fits">
          <ChipGroup label="Any time" options={DURATION_OPTIONS} value={picker.duration} onChange={(duration) => update({ duration })} />
          <div className="flex flex-wrap items-center gap-x-2">
            <ChipGroup label="Anywhere" options={SETTING_OPTIONS} value={picker.setting} onChange={(setting) => update({ setting })} />
            {picked && (
              <button
                type="button"
                onClick={() => setSearchParams(new URLSearchParams())}
                className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-[var(--accent-text)] hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {weekEvents.length > 0 && (
          <section className={SECTION_GAP} aria-labelledby="week-title">
            <h2 id="week-title" className="mb-4 text-title">
              Happening this week
            </h2>
            <HorizontalRow name={`browse.${slug}.week`} label="Happening this week" contentKey={weekEvents.map((e) => e.id).join(",")}>
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
          {shown.length === 0 ? (
            <EmptyState line="No Corners match those choices." hint="Clear a choice to see more." action={{ label: "Clear choices", onClick: () => setSearchParams(new URLSearchParams()) }} />
          ) : (
            <ul className="grid grid-cols-2 gap-3 tab:grid-cols-3 tab:gap-4 desk:grid-cols-4">
              {shown.map((c) => (
                <CornerCard key={cornerKey(c)} corner={c} subline={c.curated ? cornerMeta(c.curated) : ""} fluid />
              ))}
            </ul>
          )}
        </section>

        {lead && (
          <section className={SECTION_GAP} aria-labelledby="moments-title">
            <h2 id="moments-title" className="mb-4 text-title">
              Recent Moments
            </h2>
            {tabs.length > 1 && (
              <ul role="tablist" aria-label="Corners" className="-mx-4 mb-6 flex gap-6 overflow-x-auto px-4 [scrollbar-width:none] tab:mx-0 tab:px-0">
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
            <div className="space-y-10 tab:space-y-12">
              <Reveal>
                <MomentTile post={lead} priority width={1200} aspect="aspect-[4/5] tab:aspect-[16/9]" onOpen={() => setOpenPost(lead)} />
              </Reveal>
              {shownRest.length > 0 && (
                <div>
                  <div className="grid grid-cols-2 gap-3 tab:grid-cols-4 tab:gap-4">
                    {shownRest.map((post, i) => (
                      <Reveal
                        key={post.id}
                        index={i % 8}
                        className={`${i >= narrowCount ? "max-tab:hidden" : ""} ${i >= wideCount ? "tab:hidden" : ""}`}
                      >
                        <MomentTile post={post} onOpen={() => setOpenPost(post)} />
                      </Reveal>
                    ))}
                  </div>
                  {(hiddenWide || hiddenNarrow) && (
                    <div className={`mt-10 border-t border-border pt-4 ${hiddenNarrow ? "" : "max-tab:hidden"} ${hiddenWide ? "" : "tab:hidden"}`}>
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
