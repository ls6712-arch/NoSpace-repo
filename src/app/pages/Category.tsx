import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { hobbies, titleCaseSlug } from "../data/hobbies";
import { postCorner, type Post } from "../data/posts";
import { cornerGuide } from "../data/cornerGuides";
import { CORNER_CATEGORIES, categoryOfCorner, cornersInCategory } from "../data/cornerCategories";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { useDarkByDefault } from "../context/ThemeContext";
import { MomentDetail } from "../components/MomentDetail";
import { Button } from "../components/ui/button";
import { PosterTitle } from "../components/afterhours/PosterTitle";
import { PressLink } from "../components/afterhours/PressLink";
import { BlurFade } from "../components/afterhours/BlurFade";
import { MomentFigure } from "../components/afterhours/MomentFigure";
import { categoryStyle, categoryTransitionName, cornerStyle } from "../lib/categoryStyle";
import { fillRows } from "../lib/fillRows";
import { useHistoryState } from "../lib/useHistoryState";
import { APP_NAME } from "../config";

/**
 * One category's page: a full-width band in its colour with its name (the tile
 * on Discover grew into this band), what's in it, every Corner in it with a
 * line about each, then its Moments with a chip per Corner.
 *
 * A Moment is in a category through its Corner. A Moment with no Corner is in
 * none, so it never shows here (it still shows in feeds and on its old Space).
 * The word "category" is never shown: the category's own name is the heading.
 */
export function CategoryPage() {
  useDarkByDefault();
  const { slug = "" } = useParams();
  const category = CORNER_CATEGORIES.find((c) => c.slug === slug);
  const { publicFeed } = useContent();
  const { user } = useAuth();
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [chip, setChip] = useHistoryState(`browse.${slug}.chip`, "all");
  const [morePages, setMorePages] = useHistoryState(`browse.${slug}.morePages`, 0);

  const corners = useMemo(
    () =>
      cornersInCategory(slug).map(({ spaceSlug, cornerSlug }) => ({
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
  const chips = useMemo(
    () =>
      corners.filter((c) => inCategory.some((p) => postCorner(p) === c.cornerSlug)),
    [corners, inCategory],
  );
  const activeChip = chips.some((c) => c.cornerSlug === chip) ? chip : "all";
  const posts = activeChip === "all" ? inCategory : inCategory.filter((p) => postCorner(p) === activeChip);

  if (!category) return <Navigate to="/discover" replace />;

  const [lead, ...rest] = posts;
  const n = rest.length;
  const { lgCount, smCount } = fillRows(n, morePages);
  const shownRest = rest.slice(0, Math.max(lgCount, smCount));
  const hiddenLg = n > lgCount;
  const hiddenSm = n > smCount;

  return (
    <div className="min-h-viewport" style={categoryStyle(category.slug)}>
      <header
        className="bg-[var(--field)] text-[var(--on-field)]"
        style={{ viewTransitionName: categoryTransitionName(category.slug) }}
      >
        <div className="container mx-auto max-w-5xl px-4 pb-10 pt-6 sm:pb-14 sm:pt-10">
          <Link to="/discover" className="mb-10 inline-flex min-h-11 items-center text-small underline-offset-4 hover:underline">
            ← Back to Discover
          </Link>
          <PosterTitle onField>{category.name}</PosterTitle>
          <BlurFade delay={0.3}>
            <p className="mt-5 max-w-xl text-title italic" style={{ fontFamily: "var(--font-serif)" }}>
              {category.about}
            </p>
          </BlurFade>
        </div>
      </header>

      <section className="container mx-auto max-w-5xl px-4 pb-4 pt-6">
        <h2 className="sr-only">Corners</h2>
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {corners.map((c, i) => (
            <li key={`${c.spaceSlug}-${c.cornerSlug}`} style={cornerStyle(c.spaceSlug, c.cornerSlug)}>
              <PressLink
                to={`/corner/${c.cornerSlug}`}
                aria-label={`Browse the ${c.name} Corner`}
                // design-token-ignore: stagger delay, same wave as every list entrance
                className="ns-enter group block min-h-14 border-t border-border py-4"
                style={{ animationDelay: `${Math.min(i, 11) * 0.03}s` }}
              >
                <span
                  className="block text-display leading-tight text-foreground transition-colors duration-fast group-hover:text-[var(--field-text)]"
                  style={{ fontFamily: "var(--font-poster)" }}
                >
                  {c.name}
                </span>
                {c.about && <span className="mt-1 block max-w-prose text-small text-muted-foreground">{c.about}</span>}
              </PressLink>
            </li>
          ))}
        </ul>
      </section>

      {lead && (
        <section className="pb-16 pt-10">
          <div className="container mx-auto max-w-5xl px-4">
            <div className="mb-4 text-caption font-medium text-muted-foreground">Moments from across {APP_NAME}</div>
            <h2 className="mb-5 text-display" style={{ fontFamily: "var(--font-poster)" }}>
              Moments
            </h2>
            {chips.length > 1 && (
              <ul role="tablist" aria-label="Corners" className="-mx-4 mb-8 flex gap-6 overflow-x-auto px-4 [scrollbar-width:none]">
                {[{ cornerSlug: "all", name: "Everything" }, ...chips].map((c) => {
                  const active = activeChip === c.cornerSlug;
                  return (
                    <li key={c.cornerSlug} className="shrink-0">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setChip(c.cornerSlug);
                          setMorePages(0);
                        }}
                        className={`min-h-11 border-b-2 text-caption font-medium tracking-wide [font-family:var(--font-body)] transition-colors ${
                          active ? "border-[var(--field)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {c.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="space-y-12">
            <BlurFade inView>
              <div className="sm:container sm:mx-auto sm:max-w-5xl sm:px-4">
                <MomentFigure post={lead} priority large bleed aspect="aspect-[4/5] sm:aspect-[16/9]" onOpen={() => setOpenPost(lead)} />
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
                  <div className={`mt-10 border-t border-border pt-4 ${hiddenSm ? "" : "max-lg:hidden"} ${hiddenLg ? "" : "lg:hidden"}`}>
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
