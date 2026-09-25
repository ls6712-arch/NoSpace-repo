import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowRight, MessageCircle, Plus, Share2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { Post } from "../data/posts";
import { subHobbyLabel, currentSpaceSlug, getHobby } from "../data/hobbies";
import { circlesByHobby } from "../data/circles";
import { usePeopleInHobby } from "../lib/people";
import { sessionsFromPosts } from "../components/HobbyShelf";
import { tagsFromPosts } from "../lib/postTags";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { WorkGrid } from "../components/WorkGrid";
import { PursuitCard } from "../components/PursuitCard";
import { QuietMilestones, SharedMilestones } from "../components/QuietMilestones";
import { GeneratedArt } from "../components/GeneratedArt";
import { MomentDetail } from "../components/MomentDetail";
import { milestoneText, pickPrimaryHobby } from "../components/ProfileHeadline";
import { fetchSharedPursuits, SharedPursuit } from "../lib/pursuitsRemote";
import { fetchProfileLinks } from "../lib/profileLinksRemote";
import { fetchSharedMilestoneIds } from "../lib/milestonesRemote";
import { ProfileLink } from "../lib/profileLinks";
import { ProfileLinksRow } from "../components/ProfileLinks";
import { useFollowerCount } from "../lib/useFollowerCount";
import { fetchFollowStatus, follow, unfollow, type FollowStatus } from "../lib/profileFollows";
import { FollowListDialog } from "../components/FollowListDialog";
import { PersonActionsMenu } from "../components/PersonActionsMenu";

/** Whichever Space shows up most in their posts — used to pick a Circles
 * suggestion and the closing banner's illustration, not to claim membership
 * in anything we can't actually see. */
