import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, FileText, Globe2, PenLine, Play, Users, UserRound } from "lucide-react";
import { Post } from "../data/posts";
import { getHobby } from "../data/hobbies";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { useJournal } from "../lib/journal";
import { parseArchiveKey, updatedLabel } from "../components/HobbyShelf";
import { MomentDetail } from "../components/MomentDetail";
import { PostMedia } from "../components/PostMedia";
import { Button } from "../components/ui/button";

/**
 * One hobby's personal archive — everything logged under that tag, in order.
 * This is the page a book on the shelf opens into, and it is deliberately
 * closer to a photo album than a feed: grouped by month, no counts of other
 * people's approval, and text-only entries kept as note cards rather than
 * dropped for having no picture.
 */
const FILTERS = [
  { id: "all", label: "All" },
  { id: "media", label: "Media" },
  { id: "notes", label: "Notes" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const AUDIENCE: Record<string, { label: string; icon: typeof Globe2 }> = {
  public: { label: "Everyone", icon: Globe2 },
  circle: { label: "A Circle", icon: Users },
  friends: { label: "People you follow", icon: UserRound },
};

const hasMedia = (post: Post) => !!post.media && /^https?:\/\//.test(post.media);

function monthKey(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function dayLabel(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function HobbyArchive() {
  const { hobbyKey = "" } = useParams();
  const { myPosts } = useContent();
  const { user, isConfigured } = useAuth();
  const journal = useJournal();

  const [tab, setTab] = useState<"moments" | "projects" | "about">("moments");
  const [filter, setFilter] = useState<FilterId>("all");
  const [open, setOpen] = useState<Post | null>(null);

  const target = useMemo(() => parseArchiveKey(hobbyKey), [hobbyKey]);

  const moments = useMemo(() => {
    if (!target) return [];
    return myPosts
      .filter((p) =>
        target.subSlug
          ? p.subHobby === target.subSlug
          : p.hobbySlug === target.hobbySlug && !p.subHobby,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [myPosts, target]);

  const projects = useMemo(() => {
    if (!target) return [];
    return journal.projects.filter((p) =>
      target.subSlug ? p.subHobby === target.subSlug : p.hobbySlug === target.hobbySlug,
    );
  }, [journal.projects, target]);

  // A personal archive with no account behind it would read as "you have
  // nothing", when the truth is there's nobody to have anything.
  if (isConfigured && !user) {
    return (
      <SignUpPrompt
        title="This is your own archive"
        body="Every hobby you log gets a book here, holding every photo, video and note you've put in it. Make an account and yours starts filling up."
        cta="Start my shelf"
      />
    );
  }

  if (!target) {
    return (
      <div className="min-h-screen bg-surface py-16">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h1 className="mb-3 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            No such hobby
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            That book isn't on your shelf.
          </p>
          <Link to="/you">
            <Button variant="outline">Back to Your work</Button>
          </Link>
        </div>
      </div>
    );
  }

  const space = getHobby(target.hobbySlug)!;
  const logTo = `/log?hobby=${target.hobbySlug}${target.subSlug ? `&sub=${target.subSlug}` : ""}`;

  const filtered = moments.filter((p) =>
    filter === "media" ? hasMedia(p) : filter === "notes" ? !hasMedia(p) : true,
  );

  // Grouped by month, newest first, so scrolling reads as a timeline.
  const byMonth: { month: string; items: Post[] }[] = [];
  for (const post of filtered) {
    const key = monthKey(post.createdAt);
    const last = byMonth[byMonth.length - 1];
    if (last && last.month === key) last.items.push(post);
    else byMonth.push({ month: key, items: [post] });
  }

  return (
    <div className="min-h-screen bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <Link
          to="/you"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Your work
        </Link>

        <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
          {target.label}
        </h1>
        <p className="mt-1 text-muted-foreground">{space.name}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {moments.length} {moments.length === 1 ? "moment" : "moments"} · {projects.length}{" "}
          {projects.length === 1 ? "project" : "projects"}
          {moments.length > 0 ? ` · ${updatedLabel(moments[0].createdAt).toLowerCase()}` : ""}
        </p>

        <div className="mt-5">
          <Link to={logTo}>
            <Button variant="coral">
              <PenLine className="size-4" />
              Log a {target.label.toLowerCase()} moment
            </Button>
          </Link>
        </div>

        {/* Sections */}
        <div role="tablist" aria-label="Archive sections" className="mt-8 flex gap-1 border-b border-[var(--hairline)]">
          {(["moments", "projects", "about"] as const).map((id) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm capitalize transition-colors ${
                tab === id
                  ? "border-[var(--coral-deep)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {id}
            </button>
          ))}
        </div>

        {tab === "moments" && (
          <>
            <ul className="mt-5 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      filter === f.id
                        ? "border-transparent text-white [background-color:var(--coral-deep)]"
                        : "border-border bg-card text-foreground hover:border-[var(--foreground)]/35"
                    }`}
                  >
                    {f.label}
                  </button>
                </li>
              ))}
            </ul>

            {filtered.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border px-5 py-12 text-center">
                <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {moments.length === 0
                    ? `Nothing logged under ${target.label} yet. A photo, or a sentence about how it went, both count.`
                    : `No ${filter === "media" ? "photos or videos" : "notes"} here — try All.`}
                </p>
                <Link to={logTo} className="mt-4 inline-block">
                  <Button variant="outline" size="sm">
                    Log a moment
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-8">
                {byMonth.map(({ month, items }) => (
                  <section key={month}>
                    <h2 className="mb-3 text-sm text-muted-foreground">{month}</h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {items.map((post) => {
                        const audience = AUDIENCE[post.visibility] ?? AUDIENCE.friends;
                        const media = hasMedia(post);
                        return (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => setOpen(post)}
                            className="group relative flex aspect-square flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)]"
                          >
                            {media ? (
                              <>
                                <PostMedia
                                  media={post.media}
                                  type={post.type}
                                  hobbySlug={post.hobbySlug}
                                  seed={post.id}
                                  preview
                                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                                />
                                {post.type === "video" && (
                                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <span className="flex size-9 items-center justify-center rounded-full bg-[var(--forest-ink)]/55 backdrop-blur-sm">
                                      <Play className="size-4 fill-white text-white" />
                                    </span>
                                  </span>
                                )}
                              </>
                            ) : (
                              // A text-only log is still a moment — it gets a
                              // note card rather than vanishing from the grid.
                              <div className="flex h-full flex-col justify-between bg-surface-muted p-3">
                                <FileText className="size-4 text-muted-foreground" />
                                <p className="line-clamp-4 text-xs leading-relaxed">
                                  {post.caption}
                                </p>
                              </div>
                            )}

                            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[var(--forest-ink)]/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                              <audience.icon className="size-2.5" />
                              {audience.label}
                            </span>
                            <span className="absolute bottom-2 right-2 rounded-full bg-[var(--forest-ink)]/60 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                              {dayLabel(post.createdAt)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "projects" && (
          <div className="mt-6">
            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
                <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
                  No {target.label.toLowerCase()} projects yet. A project is a
                  thing you come back to — moments group under it as updates.
                </p>
                <Link to={logTo} className="mt-4 inline-block">
                  <Button variant="outline" size="sm">
                    Start a project
                  </Button>
                </Link>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {projects.map((project) => {
                  const updates = moments.filter(
                    (m) => journal.entryProject[String(m.id)] === project.id,
                  );
                  return (
                    <li
                      key={project.id}
                      className="rounded-2xl border border-border bg-card p-4"
                    >
                      <div className="text-base" style={{ fontFamily: "var(--font-serif)" }}>
                        {project.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {updates.length} {updates.length === 1 ? "update" : "updates"}
                        {project.finishedAt ? " · finished" : " · in progress"}
                      </div>
                      {updates.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {updates.slice(0, 3).map((u) => (
                            <li key={u.id} className="truncate text-xs text-muted-foreground">
                              {dayLabel(u.createdAt)} — {u.caption}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {tab === "about" && (
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-1 text-base" style={{ fontFamily: "var(--font-serif)" }}>
                {target.label}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Part of {space.name} — {space.plainLabel.toLowerCase()}.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {space.description}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-2 text-base" style={{ fontFamily: "var(--font-serif)" }}>
                This archive
              </h2>
              <dl className="grid gap-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">First logged</dt>
                  <dd>
                    {moments.length > 0
                      ? new Date(moments[moments.length - 1].createdAt).toLocaleDateString()
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Moments</dt>
                  <dd>{moments.length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">With a photo or video</dt>
                  <dd>{moments.filter(hasMedia).length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Kept private</dt>
                  <dd>{moments.filter((m) => m.visibility !== "public").length}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-2 text-base" style={{ fontFamily: "var(--font-serif)" }}>
                Find others doing this
              </h2>
              <Link
                to={`/space/${target.hobbySlug}${target.subSlug ? `?hobby=${target.subSlug}` : ""}`}
                className="text-sm text-[var(--coral-text)] hover:underline"
              >
                Open {target.label} in {space.shortName} →
              </Link>
            </div>
          </div>
        )}
      </div>

      <MomentDetail post={open} owned onOpenChange={(o) => !o && setOpen(null)} />
    </div>
  );
}
