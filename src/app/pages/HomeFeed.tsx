import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useFeedInputs } from "../lib/useFeedInputs";
import type { Post } from "../data/posts";
import { buildFeed } from "../lib/homeFeed";
import { Moment } from "../components/moment/Moment";
import { MomentListSkeleton } from "../components/moment/MomentSkeleton";
import { PAGE_GRID, PageShell, SPAN_GRID } from "../components/layout/PageShell";
import { MOMENT_LIST } from "../components/moment/Moment";
import { YourWeekCard } from "../components/home/YourWeekCard";
import { BestFitCard, type CardState } from "../components/home/BestFitCard";
import { BringPeopleCard, HappeningSection, StillMakingSection } from "../components/home/YourCornersSections";
import { MomentDetail } from "../components/moment/MomentDetail";
import { Loadable } from "../components/ui/skeleton";
import { ErrorNotice } from "../components/StateViews";
import { haptic, pop } from "../lib/motionTokens";
import { Skeleton } from "../components/ui/skeleton";
import { notifyError } from "../components/ui/toaster";
import { useHomeData } from "../lib/useHomeData";
import { commitToItem, inviteToItem, openStart, recordSuggestion } from "../lib/homeActions";
import { formatDate } from "../lib/dates";
import { GREETING_NO_NAME } from "../lib/homeCopy";
import { HOME_TZ } from "../lib/homeWeek";
import { firstName } from "../lib/tasteModel";
import type { HomeItem } from "../lib/homeItems";
import type { Owner } from "../lib/firstPlanRemote";
import { useSocial } from "../context/SocialContext";
import { useCorners } from "../context/CornersContext";
import { fetchHomeEvents, fetchStillMaking, yourCorners, type HomeEvent, type HomeWallCard } from "../lib/homeYourCorners";
import { cornerPath } from "../lib/cornerPath";

const PULL_THRESHOLD = 64;

/**
 * Home (Home v3, Nov 8, 2026): your Corners, right now. The one best fit for
 * you, a one-row way into your week, the newest Still making cards from the
 * Corners you follow (from the newest public Moments when you follow none),
 * this week's events in them, then Moments from the people you follow. While
 * that last part is empty, a card to bring someone in takes its place. The
 * old grid is still at /my-space/all.
 */
