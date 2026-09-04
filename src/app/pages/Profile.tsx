import { useState } from "react";
import { Link } from "react-router";
import { Plus, Share2, Users, Settings } from "lucide-react";
import { getHobby } from "../data/hobbies";
import { getCircle } from "../data/circles";
import { useRewards } from "../context/RewardsContext";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { QuietMilestones } from "../components/QuietMilestones";
import { MyPostsGrid } from "../components/MyPostsGrid";
import { ShareProfileDialog } from "../components/ShareProfileDialog";
import { ProfileHeadline } from "../components/ProfileHeadline";
import { HobbyShelf, useSessionsByHobby } from "../components/HobbyShelf";
import { SignUpPrompt } from "../components/SignUpPrompt";

function timeAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Pastel tints cycled across circle cards, so a list of them reads as calm. */
const CIRCLE_TINTS = [
  "var(--pastel-sage)",
  "var(--pastel-stone)",
  "var(--pastel-clay)",
  "var(--pastel-sky)",
  "var(--pastel-wheat)",
  "var(--pastel-rose)",
];

export function Profile() {
  const { points, stats } = useRewards();
  const { joinedCircleIds } = useContent();
  const { user, profile, isConfigured } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [circlesVisible, setCirclesVisible] = useState(true);

  const sessions = useSessionsByHobby();
  const totalSessions = sessions.reduce((n, s) => n + s.sessions, 0);

  const displayName = profile?.display_name || "You";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const creatorPoints = stats.postsCreated * 50;
  const consumerPoints = Math.max(points - creatorPoints, 0);
  const totalForSplit = Math.max(creatorPoints + consumerPoints, 1);
  const creatorShare = Math.round((creatorPoints / totalForSplit) * 100);

  const joinedCircles = joinedCircleIds
    .map((id) => getCircle(id))
    .filter((c): c is NonNullable<typeof c> => !!c);

  // Your own profile is the one page that genuinely needs to know who you are.
  // Anyone else's shelf is open at /u/<username>.
  if (isConfigured && !user) {
    return (
      <SignUpPrompt
        title="Your shelf lives here"
        body="Make an account and everything you log builds up on a shelf of your own — hobbies, sessions, milestones. You can keep browsing everything else without one."
        cta="Start my shelf"
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface py-8 sm:py-10">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Wordmark + settings, matching the phone layout */}
        <div className="mb-6 flex items-start justify-between">
          <span
            className="text-3xl sm:text-4xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
          >
            No Space
          </span>
          <button
            type="button"
            aria-label="Settings"
            className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings className="size-4" strokeWidth={1.7} />
          </button>
        </div>

        {/* Who you are, and how much you've done */}
        <div className="mb-5 flex items-center gap-5 sm:gap-6">
          <Avatar className="size-20 shrink-0 sm:size-24">
            <AvatarFallback className="text-xl">{user ? initials : "YOU"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1
              className="truncate text-3xl leading-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
            >
              {user ? displayName : "You"}
            </h1>
            <div className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-[var(--pastel-sage)]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 21c0-6 3-10 8-12-1 7-4 10-8 12Zm0 0c0-5-2.5-8.5-7-10 1 6 3.5 8.5 7 10Z" />
                </svg>
              </span>
              <span>
                <strong className="text-foreground">{totalSessions}</strong> lifetime{" "}
                {totalSessions === 1 ? "session" : "sessions"}
              </span>
            </div>
            <div className="mt-1">
              <ProfileHeadline variant="quiet" />
            </div>
          </div>
        </div>

        {/* Hobby chips — what you actually do */}
        {sessions.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {sessions.slice(0, 6).map((s) => (
              <Link
                key={s.key}
                to={
                  s.subSlug
                    ? `/space/${s.hobbySlug}?hobby=${s.subSlug}`
                    : `/space/${s.hobbySlug}`
                }
                className="rounded-full border border-border bg-white/[0.04] px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {s.label}
              </Link>
            ))}
          </div>
        )}

        {isConfigured && !user && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-muted px-4 py-3">
            <p className="text-xs text-muted-foreground">
              You're not logged in — sessions here are just local to this browser.
            </p>
            <Link to="/login" className="shrink-0">
              <Button variant="outline" size="sm">
                Log in
              </Button>
            </Link>
          </div>
        )}

        <div className="mb-8 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setShareOpen(true)}>
            <Share2 className="size-4" />
            Share profile
          </Button>
          <Link to="/create" className="flex-1">
            <Button variant="brand" className="w-full">
              <Plus className="size-4" />
              Log a session
            </Button>
          </Link>
        </div>

        {/* The shelf — the centrepiece of the page */}
        <div className="mb-9">
          <HobbyShelf />
        </div>

        {/* Creator vs. consumer */}
        <div className="glass-panel glow-violet mb-9 rounded-3xl p-6 shadow-2xl ring-1 ring-border sm:p-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-base sm:text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              Creator vs. consumer
            </h2>
            <span className="shrink-0 font-hud text-2xl text-gradient-brand sm:text-3xl">
              {creatorShare}% creator
            </span>
          </div>
          <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-surface-muted sm:h-4">
            <div
              className="h-full [background-image:var(--gradient-brand)]"
              style={{ width: `${creatorShare}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {stats.postsCreated === 0
              ? "Log your first session and this bar starts moving."
              : creatorShare >= 50
              ? "You're making more than you're consuming."
              : "Log a session to shift the balance toward making."}
          </p>
        </div>

        {/* Quiet milestones */}
        <div className="mb-9">
          <h2 className="mb-3 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
            Quiet Milestones
          </h2>
          <QuietMilestones onShare={() => setShareOpen(true)} />
        </div>

        {/* Circles joined — soft colour-tinted cards */}
        <div className="mb-9">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              Circles Joined
            </h2>
            {joinedCircles.length > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setCirclesVisible((v) => !v)}
              >
                {circlesVisible ? "Visible on profile" : "Hidden — only you see this"}
              </button>
            )}
          </div>

          {joinedCircles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven't joined a circle yet — spaces have local and topic-based circles
              worth a look.
            </p>
          ) : !circlesVisible ? (
            <p className="text-sm text-muted-foreground">
              Hidden. Only you can see which circles you've joined.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {joinedCircles.map((circle, i) => {
                const hobby = getHobby(circle.hobbySlug);
                const tint = CIRCLE_TINTS[i % CIRCLE_TINTS.length];
                return (
                  <Link
                    key={circle.id}
                    to={`/space/${circle.hobbySlug}`}
                    className="rounded-2xl px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${tint} 13%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${tint} 26%, transparent)`,
                    }}
                  >
                    <div
                      className="text-sm leading-snug"
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {circle.name}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Users className="size-3" strokeWidth={1.8} />
                      {circle.memberCount.toLocaleString()} members
                      {hobby && <span className="opacity-60">· {hobby.shortName}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Portfolio + activity */}
        <Tabs defaultValue="portfolio">
          <TabsList className="mb-5">
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio">
            <MyPostsGrid />
          </TabsContent>

          <TabsContent value="activity">
            {stats.postsCreated === 0 && stats.likesGiven === 0 && stats.purchases === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing yet — log a session to start filling this in.
              </p>
            ) : (
              <ActivityLog />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ShareProfileDialog open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}

function ActivityLog() {
  const { activity } = useRewards();
  if (activity.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nothing logged this session yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {activity.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm"
        >
          <span>{entry.label}</span>
          <div className="flex items-center gap-3">
            <span className="text-[var(--coral-text)]">+{entry.delta}</span>
            <span className="text-xs text-muted-foreground">{timeAgo(entry.at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
