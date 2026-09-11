import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Eye,
  HelpCircle,
  Lock,
  MapPin,
  PenLine,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { CircleTabId } from "../data/circles";
import { getHobby } from "../data/hobbies";
import { useCircles } from "../context/CirclesContext";
import { useContent } from "../context/ContentContext";
import { useConnections } from "../context/ConnectionsContext";
import { useAuth } from "../context/AuthContext";
import { CircleComposer } from "../components/CircleComposer";
import { CircleRoster } from "../components/CircleRoster";
import { Thoughts } from "../components/Thoughts";
import { PostMedia } from "../components/PostMedia";
import { Button } from "../components/ui/button";

const TABS: { id: CircleTabId; label: string; icon: typeof PenLine }[] = [
  { id: "updates", label: "Updates", icon: PenLine },
  { id: "pursuits", label: "Pursuits", icon: Sparkles },
  { id: "questions", label: "Questions", icon: HelpCircle },
  { id: "events", label: "Events", icon: CalendarDays },
];

function timeAgo(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * A Circle's own place — a board with four tabs, real threads, and a real
 * roster, for either a real (Supabase-backed) Circle or one of the
 * hand-written seed Circles, which degrade gracefully here: no live
 * roster or owner controls (there's no account behind them to own), but
 * posting into their threads and replying to one works exactly the same.
 */
export function CircleBoard() {
  const { id = "" } = useParams();
  const circleId = Number(id);
  const { getCircle, isRealCircle, isMemberOfReal, joinRealCircle, leaveRealCircle } = useCircles();
  const { circleFeed, isCircleJoined, joinCircle, leaveCircle, setThreadAnswered } = useContent();
  const connections = useConnections();
  const { user } = useAuth();
  const [tab, setTab] = useState<CircleTabId>("updates");
  const [joinError, setJoinError] = useState<string | null>(null);

  const circle = getCircle(circleId);

  if (!circle) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
          This Circle isn't here.
        </h1>
        <Link to="/circles" className="text-sm text-[var(--coral-text)] hover:underline">
          Back to Circles
        </Link>
      </div>
    );
  }

  const real = isRealCircle(circle.id);
  const isOwner = real && !!user && circle.ownerId === user.id;
  const joined = real
    ? isMemberOfReal(circle.id)
    : isCircleJoined(circle.id) || connections.myCircleIds.includes(circle.id);
  const space = getHobby(circle.hobbySlug);
  const gated = real && circle.visibility === "Members only" && !joined && !isOwner;

  const toggleMembership = async () => {
    setJoinError(null);
    if (real) {
      const { error } = joined ? await leaveRealCircle(circle.id) : await joinRealCircle(circle.id);
      if (error) setJoinError(error);
      return;
    }
    if (joined) {
      if (connections.myCircleIds.includes(circle.id)) await connections.leaveCircleInvite(circle.id);
      if (isCircleJoined(circle.id)) leaveCircle(circle.id);
    } else {
      joinCircle(circle.id);
    }
  };

  const threads = gated ? [] : circleFeed(circle.id, tab);

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="container mx-auto max-w-3xl px-4 pt-8">
        <Link
          to="/circles"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Circles
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
              {circle.name}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{circle.purpose}</p>
            <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Users className="size-3" strokeWidth={1.8} />
                {circle.memberCount.toLocaleString()} members
              </li>
              {circle.location && (
                <li className="flex items-center gap-1.5">
                  <MapPin className="size-3" strokeWidth={1.8} />
                  {circle.location}
                </li>
              )}
              <li className="flex items-center gap-1.5">
                <Eye className="size-3" strokeWidth={1.8} />
                {circle.visibility}
              </li>
              {space && <li>{space.shortName}</li>}
              {isOwner && <li className="text-[var(--coral-text)]">You created this Circle</li>}
            </ul>
          </div>
          <Button variant={joined ? "outline" : "coral"} size="sm" className="shrink-0" onClick={toggleMembership}>
            {joined ? "Leave" : "Join"}
          </Button>
        </div>
        {joinError && <p className="mb-4 text-xs text-[var(--coral-text)]">{joinError}</p>}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div className="min-w-0">
            <div role="tablist" aria-label={`${circle.name} sections`} className="flex flex-wrap gap-1">
              {TABS.map(({ id: tabId, label, icon: Icon }) => (
                <button
                  key={tabId}
                  role="tab"
                  type="button"
                  aria-selected={tab === tabId}
                  onClick={() => setTab(tabId)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
                    tab === tabId
                      ? "text-white [background-image:var(--gradient-brand)]"
                      : "bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {gated ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border px-5 py-9 text-center">
                <Lock className="mx-auto mb-2 size-5 text-muted-foreground" />
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  Members only. Join to read what's here — there's no request to approve, joining is enough.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-4">
                  {joined || !real || isOwner ? (
                    <CircleComposer circle={circle} tab={tab} />
                  ) : (
                    <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">
                      Join to post here.
                    </p>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {threads.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-border px-5 py-9 text-center text-sm text-muted-foreground">
                      Nothing here yet. Yours would be the first.
                    </p>
                  ) : (
                    threads.map((thread) => {
                      const canMarkAnswered = tab === "questions" && !!user && (user.id === thread.userId || isOwner);
                      const hasMedia = thread.media && /^https?:\/\//.test(thread.media);
                      return (
                        <div key={thread.id} className="rounded-2xl border border-border bg-card p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm">
                              <span style={{ fontFamily: "var(--font-serif)" }}>{thread.creator}</span>{" "}
                              <span className="text-muted-foreground">· {timeAgo(thread.createdAt)}</span>
                            </span>
                            {tab === "questions" && (
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                                  thread.answered
                                    ? "bg-[var(--pastel-sage)]/40 text-foreground"
                                    : "bg-surface-muted text-muted-foreground"
                                }`}
                              >
                                {thread.answered ? "Answered" : "Open"}
                              </span>
                            )}
                          </div>
                          {hasMedia && (
                            <div className="mb-2 overflow-hidden rounded-xl border border-[var(--hairline)]">
                              <PostMedia
                                media={thread.media}
                                type={thread.type}
                                hobbySlug={thread.hobbySlug}
                                seed={thread.id}
                                className="w-full"
                              />
                            </div>
                          )}
                          <p className="whitespace-pre-line text-sm leading-relaxed">{thread.caption}</p>
                          {canMarkAnswered && (
                            <button
                              type="button"
                              onClick={() => setThreadAnswered(thread.id, !thread.answered)}
                              className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <Check className="size-3" />
                              {thread.answered ? "Reopen" : "Mark answered"}
                            </button>
                          )}
                          <Thoughts
                            postId={thread.id}
                            postOwnerId={thread.userId}
                            postOwnerName={thread.creator}
                            allowMedia
                            compact
                            className="mt-3"
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
            <CircleRoster circle={circle} />
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-1.5 text-sm">
                <Shield className="size-3.5 text-muted-foreground" />
                House rules
              </div>
              <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                {circle.rules.map((rule) => (
                  <li key={rule} className="list-disc pl-4">
                    {rule}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Moderated by {circle.moderators.join(" and ")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
