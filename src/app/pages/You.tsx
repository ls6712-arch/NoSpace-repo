import { useMemo, useState } from "react";
import { Link } from "react-router";
import * as Icons from "lucide-react";
import { Settings as SettingsIcon, Sparkles, Sprout, Users } from "lucide-react";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useSettings } from "../context/SettingsContext";
import { useRewards } from "../context/RewardsContext";
import { badges, badgeName } from "../data/badges";
import { Post } from "../data/posts";
import { Button } from "../components/ui/button";
import { QuietMilestones } from "../components/QuietMilestones";
import { CirclesJoined } from "../components/CirclesJoined";
import { AvatarPicker } from "../components/AvatarPicker";
import { WorkGrid } from "../components/WorkGrid";
import { PursuitCompactCard, NewPursuitTile, PursuitExpandedPanel } from "../components/PursuitCompact";
import { PursuitDialog } from "../components/PursuitDialog";
import { MomentDetail } from "../components/MomentDetail";
import { ShareProfileDialog } from "../components/ShareProfileDialog";
import { FollowListDialog } from "../components/FollowListDialog";
import { HobbyShelf, useSessionsByHobby } from "../components/HobbyShelf";
import { usePrimaryHobbyKey } from "../components/usePrimaryHobbyKey";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { useJournal, useJournalSlice } from "../lib/journal";
import { useProfileLinks } from "../lib/profileLinks";
import { mirrorProfileLinks } from "../lib/profileLinksRemote";
import { ProfileLinksEditor } from "../components/ProfileLinks";
import { tagsFromPosts } from "../lib/postTags";
import { useFollowerCount } from "../lib/useFollowerCount";