export function HomeFeed() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { publicFeed, postsStatus, reloadPosts } = useContent();
  const [searchParams, setSearchParams] = useSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  const [pull, setPull] = useState(0);
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});
  const [now] = useState(() => Date.now());
  const home = useHomeData(user?.id);
  const touchStart = useRef<number | null>(null);
  const social = useSocial();
  const { allCorners } = useCorners();
  const [wallCards, setWallCards] = useState<HomeWallCard[] | null>(null);
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const mine = useMemo(
    () => yourCorners(social.followedHobbies, allCorners, publicFeed),
    [social.followedHobbies, allCorners, publicFeed],
  );
  const cornerKeys = mine.corners.map((c) => `${c.spaceSlug}/${c.slug}`).join(",");
  useEffect(() => {
    if (!user) return;
    let live = true;
    void fetchStillMaking(mine.corners).then((cards) => live && setWallCards(cards));
    void fetchHomeEvents(mine.corners).then((list) => live && setEvents(list));
    return () => {
      live = false;
    };
    // The Corners, by key: a new array with the same Corners does not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, cornerKeys]);

  const { inputs: feedInputs, loaded } = useFeedInputs();
  const feed = useMemo(() => buildFeed(publicFeed, feedInputs), [publicFeed, feedInputs]);

  const openId = searchParams.get("m") ? Number(searchParams.get("m")) : null;
  const openPost = openId != null ? (publicFeed.find((p) => p.id === openId) ?? null) : null;
  const open = (post: Post) => {
    const next = new URLSearchParams(searchParams);
    next.set("m", String(post.id));
    setSearchParams(next, { replace: true });
  };
  const close = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("m");
    setSearchParams(next, { replace: true });
  };

  const refresh = async () => {
    setRefreshing(true);
    haptic();
    try {
      await reloadPosts();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  const loading = postsStatus === "loading" || !loaded;

  const owner: Owner | null = user
    ? { id: user.id, username: profile?.username ?? null, displayName: profile?.display_name?.trim() || "", avatarUrl: profile?.avatar_url ?? undefined }
    : null;
  const setCard = (id: string, state: CardState) => setCardStates((cur) => ({ ...cur, [id]: state }));

  const onPrimary = async (item: HomeItem, position: number) => {
    if (!owner) return;
    if (item.kind === "at_home") {
      // Start opens the activity. It is a start, not a commitment: going is recorded only when a plan is made there.
      openStart(item, position, navigate);
      return;
    }
    setCard(item.id, "busy");
    const r = await commitToItem(item, owner);
    if (!r.ok) {
      setCard(item.id, "idle");
      notifyError(r.error);
      return;
    }
    setCard(item.id, r.requested ? "requested" : "done");
    recordSuggestion("going", item, position);
  };
  const onInvite = async (item: HomeItem, position: number) => {
    if (!owner) return;
    const r = await inviteToItem(item, owner);
    if (!r.ok) notifyError(r.error ?? "");
    else recordSuggestion("invite", item, position);
  };
  const openWallCard = ({ card, corner }: HomeWallCard) => {
    const known = publicFeed.find((p) => p.id === card.postId);
    if (known) open(known);
    else navigate(cornerPath(corner.spaceSlug, corner.slug));
  };
  const greetingName = firstName(profile?.display_name ?? "");
  const place = home.place.area || home.place.city;
  const subline = [place, formatDate(now, { weekday: "long", timeZone: HOME_TZ })].filter(Boolean).join(" · ");
  const best = home.items[0];


  return (
    <PageShell
      title={greetingName ? `Hi ${greetingName}` : GREETING_NO_NAME}
      subtitle={subline}
      onTouchStart={(e) => {
        touchStart.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
      }}
      onTouchMove={(e) => {
        if (touchStart.current == null || refreshing) return;
        setPull(Math.max(0, Math.min(PULL_THRESHOLD * 1.5, e.touches[0].clientY - touchStart.current)));
      }}
      onTouchEnd={() => {
        touchStart.current = null;
        if (pull >= PULL_THRESHOLD) void refresh();
        else setPull(0);
      }}
      topBar={
        <>
          <motion.div
            aria-live="polite"
            animate={{ height: refreshing ? 32 : pull > 8 ? Math.min(pull / 2, 32) : 0, opacity: refreshing || pull > 8 ? 1 : 0 }}
            transition={pop}
            className="flex items-center justify-center overflow-hidden text-small text-muted-foreground"
          >
            {refreshing ? "Refreshing…" : pull >= PULL_THRESHOLD ? "Let go to refresh" : "Pull to refresh"}
          </motion.div>
        </>
      }
    >
      {home.status === "loading" ? (
        <div className={PAGE_GRID} aria-hidden="true">
          <Skeleton className={`h-[148px] w-full rounded-card ${SPAN_GRID}`} />
          <Skeleton className="h-[372px] w-full rounded-card" />
          <Skeleton className="h-[92px] w-full rounded-card" />
        </div>
      ) : (
        <div className={PAGE_GRID}>
          {best && (
            <section aria-labelledby="home-best-fit" className={`flex flex-col gap-2.5 ${SPAN_GRID}`}>
              <h2 id="home-best-fit" className="text-small font-semibold text-muted-foreground">
                Best fit for you
              </h2>
              <BestFitCard
                item={best}
                state={cardStates[best.id] ?? "idle"}
                onShown={() => recordSuggestion("shown", best, 0)}
                onOpen={() => recordSuggestion("opened", best, 0)}
                onPrimary={() => void onPrimary(best, 0)}
                onInvite={() => void onInvite(best, 0)}
              />
            </section>
          )}
          <div className={SPAN_GRID}>
            <YourWeekCard compact windows={home.windows} left={home.left} plans={home.plans} now={now} />
          </div>
        </div>
      )}

      <StillMakingSection cards={wallCards} fallback={mine.fallback} onOpen={openWallCard} />
      <HappeningSection events={events} />

      <Loadable loading={loading} skeleton={<MomentListSkeleton />}>
        {postsStatus === "error" && feed.length === 0 ? (
          <ErrorNotice onRetry={reloadPosts} />
        ) : feed.length === 0 ? (
          <BringPeopleCard />
        ) : (
          <>
            <h2 className="mb-3 mt-8 text-lead" style={{ fontFamily: "var(--font-display)" }}>
              From your people
            </h2>
            <div className={MOMENT_LIST}>
              {feed.map((item, i) => (
                <Moment key={item.post.id} post={item.post} onOpen={open} priority={i === 0} />
              ))}
            </div>
            <p className="mt-6 text-center text-small text-muted-foreground">You’re caught up</p>
            <p className="mt-2 text-center">
              <Link to="/my-space/all" className="inline-flex min-h-11 items-center text-small text-accent-text underline-offset-4 hover:underline">
                See all Moments
              </Link>
            </p>
          </>
        )}
      </Loadable>

      <MomentDetail post={openPost} owned={false} onOpenChange={(o) => !o && close()} />
    </PageShell>
  );
}
