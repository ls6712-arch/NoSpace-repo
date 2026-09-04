import { useState } from "react";
import { Link } from "react-router";
import { Plus, Share2, Users } from "lucide-react";
import { getHobby } from "../data/hobbies";
import { getCircle } from "../data/circles";
import { useRewards } from "../context/RewardsContext";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { Progress } from "../components/ui/progress";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { AchievementStrip } from "../components/AchievementStrip";
import { ProfileHeadline } from "../components/ProfileHeadline";
import { MyPostsGrid } from "../components/MyPostsGrid";
import { ShareProfileDialog } from "../components/ShareProfileDialog";

function timeAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function Profile() {
  const { points, progress, stats } = useRewards();
  const { activeHobbySlugs, joinedCircleIds } = useContent();
  const { user, profile, isConfigured } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [circlesVisible, setCirclesVisible] = useState(true);

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

  return (
    <div className="min-h-screen py-10">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header: avatar + a single headline stat, not a dashboard */}
        <div className="flex items-center gap-6 sm:gap-8 mb-6">
          <Avatar className="size-20 sm:size-24 shrink-0">
            <AvatarFallback className="text-xl">{user ? initials : "YOU"}</AvatarFallback>
          </Avatar>
          <ProfileHeadline />
        </div>

        <div className="mb-1">{user ? displayName : "you"}</div>
        <p className="text-sm text-muted-foreground mb-4">Create, Don't Just Consume.</p>
        <Progress value={progress} className="max-w-xs mb-5" />

        {isConfigured && !user && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              You're not logged in — points and posts here are just local to this browser.
            </p>
            <Link to="/login" className="shrink-0">
              <Button variant="outline" size="sm">
                Log in
              </Button>
            </Link>
          </div>
        )}

        {/* Hobby tags — what you actually engage with, not a category picker */}
        {activeHobbySlugs.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {activeHobbySlugs.map((slug) => {
              const hobby = getHobby(slug);
              if (!hobby) return null;
              return (
                <Link
                  key={slug}
                  to={`/space/${slug}`}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {hobby.shortName}
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 mb-8">
          <Button variant="outline" className="flex-1" onClick={() => setShareOpen(true)}>
            <Share2 className="size-4" />
            Share profile
          </Button>
          <Link to="/create" className="flex-1">
            <Button variant="brand" className="w-full">
              <Plus className="size-4" />
              Create
            </Button>
          </Link>
        </div>

        {/* Creator vs. consumer — the centerpiece of the page, so it's given
            more room and a little elevation than everything around it. */}
        <div className="glass-panel glow-violet rounded-3xl p-6 sm:p-8 mb-10 shadow-2xl ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-base sm:text-lg">Creator vs. consumer</h2>
            <span className="font-hud text-2xl sm:text-3xl text-gradient-brand shrink-0">
              {creatorShare}% creator
            </span>
          </div>
          <div className="h-3.5 sm:h-4 w-full overflow-hidden rounded-full bg-white/10 flex">
            <div
              className="h-full [background-image:var(--gradient-brand)]"
              style={{ width: `${creatorShare}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            {stats.postsCreated === 0
              ? "Your first post is worth 50 points — and shifts this bar."
              : creatorShare >= 50
              ? "You're making more than you're consuming."
              : "Post something to shift the balance toward creating."}
          </p>
        </div>

        {/* Achievements — Instagram "highlights" style, quiet, no ranking */}
        <h2 className="text-sm text-muted-foreground mb-3">Achievements</h2>
        <div className="mb-8">
          <AchievementStrip onShare={() => setShareOpen(true)} />
        </div>

        {/* Circles joined */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm text-muted-foreground">Circles joined</h2>
            {joinedCircles.length > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
            <div className="space-y-2">
              {joinedCircles.map((circle) => {
                const hobby = getHobby(circle.hobbySlug);
                return (
                  <Link
                    key={circle.id}
                    to={`/space/${circle.hobbySlug}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-sm hover:border-white/20 transition-colors"
                  >
                    <Users className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1">{circle.name}</span>
                    <span className="text-xs text-muted-foreground">{hobby?.shortName}</span>
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
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nothing yet — like a post or create something to start earning points.
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
      <p className="text-sm text-muted-foreground py-8 text-center">
        Nothing logged this session yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {activity.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-sm"
        >
          <span>{entry.label}</span>
          <div className="flex items-center gap-3">
            <span className="text-[#38BDF8]">+{entry.delta}</span>
            <span className="text-muted-foreground text-xs">{timeAgo(entry.at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
