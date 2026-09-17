import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { currentSpaceSlug } from "../data/hobbies";
import { Post } from "../data/posts";
import { PostMedia } from "../components/PostMedia";
import { CoverEditor } from "../components/CoverEditor";
import { Button } from "../components/ui/button";

type Grouping = "chronological" | "tag";

/** True only for a real, loadable upload — the studio is a photo book, so a
 * generated-art placeholder (nothing to actually show) never gets a page. */
function hasRealMedia(post: Post) {
  return !!post.media && /^https?:\/\//.test(post.media);
}

const PAGE_SIZE = 7; // one hero + a 2x3 grid of six, per the spread layout

interface Spread {
  chapter?: string;
  items: Post[];
}

/** Chronological pages ignore tags entirely; by-tag pages chapter by each
 * Moment's first tag, splitting a chapter across pages only if it runs past
 * seven. Different grouping, different page count and order — intentional,
 * not a bug to reconcile between the two modes. */
function buildSpreads(posts: Post[], grouping: Grouping): Spread[] {
  const withMedia = posts.filter(hasRealMedia);
  if (grouping === "chronological") {
    const ordered = [...withMedia].sort((a, b) => b.createdAt - a.createdAt);
    const spreads: Spread[] = [];
    for (let i = 0; i < ordered.length; i += PAGE_SIZE) {
      spreads.push({ items: ordered.slice(i, i + PAGE_SIZE) });
    }
    return spreads;
  }
  const byTag = new Map<string, Post[]>();
  for (const post of withMedia) {
    const tag = post.tags?.[0] ?? "Untagged";
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag)!.push(post);
  }
  const spreads: Spread[] = [];
  for (const [tag, items] of byTag) {
    const ordered = [...items].sort((a, b) => b.createdAt - a.createdAt);
    for (let i = 0; i < ordered.length; i += PAGE_SIZE) {
      spreads.push({ chapter: tag, items: ordered.slice(i, i + PAGE_SIZE) });
    }
  }
  return spreads;
}

type Loaded = {
  personId: string;
  displayName: string;
  bio?: string;
  coverTitle?: string | null;
  coverTagline?: string | null;
  coverPostId?: number | null;
  posts: Post[];
};

/**
 * The visitor-facing, paginated view of a Shelf — a photo book, not a feed.
 * A full-bleed cover (editable by its owner) opens into two-page spreads,
 * browsable chronologically or grouped by tag, turned with a real page-flip
 * rather than a fade. This is where "Cover Story" now lives, off the
 * everyday Shelf (see You.tsx's Fix 4) — a place worth opening deliberately,
 * not a section scrolled past on every visit.
 */
