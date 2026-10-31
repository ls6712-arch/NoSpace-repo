import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useFeedInputs } from "../lib/useFeedInputs";
import type { Post } from "../data/posts";
import { buildFeed } from "../lib/homeFeed";
import { FeedCard } from "../components/home/FeedCard";
import { HomeHeader } from "../components/home/HomeHeader";
import { YourWeekCard } from "../components/home/YourWeekCard";
import { BestFitCard, type CardState } from "../components/home/BestFitCard";
import { MoreWaysList } from "../components/home/MoreWaysList";
import { LogMomentCard } from "../components/home/LogMomentCard";
import { HomeEmpty } from "../components/home/HomeEmpty";
import { MomentDetail } from "../components/MomentDetail";
import { Loadable } from "../components/ui/skeleton";
import { MomentGridSkeleton } from "../components/Skeletons";
import { ErrorNotice } from "../components/StateViews";
import { haptic, pop } from "../lib/motionTokens";
import { Skeleton } from "../components/ui/skeleton";
import { notifyError } from "../components/ui/toaster";
import { useHomeData } from "../lib/useHomeData";
import { commitToItem, inviteToItem, recordSuggestion, startPathFor } from "../lib/homeActions";
import { formatDate } from "../lib/dates";
import { GREETING_NO_NAME } from "../lib/homeCopy";
import { HOME_TZ } from "../lib/homeWeek";
import { firstName } from "../lib/tasteModel";
import type { HomeItem } from "../lib/homeItems";
import type { Owner } from "../lib/firstPlanRemote";

const PULL_THRESHOLD = 64;

/**
 * Home (Home v2): your week and what fits it (the best suggestion large, three
 * more below, ranked by home_suggestions() and filled with first steps from
 * your picks), a way to Log a Moment, then Moments from the people you follow,
 * newest first. At most about one card in four is a Space
 * promotion (a stranger's Moment from a Space you are in or a Corner you
 * follow); a friend's Moment at a Space is a friend card and never counts
 * toward that. With nothing from your people yet it shows the empty view
 * (screen 14). The old grid is still at /my-space/all.
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
      recordSuggestion("going", item, position);
      navigate(startPathFor(item));
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
  const greetingName = firstName(profile?.display_name ?? "");
  const place = home.place.area || home.place.city;
  const subline = [place, formatDate(now, { weekday: "long", timeZone: HOME_TZ })].filter(Boolean).join(" · ");
  const best = home.items[0];


  return (
    <div
      className="mx-auto w-full max-w-md px-4 pb-8 pt-4 max-desk:pt-[calc(var(--safe-top)+1rem)]"
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
    >
      <motion.div
        aria-live="polite"
        animate={{ height: refreshing ? 32 : pull > 8 ? Math.min(pull / 2, 32) : 0, opacity: refreshing || pull > 8 ? 1 : 0 }}
        transition={pop}
        className="flex items-center justify-center overflow-hidden text-small text-muted-foreground"
      >
        {refreshing ? "Refreshing…" : pull >= PULL_THRESHOLD ? "Let go to refresh" : "Pull to refresh"}
      </motion.div>

      <HomeHeader />

      <div className="flex flex-col gap-1 pb-5 pt-3">
        <h1 className="text-display font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
          {greetingName ? `Hi ${greetingName}` : GREETING_NO_NAME}
        </h1>
        <p className="text-small text-muted-foreground">{subline}</p>
      </div>

      {home.status === "loading" ? (
        <div className="flex flex-col gap-6" aria-hidden="true">
          <Skeleton className="h-[148px] w-full rounded-card" />
          <Skeleton className="h-[372px] w-full rounded-card" />
          <Skeleton className="h-[92px] w-full rounded-card" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <YourWeekCard windows={home.windows} left={home.left} plans={home.plans} now={now} />
          {best && (
            <section aria-labelledby="home-best-fit" className="flex flex-col gap-2.5">
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
          <MoreWaysList
            items={home.items.slice(1, 4)}
            firstPosition={1}
            states={cardStates}
            onShown={(item, position) => recordSuggestion("shown", item, position)}
            onOpen={(item, position) => recordSuggestion("opened", item, position)}
            onPrimary={(item, position) => void onPrimary(item, position)}
          />
          <LogMomentCard />
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
        From your people
      </h2>

      <Loadable loading={loading} skeleton={<MomentGridSkeleton count={2} />}>
        {postsStatus === "error" && feed.length === 0 ? (
          <ErrorNotice onRetry={reloadPosts} />
        ) : feed.length === 0 ? (
          <HomeEmpty />
        ) : (
          <>
            <div>
              {feed.map((item, i) => (
                <FeedCard key={item.post.id} post={item.post} source={item.source} onOpen={open} priority={i === 0} />
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
    </div>
  );
}
