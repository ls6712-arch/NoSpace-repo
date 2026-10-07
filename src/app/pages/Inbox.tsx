import { useState } from "react";
import { Link } from "react-router";
import { Check, Inbox as InboxIcon, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { useIncomingFollowRequests } from "../lib/useIncomingFollowRequests";
import { respondToFollow } from "../lib/profileFollows";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Loadable } from "../components/ui/skeleton";
import { ListSkeleton } from "../components/Skeletons";
import { EmptyState } from "../components/StateViews";
import { notifyError } from "../components/ui/toaster";
import { ERROR_LINE } from "../lib/stateCopy";
import { withoutDashes } from "../lib/text";

/**
 * Inbox: everything addressed to you, in one place.
 *
 *   Requests   follow requests waiting on you
 *   Activity   everything else that happened — thoughts, accepts, invites
 *
 * Direct messaging is very much alive (SocialContext.tsx's
 * startDirectMessage/Messages.tsx) — only the old person-to-person
 * connections system (PersonActions' Connect/Invite) was retired. Messages,
 * including a stranger's first message waiting to be accepted or ignored,
 * live only in Messages, never here —
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

export function Inbox() {
  const { user, isConfigured } = useAuth();
  const social = useSocial();
  const [followRefreshKey, setFollowRefreshKey] = useState(0);
  const followRequestsOrNull = useIncomingFollowRequests(user?.id, followRefreshKey);
  const followRequests = followRequestsOrNull ?? [];
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const requestCount = followRequests.length;
  const unreadActivity = social.notifications.filter((n) => !n.read).length;

  const answerFollow = async (followerId: string, accept: boolean) => {
    if (!user || respondingTo) return;
    setRespondingTo(followerId);
    const ok = await respondToFollow(followerId, user.id, accept);
    if (!ok) notifyError(ERROR_LINE, () => void answerFollow(followerId, accept));
    setFollowRefreshKey((k) => k + 1);
    setRespondingTo(null);
  };

  if (isConfigured && !user) {
    return (
      <div className="min-h-viewport bg-surface py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="mb-2 text-display" style={{ fontFamily: "var(--font-serif)" }}>
            Inbox
          </h1>
          <p className="mb-6 text-small text-muted-foreground">
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
    <div className="min-h-viewport bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-display" style={{ fontFamily: "var(--font-serif)" }}>
          Inbox
        </h1>
        <p className="mb-8 mt-2 text-small text-muted-foreground">
          Everything addressed to you. Nothing here takes effect until you answer it.
        </p>

        <Tabs defaultValue={requestCount > 0 ? "requests" : "activity"}>
          <TabsList className="mb-6">
            <TabsTrigger value="requests">
              Requests{requestCount > 0 ? ` (${requestCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="activity">
              Activity{unreadActivity > 0 ? ` (${unreadActivity})` : ""}
            </TabsTrigger>
          </TabsList>

          {/* ── Requests ─────────────────────────────────────────────── */}
          <TabsContent value="requests">
            <Loadable loading={followRequestsOrNull === null} skeleton={<ListSkeleton count={3} />}>
            {requestCount === 0 ? (
              <EmptyState
                line="Nothing waiting on you."
                hint="Follow requests arrive here, and none of them take effect until you answer."
                action={{ label: "Browse Spaces", to: "/discover?tab=spaces" }}
              />
            ) : (
              <div className="space-y-6">
                {followRequests.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-small text-muted-foreground">Follow requests</h2>
                    <ul className="space-y-2">
                      {followRequests.map((r) => (
                        <li
                          key={r.followerId}
                          className="rounded-card border border-border bg-card px-4 py-3.5"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9 shrink-0">
                              {r.avatarUrl && <AvatarImage src={r.avatarUrl} alt="" />}
                              <AvatarFallback className="text-caption">
                                {initials(r.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-small">
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
                              className="flex-1 text-on-brand [background-image:var(--gradient-brand)]"
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
              </div>
            )}
            </Loadable>
          </TabsContent>

          {/* ── Activity ─────────────────────────────────────────────── */}
          <TabsContent value="activity">
            <Loadable loading={!social.loaded} skeleton={<ListSkeleton count={5} />}>
            {social.notifications.length === 0 ? (
              <EmptyState
                size={requestCount === 0 ? "page" : "section"}
                icon={<InboxIcon />}
                line="No notifications yet."
                hint="Thoughts on your Moments and accepted follows all show up here."
                action={{ label: "Log a Moment", to: "/create" }}
              />
            ) : (
              <ul className="space-y-2">
                {social.notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`rounded-card border px-4 py-3.5 text-small ${
                      n.read
                        ? "border-border bg-card"
                        : "border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--yellow)_10%,var(--card))]"
                    }`}
                  >
                    {!n.read && <span className="sr-only">Unread. </span>}
                    <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                      {n.actorName ?? "Someone"}{" "}
                    </strong>
                    {withoutDashes(n.body)}
                    <span className="ml-2 text-caption text-muted-foreground">
                      {ago(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            </Loadable>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
