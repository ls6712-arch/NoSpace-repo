import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useSocial } from "../context/SocialContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { Project, pursuitStatus, useJournal } from "../lib/journal";
import { activePursuits, collectPursuitMoments } from "../lib/pursuitTrail";
import { fetchFollowingIds } from "../lib/profileFollows";
import { supabase } from "../../lib/supabase";
import { Post } from "../data/posts";
import { MomentCard, MOMENT_GRID } from "../components/MomentCard";
import { MomentDetail } from "../components/MomentDetail";
import { PursuitsRail } from "../components/PursuitsRail";
import { DayTwoInviteCard } from "../components/DayTwoInviteCard";
import { PursuitsInProgressSection } from "../components/PursuitsInProgressSection";
import { AllPursuitsSection } from "../components/AllPursuitsSection";
import { ShelfRail } from "../components/ShelfRail";
import { InspiredRail } from "../components/InspiredRail";
import { NewSpacesRail } from "../components/NewSpacesRail";
import { WelcomeBanner } from "../components/WelcomeBanner";
import { formatDate } from "../lib/dates";
import { plural } from "../lib/plural";
import { Sparkles } from "lucide-react";
import { Loadable } from "../components/ui/skeleton";
import { MomentGridSkeleton } from "../components/Skeletons";
import { EmptyState, ErrorNotice } from "../components/StateViews";

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
 * The right rail (Shelf, Pursuits) stays a sidebar at lg+, a deliberate
 * difference from boards 4/5 (which show no rail at all) — kept on an
 * explicit call rather than dropped or moved off this page.
 *
 * PursuitsInProgressSection, in normal flow right below the greeting header,
 * is additive to the rail rather than a replacement for it: the rail only
 * ever sits at lg+, so below that this section was the only always-visible
 * surface for "what am I still moving on," previously buried below the
 * whole feed. Its "See all" and the rail's own both smooth-scroll down
 * to the one AllPursuitsSection at the bottom of this page (lib/
 * scrollToElement.ts) — real in-page navigation now, not each opening its
 * own copy of the same grouped list in a dialog.
 *
 * Nav below lg: this app already has a working "reach every section on a
 * small screen" answer — the global BottomTabBar (Root.tsx, every page) —
 * so this doesn't also build the spec's hamburger-menu nav on top of it;
 * flagged as a deliberate deviation rather than doubling up on navigation
 * chrome.
 */
