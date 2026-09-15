import { useEffect, useState } from "react";
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
import { WorkGrid } from "../components/WorkGrid";
import { PursuitCompactCard, NewPursuitTile, PursuitExpandedPanel } from "../components/PursuitCompact";
import { PursuitDialog } from "../components/PursuitDialog";
import { MomentDetail } from "../components/MomentDetail";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ShareProfileDialog } from "../components/ShareProfileDialog";
import { ProfileHeadline } from "../components/ProfileHeadline";
import { ProfileOnboarding } from "../components/ProfileOnboarding";
import { HobbyShelf, useSessionsByHobby } from "../components/HobbyShelf";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { useJournal, useJournalSlice } from "../lib/journal";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useProfileLinks } from "../lib/profileLinks";
import { mirrorProfileLinks } from "../lib/profileLinksRemote";
import { ProfileLinksEditor } from "../components/ProfileLinks";
import { AccountSettings } from "../components/AccountSettings";
import { useSocial } from "../context/SocialContext";
import { localOnboardingDone } from "../lib/onboardingLocal";
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
  // Only one Pursuit expanded at a time. renderedPursuitId lags behind on
  // collapse (it only ever updates to a new id, never clears to null) so the
  // panel's content stays put while it animates shut instead of vanishing
  // out from under the closing transition.
  const [expandedPursuitId, setExpandedPursuitId] = useState<string | null>(null);
  const [renderedPursuitId, setRenderedPursuitId] = useState<string | null>(null);
  const entryProject = useJournalSlice((s) => s.entryProject);
  // Whether to show the first-run guided setup, decided once and then left
  // alone — null means "not decided yet". Deciding it live off the current
  // profile/social state (rather than freezing it) was a real bug: adding
  // your first interest on step 2 made "no interests yet" false mid-flow,
  // which kicked the onboarding view out from under itself back to the
  // normal page before the remaining steps ever ran.
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  const sessions = useSessionsByHobby();
  const [momentsView, setMomentsView] = useState<"shelf" | "grid">("grid");
  // The portfolio's own record — every Pursuit you've ever started, finished
  // ones included, because a personal archive doesn't erase what's done.
  const myPursuits = journal.projects;
  // Every Moment you've ever logged, lifetime — the profile card's own
  // one-line stat, distinct from ProfileHeadline's "N months into X" line.
  const totalSessions = myPosts.length;

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

  // First-run guided setup: only for a signed-in, genuinely-empty profile
  // that hasn't been through onboarding before. onboarding_completed_at is
  // authoritative once set — checked first, so this never comes back just
  // because someone later cleared their name or unfollowed every interest.
  // localOnboardingDone() covers the same "never again" promise when
  // there's no account to hang that flag off (Supabase not configured) or
  // the save on finishing failed to reach it.
  //
  // Decided once profile has actually loaded (isConfigured but profile is
  // still null right after sign-in), not on every render — profile starts
  // out null for everyone, existing accounts included, so judging "empty"
  // against that transient null would flash onboarding at every sign-in
  // until the real row arrives.
  useEffect(() => {
    if (needsOnboarding !== null || !user) return;
    if (isConfigured && !profile) return;
    setNeedsOnboarding(
      !profile?.onboarding_completed_at &&
        !localOnboardingDone() &&
        !profile?.display_name?.trim() &&
        !profile?.avatar_url &&
        social.followedHobbies.length === 0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, isConfigured]);

  if (needsOnboarding) {
    return <ProfileOnboarding onDone={() => setNeedsOnboarding(false)} />;
  }

  return (
    <div className="min-h-screen bg-background py-8 sm:py-12">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          YOUR PERSONAL ARCHIVE
        </div>

        <div className="ns-you-profile-card ns-you-profile-card--compact mb-6">
          <div className="ns-you-profile-top">
            <div className="ns-you-profile-identity">
              <AvatarPicker
                compact
                name={displayName}
                url={avatar ?? profile?.avatar_url}
                onChange={setAvatar}
              />
              <div className="min-w-0">
                <h2
                  className="truncate text-xl leading-tight sm:text-2xl"
                  style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
                >
                  {user ? displayName : "You"}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground sm:text-sm">
                  <span className="ns-you-sprout" aria-hidden="true">✦</span>
                  <span>
                    <strong className="text-foreground">{totalSessions}</strong> lifetime{" "}
                    {totalSessions === 1 ? "session" : "sessions"}
                  </span>
                  <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                  <ProfileHeadline variant="quiet" />
                </div>
              </div>
            </div>

            <Button variant="coral" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="size-3.5" />
              Share
            </Button>
          </div>

          {/* One link, inline — no separate panel, no repeated helper copy.
              Already-added links show as small removable chips above it. */}
          <ProfileLinksEditor
            compact
            links={profileLinks}
            onChange={(next) => {
              if (user) void mirrorProfileLinks(user.id, next);
            }}
          />
        </div>

        {/* Hobby chips float under the card now, not boxed in one of their own */}
        {sessions.length > 0 && (
          <div className="ns-you-tags ns-you-tags--pills mb-7 flex flex-wrap gap-2">
            {sessions.slice(0, 6).map((s) => (
              <Link
                key={s.key}
                to={s.subSlug ? `/space/${s.hobbySlug}?hobby=${s.subSlug}` : `/space/${s.hobbySlug}`}
                className="ns-pill"
              >
                {s.label}
              </Link>
            ))}
            <Link to="/discover" className="ns-pill ns-pill--ghost">
              + Add interest
            </Link>
          </div>
        )}

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

        {/* Share now lives on the profile card itself, up top — no need to
            repeat it here too. */}
        <div className="ns-you-actions mb-11 flex gap-2">
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

        {/* Five sections, stacked full-width with generous space between
            them rather than paired side by side — separation comes from
            whitespace and a hairline rule, not from boxing each one in.
            Order: Moments, Pursuits, Quiet Milestones, Circles, Clan. */}
        <section className="mb-14">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg sm:text-xl" style={{ fontFamily: "var(--font-serif)" }}>
              Your Moments
            </h2>
            {/* All moments (plain chronological) is the default now — By
                Corner stays available for anyone who wants the grouped
                view. HobbyShelf.tsx no longer renders Space-level section
                headers at all — it's one flat grid of Corners, sorted by
                whichever was most recently updated — so "By Corner" is
                what actually describes it now. (An earlier pass called
                this "By space" when the view still had Space headers with
                Corners stacked inside each one; that structure is gone,
                so that label would now be the wrong one.) */}
            <div className="flex gap-1 rounded-full border border-border p-0.5 text-xs">
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
                By Corner
              </button>
            </div>
          </div>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">
            {momentsView === "shelf"
              ? "By Corner, most recently updated first — open one to see every moment inside it."
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

        <section className="mb-14 border-t border-border pt-10">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg sm:text-xl" style={{ fontFamily: "var(--font-serif)" }}>
              Your Pursuits
            </h2>
            <Button variant="outline" size="sm" onClick={() => setPursuitDialog(true)}>
              <Sparkles className="size-3.5" />
              Create Your Pursuit
            </Button>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">The things you're bringing to life.</p>

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
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {myPursuits.map((pursuit) => (
                  <PursuitCompactCard
                    key={pursuit.id}
                    pursuit={pursuit}
                    entryProject={entryProject}
                    posts={posts}
                    expanded={expandedPursuitId === pursuit.id}
                    onToggle={() => {
                      setExpandedPursuitId((cur) => {
                        const next = cur === pursuit.id ? null : pursuit.id;
                        if (next) setRenderedPursuitId(next);
                        return next;
                      });
                    }}
                  />
                ))}
                <NewPursuitTile onClick={() => setPursuitDialog(true)} />
              </div>

              {/* grid-template-rows 0fr->1fr is what lets this collapse to
                  a true zero height (a max-height guess would either clip a
                  tall panel or leave dead space on a short one). */}
              <div
                style={{
                  display: "grid",
                  gridTemplateRows: expandedPursuitId ? "1fr" : "0fr",
                  transition: "grid-template-rows 280ms ease",
                }}
              >
                <div style={{ overflow: "hidden" }}>
                  <div style={{ opacity: expandedPursuitId ? 1 : 0, transition: "opacity 200ms ease" }}>
                    {(() => {
                      const renderedPursuit = myPursuits.find((p) => p.id === renderedPursuitId);
                      return (
                        renderedPursuit && (
                          <PursuitExpandedPanel
                            pursuit={renderedPursuit}
                            entryProject={entryProject}
                            posts={posts}
                            onOpenPost={setOpenPost}
                          />
                        )
                      );
                    })()}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="mb-14 border-t border-border pt-10">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg sm:text-xl" style={{ fontFamily: "var(--font-serif)" }}>
              <Sprout className="size-4 text-foreground" strokeWidth={1.8} />
              Quiet Milestones
            </h2>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            Non-metric growth that feels good. Private by default — share one at a time, only if you want to.
          </p>
          <QuietMilestones />
        </section>

        <section className="mb-14 border-t border-border pt-10">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg sm:text-xl" style={{ fontFamily: "var(--font-serif)" }}>
              <Users className="size-4 text-foreground" strokeWidth={1.8} />
              Your Circles
            </h2>
            <Link to="/circles" className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground">
              View all →
            </Link>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">Communities you're part of.</p>
          {circlesVisible ? (
            <CirclesJoined limit={4} />
          ) : (
            <p className="text-sm text-muted-foreground">Hidden. Only you can see which Circles you've joined.</p>
          )}
        </section>

        <section className="border-t border-border pt-10">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="flex items-center gap-2 text-lg sm:text-xl" style={{ fontFamily: "var(--font-serif)" }}>
              <Users className="size-4 text-foreground" strokeWidth={1.8} />
              Your Clan
            </h2>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">People who make the journey more fun.</p>
          <ClanList limit={5} />
        </section>
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
