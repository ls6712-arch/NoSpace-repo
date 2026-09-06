import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowRight, Plus, Share2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Post } from "../data/posts";
import { badges, RewardStats } from "../data/badges";
import { subHobbyLabel, currentSpaceSlug, getHobby } from "../data/hobbies";
import { circlesByHobby } from "../data/circles";
import { usePeopleInHobby } from "../lib/people";
import { sessionsFromPosts } from "../components/HobbyShelf";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { PersonActions } from "../components/PersonActions";
import { HandwrittenNote } from "../components/HandwrittenNote";
import { WorkGrid } from "../components/WorkGrid";
import { PursuitCard } from "../components/PursuitCard";
import { QuietMilestones } from "../components/QuietMilestones";
import { GeneratedArt } from "../components/GeneratedArt";
import { MomentDetail } from "../components/MomentDetail";
import { milestoneText, pickPrimaryHobby } from "../components/ProfileHeadline";
import { fetchSharedPursuits, SharedPursuit } from "../lib/pursuitsRemote";

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
  // Only what this person explicitly marked shared — never their private
  // Pursuits, which this query can't even see (sql/pursuits.sql's row
  // security only returns shared=true rows to anyone but the owner).
  const [sharedPursuits, setSharedPursuits] = useState<SharedPursuit[]>([]);

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

  const { personId, displayName, avatarUrl, posts } = state;
  const isMe = !!user && user.id === personId;
  const firstName = displayName.split(" ")[0];
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
  const shownPosts = focusKey
    ? posts.filter((p) => (p.subHobby ?? `space:${p.hobbySlug}`) === focusKey)
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
  const hobbySlug = primaryHobbySlug(posts);
  const hobby = hobbySlug ? getHobby(hobbySlug) : undefined;
  const relatedCircles = hobbySlug ? circlesByHobby(hobbySlug).slice(0, 4) : [];

  return (
    <div className="ns-public-profile min-h-screen bg-surface py-8 sm:py-10">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-5 sm:gap-6">
            <Avatar className="size-20 shrink-0 sm:size-28">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" className="object-cover" />}
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1
                className="truncate text-3xl leading-tight sm:text-4xl"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                {displayName}
              </h1>
              {sessions.length > 0 && (
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {sessions.slice(0, 5).map((s) => s.label).join(", ")}.
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-[var(--coral-deep)]" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
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
                  {milestoneText(primaryHobby.label, primaryHobby.firstActivityAt)} · Keep going.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {/* Not a Follow button. You attach to the hobby, or ask to do a
                    specific thing together — never to the person as a person.
                    Not shown on your own shelf — you can't ask yourself to
                    make something together. personId comes from the profile
                    itself, so it exists even before this person has posted. */}
                {!isMe && (
                  <PersonActions
                    personName={displayName}
                    personId={personId}
                    hobbyKeys={posts.map((p) => p.subHobby ?? `space:${p.hobbySlug}`)}
                  />
                )}
                <CopyLinkButton />
              </div>
            </div>
          </div>
          <HandwrittenNote className="max-w-[220px] sm:mt-2">
            Curious creators make a brighter world.
          </HandwrittenNote>
        </div>

        {sessions.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
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

        {/* Their Moments and their shared Pursuits, side by side — the same
            portfolio-first layout as the owner's own profile. A Pursuit
            only ever shows up here when its owner explicitly shared it;
            the section itself doesn't render at all when there are none,
            rather than showing an empty "Pursuits" box. */}
        <div className="mb-12 grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <section>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                  {focusKey
                    ? `What ${firstName} makes in ${sessions.find((s) => s.key === focusKey)?.label.toLowerCase()}`
                    : `What ${firstName} makes`}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A look into the things they've created, explored, and loved.
                </p>
              </div>
              {focusKey && (
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

        <div className="mb-10">
          <h2 className="mb-1 flex items-center gap-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
            Quiet Milestones
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">Their non-metric growth, just for them.</p>
          <QuietMilestones unlockedIds={unlockedIds} primary={primary} />
        </div>

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
              People They Make With
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
