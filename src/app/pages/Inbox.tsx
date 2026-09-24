import { useState } from "react";
import { Link } from "react-router";
import { Bell, Check, Inbox as InboxIcon, UserPlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useConnections } from "../context/ConnectionsContext";
import { useContent } from "../context/ContentContext";
import { useSocial } from "../context/SocialContext";
import { useIncomingFollowRequests } from "../lib/useIncomingFollowRequests";
import { respondToFollow } from "../lib/profileFollows";
import { getCircle } from "../data/circles";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

/**
 * Inbox: everything addressed to you, in one place.
 *
 *   Requests   follow requests and Circle invitations, waiting on you
 *   Activity   everything else that happened — thoughts, accepts, invites
 *
 * Direct messaging is very much alive (SocialContext.tsx's
 * startDirectMessage/Messages.tsx) — only the old person-to-person
 * connections system (PersonActions' Connect/Invite) was retired; see
 * ConnectionsContext.tsx. Messages, including a stranger's first message
 * waiting to be accepted or ignored, live only in Messages, never here —
 * see docs/communication-strategy.md's Phase 1 decisions on why message
 * requests and follow requests stay in separate places. Follow
 * (sql/profile-follows.sql) is a separate, accept-based relationship: it
 * doesn't unlock messaging, just decides whether a request counts toward
 * someone's follower count.
 */
function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ago(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function Empty({ icon: Icon, children }: { icon: typeof Bell; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
      <Icon className="mx-auto mb-3 size-5 text-muted-foreground" />
      <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export function Inbox() {
  const { user, isConfigured } = useAuth();
  const connections = useConnections();
  const content = useContent();
  const social = useSocial();
  const [followRefreshKey, setFollowRefreshKey] = useState(0);
  const followRequests = useIncomingFollowRequests(user?.id, followRefreshKey) ?? [];
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const circleInvitations = connections.circleInvitations;
  const requestCount = followRequests.length + circleInvitations.length;

  const answerFollow = async (followerId: string, accept: boolean) => {
    if (!user || respondingTo) return;
    setRespondingTo(followerId);
    await respondToFollow(followerId, user.id, accept);
    setFollowRefreshKey((k) => k + 1);
    setRespondingTo(null);
  };

  if (isConfigured && !user) {
    return (
      <div className="min-h-screen bg-surface py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="mb-2 text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
            Inbox
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Requests and activity live here once you have an account.
          </p>
          <Link to="/login?next=/inbox">
            <Button variant="coral">Sign in</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
          Inbox
        </h1>
        <p className="mb-8 mt-2 text-sm text-muted-foreground">
          Everything addressed to you. Nothing here takes effect until you answer it.
        </p>

        <Tabs defaultValue={requestCount > 0 ? "requests" : "activity"}>
          <TabsList className="mb-6">
            <TabsTrigger value="requests">
              Requests{requestCount > 0 ? ` (${requestCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* ── Requests ─────────────────────────────────────────────── */}
          <TabsContent value="requests">
            {requestCount === 0 ? (
              <Empty icon={UserPlus}>
                Nothing waiting on you. Follow requests and Circle invitations
                arrive here, and none of them take effect until you answer.
              </Empty>
            ) : (
              <div className="space-y-6">
                {followRequests.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-sm text-muted-foreground">Follow requests</h2>
                    <ul className="space-y-2">
                      {followRequests.map((r) => (
                        <li
                          key={r.followerId}
                          className="rounded-2xl border border-border bg-card px-4 py-3.5"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9 shrink-0">
                              {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt="" />}
                              <AvatarFallback className="text-[10px]">
                                {initials(r.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">
                                <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                                  {r.displayName}
                                </strong>{" "}
                                wants to follow your Shelf.
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              disabled={respondingTo === r.followerId}
                              className="flex-1 text-white [background-image:var(--gradient-brand)]"
                              onClick={() => answerFollow(r.followerId, true)}
                            >
                              <Check className="size-3.5" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={respondingTo === r.followerId}
                              className="flex-1"
                              onClick={() => answerFollow(r.followerId, false)}
                            >
                              <X className="size-3.5" />
                              Decline
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {circleInvitations.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-sm text-muted-foreground">Circle invitations</h2>
                    <ul className="space-y-2">
                      {circleInvitations.map((c) => {
                        const circle = getCircle(c.circleId);
                        return (
                          <li
                            key={c.id}
                            className="rounded-2xl border border-border bg-card px-4 py-3.5"
                          >
                            <p className="text-sm">
                              <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                                {c.invitedByName ?? "Someone"}
                              </strong>{" "}
                              invited you to{" "}
                              <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                                {circle?.name ?? "a Circle"}
                              </strong>
                              .
                            </p>
                            {c.note && (
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                "{c.note}"
                              </p>
                            )}
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 text-white [background-image:var(--gradient-brand)]"
                                onClick={async () => {
                                  await connections.respondToCircleInvitation(c.circleId, true);
                                  // The count is a public aggregate fetched
                                  // separately (ContentContext) — accepting
                                  // here doesn't refresh it on its own.
                                  await content.refetchCircleMemberCounts();
                                }}
                              >
                                <Check className="size-3.5" />
                                Join
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => connections.respondToCircleInvitation(c.circleId, false)}
                              >
                                <X className="size-3.5" />
                                Decline
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Activity ─────────────────────────────────────────────── */}
          <TabsContent value="activity">
            {social.notifications.length === 0 ? (
              <Empty icon={InboxIcon}>
                Quiet. Thoughts on your work, accepted follows and Circle
                invitations all show up here.
              </Empty>
            ) : (
              <ul className="space-y-2">
                {social.notifications.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-2xl border border-border bg-card px-4 py-3.5 text-sm"
                  >
                    {n.actorName && (
                      <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                        {n.actorName}{" "}
                      </strong>
                    )}
                    {n.body}
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {ago(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
