import { cornerPath } from "../lib/cornerPath";
import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { hobbies, isBrowsableCorner, titleCaseSlug } from "../data/hobbies";
import { isInCorner } from "../lib/cornerAlias";
import { postCorner, type Post } from "../data/posts";
import { cornerGuide } from "../data/cornerGuides";
import { CORNER_CATEGORIES, categoryOfCorner, cornersInCategory } from "../data/cornerCategories";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { MomentDetail } from "../components/MomentDetail";
import { Button } from "../components/ui/button";
import { PressLink } from "../components/afterhours/PressLink";
import { Reveal } from "../components/afterhours/Reveal";
import { MomentTile } from "../components/afterhours/MomentTile";
import { categoryStyle, categoryTransitionName, cornerStyle } from "../lib/categoryStyle";
import { fillRows } from "../lib/fillRows";
import { PAGE_X } from "../lib/pageGrid";
import { useHistoryState } from "../lib/useHistoryState";

/**
 * One category's page (spec v1): a full-width band in its colour with its name
 * (the tile on Discover grew into this band) and what's in it; every Corner in
 * it with a line about each; then its Moments, with a tab per Corner.
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
  const [tab, setTab] = useHistoryState(`browse.${slug}.tab`, "all");
  const [morePages, setMorePages] = useHistoryState(`browse.${slug}.morePages`, 0);

  const corners = useMemo(
    () =>
      cornersInCategory(slug).filter(({ spaceSlug, cornerSlug }) => isBrowsableCorner(spaceSlug, cornerSlug)).map(({ spaceSlug, cornerSlug }) => ({
        spaceSlug,
        cornerSlug,
        name:
          hobbies.find((h) => h.slug === spaceSlug)?.subItems.find((s) => s.slug === cornerSlug)?.label ??
          titleCaseSlug(cornerSlug),
        about: cornerGuide(spaceSlug, cornerSlug)?.about,
      })),
    [slug],
  );

  const inCategory = useMemo(
    () =>
      publicFeed.filter((p) => {
        const corner = postCorner(p);
        return !!corner && categoryOfCorner(p.hobbySlug, corner)?.slug === slug;
      }),
    [publicFeed, slug],
  );
  const tabs = useMemo(
    () => corners.filter((c) => inCategory.some((p) => isInCorner(p, c.spaceSlug, c.cornerSlug))),
    [corners, inCategory],
  );
  const activeTab = tabs.some((c) => c.cornerSlug === tab) ? tab : "all";
  const posts = activeTab === "all" ? inCategory : inCategory.filter((p) => { const c = corners.find((x) => x.cornerSlug === activeTab); return !!c && isInCorner(p, c.spaceSlug, c.cornerSlug); });

  if (!category) return <Navigate to="/discover" replace />;

  // Back link at 70% ink, the description at 80% (spec v1; both clear 4.5:1 on the v1.1 colours).
  const dimLink = "text-[color-mix(in_srgb,var(--ink)_70%,transparent)]";
  const dimText = "text-[color-mix(in_srgb,var(--ink)_80%,transparent)]";
  const [lead, ...rest] = posts;
  const n = rest.length;
  const { wideCount, narrowCount } = fillRows(n, morePages);
  const shownRest = rest.slice(0, Math.max(wideCount, narrowCount));
  const hiddenWide = n > wideCount;
  const hiddenNarrow = n > narrowCount;

  return (
    <div className="ns-afterhours min-h-viewport" style={categoryStyle(category.slug)}>
      <header
        className="bg-[var(--cat)] text-[var(--ink)]"
        style={{ viewTransitionName: categoryTransitionName(category.slug) }}
      >
        <div className={`${PAGE_X} py-8 md:py-12`}>
          <Link to="/discover" className={`inline-flex min-h-11 items-center text-small hover:underline ${dimLink}`}>
            ← Back to Discover
          </Link>
          <h1 className="mt-6 text-display">{category.name}</h1>
          <p className={`mt-3 max-w-xl text-body ${dimText}`}>{category.about}</p>
        </div>
      </header>

      <section className={`${PAGE_X} pt-6`}>
        <h2 className="sr-only">Corners</h2>
        <ul className="grid gap-x-10 md:grid-cols-2">
          {corners.map((c, i) => (
            <li key={`${c.spaceSlug}-${c.cornerSlug}`} style={cornerStyle(c.spaceSlug, c.cornerSlug)}>
              <Reveal index={Math.min(i, 11)}>
                <PressLink
                  to={cornerPath(c.spaceSlug, c.cornerSlug)}
                  aria-label={`Browse the ${c.name} Corner`}
                  className="group block min-h-14 border-t border-border py-4"
                >
                  <span className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full bg-[var(--cat)]" aria-hidden="true" />
                    <span className="text-lead text-foreground">{c.name}</span>
                  </span>
                  {c.about && <span className="mt-1 block max-w-prose text-small text-muted-foreground">{c.about}</span>}
                </PressLink>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {lead && (
        <section className={`${PAGE_X} pb-16 pt-10 md:pt-12`}>
          <h2 className="mb-4 text-title">Moments</h2>
          {tabs.length > 1 && (
            <ul role="tablist" aria-label="Corners" className="-mx-4 mb-6 flex gap-6 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
              {[{ cornerSlug: "all", name: "Everything" }, ...tabs].map((c) => {
                const active = activeTab === c.cornerSlug;
                return (
                  <li key={c.cornerSlug} className="shrink-0">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setTab(c.cornerSlug);
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

      <MomentDetail
        post={openPost}
        owned={!!user && openPost?.userId === user.id}
        onOpenChange={(o) => !o && setOpenPost(null)}
      />
    </div>
  );
}
