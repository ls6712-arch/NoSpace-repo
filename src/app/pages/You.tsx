import { useState } from "react";
import { Link } from "react-router";
import { BookOpen, Lock, PenLine, Share2, Sprout, Users } from "lucide-react";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { Post } from "../data/posts";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { QuietMilestones } from "../components/QuietMilestones";
import { CirclesJoined } from "../components/CirclesJoined";
import { ClanList } from "../components/ClanList";
import { AvatarPicker } from "../components/AvatarPicker";
import { HandwrittenNote } from "../components/HandwrittenNote";
import { WorkGrid } from "../components/WorkGrid";
import { MomentDetail } from "../components/MomentDetail";
import { ShareProfileDialog } from "../components/ShareProfileDialog";
import { ProfileHeadline } from "../components/ProfileHeadline";
import { useSessionsByHobby } from "../components/HobbyShelf";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { removePrivateLog, useJournal } from "../lib/journal";
import { AccountSettings } from "../components/AccountSettings";
import { useSocial } from "../context/SocialContext";
import { subHobbyLabel, getHobby } from "../data/hobbies";

function timeAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function You() {
  const { myPosts } = useContent();
  const journal = useJournal();
  const social = useSocial();
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const { user, profile, isConfigured, signOut } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [circlesVisible, setCirclesVisible] = useState(true);
  const [openPost, setOpenPost] = useState<Post | null>(null);

  const sessions = useSessionsByHobby();
  const totalSessions = sessions.reduce((n, s) => n + s.sessions, 0);

  // Never abbreviate the placeholder: "You" becomes a meaningless "Y".
  const realName = profile?.display_name?.trim();
  const displayName = realName || "You";

  // Your own profile is the one page that genuinely needs to know who you are.
  // Anyone else's shelf is open at /u/<username>.
  if (isConfigured && !user) {
    return (
      <SignUpPrompt
        title="Your shelf lives here"
        body="Make an account and everything you log builds up on a shelf of your own: hobbies, sessions, milestones. You can keep browsing everything else without one."
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
            <p className="mt-3 max-w-md text-lg leading-relaxed text-muted-foreground">
              Your work, your ideas, your people, your space to keep becoming.
            </p>
          </div>
          <HandwrittenNote className="max-w-[220px]">A more curious you lives here.</HandwrittenNote>
        </div>

        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <AvatarPicker name={displayName} url={avatar ?? profile?.avatar_url} onChange={setAvatar} />
            <div className="min-w-0">
              <h2 className="truncate text-3xl leading-tight sm:text-4xl" style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                {user ? displayName : "You"}
              </h2>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-[var(--coral-deep)]" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21c0-6 3-10 8-12-1 7-4 10-8 12Zm0 0c0-5-2.5-8.5-7-10 1 6 3.5 8.5 7 10Z" />
                  </svg>
                </span>
                <span><strong className="text-foreground">{totalSessions}</strong> lifetime {totalSessions === 1 ? "session" : "sessions"}</span>
              </div>
              <div className="mt-1"><ProfileHeadline variant="quiet" /></div>
            </div>
          </div>
          <div className="hidden shrink-0 rounded-2xl bg-[color-mix(in_srgb,var(--pastel-sage)_28%,var(--surface))] px-5 py-4 text-center sm:block">
            <p className="text-sm italic text-[var(--forest-ink)]" style={{ fontFamily: "var(--font-serif)" }}>
              "Same person, more hobbies."
            </p>
          </div>
        </div>

        {/* Hobby chips — what you actually do */}
        <div className="ns-you-tags mb-7 flex flex-wrap gap-2">
          {sessions.slice(0, 6).map((s) => (
            <Link
              key={s.key}
              to={s.subSlug ? `/space/${s.hobbySlug}?hobby=${s.subSlug}` : `/space/${s.hobbySlug}`}
              className="rounded-full border border-border bg-white/[0.04] px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {s.label}
            </Link>
          ))}
          <Link
            to="/discover"
            title="Find another hobby"
            aria-label="Find another hobby"
            className="flex size-8 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-[var(--coral-text)]"
          >
            +
          </Link>
        </div>

        {isConfigured && !user && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-muted px-4 py-3">
            <p className="text-xs text-muted-foreground">
              You're not logged in. Sessions here are just local to this browser.
            </p>
            <Link to="/login" className="shrink-0">
              <Button variant="outline" size="sm">Log in</Button>
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
            <TabsTrigger value="work">Your Work</TabsTrigger>
            <TabsTrigger value="clan">Your Clan</TabsTrigger>
            <TabsTrigger value="circles">Your Circles</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="work">
            <div className="mb-4 flex items-center gap-2">
              <BookOpen className="size-4 text-[var(--forest)]" strokeWidth={1.7} />
              <p className="text-sm text-muted-foreground">
                A visual record of what you've made, explored, and loved.
              </p>
            </div>
            <WorkGrid
              posts={myPosts}
              onOpen={setOpenPost}
              emptyLabel="Nothing logged yet. Create something and it'll show up here."
            />
          </TabsContent>

          <TabsContent value="clan">
            <p className="mb-4 text-sm text-muted-foreground">People who make the journey more fun.</p>
            <ClanList />
          </TabsContent>

          <TabsContent value="circles">
            <p className="mb-4 text-sm text-muted-foreground">Communities you're part of.</p>
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
                  {circlesVisible ? "Visible on your work (hide them)" : "Hidden (show them on your work)"}
                </button>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  Hobbies you're exploring
                </div>
                {social.followedHobbies.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Not exploring anything yet. Attach yourself to a hobby from any Space.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {social.followedHobbies.map((key) => {
                      const isSpace = key.startsWith("space:");
                      const isOwn = key.startsWith("interest:");
                      const slug = isSpace ? key.slice(6) : isOwn ? key.slice(9) : key;
                      const label = isOwn
                        ? slug.replace(/\b\w/g, (c: string) => c.toUpperCase())
                        : isSpace
                          ? getHobby(slug)?.name ?? slug
                          : subHobbyLabel(slug) ?? slug;
                      return (
                        <li key={key} className="flex items-center justify-between gap-3 text-sm">
                          <span style={{ fontFamily: "var(--font-serif)" }}>{label}</span>
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
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <Lock className="size-4 text-muted-foreground" />
                  Private logs
                </div>
                <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                  Kept here and nowhere else. Private logs never appear in a Space, a feed, or your public shelf.
                </p>
                {journal.privateLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nothing private yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {journal.privateLogs.map((entry) => (
                      <li key={entry.id} className="rounded-xl border border-[var(--hairline)] p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] text-muted-foreground">
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
                        {entry.media && (
                          <div className="mb-2 overflow-hidden rounded-lg border border-[var(--hairline)]">
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

        <div className="mb-9 mt-2">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              <Sprout className="size-4 text-[var(--forest)]" strokeWidth={1.8} />
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
          <p className="mb-3 text-sm text-muted-foreground">Non-metric growth that feels good.</p>
          <QuietMilestones onShare={() => setShareOpen(true)} />
        </div>

        <div className="ns-you-lower-grid grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                <Users className="size-4 text-[var(--forest)]" strokeWidth={1.8} />
                Your Clan
              </h2>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">People who make the journey more fun.</p>
            <ClanList limit={5} />
          </div>

          <div>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                <Users className="size-4 text-[var(--forest)]" strokeWidth={1.8} />
                Your Circles
              </h2>
              <Link to="/circles" className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground">
                View all →
              </Link>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">Communities you're part of.</p>
            <CirclesJoined limit={4} />
          </div>
        </div>
      </div>

      <MomentDetail post={openPost} owned onOpenChange={(o) => !o && setOpenPost(null)} />
      <ShareProfileDialog open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
