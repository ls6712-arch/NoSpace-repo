import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useSocial } from "../context/SocialContext";
import { useJournal } from "../lib/journal";
import { fetchFollowingIds } from "../lib/profileFollows";
import { getLastVisit, markVisited } from "../lib/mySpaceVisit";
import { circles } from "../data/circles";
import { ContactSheet } from "../components/ContactSheet";
import { MomentPanel } from "../components/MomentPanel";
import { PursuitsRail } from "../components/PursuitsRail";
import { ShelfRail } from "../components/ShelfRail";
import { CirclesRail } from "../components/CirclesRail";

const PAGE_SIZE = 6;

function greeting(name: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${part}, ${name}`;
}

/**
 * docs/my-space-spec.md's grid page. Nav below lg: this app already has a
 * working "reach every section on a small screen" answer — the global
 * BottomTabBar (Root.tsx, every page) — so this doesn't also build the
 * spec's hamburger-menu nav on top of it; flagged as a deliberate deviation
 * rather than doubling up on navigation chrome.
 */
export function MySpaceGrid() {
  const { user, profile } = useAuth();
  const { publicFeed, posts, isCircleJoined } = useContent();
  const social = useSocial();
  const journal = useJournal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pages, setPages] = useState(1);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const reducedMotion = !!useReducedMotion();

  useEffect(() => {
    if (!user) return;
    fetchFollowingIds(user.id).then(setFollowingIds);
  }, [user?.id]);

  useEffect(() => () => markVisited(), []);

  const exploring = new Set(social.followedHobbies);
  const joinedCircles = circles.filter((c) => isCircleJoined(c.id));
  const joinedSpaces = new Set(joinedCircles.map((c) => c.hobbySlug));
  const lastVisit = useMemo(() => getLastVisit(), []);

  // Moments from people, Spaces or Circles you follow or joined, since your
  // last visit, never your own (docs/my-space-spec.md section 2).
  const unseen = useMemo(
    () =>
      publicFeed
        .filter((p) => p.userId !== user?.id)
        .filter((p) => p.createdAt > lastVisit)
        .filter(
          (p) =>
            (p.userId && followingIds.includes(p.userId)) ||
            exploring.has(`space:${p.hobbySlug}`) ||
            (p.subHobby && exploring.has(p.subHobby)) ||
            joinedSpaces.has(p.hobbySlug),
        )
        .sort((a, b) => b.createdAt - a.createdAt),
    [publicFeed, user?.id, lastVisit, followingIds, exploring, joinedSpaces],
  );

  const shown = unseen.slice(0, pages * PAGE_SIZE);
  const hasMore = unseen.length > shown.length;

  const selectedId = searchParams.get("m") ? Number(searchParams.get("m")) : shown[0]?.id ?? null;
  const selected = shown.find((p) => p.id === selectedId) ?? null;

  const setSelectedId = (id: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("m", String(id));
    setSearchParams(next, { replace: true });
  };

  const dateEyebrow = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).toUpperCase();

  const numeral =
    shown.length === 0
      ? "00–00"
      : `${String(1).padStart(2, "0")}–${String(shown.length).padStart(2, "0")}`;

  return (
    <div className="myspace-shell px-4 py-6 sm:px-5 lg:px-8">
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
        <div className="myspace-sheet">
          <ContactSheet
            moments={shown}
            totalUnseen={unseen.length}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onTurnPage={() => setPages((p) => p + 1)}
            hasMore={hasMore}
          />
        </div>

        <div className="myspace-moment mt-8 lg:mt-0">
          {selected ? (
            // Cross-fade on selection change (docs/my-space-spec.md section
            // 5) — keyed by post id so a new Moment mounts its own faded-in
            // instance rather than mutating one in place.
            <motion.div
              key={selected.id}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <MomentPanel post={selected} />
            </motion.div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nothing selected yet.
            </div>
          )}
        </div>

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
        </div>
      </div>
    </div>
  );
}