export function Studio() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user, profile: myProfile } = useAuth();
  const { myPosts } = useContent();
  const reduceMotion = useReducedMotion();

  const [remote, setRemote] = useState<
    { status: "loading" } | { status: "missing" } | { status: "ready"; data: Loaded }
  >(username ? { status: "loading" } : { status: "missing" });

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setRemote({ status: "loading" });

    // A profile that can't be reached shows "no studio here" rather than
    // spinning indefinitely on a slow or offline connection — same fallback
    // PublicProfile.tsx uses for the same fetch.
    const timer = setTimeout(() => {
      if (!cancelled) setRemote((s) => (s.status === "loading" ? { status: "missing" } : s));
    }, 10000);

    (async () => {
      try {
        if (!supabase) return setRemote({ status: "missing" });
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("id, display_name, bio, cover_title, cover_tagline, cover_post_id")
          .eq(isUuid ? "id" : "username", username)
          .maybeSingle();
        if (cancelled) return;
        if (!profileRow) return setRemote({ status: "missing" });

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
          tags: row.tags ?? [],
          pinned: row.pinned ?? false,
        }));

        setRemote({
          status: "ready",
          data: {
            personId: profileRow.id,
            displayName: profileRow.display_name,
            bio: profileRow.bio ?? undefined,
            coverTitle: profileRow.cover_title,
            coverTagline: profileRow.cover_tagline,
            coverPostId: profileRow.cover_post_id,
            posts,
          },
        });
      } catch {
        // Unreachable network: same "no studio here" fallback as a timeout,
        // rather than leaving the spinner running forever.
        if (!cancelled) setRemote({ status: "missing" });
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username]);

  const own: Loaded | null = !username && user
    ? {
        personId: user.id,
        displayName: myProfile?.display_name ?? "You",
        bio: myProfile?.bio ?? undefined,
        coverTitle: myProfile?.cover_title,
        coverTagline: myProfile?.cover_tagline,
        coverPostId: myProfile?.cover_post_id,
        posts: myPosts,
      }
    : null;

  const [opened, setOpened] = useState(false);
  const [grouping, setGrouping] = useState<Grouping>("chronological");
  const [pageIndex, setPageIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const loaded = own ?? (remote.status === "ready" ? remote.data : null);
  const isMe = !!user && !!loaded && user.id === loaded.personId;

  const spreads = useMemo(() => (loaded ? buildSpreads(loaded.posts, grouping) : []), [loaded, grouping]);
  const clampedIndex = Math.min(pageIndex, Math.max(spreads.length - 1, 0));

  const goTo = (next: number) => {
    if (next < 0 || next >= spreads.length) return;
    setDirection(next > clampedIndex ? 1 : -1);
    setPageIndex(next);
  };

  if (!loaded) {
    if (!username && !user) {
      return (
        <div className="flex min-h-[70vh] items-center justify-center px-4 text-center">
          <p className="text-sm text-muted-foreground">Sign in to open your own Studio.</p>
        </div>
      );
    }
    if (remote.status === "missing") {
      return (
        <div className="flex min-h-[70vh] items-center justify-center px-4 text-center">
          <p className="text-sm text-muted-foreground">No studio here. The link may be out of date.</p>
        </div>
      );
    }
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <span className="size-8 animate-spin rounded-full border-2 border-border border-t-white/70" />
      </div>
    );
  }

  const withMedia = loaded.posts.filter(hasRealMedia);
  const coverPost =
    withMedia.find((p) => p.id === loaded.coverPostId) ??
    withMedia.find((p) => p.pinned) ??
    withMedia[0];
  const coverTitle = loaded.coverTitle || loaded.displayName;
  const coverTagline = loaded.coverTagline || loaded.bio;
  const sinceAt = loaded.posts.length ? Math.min(...loaded.posts.map((p) => p.createdAt)) : null;
  const sinceLabel = sinceAt
    ? new Date(sinceAt).toLocaleDateString(undefined, {
        month: "long",
        year: new Date(sinceAt).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
      })
    : null;

  if (!opened) {
    return (
      <div className="ns-paper-theme relative min-h-screen overflow-hidden bg-[var(--ink)] text-white">
        <div className="absolute inset-0">
          {coverPost && (
            <PostMedia
              media={coverPost.media}
              type={coverPost.type}
              hobbySlug={coverPost.hobbySlug}
              seed={coverPost.id}
              preview
              className="h-full w-full object-cover"
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(42,36,29,0.72) 0%, rgba(42,36,29,0.15) 45%, rgba(42,36,29,0.35) 100%)",
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-6 top-6 flex size-9 items-center justify-center rounded-full border border-white/30 bg-black/25 text-white transition-colors hover:border-white/60"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </button>

        <span
          className="absolute right-8 top-7 text-sm italic text-white/80"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          NoSpace
        </span>

        {isMe && (
          <div className="absolute right-6 top-16 sm:right-8">
            <CoverEditor posts={loaded.posts} />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-8 sm:p-16">
          <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/70">
            {loaded.posts.length} {loaded.posts.length === 1 ? "moment" : "moments"}
            {sinceLabel ? ` since ${sinceLabel}` : ""}
          </p>
          <h1
            className="max-w-xl text-4xl leading-tight sm:text-6xl"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}
          >
            {coverTitle}
          </h1>
          {coverTagline && (
            <p
              className="mt-3 max-w-md text-lg italic text-white/85 sm:text-xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {coverTagline}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setOpened(true);
              setPageIndex(0);
            }}
            disabled={spreads.length === 0}
            className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: "var(--coral-deep)" }}
          >
            Open the studio
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  const spread = spreads[clampedIndex];
  const hero = spread?.items[0];
  const rest = spread?.items.slice(1, 7) ?? [];

  return (
    <div className="ns-paper-theme min-h-screen bg-[var(--paper)]">
      <div className="mx-auto max-w-6xl px-6 py-6 sm:px-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setOpened(false)}
            className="flex size-9 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--paper-raised)] text-[var(--ink)] transition-colors hover:border-[var(--coral-deep)]"
            aria-label="Back to cover"
          >
            <ArrowLeft className="size-4" />
          </button>

          <div className="flex gap-1 rounded-full border border-[var(--line)] p-0.5 text-xs">
            {(["chronological", "tag"] as Grouping[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGrouping(g);
                  setPageIndex(0);
                  setDirection(1);
                }}
                className={`rounded-full px-3.5 py-1.5 transition-colors ${
                  grouping === g ? "bg-[var(--coral-deep)] text-white" : "text-[var(--ink-soft)]"
                }`}
              >
                {g === "chronological" ? "Chronological" : "By tag"}
              </button>
            ))}
          </div>

          <span
            className="text-sm italic text-[var(--ink-soft)]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {spreads.length === 0 ? "0 / 0" : `${clampedIndex + 1} / ${spreads.length}`}
          </span>
        </div>

        {spread?.chapter && (
          <h2
            className="mb-4 text-[22px]"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
          >
            {spread.chapter}
          </h2>
        )}

        <div style={{ perspective: 1800 }}>
          <AnimatePresence initial={false} mode="wait" custom={direction}>
            <motion.div
              key={`${grouping}-${clampedIndex}`}
              initial={reduceMotion ? false : { rotateY: direction > 0 ? 70 : -70, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={reduceMotion ? undefined : { rotateY: direction > 0 ? -70 : 70, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 32 }}
              style={{
                transformStyle: "preserve-3d",
                transformOrigin: direction > 0 ? "left center" : "right center",
              }}
              className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr]"
            >
              {hero && (
                <div className="relative aspect-[4/5] overflow-hidden rounded-md border border-[var(--line)] md:aspect-auto md:h-[560px]">
                  <PostMedia
                    media={hero.media}
                    type={hero.type}
                    hobbySlug={hero.hobbySlug}
                    seed={hero.id}
                    preview
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                  <p
                    className="absolute inset-x-0 bottom-0 p-5 text-lg italic text-white sm:text-xl"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {hero.caption}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 grid-rows-3 gap-2 md:h-[560px]">
                {rest.map((post) => (
                  <div key={post.id} className="relative overflow-hidden rounded-md border border-[var(--line)]">
                    <PostMedia
                      media={post.media}
                      type={post.type}
                      hobbySlug={post.hobbySlug}
                      seed={post.id}
                      preview
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                    <p className="absolute inset-x-0 bottom-0 truncate p-2 text-[11px] italic text-white">
                      {post.caption}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex justify-between">
          <Button
            variant="outline"
            className="rounded-full disabled:opacity-35"
            disabled={clampedIndex === 0}
            onClick={() => goTo(clampedIndex - 1)}
          >
            <ArrowLeft className="size-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            className="rounded-full disabled:opacity-35"
            disabled={clampedIndex >= spreads.length - 1}
            onClick={() => goTo(clampedIndex + 1)}
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
