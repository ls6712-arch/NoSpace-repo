import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useSocial } from "../context/SocialContext";
import { useJournal } from "../lib/journal";
import { fetchFollowingIds } from "../lib/profileFollows";
import { circles } from "../data/circles";
import { Post } from "../data/posts";
import { MomentCard, MOMENT_GRID } from "../components/MomentCard";
import { MomentDetail } from "../components/MomentDetail";
import { PursuitsRail } from "../components/PursuitsRail";
import { ShelfRail } from "../components/ShelfRail";
import { CirclesRail } from "../components/CirclesRail";
import { InspiredRail } from "../components/InspiredRail";
import { NewSpacesRail } from "../components/NewSpacesRail";
import { WelcomeBanner } from "../components/WelcomeBanner";

const PAGE_SIZE = 6;

function greeting(name: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${part}, ${name}`;
}

/**
 * docs/my-space-spec.md's grid page. Board 4's sheet of 6, numbered 01–06.
 * Since Sept 24, 2026 every card is the same square in one even grid
 * (MOMENT_GRID) instead of board 4's lead + mixed-width rows, so a Moment
 * looks the same here as on every other page — replacing ContactSheet's thumbnail strip
 * plus a single selected-Moment panel. "Turn the page" now moves to the
 * NEXT distinct sheet of 6 (re-slicing the same already-loaded `unseen`
 * list — no fetch, no auto-load) rather than accumulating a longer
 * scrollable list the old strip let you browse.
 *
 * The right rail (Shelf, Pursuits, Circles) stays a sidebar at lg+, a
 * deliberate difference from boards 4/5 (which show no rail at all) — kept
 * on an explicit call rather than dropped or moved off this page.
 *
 * Nav below lg: this app already has a working "reach every section on a
 * small screen" answer — the global BottomTabBar (Root.tsx, every page) —
 * so this doesn't also build the spec's hamburger-menu nav on top of it;
 * flagged as a deliberate deviation rather than doubling up on navigation
 * chrome.
 */
export function MySpaceGrid() {
  const { user, profile } = useAuth();
  const { publicFeed, posts, isCircleJoined } = useContent();
  const social = useSocial();
  const journal = useJournal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageIndex, setPageIndex] = useState(0);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchFollowingIds(user.id).then(setFollowingIds);
  }, [user?.id]);

  const exploring = new Set(social.followedHobbies);
  const joinedCircles = circles.filter((c) => isCircleJoined(c.id));
  const joinedSpaces = new Set(joinedCircles.map((c) => c.hobbySlug));

  // Moments from people, Spaces or Circles you follow or joined, never your
  // own (docs/my-space-spec.md section 2). Deliberately not gated to "since
  // your last visit" — that's the cold-start bug this round's spec calls
  // out by name: a person whose follows haven't posted since they were last
  // here saw an empty sheet even though there was plenty to show. This is
  // just the most recent N regardless of when they were last on this page —
  // "recent" is entirely carried by the sort below, with no age floor
  // either (confirmed explicitly: always show the N most recent, even if
  // the newest one is months old, rather than a sheet that's sometimes
  // empty for an active account with a quiet circle).
  const unseen = useMemo(
    () =>
      publicFeed
        .filter((p) => p.userId !== user?.id)
        .filter(
          (p) =>
            (p.userId && followingIds.includes(p.userId)) ||
            exploring.has(`space:${p.hobbySlug}`) ||
            (p.subHobby && exploring.has(p.subHobby)) ||
            joinedSpaces.has(p.hobbySlug),
        )
        .sort((a, b) => b.createdAt - a.createdAt),
    [publicFeed, user?.id, followingIds, exploring, joinedSpaces],
  );

  // One distinct sheet of (at most) 6 — "Turn the page" moves to the next
  // one rather than growing this list.
  const sheet = unseen.slice(pageIndex * PAGE_SIZE, pageIndex * PAGE_SIZE + PAGE_SIZE);
  const hasMore = unseen.length > (pageIndex + 1) * PAGE_SIZE;

  // ?m=<id> opens MomentDetail over the sheet — a deep link to one Moment,
  // not "which one is selected" (every Moment on the sheet is already
  // visible as its own card, so there's nothing else for ?m= to mean).
  const openId = searchParams.get("m") ? Number(searchParams.get("m")) : null;
  const openPost = openId != null ? (unseen.find((p) => p.id === openId) ?? null) : null;
  const openDetail = (post: Post) => {
    const next = new URLSearchParams(searchParams);
    next.set("m", String(post.id));
    setSearchParams(next, { replace: true });
  };
  const closeDetail = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("m");
    setSearchParams(next, { replace: true });
  };

  const dateEyebrow = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).toUpperCase();

  const numeral =
    sheet.length === 0
      ? "00–00"
      : `${String(1).padStart(2, "0")}–${String(sheet.length).padStart(2, "0")}`;

  return (
    <div className="myspace-shell px-4 py-6 sm:px-5 lg:px-8">
      <WelcomeBanner />
      <header className="myspace-header mb-6 border-b border-hairline pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {/* text-gold-text, not text-gold: this is a rendered label, and
                --gold fails AA text contrast in light (2.76:1) — see
                theme.css's own contrast-audit comment. --gold-text is the
                darkened-in-light, same-in-dark variant built for exactly this
                (any place gold is used as text, not decoration). */}
            <p className="ns-section-kicker text-gold-text">{dateEyebrow}</p>
            <h1
              className="mt-1 text-[clamp(1.75rem,4vw,2.5rem)] leading-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {greeting(profile?.display_name ?? "there")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unseen.length} Moment{unseen.length === 1 ? "" : "s"} from the people and Spaces you follow.
            </p>
          </div>
          {/* Numeral in foreground, not accent — docs/my-space-spec.md
              section 1 explicitly overrides the mockup's warmer-looking
              numeral. lg+ only here; below lg it moves under the subtitle
              on one line instead (just below). */}
          <div className="hidden text-right text-foreground lg:block">
            <p className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
              {numeral}
            </p>
            <p className="ns-section-kicker text-muted-foreground">TODAY'S SHEET</p>
          </div>
        </div>
        <p className="ns-section-kicker mt-2 text-foreground lg:hidden">
          {numeral} · TODAY'S SHEET
        </p>
      </header>

      <div className="myspace-body">
        <div className="myspace-feed">
          {sheet.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {/* Genuinely empty now only means zero eligible Moments exist
                  at all — the sheet no longer gates on "since your last
                  visit" (see the unseen memo above), so that copy would be
                  inaccurate here. */}
              Nothing here yet. Follow a Space or a person to start your sheet.
            </div>
          ) : (
            <div className={MOMENT_GRID}>
              {sheet.map((post, i) => (
                <MomentCard
                  key={post.id}
                  post={post}
                  surface="mySpace"
                  size="standard"
                  number={String(i + 1).padStart(2, "0")}
                  onOpen={() => openDetail(post)}
                />
              ))}
            </div>
          )}

          {hasMore && (
            <button
              type="button"
              onClick={() => setPageIndex((p) => p + 1)}
              className="mt-6 text-xs text-accent hover:underline"
            >
              Turn the page
            </button>
          )}

          {sheet.length > 0 && (
            <div className="mt-6 rounded-lg border-t border-border pt-4">
              <p className="ns-section-kicker text-muted-foreground">END OF THE SHEET</p>
              <p className="mt-1 text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                You're caught up
              </p>
              <Link to="/create" className="mt-2 inline-block text-xs text-accent hover:underline">
                Add a Moment
              </Link>
            </div>
          )}
        </div>

        {/* Not numbered: the spec's own "design patterns to reuse" section
            asks for sequential numbering on new right-rail sections, but
            Shelf/Pursuits/Circles never actually shipped with one (they're
            plain <h2> headings, no kicker), and a mobile-only CSS rule
            just below (.myspace-rail-pursuits' order: -1) already moves
            Pursuits above Shelf on small screens — a numeral would show
            "2" sitting visually above "1" there. Matching the page's own
            established unnumbered style avoids inventing a visible
            contradiction to chase a numbering scheme the live page never
            had; docs/my-space-deviations.md already flags that same
            DOM/visual gap once, for tab order — this doesn't add a second,
            visible instance of it. */}
        <div className="myspace-rail mt-8 lg:mt-0">
          <div className="myspace-rail-shelf">
            <ShelfRail />
          </div>
          <div className="myspace-rail-pursuits">
            <PursuitsRail pursuits={journal.projects} posts={posts} entryProject={journal.entryProject} />
          </div>
          <div className="myspace-rail-circles">
            <CirclesRail />
          </div>
          <div className="myspace-rail-inspired">
            <InspiredRail />
          </div>
          <div className="myspace-rail-newspaces">
            <NewSpacesRail />
          </div>
        </div>
      </div>

      <MomentDetail post={openPost} owned={false} onOpenChange={(o) => !o && closeDetail()} />
    </div>
  );
}