export function MySpaceGrid() {
  const { user, profile } = useAuth();
  const { publicFeed, posts, myPosts, postsStatus, reloadPosts } = useContent();
  const social = useSocial();
  const journal = useJournal();
  const { logs } = usePrivateLogs();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageIndex, setPageIndex] = useState(0);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  // Approved, not-removed Moments linked into a Space you're an active
  // member of — the real replacement for the old "space:<slug>"
  // hobby_follows source below (dead: Categories are internal-only now, so
  // nothing can create one of those follows any more; real Space
  // membership is what actually gates a Space's Moments — see
  // 20261010000000_space_moment_sharing.sql).
  const [mySpaceMomentPostIds, setMySpaceMomentPostIds] = useState<Set<number>>(new Set());
  // Both sources below have to land before an empty sheet means "empty"
  // rather than "still loading".
  const [followingLoaded, setFollowingLoaded] = useState(!user);
  const [spaceMomentsLoaded, setSpaceMomentsLoaded] = useState(!user || !supabase);

  useEffect(() => {
    if (!user) return;
    fetchFollowingIds(user.id)
      .then(setFollowingIds)
      .finally(() => setFollowingLoaded(true));
  }, [user?.id]);

  useEffect(() => {
    const client = supabase;
    if (!user || !client) return;
    let cancelled = false;
    (async () => {
      const { data: memberships } = await client
        .from("space_members")
        .select("space_id")
        .eq("user_id", user.id)
        .eq("status", "active");
      const spaceIds = (memberships ?? []).map((m) => m.space_id as string);
      if (spaceIds.length === 0) {
        if (!cancelled) {
          setMySpaceMomentPostIds(new Set());
          setSpaceMomentsLoaded(true);
        }
        return;
      }
      const { data: moments } = await client
        .from("space_moments")
        .select("post_id")
        .in("space_id", spaceIds)
        .eq("status", "approved")
        .eq("removed_by_host", false);
      if (!cancelled) {
        setMySpaceMomentPostIds(new Set((moments ?? []).map((m) => m.post_id as number)));
        setSpaceMomentsLoaded(true);
      }
    })().catch((err) => {
      console.warn("[MySpaceGrid] Space Moments load failed:", err);
      if (!cancelled) setSpaceMomentsLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const exploring = new Set(social.followedHobbies);

  // Moments from people you follow, Corners you follow, or approved
  // Moments from Spaces you're an active member of, never your own
  // (docs/my-space-spec.md section 2). Deliberately not gated to "since
  // your last visit" — that's the cold-start bug this round's spec calls
  // out by name: a person whose follows haven't posted since they were last
  // here saw an empty sheet even though there was plenty to show. This is
  // just the most recent N regardless of when they were last on this page —
  // "recent" is entirely carried by the sort below, with no age floor
  // either (confirmed explicitly: always show the N most recent, even if
  // the newest one is months old, rather than a sheet that's sometimes
  // empty for an active account whose follows have been quiet).
  const unseen = useMemo(
    () =>
      publicFeed
        .filter((p) => p.userId !== user?.id)
        .filter(
          (p) =>
            (p.userId && followingIds.includes(p.userId)) ||
            (p.subHobby && exploring.has(p.subHobby)) ||
            mySpaceMomentPostIds.has(p.id),
        )
        .sort((a, b) => b.createdAt - a.createdAt),
    [publicFeed, user?.id, followingIds, exploring, mySpaceMomentPostIds],
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

  const dateEyebrow = formatDate(Date.now(), { weekday: "long", month: "long" });

  const numeral =
    sheet.length === 0
      ? "00 to 00"
      : `${String(1).padStart(2, "0")} to ${String(sheet.length).padStart(2, "0")}`;

  // For AllPursuitsSection, rendered once at the bottom of this page —
  // both PursuitsInProgressSection's and PursuitsRail's own "See all"
  // smooth-scroll down to it rather than each opening its own copy of the
  // same grouped list in a dialog. Same per-Pursuit moments/grouping logic
  // those two components already compute from their own copies of
  // pursuits/posts/entryProject; a third copy here rather than threading a
  // shared selector through three components for this one list.
  const allMomentsFor = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof collectPursuitMoments>>();
    return (p: Project) => {
      if (!cache.has(p.id)) cache.set(p.id, collectPursuitMoments(p.id, posts, journal.entryProject, logs));
      return cache.get(p.id)!;
    };
  }, [posts, journal.entryProject, logs]);
  const allActive = activePursuits(journal.projects, allMomentsFor);
  const allResting = journal.projects.filter((p) => pursuitStatus(p) === "resting");
  const allComplete = journal.projects.filter((p) => pursuitStatus(p) === "complete");
  const allLastMomentOf = (p: Project) => {
    const m = allMomentsFor(p);
    return m.length ? m[m.length - 1].createdAt : undefined;
  };

  return (
    <div className="myspace-shell px-4 py-6 sm:px-5 lg:px-8">
      <WelcomeBanner />
      <header className="myspace-header mb-6 border-b border-hairline pb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {/* text-gold-text, not text-gold: this is a rendered label, and
                --gold fails AA text contrast in light (2.76:1) — see
                theme.css’s own contrast-audit comment. --gold-text is the
                darkened-in-light, same-in-dark variant built for exactly this
                (any place gold is used as text, not decoration). */}
            <p className="ns-section-kicker text-gold-text">{dateEyebrow}</p>
            <h1
              className="mt-1 text-display leading-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {greeting(profile?.display_name ?? "there")}
            </h1>
            <p className="mt-1 text-small text-muted-foreground">
              {plural(unseen.length, "Moment")} from the people and Spaces you follow.
            </p>
          </div>
          {/* Numeral in foreground, not accent — docs/my-space-spec.md
              section 1 explicitly overrides the mockup’s warmer-looking
              numeral. lg+ only here; below lg it moves under the subtitle
              on one line instead (just below). */}
          <div className="hidden text-right text-foreground lg:block">
            <p className="text-title" style={{ fontFamily: "var(--font-serif)" }}>
              {numeral}
            </p>
            <p className="ns-section-kicker text-muted-foreground">Today’s sheet</p>
          </div>
        </div>
        <p className="ns-section-kicker mt-2 text-foreground lg:hidden">
          {numeral} · TODAY’S SHEET
        </p>
      </header>

      <DayTwoInviteCard />

      <PursuitsInProgressSection pursuits={journal.projects} posts={posts} entryProject={journal.entryProject} />

      <div className="myspace-body">
        <div className="myspace-feed">
          <Loadable
            loading={postsStatus === "loading" || !followingLoaded || !spaceMomentsLoaded}
            skeleton={<MomentGridSkeleton count={PAGE_SIZE} />}
          >
            {postsStatus === "error" && sheet.length === 0 ? (
              <ErrorNotice onRetry={reloadPosts} />
            ) : sheet.length === 0 ? (
              myPosts.length === 0 ? (
                // First run: a brand-new account with nothing logged yet.
                <EmptyState
                  size="page"
                  icon={<Sparkles />}
                  line="Nothing here yet."
                  hint="Log your first Moment, then join a Space or follow a person to fill your Contact sheet."
                  action={{ label: "Log a Moment", to: "/create" }}
                />
              ) : (
                <EmptyState
                  line="Nothing here yet."
                  hint="Join a Space or follow a person to start your Contact sheet."
                  action={{ label: "Browse Spaces", to: "/discover?tab=spaces" }}
                />
              )
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
          </Loadable>

          {hasMore && (
            <button
              type="button"
              onClick={() => setPageIndex((p) => p + 1)}
              className="mt-6 text-caption text-accent hover:underline"
            >
              Turn the page
            </button>
          )}

          {sheet.length > 0 && (
            <div className="mt-6 rounded-card border-t border-border pt-4">
              <p className="ns-section-kicker text-muted-foreground">End of the sheet</p>
              <p className="mt-1 text-small" style={{ fontFamily: "var(--font-serif)" }}>
                You’re caught up
              </p>
              <Link to="/create" className="mt-2 inline-block text-caption text-accent hover:underline">
                Log a Moment
              </Link>
            </div>
          )}
        </div>

        {/* Not numbered: the spec's own "design patterns to reuse" section
            asks for sequential numbering on new right-rail sections, but
            Shelf/Pursuits never actually shipped with one (they're
            plain <h2> headings, no kicker), and a mobile-only CSS rule
            just below (.myspace-rail-pursuits' order: -1) already moves
            Pursuits above Shelf on small screens — a numeral would show
            "2" sitting visually above "1" there. Matching the page's own
            established unnumbered style avoids inventing a visible
            contradiction to chase a numbering scheme the live page never
            had; docs/my-space-deviations.md already flags that same
            DOM/visual gap once, for tab order — this doesn’t add a second,
            visible instance of it. */}
        <div className="myspace-rail mt-8 lg:mt-0">
          <div className="myspace-rail-shelf">
            <ShelfRail />
          </div>
          <div className="myspace-rail-pursuits">
            <PursuitsRail pursuits={journal.projects} posts={posts} entryProject={journal.entryProject} />
          </div>
          <div className="myspace-rail-inspired">
            <InspiredRail />
          </div>
          <div className="myspace-rail-newspaces">
            <NewSpacesRail />
          </div>
        </div>
      </div>

      <AllPursuitsSection
        active={allActive}
        resting={allResting}
        complete={allComplete}
        lastOf={allLastMomentOf}
      />

      <MomentDetail post={openPost} owned={false} onOpenChange={(o) => !o && closeDetail()} />
    </div>
  );
}
