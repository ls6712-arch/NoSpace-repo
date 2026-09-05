import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Plus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Post } from "../data/posts";
import { badges, RewardStats } from "../data/badges";
import { subHobbyLabel } from "../data/hobbies";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { BePart } from "../components/BePart";
import { HobbyShelf, sessionsFromPosts } from "../components/HobbyShelf";
import { QuietMilestones } from "../components/QuietMilestones";
import { PostMedia } from "../components/PostMedia";
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
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "missing" }
    | { status: "ready"; displayName: string; posts: Post[] }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!supabase) return setState({ status: "missing" });

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .eq("username", username)
        .maybeSingle();

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
        hobbySlug: row.hobby_slug,
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

      setState({ status: "ready", displayName: profileRow.display_name, posts });
    })();

    return () => {
      cancelled = true;
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

  const { displayName, posts } = state;
  const sessions = sessionsFromPosts(posts);
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
        <div className="mb-6">
          <span
            className="text-3xl sm:text-4xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
          >
            No Space
          </span>
        </div>

        <div className="mb-5 flex items-center gap-5 sm:gap-6">
          <Avatar className="size-20 shrink-0 sm:size-24">
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
              <BePart
                personName={displayName}
                personId={posts[0]?.userId}
                hobbySlug={posts[0]?.hobbySlug ?? "workbench"}
                subSlug={posts[0]?.subHobby}
              />
            </div>
          </div>
        </div>

        {sessions.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
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
          </div>
        )}

        <div className="mb-9">
          <HobbyShelf items={sessions} />
        </div>

        <div className="mb-9">
          <h2 className="mb-3 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
            Quiet Milestones
          </h2>
          <QuietMilestones unlockedIds={unlockedIds} primary={primary} />
        </div>

        {posts.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-3 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              {displayName.split(" ")[0]}'s work
            </h2>
            <div className="grid grid-cols-3 gap-1.5">
              {posts.slice(0, 12).map((post) => (
                <div key={post.id} className="aspect-square overflow-hidden rounded-md">
                  <PostMedia
                    media={post.media}
                    type={post.type}
                    hobbySlug={post.hobbySlug}
                    seed={post.id}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

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
              <Button variant="outline">Browse 108 hobbies</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