export function You() {
  const { myPosts, posts } = useContent();
  const journal = useJournal();
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const { user, profile, isConfigured } = useAuth();
  const { logs: privateLogEntries } = usePrivateLogs();
  // A private log's caption grid was missing entirely from this page — this
  // folds each entry in as a Post-shaped stand-in (negative id so it can
  // never collide with a real post's), so the same WorkGrid/MomentDetail
  // machinery that already handles real Moments handles these too, instead
  // of building a second, parallel grid just for private logs.
  const privateLogsAsPosts: Post[] = privateLogEntries.map((log) => ({
    id: -log.id,
    privateLogId: log.id,
    isPrivateLog: true,
    userId: user?.id ?? "you",
    hobbySlug: log.hobbySlug ?? "",
    type: log.media ? (log.mediaType === "video" ? "video" : "photo") : "written",
    media: log.media ?? "",
    creator: "You",
    caption: log.note,
    likes: 0,
    createdAt: log.createdAt,
    // Post["visibility"] doesn't have a literal "private" value yet — see
    // lib/visibility.ts's isOnlyYou(), which is deliberately typed structurally
    // (not Post["visibility"]) for exactly this reason. Cast here rather than
    // widen Visibility itself, which is out of scope for this change.
    visibility: "private" as Post["visibility"],
  }));
  const myPostsAndPrivate = [...myPosts, ...privateLogsAsPosts].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  const { circlesVisible } = useSettings();
  const profileLinks = useProfileLinks();
  const [shareOpen, setShareOpen] = useState(false);
  const [followListOpen, setFollowListOpen] = useState(false);
  const [followListTab, setFollowListTab] = useState<"followers" | "following">("followers");
  const { unlockedBadgeIds } = useRewards();
  const { slug: primaryHobbySlug, label: primaryHobbyLabel } = usePrimaryHobbyKey();
  const unlockedBadges = badges.filter((b) => unlockedBadgeIds.includes(b.id));
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [pursuitDialog, setPursuitDialog] = useState(false);
  // Only one Pursuit expanded at a time. renderedPursuitId lags behind on
  // collapse (it only ever updates to a new id, never clears to null) so the
  // panel's content stays put while it animates shut instead of vanishing
  // out from under the closing transition.
  const [expandedPursuitId, setExpandedPursuitId] = useState<string | null>(null);
  const [renderedPursuitId, setRenderedPursuitId] = useState<string | null>(null);
  const entryProject = useJournalSlice((s) => s.entryProject);

  const sessions = useSessionsByHobby();
  const myTags = useMemo(() => tagsFromPosts(myPosts), [myPosts]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [momentsView, setMomentsView] = useState<"shelf" | "grid">("grid");
  // The portfolio's own record — every Pursuit you've ever started, finished
  // ones included, because a personal archive doesn't erase what's done.
  const myPursuits = journal.projects;
  // Every Moment you've ever logged, lifetime — the profile card's own
  // one-line stat.
  const totalSessions = myPosts.length;
  const earliestPostAt = myPosts.length
    ? Math.min(...myPosts.map((p) => p.createdAt))
    : null;
  const sinceLabel = earliestPostAt
    ? new Date(earliestPostAt).toLocaleDateString(undefined, {
        month: "long",
        year: new Date(earliestPostAt).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
      })
    : null;
  const followerCount = useFollowerCount(user?.id);

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
    <div className="ns-paper-theme min-h-screen bg-background py-8 sm:py-12">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          YOUR PERSONAL ARCHIVE
        </div>

        <div className="mb-6 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <AvatarPicker
                compact
                name={displayName}
                url={avatar ?? profile?.avatar_url}
                onChange={setAvatar}
              />
              <div className="min-w-0">
                <h2
                  className="truncate text-2xl leading-tight sm:text-4xl"
                  style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
                >
                  {user ? displayName : "You"}
                </h2>
                {user && (
                  profile?.bio?.trim() ? (
                    <p
                      className="mt-1 text-base leading-relaxed text-muted-foreground sm:text-lg"
                      style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
                    >
                      {profile.bio}
                    </p>
                  ) : (
                    <Link
                      to="/profile"
                      className="mt-1 inline-block rounded-lg border border-dashed border-[var(--hairline)] px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
                    >
                      Tell your story: what got you into this, and where it's going.
                    </Link>
                  )
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground sm:text-sm">
                  <span>
                    <strong className="text-foreground">{totalSessions}</strong>{" "}
                    {totalSessions === 1 ? "moment" : "moments"} logged
                    {sinceLabel ? ` since ${sinceLabel}` : ""}
                  </span>
                  {followerCount !== null && followerCount > 0 && (
                    <>
                      <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFollowListTab("followers");
                          setFollowListOpen(true);
                        }}
                        className="transition-colors hover:text-foreground hover:underline"
                      >
                        <strong className="text-foreground">{followerCount}</strong>{" "}
                        {followerCount === 1 ? "follower" : "followers"}
                      </button>
                    </>
                  )}
                  {followerCount === 0 && (
                    <>
                      <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                      <span>No one's following yet</span>
                    </>
                  )}
                  {/* No count shown here — "who you follow" isn't a number
                      worth advertising the way follower count is, it's just
                      a place to get to the list. */}
                  {user && (
                    <>
                      <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFollowListTab("following");
                          setFollowListOpen(true);
                        }}
                        className="transition-colors hover:text-foreground hover:underline"
                      >
                        Following
                      </button>
                    </>
                  )}
                </div>

                {/* Earned milestones only — a locked badge has nothing to
                    say here yet. Real data straight off the rewards ledger,
                    same source ShareProfileDialog already reads. */}
                {unlockedBadges.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {unlockedBadges.map((b) => {
                      const Icon = (Icons as any)[b.icon] ?? Icons.Sparkles;
                      return (
                        <span
                          key={b.id}
                          title={b.description}
                          className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                        >
                          <Icon className="size-3.5 text-[var(--coral-deep)]" strokeWidth={1.8} aria-hidden="true" />
                          {badgeName(b, primaryHobbySlug, primaryHobbyLabel)}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <div className="flex items-center gap-2">
                <Link
                  to="/create"
                  className="text-xs font-medium uppercase tracking-[0.08em] text-foreground transition-colors hover:text-[var(--coral-text)]"
                >
                  Add a moment
                </Link>
                <Link to="/settings" title="Settings" aria-label="Settings">
                  <SettingsIcon className="size-3.5 text-muted-foreground transition-colors hover:text-foreground" />
                </Link>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="text-xs uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Share
                </button>
                <span className="text-muted-foreground/50" aria-hidden="true">·</span>
                <Link
                  to="/studio"
                  className="text-xs uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Public archive ↗
                </Link>
              </div>
            </div>
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

        {/* Open tags now, not the fixed 15-Space list — tap one to narrow
            Every moment below to just that tag, tap it again to clear. */}
        {myTags.length > 0 && (
          <div
            className="mb-5 flex flex-wrap items-center gap-2 text-base"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {myTags.slice(0, 6).map(({ tag }, i) => (
              <span key={tag} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-muted-foreground/50" aria-hidden="true">
                    ·
                  </span>
                )}
                <button
                  type="button"
                  aria-pressed={tagFilter === tag}
                  onClick={() => setTagFilter((current) => (current === tag ? null : tag))}
                  className={`transition-colors ${
                    tagFilter === tag
                      ? "text-[var(--coral-text)]"
                      : "text-foreground hover:text-[var(--coral-text)]"
                  }`}
                >
                  {tag}
                </button>
              </span>
            ))}
            <Link
              to="/create"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Add a tag"
              title="Add a tag"
            >
              +
            </Link>
          </div>
        )}

        <div className="mb-7 border-t border-[var(--hairline)]" />

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

        {/* Four sections, stacked full-width. "Every moment" is the major
            section here — it's what the Shelf is actually for — so it gets
            the biggest type and the most air around it. Pursuits, Quiet
            Milestones, and Circles are minor sections: smaller headers,
            tighter rules, less padding, so the page reads as one important
            thing plus three supporting ones rather than five equal blocks.
            Order: Moments, Pursuits, Quiet Milestones, Circles. */}
        <section className="mb-16">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}>
              Every moment
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
          <p className="mb-5 mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {momentsView === "shelf"
              ? "By Corner, most recently updated first — open one to see every moment inside it."
              : tagFilter
                ? `Tagged “${tagFilter}.”`
                : "A visual record of what you've made, explored, and loved, newest first."}
            {momentsView === "grid" && tagFilter && (
              <button
                type="button"
                onClick={() => setTagFilter(null)}
                className="text-xs text-[var(--coral-text)] hover:underline"
              >
                Show everything
              </button>
            )}
          </p>
          {momentsView === "shelf" ? (
            <HobbyShelf
              items={sessions}
              emptyCta={false}
              emptyCopy="Nothing logged yet. Create something and it'll show up here."
            />
          ) : (
            <WorkGrid
              posts={
                tagFilter
                  ? myPostsAndPrivate.filter((p) =>
                      (p.tags ?? []).some((t) => t.toLowerCase() === tagFilter.toLowerCase()),
                    )
                  : myPostsAndPrivate
              }
              onOpen={setOpenPost}
              editable
              emptyLabel="Nothing logged yet. Create something and it'll show up here."
            />
          )}
        </section>

        <section className="mb-10 border-t border-[var(--line,var(--border))] pt-7">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg" style={{ fontFamily: "var(--font-serif)" }}>
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

        <section className="mb-10 border-t border-[var(--line,var(--border))] pt-7">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="flex items-center gap-2 text-base sm:text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              <Sprout className="size-4 text-foreground" strokeWidth={1.8} />
              Quiet Milestones
            </h2>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            Non-metric growth that feels good. Private by default — share one at a time, only if you want to.
          </p>
          <QuietMilestones />
        </section>

        <section className="border-t border-[var(--line,var(--border))] pt-7">
          <div className="mb-1 flex items-baseline justify-between gap-4">
            <h2 className="flex items-center gap-2 text-base sm:text-lg" style={{ fontFamily: "var(--font-serif)" }}>
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
      </div>

      <MomentDetail post={openPost} owned onOpenChange={(o) => !o && setOpenPost(null)} />
      <ShareProfileDialog open={shareOpen} onOpenChange={setShareOpen} />
      {user && (
        <FollowListDialog
          open={followListOpen}
          onOpenChange={setFollowListOpen}
          profileId={user.id}
          initialTab={followListTab}
        />
      )}
      <PursuitDialog open={pursuitDialog} onOpenChange={setPursuitDialog} />
    </div>
  );
}
