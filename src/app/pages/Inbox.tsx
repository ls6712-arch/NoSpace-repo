import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { PageShell } from "../components/layout/PageShell";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { useContent } from "../context/ContentContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useIncomingFollowRequests } from "../lib/useIncomingFollowRequests";
import { respondToFollow } from "../lib/profileFollows";
import { collectPursuitMoments } from "../lib/pursuitTrail";
import { fetchJoinRequestsForMe, quietPursuits, answeredIds, markAnswered, type JoinRequest } from "../lib/needsYou";
import { answerJoinRequest, fetchNextSession, setImIn, type PursuitSession } from "../lib/openPursuits";
import { pursuitStatus, pauseProject, useJournal } from "../lib/journal";
import { profilesById } from "../lib/pursuitsRemote";
import { PillButton } from "../components/ui/PillButton";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Loadable } from "../components/ui/skeleton";
import { ListSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/StateViews";
import { notifyError } from "../components/ui/toaster";
import { ERROR_LINE } from "../lib/stateCopy";
import { notificationText } from "../lib/text";
import { formatDateTime } from "../lib/dates";
import { plural } from "../lib/plural";
import { sheet } from "../lib/motionTokens";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/** A card that collapses out with a spring once it has been answered. */
function Collapsing({ id, className, children }: { id: string; className: string; children: React.ReactNode }) {
  return (
    <motion.li key={id} layout initial={false} exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }} transition={sheet} className={`overflow-hidden ${className}`}>
      {children}
    </motion.li>
  );
}

/**
 * Notifications (screen 11): "Needs you" first (an event you have not answered,
 * a request to join your open group, a request to follow you), each card with
 * two buttons that collapses away once answered, then "Earlier". No comparison
 * wording anywhere.
 */
