import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
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

const PAGE_SIZE = 6;

function greeting(name: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${part}, ${name}`;
}

/**
 * docs/my-space-spec.md's grid page — behind a temporary flag
 * (MySpace.tsx) until Stages 2-6 are all in. Stage 2: shell + contact
 * sheet. The Moment panel and Shelf/Circles rail below are placeholders,
 * built out in Stages 3-4.
 */
export function MySpaceGrid() {
  const { user, profile } = useAuth();
  const { publicFeed, posts, isCircleJoined } = useContent();
  const social = useSocial();
  const journal = useJournal();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pages, setPages] = useState(1);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

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

  return (
    <div className="myspace-shell px-4 py-6 lg:px-8">
      <header className="myspace-header mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <p className="ns-section-kicker text-gold">{dateEyebrow}</p>
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
        {/* Numeral in foreground, not accent — docs/my-space-spec.md section 1
            explicitly overrides the mockup's warmer-looking numeral. */}
        <div className="text-right text-foreground">
          <p className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            {String(Math.min(shown.length, 1)).padStart(2, "0")}–{String(shown.length).padStart(2, "0")}
          </p>
          <p className="ns-section-kicker text-muted-foreground">TODAY'S SHEET</p>
        </div>
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

        <div className="myspace-moment">
          {selected ? (
            <MomentPanel post={selected} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Nothing selected yet.
            </div>
          )}
        </div>

        <div className="myspace-rail space-y-8">
          {/* Placeholder — Stage 4 replaces this with the real Shelf. */}
          <section>
            <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              The Shelf
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Where bodies of work get bound.</p>
            <p className="mt-3 text-xs text-muted-foreground">Built in Stage 4.</p>
          </section>

          <PursuitsRail pursuits={journal.projects} posts={posts} entryProject={journal.entryProject} />

          {/* Placeholder — Stage 4 replaces this with the real Circles list. */}
          <section>
            <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              Circles
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Small rooms, quieter than the feed.</p>
            <p className="mt-3 text-xs text-muted-foreground">Built in Stage 4.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
