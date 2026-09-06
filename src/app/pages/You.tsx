import { useState } from "react";
import { Link } from "react-router";
import { Bookmark, Lock, PenLine, Share2, UserRound, Users, Settings } from "lucide-react";
import { getHobby } from "../data/hobbies";
import { getCircle } from "../data/circles";
import { useRewards } from "../context/RewardsContext";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { QuietMilestones } from "../components/QuietMilestones";
import { CirclesJoined } from "../components/CirclesJoined";
import { AvatarPicker } from "../components/AvatarPicker";
import { useSocial } from "../context/SocialContext";
import { subHobbyLabel } from "../data/hobbies";
import { ShareProfileDialog } from "../components/ShareProfileDialog";
import { ProfileHeadline } from "../components/ProfileHeadline";
import { HobbyShelf, useSessionsByHobby } from "../components/HobbyShelf";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { ContentCard } from "../components/ContentCard";
import { removePrivateLog, useJournal } from "../lib/journal";
import { AccountSettings } from "../components/AccountSettings";

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

export function You() {
  const { points, stats } = useRewards();
  const { joinedCircleIds, posts } = useContent();
  const journal = useJournal();
  const social = useSocial();
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const { user, profile, isConfigured, signOut } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [circlesVisible, setCirclesVisible] = useState(true);

  const savedWork = journal.saved
    .map((id) => posts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const sessions = useSessionsByHobby();
  const totalSessions = sessions.reduce((n, s) => n + s.sessions, 0);

  // Never abbreviate the placeholder: "You" becomes a meaningless "Y".
  const realName = profile?.display_name?.trim();
  const displayName = realName || "You";
  const initials = (realName ?? "")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
    <div className="ns-you-page min-h-screen bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="ns-you-kicker mb-3">YOUR PERSONAL ARCHIVE</div>
        <div className="mb-8 flex items-end justify-between gap-5">
          <div>
            <h1 className="text-[clamp(2.8rem,7vw,5rem)] leading-[.9] tracking-[-.04em]" style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
              You
            </h1>
            <p className="mt-3 max-w-md text-lg leading-relaxed text-muted-foreground">Your work, your saved ideas, your space to keep becoming.</p>
          </div>
          <span className="ns-you-index hidden font-hud text-[10px] tracking-[.15em] text-[var(--coral-text)] sm:block">NO. 01 / KEEPING AT IT</span>
        </div>

        <div className="ns-you-profile-card mb-8">
          <div className="ns-you-avatar-panel">
            <AvatarPicker
              name={displayName}
              url={avatar ?? profile?.avatar_url}
              onChange={setAvatar}
            />
          </div>
          <div className="ns-you-identity min-w-0">
            <h2 className="truncate text-3xl leading-tight sm:text-4xl" style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
              {user ? displayName : "You"}
            </h2>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="ns-you-sprout" aria-hidden="true">✦</span>
              <span><strong className="text-foreground">{totalSessions}</strong> lifetime {totalSessions === 1 ? "session" : "sessions"}</span>
            </div>
            <div className="mt-2"><ProfileHeadline variant="quiet" /></div>
          </div>
        </div>

        {/* Hobby chips — what you actually do */}
        {sessions.length > 0 && (
          <div className="ns-you-tags mb-7 flex flex-wrap gap-2">
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

        <div className="ns-you-actions mb-9 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setShareOpen(true)}>
            <Share2 className="size-4" />
            Share your work
          </Button>
          <Link to="/create" className="flex-1">
            <Button variant="coral" className="w-full">
              <PenLine className="size-4" />
              Create
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="work">
          <TabsList className="ns-you-tabs mb-6 flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="work">Your work</TabsTrigger>
            <TabsTrigger value="private">Private logs</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
            <TabsTrigger value="following">Exploring</TabsTrigger>
            <TabsTrigger value="circles">Your Circles</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="work">
            <p className="mb-5 text-sm text-muted-foreground">
              One book per hobby, shelved under the Space it belongs to. Open one
              to see everything you've logged in it.
            </p>
            <HobbyShelf />
          </TabsContent>

          <TabsContent value="private">
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Kept here and nowhere else. Private logs never appear in a Space,
              a feed, or your public shelf — which is why they can look missing
              if you go looking for them there.
            </p>
            {journal.privateLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
                <Lock className="mx-auto mb-3 size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nothing private yet. Anything you save as a private log stays
                  here — never shown to anyone.
                </p>
                <Link to="/create" className="mt-4 inline-block">
                  <Button variant="outline" size="sm">Write one</Button>
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {journal.privateLogs.map((entry) => (
                  <li key={entry.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Lock className="size-3" />
                        Only you · {timeAgo(entry.createdAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePrivateLog(entry.id)}
                        className="text-[11px] text-muted-foreground transition-colors hover:text-[var(--coral-text)]"
                      >
                        Delete
                      </button>
                    </div>
                    {/* A wordless capture is a picture, so show the picture. */}
                    {entry.media && (
                      <div className="mb-3 overflow-hidden rounded-xl border border-[var(--hairline)]">
                        {entry.mediaType === "video" ? (
                          <video src={entry.media} controls className="w-full" />
                        ) : (
                          <img src={entry.media} alt="" className="w-full" />
                        )}
                      </div>
                    )}
                    <p className="whitespace-pre-line text-sm leading-relaxed">{entry.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="saved">
            {savedWork.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
                <Bookmark className="mx-auto mb-3 size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nothing saved yet. Save anything on Discover to keep it here.
                </p>
                <Link to="/discover" className="mt-4 inline-block">
                  <Button variant="outline" size="sm">Go to Discover</Button>
                </Link>
              </div>
            ) : (
              <div className="columns-1 gap-4 sm:columns-2">
                {savedWork.map((post) => (
                  <ContentCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="following">
            {social.followedHobbies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
                <UserRound className="mx-auto mb-3 size-5 text-muted-foreground" />
                <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
                  You're not exploring any hobbies yet. "Keep exploring" attaches
                  you to a hobby — pottery, film photography, sourdough — rather
                  than to a person, and their new work turns up in My Space.
                </p>
                <Link to="/discover" className="mt-4 inline-block">
                  <Button variant="outline" size="sm">Find a hobby</Button>
                </Link>
              </div>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {social.followedHobbies.map((key) => {
                  const isSpace = key.startsWith("space:");
                  // A hobby someone typed themselves, e.g. "interest:bouldering".
                  const isOwn = key.startsWith("interest:");
                  const slug = isSpace ? key.slice(6) : isOwn ? key.slice(9) : key;
                  const label = isOwn
                    ? slug.replace(/\b\w/g, (c) => c.toUpperCase())
                    : isSpace
                      ? getHobby(slug)?.name ?? slug
                      : subHobbyLabel(slug) ?? slug;
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                    >
                      <span className="truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() => social.toggleHobbyFollow(key, label)}
                        className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-[var(--coral-text)]"
                      >
                        Stop exploring
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="circles">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                Circles Joined
              </h2>
              {joinedCircles.length > 0 && (
                <button
                  type="button"
                  className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setCirclesVisible((v) => !v)}
                >
                  {circlesVisible ? "Visible on your work" : "Hidden — only you see this"}
                </button>
              )}
            </div>
            {circlesVisible ? (
              <CirclesJoined />
            ) : (
              <p className="text-sm text-muted-foreground">
                Hidden. Only you can see which Circles you've joined.
              </p>
            )}
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-3">
              <AccountSettings />
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-1 text-sm">Who sees your Circles</div>
                <button
                  type="button"
                  onClick={() => setCirclesVisible((v) => !v)}
                  className="text-xs text-[var(--coral-text)] hover:underline"
                >
                  {circlesVisible
                    ? "Visible on your work — hide them"
                    : "Hidden — show them on your work"}
                </button>
              </div>
              {user && (
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full rounded-2xl border border-border bg-card p-4 text-left text-sm transition-colors hover:border-[var(--coral-deep)]"
                >
                  Log out
                </button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="ns-you-lower-grid">
          {/* Quiet milestones */}
          <div className="mb-9">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              Quiet Milestones
            </h2>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Share these →
            </button>
          </div>
          <QuietMilestones onShare={() => setShareOpen(true)} />
        </div>

          {/* Circles joined — a preview here, the full list under Your Circles */}
          <div className="mb-10">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              Circles Joined
            </h2>
            <Link
              to="/circles"
              className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View all →
            </Link>
          </div>
          <CirclesJoined limit={4} />
          </div>
        </div>

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