export function Inbox() {
  const { user, isConfigured } = useAuth();
  const social = useSocial();
  const { posts } = useContent();
  const { logs } = usePrivateLogs();
  const journal = useJournal();
  const [followRefreshKey, setFollowRefreshKey] = useState(0);
  const followRequestsOrNull = useIncomingFollowRequests(user?.id, followRefreshKey);
  const followRequests = followRequestsOrNull ?? [];
  const [busy, setBusy] = useState<string | null>(null);
  const [answered, setAnswered] = useState<Set<string>>(() => answeredIds());
  const [joins, setJoins] = useState<(JoinRequest & { name: string; username: string | null })[]>([]);
  const [events, setEvents] = useState<{ pursuitId: string; title: string; session: PursuitSession }[]>([]);
  const [paused, setPaused] = useState<Set<string>>(new Set());

  const done = (id: string) => {
    markAnswered(id);
    setAnswered((prev) => new Set(prev).add(id));
  };

  useEffect(() => {
    if (!user) return;
    let live = true;
    void fetchJoinRequestsForMe(user.id).then(async (list) => {
      const names = await profilesById(list.map((j) => j.userId));
      if (live) setJoins(list.map((j) => ({ ...j, name: names.get(j.userId)?.displayName ?? "Someone", username: names.get(j.userId)?.username ?? null })));
    });
    return () => {
      live = false;
    };
  }, [user?.id]);

  // The next session of each Pursuit you are in that you have not said yes to.
  const activeIds = journal.projects.filter((p) => pursuitStatus(p) === "active").map((p) => p.id).slice(0, 4);
  const activeKey = activeIds.join(",");
  useEffect(() => {
    if (!user || activeIds.length === 0) return;
    let live = true;
    void Promise.all(activeIds.map((id) => fetchNextSession(id))).then((sessions) => {
      if (!live) return;
      setEvents(
        sessions.flatMap((s, i) => {
          if (!s || s.going.some((g) => g.userId === user.id)) return [];
          const title = journal.projects.find((p) => p.id === activeIds[i])?.title ?? "";
          return [{ pursuitId: activeIds[i], title, session: s }];
        }),
      );
    });
    return () => {
      live = false;
    };
    // activeIds is derived from activeKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeKey]);

  const quiet = useMemo(
    () => quietPursuits(journal.projects, (p) => collectPursuitMoments(p.id, posts, journal.entryProject, logs)).filter((q) => !paused.has(q.id)),
    [journal.projects, journal.entryProject, posts, logs, paused],
  );

  const answerFollow = async (followerId: string, accept: boolean) => {
    if (!user || busy) return;
    setBusy(followerId);
    const ok = await respondToFollow(followerId, user.id, accept);
    if (!ok) notifyError(ERROR_LINE, () => void answerFollow(followerId, accept));
    setFollowRefreshKey((k) => k + 1);
    setBusy(null);
  };
  const answerJoin = async (j: JoinRequest, accept: boolean) => {
    if (busy) return;
    setBusy(j.userId + j.pursuitId);
    const err = await answerJoinRequest(j.pursuitId, j.userId, accept);
    setBusy(null);
    if (err) return notifyError(err, () => void answerJoin(j, accept));
    done(`join:${j.pursuitId}:${j.userId}`);
  };
  const answerEvent = async (e: { pursuitId: string; session: PursuitSession }, going: boolean) => {
    if (!user || busy) return;
    setBusy(`event:${e.session.id}`);
    const err = going ? await setImIn(e.session.id, user.id, true) : null;
    setBusy(null);
    if (err) return notifyError(err, () => void answerEvent(e, going));
    done(`event:${e.session.id}`);
  };

  if (isConfigured && !user) {
    return (
      <PageShell title="Notifications" subtitle="Requests and activity live here once you have an account.">
        <Link to="/login?next=/inbox" className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-body font-semibold text-accent-foreground">
          Log in
        </Link>
      </PageShell>
    );
  }

  const shownEvents = events.filter((e) => !answered.has(`event:${e.session.id}`));
  const shownJoins = joins.filter((j) => !answered.has(`join:${j.pursuitId}:${j.userId}`));
  const needsCount = shownEvents.length + shownJoins.length + followRequests.length;
  const earlier = social.notifications;

  return (
    <PageShell title="Notifications">

      <Loadable loading={followRequestsOrNull === null && !social.loaded} skeleton={<ListSkeleton count={4} />}>
        {needsCount > 0 && (
          <section aria-labelledby="needs-you" className="mb-6">
            <h2 id="needs-you" className="mb-2 text-small font-semibold text-muted-foreground">
              Needs you
            </h2>
            <ul className="flex flex-col">
              <AnimatePresence initial={false}>
                {shownEvents.map((e) => (
                  <Collapsing key={`event:${e.session.id}`} id={`event:${e.session.id}`} className="mb-3 rounded-card border border-border bg-card p-4">
                    <p className="text-body font-semibold">{`${e.title.slice(0, 80)} is ${formatDateTime(e.session.startsAt)}`}</p>
                    <p className="mt-1 text-small">{[e.session.place, e.session.going.length > 0 ? `${e.session.going.length} going` : undefined].filter(Boolean).join(" · ")}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <PillButton variant="light" disabled={busy === `event:${e.session.id}`} onClick={() => void answerEvent(e, true)}>
                        I’m going
                      </PillButton>
                      <PillButton variant="outline" onClick={() => void answerEvent(e, false)}>
                        Can’t make it
                      </PillButton>
                    </div>
                  </Collapsing>
                ))}
                {shownJoins.map((j) => (
                  <Collapsing key={`join:${j.pursuitId}:${j.userId}`} id={`join:${j.pursuitId}:${j.userId}`} className="mb-3 rounded-card bg-card p-4">
                    <p className="text-body font-semibold">{`${j.name.slice(0, 60)} wants to join “${j.pursuitTitle.slice(0, 80)}”`}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <PillButton variant="light" disabled={busy === j.userId + j.pursuitId} onClick={() => void answerJoin(j, true)}>
                        Let in
                      </PillButton>
                      <PillButton variant="outline" onClick={() => void answerJoin(j, false)}>
                        Not now
                      </PillButton>
                      {j.username && (
                        <Link to={`/u/${j.username}`} className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-accent-text underline underline-offset-4">
                          View profile
                        </Link>
                      )}
                    </div>
                  </Collapsing>
                ))}
                {followRequests.map((r) => (
                  <Collapsing key={`follow:${r.followerId}`} id={`follow:${r.followerId}`} className="mb-3 rounded-card bg-card p-4">
                    <p className="text-body font-semibold">{`${r.displayName.slice(0, 60)} wants to follow you`}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <PillButton variant="light" disabled={busy === r.followerId} onClick={() => void answerFollow(r.followerId, true)}>
                        Accept
                      </PillButton>
                      <PillButton variant="outline" disabled={busy === r.followerId} onClick={() => void answerFollow(r.followerId, false)}>
                        Decline
                      </PillButton>
                    </div>
                  </Collapsing>
                ))}
              </AnimatePresence>
            </ul>
          </section>
        )}

        <section aria-labelledby="earlier">
          <h2 id="earlier" className="mb-3 text-small font-semibold text-muted-foreground">
            Earlier
          </h2>
          {earlier.length === 0 && quiet.length === 0 ? (
            <EmptyState size="inline" line="Nothing here yet." hint="Reactions on your Moments and updates from your Pursuits show up here." action={{ label: "Log a Moment", to: "/create" }} />
          ) : (
            <ul className="flex flex-col gap-4">
              {quiet.map((q) => (
                <li key={`quiet:${q.id}`} className="flex items-center gap-3">
                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback className="text-small">{initials(q.title)}</AvatarFallback>
                  </Avatar>
                  <p className="min-w-0 flex-1 text-body">
                    {`${q.title.slice(0, 60)} has been quiet for ${plural(q.weeks, "week")}. Pause it?`}
                  </p>
                  <PillButton
                    variant="outline"
                    onClick={() => {
                      pauseProject(q.id);
                      setPaused((prev) => new Set(prev).add(q.id));
                    }}
                  >
                    Pause
                  </PillButton>
                </li>
              ))}
              {earlier.map((n) => (
                <li key={n.id} className={`flex items-center gap-3 rounded-card p-2 ${n.read ? "" : "bg-surface-raised"}`}>
                  <Avatar className="size-10 shrink-0">
                    {n.actorAvatar && <AvatarImage src={n.actorAvatar} alt="" className="object-cover" />}
                    <AvatarFallback className="text-small">{initials(n.actorName ?? "Someone")}</AvatarFallback>
                  </Avatar>
                  <p className={`min-w-0 flex-1 text-body ${n.read ? "text-muted-foreground" : ""}`}>
                    {!n.read && <span className="sr-only">Unread. </span>}
                    {!(n.actorName && n.body.startsWith(n.actorName)) && <strong className="font-semibold">{n.actorName ?? "Someone"} </strong>}
                    {notificationText(n.body)}
                  </p>
                  {!n.read && <span className="size-2 shrink-0 rounded-full [background-color:var(--accent-text)]" aria-hidden="true" />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </Loadable>
    </PageShell>
  );
}
