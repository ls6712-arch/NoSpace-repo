import { useState } from "react";
import { Link } from "react-router";
import { Lock, PenLine, Settings as SettingsIcon, Share2, Sparkles, Sprout, Users } from "lucide-react";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { Post } from "../data/posts";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { QuietMilestones } from "../components/QuietMilestones";
import { CirclesJoined } from "../components/CirclesJoined";
import { ClanList } from "../components/ClanList";
import { AvatarPicker } from "../components/AvatarPicker";
import { HandwrittenNote } from "../components/HandwrittenNote";
import { WorkGrid } from "../components/WorkGrid";
import { PursuitCard } from "../components/PursuitCard";
import { PursuitDialog } from "../components/PursuitDialog";
import { MomentDetail } from "../components/MomentDetail";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ShareProfileDialog } from "../components/ShareProfileDialog";
import { ProfileHeadline } from "../components/ProfileHeadline";
import { HobbyShelf, useSessionsByHobby } from "../components/HobbyShelf";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { useJournal } from "../lib/journal";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useProfileLinks } from "../lib/profileLinks";
import { mirrorProfileLinks } from "../lib/profileLinksRemote";
import { ProfileLinksEditor } from "../components/ProfileLinks";
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
  const { myPosts, posts } = useContent();
  const journal = useJournal();
  const { logs: privateLogs, remove: removePrivateLog } = usePrivateLogs();
  const [confirmDeleteLogId, setConfirmDeleteLogId] = useState<number | null>(null);
  const social = useSocial();
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const { user, profile, isConfigured, signOut } = useAuth();
  const profileLinks = useProfileLinks();
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [circlesVisible, setCirclesVisible] = useState(true);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [pursuitDialog, setPursuitDialog] = useState(false);

  const sessions = useSessionsByHobby();
  const [momentsView, setMomentsView] = useState<"shelf" | "grid">("grid");
  // The portfolio's own record — every Pursuit you've ever started, finished
  // ones included, because a personal archive doesn't erase what's done.
  const myPursuits = journal.projects;

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
              <div className="mt-1"><ProfileHeadline variant="quiet" /></div>
            </div>
          </div>
          <div className="hidden shrink-0 rounded-2xl bg-[color-mix(in_srgb,var(--pastel-sage)_28%,var(--surface))] px-5 py-4 text-center sm:block">
            <p className="text-sm italic text-foreground" style={{ fontFamily: "var(--font-serif)" }}>
              "Same person, more hobbies."
            </p>
          </div>
        </div>

        {/* Your links — GitHub, a design studio, a Substack, whatever
            people should be able to find and click through to. Public the
            moment it's added, same as the rest of your public profile. */}
        <div className="mb-8 rounded-3xl border border-border bg-card p-5">
          <h2 className="mb-1 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
            Your links
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Point people somewhere — your GitHub, your studio, your Substack.
          </p>
          <ProfileLinksEditor
            links={profileLinks}
            onChange={(next) => {
              if (user) void mirrorProfileLinks(user.id, next);
            }}
          />
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

        <div className="ns-you-actions mb-11 flex gap-2">
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
          <Button variant="outline" size="icon" title="Settings" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="size-4" />
          </Button>
        </div>

        {/* Your Moments and Your Pursuits are the portfolio: what you've
            actually made, and what you're currently bringing to life,
            standing next to each other rather than buried in tabs. */}
        <div className="mb-12 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <section>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                Your Moments
              </h2>
              {/* All moments (plain chronological) is the default now — By
                  Space stays available for anyone who wants the grouped
                  view. "Space" is the app's actual term for this, so the
                  toggle shouldn't say "hobby" anywhere. */}
              <div className="flex gap-1 rounded-full border border-border bg-surface p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMomentsView("grid")}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    momentsView === "grid" ? "bg-[var(--coral-deep)] text-white" : "text-muted-foreground"
                  }`}
                >
                  All moments
                </button>
                <button
                  type="button"
                  onClick={() => setMomentsView("shelf")}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    momentsView === "shelf" ? "bg-[var(--coral-deep)] text-white" : "text-muted-foreground"
                  }`}
                >
                  By Space
                </button>
              </div>
            </div>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">
              {momentsView === "shelf"
                ? "Grouped by Space — open one to see every moment inside it."
                : "A visual record of what you've made, explored, and loved, newest first."}
            </p>
            {momentsView === "shelf" ? (
              <HobbyShelf
                items={sessions}
                emptyCta={false}
                emptyCopy="Nothing logged yet. Create something and it'll show up here."
              />
            ) : (
              <WorkGrid
                posts={myPosts}
                onOpen={setOpenPost}
                emptyLabel="Nothing logged yet. Create something and it'll show up here."
              />
            )}
          </section>

          <section>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                Your Pursuits
              </h2>
              <Button variant="outline" size="sm" onClick={() => setPursuitDialog(true)}>
                <Sparkles className="size-3.5" />
                Create Your Pursuit
              </Button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">The things you're bringing to life.</p>

            {myPursuits.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-9 text-center">
                <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Nothing yet. Name a thing you're working toward and it lives here.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setPursuitDialog(true)}>
                  Create Your Pursuit
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {myPursuits.map((pursuit) => (
                  <PursuitCard
                    key={pursuit.id}
                    pursuit={pursuit}
                    owner
                    className="w-full"
                    inspirationPost={
                      pursuit.inspiredByPostId
                        ? posts.find((p) => p.id === pursuit.inspiredByPostId)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mb-9">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              <Sprout className="size-4 text-foreground" strokeWidth={1.8} />
              Quiet Milestones
            </h2>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Non-metric growth that feels good. Private by default — share one at a time, only if you want to.
          </p>
          <QuietMilestones />
        </div>

        <div className="ns-you-lower-grid grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                <Users className="size-4 text-foreground" strokeWidth={1.8} />
                Your Clan
              </h2>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">People who make the journey more fun.</p>
            <ClanList limit={5} />
          </div>

          <div>
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                <Users className="size-4 text-foreground" strokeWidth={1.8} />
                Your Circles
              </h2>
              <Link to="/circles" className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground">
                View all →
              </Link>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">Communities you're part of.</p>
            {circlesVisible ? (
              <CirclesJoined limit={4} />
            ) : (
              <p className="text-sm text-muted-foreground">Hidden. Only you can see which Circles you've joined.</p>
            )}
          </div>
        </div>
      </div>

      <MomentDetail post={openPost} owned onOpenChange={(o) => !o && setOpenPost(null)} />
      <ShareProfileDialog open={shareOpen} onOpenChange={setShareOpen} />
      <PursuitDialog open={pursuitDialog} onOpenChange={setPursuitDialog} />
      <ConfirmDialog
        open={confirmDeleteLogId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteLogId(null)}
        title="Delete this private log?"
        description="This can't be undone — nobody else ever saw it, and once it's gone there's no copy left anywhere."
        onConfirm={async () => {
          if (confirmDeleteLogId !== null) await removePrivateLog(confirmDeleteLogId);
          setConfirmDeleteLogId(null);
        }}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Settings</DialogTitle>
          </DialogHeader>
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
              {privateLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nothing private yet.</p>
              ) : (
                <ul className="space-y-3">
                  {privateLogs.map((entry) => (
                    <li key={entry.id} className="rounded-xl border border-[var(--hairline)] p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground">
                          Only you · {timeAgo(entry.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteLogId(entry.id)}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
