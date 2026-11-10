import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useContent } from "../../context/ContentContext";
import { useCorners } from "../../context/CornersContext";
import { useSocial } from "../../context/SocialContext";
import { cornerAbout } from "../../data/curatedCorners";
import { cornerStyle } from "../../lib/categoryStyle";
import { cornerPath } from "../../lib/cornerPath";
import { cornerPicture } from "../../lib/cornerPicture";
import { fetchCornerAffinity } from "../../lib/discover";
import { homeCornersRow } from "../../lib/homeCornersRow";
import { logSuggestionEvent } from "../../lib/homeSuggestions";
import type { HomeCorner } from "../../lib/homeYourCorners";
import { fetchTaste, pickKey } from "../../lib/tasteRemote";
import { useShownOnce } from "../../lib/useShownOnce";
import { PressLink } from "../common/PressLink";
import { HorizontalRow } from "../HorizontalRow";
import { ImageWithFallback } from "../ImageWithFallback";
import { Skeleton } from "../ui/skeleton";
import { SectionHead } from "./YourCornersSections";

/** The row's words (docs/glossary.md, Corners on Home and Discover; approved Nov 10, 2026). */
export const CORNERS_ROW_COPY = {
  forYou: "Corners for you",
  yours: "Your Corners",
  seeAll: "See all",
} as const;

const CARD_WIDTH = "w-40 shrink-0 tab:w-48";

/** What the person's picks and affinity are: not asked for yet, loaded, or could not be read. */
type Ranking = { status: "loading" } | { status: "ready"; picks: string[]; affinity: Map<string, number> } | { status: "failed" };
const NO_RANKING: Ranking = { status: "ready", picks: [], affinity: new Map() };

/**
 * One row of Corners on Home: a square picture, the name and the Corner's one line. Someone who follows Corners
 * sees those ("Your Corners"); anyone else sees the Corners that have a 3D world ("Corners for you"), as a still
 * picture of it. A card opens the Corner's page, as a Corner does everywhere else. No counts, badges or buttons.
 *
 * It stands alone: it reads what it needs itself, so moving it on Home is moving this one element. With nothing
 * to show, or when what it reads cannot be read, it renders nothing. It never shows an error or an empty box.
 */
export function CornersRow() {
  const { user } = useAuth();
  const { publicFeed } = useContent();
  const social = useSocial();
  const { allCorners } = useCorners();
  const follows = social.followedHobbies.length > 0;
  const followsKnown = !user || social.loaded;
  // Picks and affinity order the row only for a signed-in person who follows no Corners. Nobody else asks for them.
  const needsRanking = !!user && followsKnown && !follows;
  const [ranking, setRanking] = useState<Ranking>(NO_RANKING);
  useEffect(() => {
    if (!needsRanking || !user) {
      setRanking(NO_RANKING);
      return;
    }
    let live = true;
    setRanking({ status: "loading" });
    Promise.all([fetchTaste(user.id, { strict: true }), fetchCornerAffinity()])
      .then(([taste, affinity]) => live && setRanking({ status: "ready", picks: taste.picks, affinity }))
      .catch(() => live && setRanking({ status: "failed" }));
    return () => {
      live = false;
    };
  }, [needsRanking, user?.id]);

  const row = useMemo(
    () =>
      ranking.status === "ready"
        ? homeCornersRow({ followed: social.followedHobbies, known: allCorners, feed: publicFeed, picks: ranking.picks, affinity: ranking.affinity })
        : null,
    [ranking, social.followedHobbies, allCorners, publicFeed],
  );

  if (ranking.status === "failed") return null;
  const loading = !followsKnown || ranking.status === "loading" || !row;
  if (!loading && row.corners.length === 0) return null;
  const title = row?.yours ? CORNERS_ROW_COPY.yours : CORNERS_ROW_COPY.forYou;

  return (
    <section aria-labelledby={loading ? undefined : "home-corners-row"} aria-hidden={loading || undefined} className="mt-8">
      {loading ? (
        // The heading's height, then squares the size of the real cards, so nothing below moves when they arrive.
        <div className="mb-3 flex min-h-11 items-center">
          <Skeleton className="h-6 w-40 rounded-control" />
        </div>
      ) : (
        <SectionHead id="home-corners-row" title={title} link={{ to: "/corners", label: CORNERS_ROW_COPY.seeAll }} />
      )}
      <HorizontalRow name="home-corners-row" label={title} contentKey={row?.corners.map((c) => c.slug).join(",")}>
        {loading
          ? [0, 1, 2, 3].map((i) => (
              <li key={i} className={CARD_WIDTH}>
                <Skeleton className="aspect-square w-full rounded-card" />
                <Skeleton className="mt-2 h-5 w-24 rounded-control" />
                <Skeleton className="mt-1 h-8 w-full rounded-control" />
              </li>
            ))
          : row.corners.map((c, i) => <CornerSquare key={c.slug} corner={c} position={i} log={!!user} />)}
      </HorizontalRow>
    </section>
  );
}

function CornerSquare({ corner, position, log }: { corner: HomeCorner; position: number; log: boolean }) {
  const record = (action: "shown" | "opened") => {
    const key = pickKey(corner.spaceSlug, corner.slug);
    if (log) void logSuggestionEvent({ kind: "corner", refId: key, cornerKey: key, position, action });
  };
  const ref = useShownOnce<HTMLLIElement>(() => record("shown"));
  const about = cornerAbout(corner.spaceSlug, corner.slug);
  return (
    <li ref={ref} className={`${CARD_WIDTH} snap-start`} style={cornerStyle(corner.spaceSlug, corner.slug)}>
      <PressLink to={cornerPath(corner.spaceSlug, corner.slug)} onClick={() => record("opened")} className="block rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ImageWithFallback src={cornerPicture(corner.spaceSlug, corner.slug, 400)} alt={corner.name} width={192} aspect="1 / 1" tint className="w-full rounded-card border border-border" />
        <span className="mt-2 block truncate text-small font-semibold">{corner.name}</span>
        <span className="mt-1 line-clamp-2 text-caption text-muted-foreground">{about}</span>
      </PressLink>
    </li>
  );
}
