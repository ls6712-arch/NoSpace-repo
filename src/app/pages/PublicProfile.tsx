import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Post } from "../data/posts";
import { badges, RewardStats } from "../data/badges";
import { subHobbyLabel, currentSpaceSlug } from "../data/hobbies";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { PersonActions } from "../components/PersonActions";
import { HobbyShelf, sessionsFromPosts } from "../components/HobbyShelf";
import { QuietMilestones } from "../components/QuietMilestones";
import { PostMedia } from "../components/PostMedia";
import { MomentDetail } from "../components/MomentDetail";
import { milestoneText, pickPrimaryHobby } from "../components/ProfileHeadline";

/**
 * Somebody's shelf, open to anyone with the link — no account needed to look.
 * This is what "Share profile" actually shares.
 *
 * Deliberately shows only what's public: their name, what they've made, and
 * how long they've been at it. Private reflections never leave the owner's own
 * view, and neither do their circles.
 *
 * Milestones here are derived from their public posts rather than from a
 * rewards ledger, since that ledger lives in the owner's browser and can't be
 * read from anywhere else.
 */
export function PublicProfile() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "missing" }
    | { status: "ready"; personId: string; displayName: string; avatarUrl?: string; posts: Post[] }
  >({ status: "loading" });
  // Opening a piece is how you react to it or leave a thought. Declared up
  // here with the other hooks — anything after the early returns below would
  // run conditionally, which React forbids.
  const [openPost, setOpenPost] = useState<Post | null>(null);

  useEffect(() => {
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

      type Row = { id: string; username: string | null; display_name: string; avatar_url: string | null };
      let profileRow: Row | null = null;

      if (isUuid) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("id", username)
          .maybeSingle();
        profileRow = (data as Row | null) ?? null;
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .eq("username", username)
          .maybeSingle();
        profileRow = (data as Row | null) ?? null;

        // Someone shared a link before usernames existed, or typed a name.
        if (!profileRow) {
          const { data: byName } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .ilike("display_name", username)
            .limit(1);
          profileRow = (byName?.[0] as Row | undefined) ?? null;
        }
      }

      if (cancelled) return;
      if (!profileRow) return setState({ status: "missing" });

      const { data: rows } = await supabase
        .from("posts")
        .select("*")
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
      }));

      setState({
        status: "ready",
        personId: profileRow.id,
        displayName: profileRow.display_name,
        avatarUrl: profileRow.avatar_url ?? undefined,
        posts,
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

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
            Nobody by that name — the link may be out of date.
          </p>
          <Link to="/discover">
            <Button variant="outline">Explore hobbies instead</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { personId, displayName, avatarUrl, posts } = state;
  const isMe = !!user && user.id === personId;
  const sessions = sessionsFromPosts(posts);

  // Focusing a hobby narrows THEIR work on THEIR page. It used to navigate to
  // the global Space, which showed the viewer their own empty version.
  const focusKey = searchParams.get("hobby");
  const setFocus = (key: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (key) next.set("hobby", key);
    else next.delete("hobby");
    setSearchParams(next, { replace: true });
  };
  // A shared link carries ?moment=<id>; open it once the posts have loaded.
  const momentParam = searchParams.get("moment");
  const focused = sessions.find((s) => s.key === focusKey);
  const shownPosts = focused
    ? posts.filter((p) => (p.subHobby ?? `space:${p.hobbySlug}`) === focused.key)
    : posts;
  const totalSessions = posts.length;
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Milestones, worked out from what's publicly visible.
  const derivedStats: RewardStats = {
    points: 0,
    postsCreated: posts.length,
    likesGiven: 0,
    purchases: 0,
    hobbiesVisited: [],
    hobbiesPosted: posts.map((p) => p.subHobby ?? `space:${p.hobbySlug}`),
  };
  const unlockedIds = badges.filter((b) => b.test(derivedStats)).map((b) => b.id);
  const top = sessions[0];
  const primary = top?.subSlug
    ? { slug: top.subSlug, label: subHobbyLabel(top.subSlug) ?? top.label }
    : { label: top?.label };

  const primaryHobby = pickPrimaryHobby(posts);

  return (
    <div className="min-h-screen bg-surface py-8 sm:py-10">
      <div className="container mx-auto max-w-2xl px-4">
        {/* The wordmark is how someone arriving on a shared profile link gets
            into the rest of the app. It looked like a way out and wasn't one. */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-block text-3xl transition-colors hover:text-[var(--coral-text)] sm:text-4xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
          >
            NoSpace
          </Link>
        </div>

        <div className="mb-5 flex items-center gap-5 sm:gap-6">
          <Avatar className="size-20 shrink-0 sm:size-24">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1
              className="truncate text-3xl leading-tight sm:text-4xl"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
            >
              {displayName}
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
            {primaryHobby && (
              <p className="mt-1 text-sm text-muted-foreground">
                {milestoneText(primaryHobby.label, primaryHobby.firstActivityAt)}
              </p>
            )}
            <div className="mt-3">
              {/* Not a Follow button. You attach to the hobby, or ask to do a
                  specific thing together — never to the person as a person. */}
              {/* Not shown on your own shelf — you can't ask yourself to
                  make something together. personId comes from the profile
                  itself, so it exists even before this person has posted. */}
              {!isMe && (
                <PersonActions
                  personName={displayName}
                  personId={personId}
                  hobbyKeys={posts.map((p) => p.subHobby ?? `space:${p.hobbySlug}`)}
                />
              )}
            </div>
          </div>
        </div>

        {sessions.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {sessions.slice(0, 6).map((s) => {
              const on = focusKey === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFocus(on ? null : s.key)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                    on
                      ? "border-transparent text-white [background-color:var(--coral-deep)]"
                      : "border-border bg-white/[0.04] text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  }`}
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mb-9">
          {/* Their books stay on their profile. These used to link into your
              own archive, so tapping someone's Workbench showed you your own
              empty Space instead of their work. */}
          <HobbyShelf
            items={sessions}
            linkTo={(item) => `?hobby=${encodeURIComponent(item.key)}`}
            emptyCopy={`${displayName} hasn't shared any work publicly yet.`}
            emptyCta={false}
          />
        </div>

        <div className="mb-9">
          <h2 className="mb-3 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
            Quiet Milestones
          </h2>
          <QuietMilestones unlockedIds={unlockedIds} primary={primary} />
        </div>

        {posts.length > 0 && (
          <div className="mb-10">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                {focused
                  ? `${displayName.split(" ")[0]}'s ${focused.label.toLowerCase()}`
                  : `${displayName.split(" ")[0]}'s work`}
              </h2>
              {focused && (
                <button
                  type="button"
                  onClick={() => setFocus(null)}
                  className="text-xs text-[var(--coral-text)] hover:underline"
                >
                  Show everything
                </button>
              )}
            </div>
            {shownPosts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                Nothing public here yet.
              </p>
            ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {shownPosts.slice(0, 12).map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setOpenPost(post)}
                  className="aspect-square overflow-hidden rounded-md transition-transform duration-200 hover:scale-[1.03]"
                  aria-label={`Open: ${post.caption.slice(0, 60)}`}
                >
                  <PostMedia
                    media={post.media}
                    type={post.type}
                    hobbySlug={post.hobbySlug}
                    seed={post.id}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
            )}
          </div>
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

        {/* The one place this page asks for anything */}
        <div className="glass-panel rounded-3xl p-7 text-center">
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