function primaryHobbySlug(posts: Post[]): string | undefined {
  if (posts.length === 0) return undefined;
  const counts = new Map<string, number>();
  for (const p of posts) counts.set(p.hobbySlug, (counts.get(p.hobbySlug) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Somebody's shelf, open to anyone with the link — no account needed to look.
 * This is what "Share profile" actually shares.
 *
 * Deliberately shows only what's public: their name, what they've made, and
 * how long they've been at it. Private reflections never leave the owner's own
 * view, and neither do their circles or connections — this app has no way to
 * read either from anyone but the account they belong to, so the Circles and
 * People shown here are honestly labelled as built around their craft, not
 * claimed as their actual memberships or connections.
 *
 * Quiet Milestones are private by default: this page shows none of them
 * unless the owner explicitly shared one or more from their own shelf, and
 * even then, only the specific ones they shared — never the full set, and
 * never whether any locked ones exist. Sharing is read from
 * sql/milestones.sql, the one place that fact can be seen from outside the
 * owner's own browser; the owner's own visit to their own public link (isMe)
 * still gets the full owner view instead, locked milestones included.
 */
export function PublicProfile() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const social = useSocial();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "missing" }
    | {
        status: "ready";
        personId: string;
        displayName: string;
        avatarUrl?: string;
        tagline?: string;
        bio?: string;
        posts: Post[];
      }
  >({ status: "loading" });
  // Opening a piece is how you react to it or leave a thought. Declared up
  // here with the other hooks — anything after the early returns below would
  // run conditionally, which React forbids.
  const [openPost, setOpenPost] = useState<Post | null>(null);
  // Only what this person explicitly marked shared — never their private
  // Pursuits, which this query can't even see (sql/pursuits.sql's row
  // security only returns shared=true rows to anyone but the owner).
  const [sharedPursuits, setSharedPursuits] = useState<SharedPursuit[]>([]);
  const [profileLinks, setProfileLinks] = useState<ProfileLink[]>([]);
  // Only the specific milestones this person chose to share — never their
  // locked ones, and never anything inferred from their public post count.
  const [sharedMilestoneIds, setSharedMilestoneIds] = useState<string[]>([]);
  // Real, accept-based person-follows-person state (sql/profile-follows.sql)
  // — a follow only counts once the followed person accepts it.
  const [followStatus, setFollowStatus] = useState<FollowStatus>("none");
  const [followBusy, setFollowBusy] = useState(false);
  const [followRefreshKey, setFollowRefreshKey] = useState(0);
  const [followListOpen, setFollowListOpen] = useState(false);
  const followerCount = useFollowerCount(
    state.status === "ready" ? state.personId : undefined,
    followRefreshKey,
  );

  useEffect(() => {
    // React Router reuses this component instance across two profiles under
    // the same /u/:username route — without resetting here, navigating from
    // one person's shelf to another kept showing the first person's name,
    // avatar, moments, Pursuits and links (and any open moment dialog) under
    // the new URL until the new fetch happened to resolve.
    setState({ status: "loading" });
    setSharedPursuits([]);
    setProfileLinks([]);
    setSharedMilestoneIds([]);
    setOpenPost(null);

    let cancelled = false;

    // A profile that can't be reached shows "no shelf here" rather than
    // spinning indefinitely on a slow or offline connection.
    const timer = setTimeout(() => {
      if (!cancelled) setState((s) => (s.status === "loading" ? { status: "missing" } : s));
    }, 10000);

    (async () => {
      if (!supabase) return setState({ status: "missing" });

      // The URL segment is a username where someone has one, and a user id
      // where the link came from a post card. Both resolve to the same person.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        username,
      );

      type Row = {
        id: string;
        username: string | null;
        display_name: string;
        avatar_url: string | null;
        tagline: string | null;
        bio: string | null;
      };
      let profileRow: Row | null = null;

      if (isUuid) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, tagline, bio")
          .eq("id", username)
          .maybeSingle();
        profileRow = (data as Row | null) ?? null;
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, tagline, bio")
          .eq("username", username)
          .maybeSingle();
        profileRow = (data as Row | null) ?? null;

        // Someone shared a link before usernames existed, or typed a name.
        if (!profileRow) {
          const { data: byName } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, tagline, bio")
            .ilike("display_name", username)
            .limit(1);
          profileRow = (byName?.[0] as Row | undefined) ?? null;
        }
      }

      if (cancelled) return;
      if (!profileRow) return setState({ status: "missing" });

      // Explicit columns, never "*" — a Reflection (public.post_reflections,
      // sql/post-reflections.sql) is owner-only and this page is always a
      // non-owner's read of someone else's Shelf; a wildcard select would
      // put it on the wire even though the mapper below never reads it.
      const { data: rows } = await supabase
        .from("posts")
        .select(
          "id, hobby_slug, sub_hobby, type, media_url, caption, likes, created_at, user_id, tags, pinned",
        )
        .eq("user_id", profileRow.id)
        .eq("visibility", "public")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      const posts: Post[] = (rows ?? []).map((row: any) => ({
        id: row.id,
        hobbySlug: currentSpaceSlug(row.hobby_slug),
        subHobby: row.sub_hobby ?? undefined,
        type: row.type,
        media: row.media_url,
        creator: profileRow.display_name,
        caption: row.caption,
        likes: row.likes ?? 0,
        createdAt: new Date(row.created_at).getTime(),
        visibility: "public",
        userId: row.user_id,
        tags: row.tags ?? [],
        pinned: row.pinned ?? false,
      }));

      setState({
        status: "ready",
        personId: profileRow.id,
        displayName: profileRow.display_name,
        avatarUrl: profileRow.avatar_url ?? undefined,
        tagline: profileRow.tagline ?? undefined,
        bio: profileRow.bio ?? undefined,
        posts,
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  useEffect(() => {
    if (state.status !== "ready") return;
    let cancelled = false;
    fetchSharedPursuits(state.personId).then((rows) => {
      if (!cancelled) setSharedPursuits(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [state.status === "ready" ? state.personId : null]);

  useEffect(() => {
    if (state.status !== "ready") return;
    let cancelled = false;
    fetchProfileLinks(state.personId).then((rows) => {
      if (!cancelled) setProfileLinks(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [state.status === "ready" ? state.personId : null]);

  useEffect(() => {
    if (state.status !== "ready") return;
    let cancelled = false;
    fetchSharedMilestoneIds(state.personId).then((ids) => {
      if (!cancelled) setSharedMilestoneIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [state.status === "ready" ? state.personId : null]);

  useEffect(() => {
    if (state.status !== "ready" || !user || user.id === state.personId) {
      setFollowStatus("none");
      return;
    }
    let cancelled = false;
    fetchFollowStatus(user.id, state.personId).then((status) => {
      if (!cancelled) setFollowStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [state.status === "ready" ? state.personId : null, user?.id]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <span className="size-8 animate-spin rounded-full border-2 border-border border-t-white/70" />
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <h2 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            No shelf here
          </h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Nobody by that name. The link may be out of date.
          </p>
          <Link to="/discover">
            <Button variant="outline">Explore hobbies instead</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { personId, displayName, avatarUrl, tagline, bio, posts } = state;
  const isMe = !!user && user.id === personId;
  const firstName = displayName.split(" ")[0];
  const sessions = sessionsFromPosts(posts);
  const tags = tagsFromPosts(posts);

  // Focusing a tag narrows THEIR work on THEIR page. It used to navigate to
  // the global Space, which showed the viewer their own empty version.
  const focusTag = searchParams.get("tag");
  const setFocus = (tag: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (tag) next.set("tag", tag);
    else next.delete("tag");
    setSearchParams(next, { replace: true });
  };
  // A shared link carries ?moment=<id>; open it once the posts have loaded.
  const momentParam = searchParams.get("moment");
  const shownPosts = focusTag
    ? posts.filter((p) => (p.tags ?? []).some((t) => t.toLowerCase() === focusTag.toLowerCase()))
    : posts;
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const top = sessions[0];
  const primary = top?.subSlug
    ? { slug: top.subSlug, label: subHobbyLabel(top.subSlug) ?? top.label }
    : { label: top?.label };

  const primaryHobby = pickPrimaryHobby(posts);
  const hobbySlug = primaryHobbySlug(posts);
  const hobby = hobbySlug ? getHobby(hobbySlug) : undefined;
  const relatedCircles = hobbySlug ? circlesByHobby(hobbySlug).slice(0, 4) : [];

  const earliestPostAt = posts.length ? Math.min(...posts.map((p) => p.createdAt)) : null;
  const sinceLabel = earliestPostAt
    ? new Date(earliestPostAt).toLocaleDateString(undefined, {
        month: "long",
        year: new Date(earliestPostAt).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
      })
    : null;

  return (
    <div className="ns-paper-theme ns-public-profile min-h-screen bg-surface py-8 sm:py-10">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-8 flex items-start gap-5 sm:gap-6">
          <Avatar className="size-20 shrink-0 sm:size-28">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="object-cover" />}
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
            <div className="min-w-0">
              <h1
                className="truncate text-4xl leading-tight sm:text-5xl"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
              >
                {displayName}
              </h1>
              {bio && (
                <p
                  className="mt-1.5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
                  style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}
                >
                  {bio}
                </p>
              )}
              {tagline && (
                <p
                  className="mt-1 max-w-md text-base italic text-muted-foreground sm:text-lg"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {tagline}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground sm:text-sm">
                <span>
                  <strong className="text-foreground">{posts.length}</strong>{" "}
                  {posts.length === 1 ? "moment" : "moments"} logged
                  {sinceLabel ? ` since ${sinceLabel}` : ""}
                </span>
                {followerCount !== null && followerCount > 0 && (
                  <>
                    <span className="text-muted-foreground/60" aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setFollowListOpen(true)}
                      className="transition-colors hover:text-foreground hover:underline"
                    >
                      <strong className="text-foreground">{followerCount}</strong>{" "}
                      {followerCount === 1 ? "follower" : "followers"}
                    </button>
                  </>
                )}
              </div>
              {primaryHobby && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {milestoneText(primaryHobby.label, primaryHobby.firstActivityAt)} · Keep going.
                </p>
              )}
              {profileLinks.length > 0 && <ProfileLinksRow links={profileLinks} className="mt-3" />}
              <div className="mt-4 flex flex-wrap gap-2">
                {/* Accept-based: a request sent isn't a follower yet, and
                    only counts toward the number above once accepted — see
                    sql/profile-follows.sql. Doesn't show on your own shelf. */}
                {!isMe && user && (
                  <Button
                    variant={followStatus === "none" || followStatus === "declined" ? "brand" : "outline"}
                    disabled={followBusy}
                    onClick={async () => {
                      setFollowBusy(true);
                      const requesting = followStatus === "none" || followStatus === "declined";
                      const ok = requesting
                        ? await follow(user.id, personId)
                        : await unfollow(user.id, personId);
                      if (ok) {
                        setFollowStatus(requesting ? "pending" : "none");
                        setFollowRefreshKey((k) => k + 1);
                      }
                      setFollowBusy(false);
                    }}
                  >
                    {followStatus === "accepted"
                      ? "Following"
                      : followStatus === "pending"
                        ? "Requested"
                        : "Follow"}
                  </Button>
                )}
                {/* No request, no acceptance needed to open the conversation
                    — but no participation row is created here either. If a
                    thread already exists (of any kind), jump straight into
                    it; otherwise this opens an empty draft in Messages, and
                    the row (with its first message) is only created on
                    Send — see SocialContext.tsx's startAndSendDirectMessage(). */}
                {!isMe && user && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const existing = social.findExistingThread(personId);
                      if (existing) {
                        navigate(`/messages?thread=${existing.id}`);
                        return;
                      }
                      navigate(
                        `/messages?draftWith=${encodeURIComponent(personId)}&draftName=${encodeURIComponent(displayName)}`,
                      );
                    }}
                  >
                    <MessageCircle className="size-3.5" />
                    Message
                  </Button>
                )}
                <CopyLinkButton />
                {!isMe && user && <PersonActionsMenu personId={personId} personName={displayName} onBlocked={() => navigate("/discover")} />}
              </div>
              <Link
                to={`/u/${username}/studio`}
                className="mt-2 inline-block text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Open Studio →
              </Link>
            </div>
        </div>

        {tags.length > 0 && (
          <div className="ns-you-tags ns-you-tags--pills mb-8 flex flex-wrap gap-2">
            {tags.slice(0, 6).map(({ tag }) => {
              const on = focusTag?.toLowerCase() === tag.toLowerCase();
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFocus(on ? null : tag)}
                  className={`ns-pill ${on ? "ns-pill--active" : ""}`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        {/* Their Moments and their shared Pursuits, side by side — the same
            portfolio-first layout as the owner's own profile. A Pursuit
            only ever shows up here when its owner explicitly shared it;
            the section itself doesn't render at all when there are none,
            rather than showing an empty "Pursuits" box. */}
        <div className="mb-12 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <section>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2
                  className="text-2xl sm:text-3xl"
                  style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
                >
                  {focusTag ? `What ${firstName} makes in ${focusTag.toLowerCase()}` : `What ${firstName} makes`}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A look into the things they've created, explored, and loved.
                </p>
              </div>
              {focusTag && (
                <button
                  type="button"
                  onClick={() => setFocus(null)}
                  className="text-xs text-[var(--coral-text)] hover:underline"
                >
                  Show everything
                </button>
              )}
            </div>
            <WorkGrid
              posts={shownPosts}
              onOpen={setOpenPost}
              editable={isMe}
              emptyLabel={`${firstName} hasn't shared any Moments publicly yet.`}
            />
          </section>

          {sharedPursuits.length > 0 && (
            <section>
              <h2 className="text-xl sm:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                {firstName}'s Pursuits
              </h2>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">
                The things they're bringing to life, that they've chosen to share.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {sharedPursuits.map((pursuit) => (
                  <PursuitCard key={pursuit.id} pursuit={pursuit} className="w-full" />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Private by default, one milestone at a time: this section simply
            doesn't exist for a non-owner until there's something explicitly
            shared to show. Visiting your own public link still gets the full
            owner view, locked milestones included — same as /you. */}
        {(isMe || sharedMilestoneIds.length > 0) && (
          <div className="mb-10">
            <h2 className="mb-1 flex items-center gap-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              Quiet Milestones
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {isMe ? "Non-metric growth that feels good." : `What ${firstName} chose to share.`}
            </p>
            {isMe ? (
              <QuietMilestones />
            ) : (
              <SharedMilestones badgeIds={sharedMilestoneIds} primary={primary} />
            )}
          </div>
        )}

        <div className="mb-10 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              Their Circles
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {hobby
                ? `Circles built around ${hobby.name.toLowerCase()} — the craft ${firstName} is deepest in, not a claim about which ones they've joined.`
                : "Nothing to build a suggestion from yet."}
            </p>
            {relatedCircles.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                No Circles for this Space yet.
              </p>
            ) : (
              <ul className="grid gap-2">
                {relatedCircles.map((circle) => (
                  <li key={circle.id}>
                    <Link
                      to="/circles"
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-[var(--coral-deep)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                          {circle.name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {circle.memberCount.toLocaleString()} members
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-1 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              This Corner
            </h2>
            <PeopleWhoAlsoMake hobbySlug={hobbySlug} excludePersonId={personId} firstName={firstName} />
          </div>
        </div>

        {hobby && (
          <Link
            to={`/space/${hobby.slug}`}
            className="group mb-10 flex flex-col overflow-hidden rounded-3xl border border-border sm:flex-row sm:items-center"
          >
            <div className="h-40 w-full shrink-0 overflow-hidden sm:h-auto sm:w-64">
              <GeneratedArt
                hobbySlug={hobby.slug}
                seed={hobby.slug}
                className="h-full w-full transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-between gap-4 p-6">
              <p className="text-xl" style={{ fontFamily: "var(--font-serif)" }}>
                Same hobbies.<br />Brighter days.
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm text-[var(--coral-text)]">
                Explore their world
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        )}

        <MomentDetail
          post={openPost ?? (momentParam ? (posts.find((p) => String(p.id) === momentParam) ?? null) : null)}
          owned={isMe}
          onOpenChange={(o) => {
            if (o) return;
            setOpenPost(null);
            if (momentParam) {
              const next = new URLSearchParams(searchParams);
              next.delete("moment");
              setSearchParams(next, { replace: true });
            }
          }}
        />

        <FollowListDialog
          open={followListOpen}
          onOpenChange={setFollowListOpen}
          profileId={personId}
          initialTab="followers"
        />

        {/* The one place this page asks for anything */}
        <div className="ns-profile-cta glass-panel p-7 text-center">
          <h2 className="mb-2 text-xl" style={{ fontFamily: "var(--font-serif)" }}>
            Start your own shelf
          </h2>
          <p className="mx-auto mb-6 max-w-sm text-sm text-muted-foreground">
            Pick a hobby, log what you make, and watch it stack up. Free, and there's
            nothing here that scrolls forever.
          </p>
          <div className="flex flex-col justify-center gap-2.5 sm:flex-row">
            <Link to="/login">
              <Button variant="brand">
                <Plus className="size-4" />
                Create an account
              </Button>
            </Link>
            <Link to="/discover">
              <Button variant="outline">Browse every hobby</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Real people who post in the same hobby — the closest honest stand-in for
 * "people they make with" the client can actually see, since nothing here
 * can read who a stranger is personally connected to. */
function PeopleWhoAlsoMake({
  hobbySlug,
  excludePersonId,
  firstName,
}: {
  hobbySlug?: string;
  excludePersonId: string;
  firstName: string;
}) {
  const { people, loading } = usePeopleInHobby(hobbySlug ?? "");
  const others = people.filter((p) => p.id !== excludePersonId).slice(0, 6);

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {hobbySlug
          ? `Other people making ${getHobby(hobbySlug)?.name.toLowerCase() ?? "the same thing"} — not ${firstName}'s connections, which only they can see.`
          : "Nothing to suggest yet."}
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Looking…</p>
      ) : others.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          Nobody else here yet.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-5">
          {others.map((person) => (
            <li key={person.id}>
              <Link
                to={person.username ? `/u/${person.username}` : `/u/${person.id}`}
                className="flex w-20 flex-col items-center gap-2 text-center transition-transform duration-200 hover:-translate-y-0.5"
              >
                <Avatar className="size-14">
                  {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" className="object-cover" />}
                  <AvatarFallback>
                    {person.displayName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="w-full truncate text-xs text-foreground">{person.displayName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // clipboard may be unavailable — the URL bar still has the link
        }
      }}
    >
      <Share2 className="size-4" />
      {copied ? "Link copied" : "Share"}
    </Button>
  );
}
