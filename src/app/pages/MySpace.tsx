import { Link } from "react-router";
import { ArrowRight, Bookmark, PenLine, Sprout, Users } from "lucide-react";
import { getHobby, subHobbyLabel } from "../data/hobbies";
import { circles } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { daysSince, deriveProjects, useJournal } from "../lib/journal";
import { useSocial } from "../context/SocialContext";
import { ContentCard } from "../components/ContentCard";
import { Button } from "../components/ui/button";

/**
 * My Space is continuity, not consumption. It answers "what's happened in my
 * corner of NoSpace, and what was I in the middle of?" — which is why the
 * first thing under the fold is your own unfinished work, not other people's
 * finished work.
 *
 * Deliberately not called a feed, and deliberately finite: every module has a
 * bounded number of items and a way out of the page.
 */
function Section({
  title,
  copy,
  action,
  children,
}: {
  title: string;
  copy?: string;
  action?: { label: string; to: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mb-11">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            {title}
          </h2>
          {copy && <p className="mt-1 text-sm text-muted-foreground">{copy}</p>}
        </div>
        {action && (
          <Link
            to={action.to}
            className="shrink-0 text-xs text-[var(--coral-text)] hover:underline"
          >
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children, to, cta }: { children: React.ReactNode; to: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-9 text-center">
      <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p>
      <Link to={to} className="mt-4 inline-block">
        <Button variant="outline" size="sm">
          {cta}
        </Button>
      </Link>
    </div>
  );
}

export function MySpace() {
  const { publicFeed, posts, isCircleJoined } = useContent();
  const journal = useJournal();
  const social = useSocial();

  const exploring = new Set(social.followedHobbies);
  const joinedCircles = circles.filter((c) => isCircleJoined(c.id));
  const joinedSpaces = new Set(joinedCircles.map((c) => c.hobbySlug));

  // "Today" means the makers and Circles you actually chose. If you've chosen
  // nobody yet, it falls back to the spaces your Circles live in rather than
  // pretending an algorithm knows you.
  // What you chose is a set of hobbies and Circles — never a set of people.
  const chosen = publicFeed.filter(
    (p) =>
      (p.subHobby && exploring.has(p.subHobby)) ||
      exploring.has(`space:${p.hobbySlug}`) ||
      joinedSpaces.has(p.hobbySlug),
  );
  // Before you've followed anyone or joined anything there is nothing personal
  // to show. Rather than an empty page or a fake "for you", it shows recent
  // work from across NoSpace and says plainly that's what it is.
  const hasChosen = chosen.length > 0;
  const today = (hasChosen ? chosen : publicFeed).slice(0, 6);

  const fromCircles = posts
    .filter((p) => p.visibility === "circle" && p.circleId && isCircleJoined(p.circleId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4);

  const exploringWork = publicFeed
    .filter((p) => (p.subHobby && exploring.has(p.subHobby)) || exploring.has(`space:${p.hobbySlug}`))
    .slice(0, 4);

  const savedWork = journal.saved
    .map((id) => posts.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 4);

  const myProjects = journal.projects.filter((p) => !p.finishedAt);
  const nudge = [...myProjects].sort((a, b) => a.startedAt - b.startedAt)[0];
  const nudgeDays = nudge ? daysSince(nudge.startedAt) : 0;

  // Other people's ongoing work, grouped honestly into projects.
  const nearbyProjects = deriveProjects(publicFeed, subHobbyLabel).slice(0, 3);

  return (
    <div className="min-h-screen bg-surface py-10 sm:py-14">
      <div className="container mx-auto max-w-4xl px-4">
        <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
          My Space
        </h1>

        <div className="mb-10 mt-8">
          <h2 className="text-xl sm:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            Today in your space
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New work from the hobbies and Circles you're part of.
          </p>

          {!hasChosen && (
            <p className="mt-3 rounded-xl border border-[var(--hairline)] bg-card px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
              You aren't exploring any hobbies or Circles yet, so this is recent
              work from across NoSpace. Once you pick some, only those appear here.
            </p>
          )}

          <div className="mt-4">
            {today.length === 0 ? (
              <Empty to="/discover" cta="Find makers to follow">
                Quiet so far. Follow a few makers or join a Circle and their new
                work turns up here — nothing else gets in.
              </Empty>
            ) : (
              <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                {today.map((post) => (
                  <ContentCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Your own unfinished work sits above everyone else's finished work. */}
        <Section
          title="Continue where you left off"
          copy="Your projects, and what they're waiting on."
          action={{ label: "Log progress", to: "/log" }}
        >
          {myProjects.length === 0 ? (
            <Empty to="/log" cta="Start a project">
              You haven't started a project yet. A project is just a thing you
              come back to — six mugs, a bench, a language.
            </Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {myProjects.slice(0, 4).map((project) => {
                const hobby = getHobby(project.hobbySlug);
                const updates = Object.values(journal.entryProject).filter(
                  (id) => id === project.id,
                ).length;
                return (
                  <li key={project.id}>
                    <Link
                      to="/log"
                      className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)]"
                    >
                      <span className="text-base" style={{ fontFamily: "var(--font-serif)" }}>
                        {project.title}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {hobby?.shortName}
                        {project.subHobby
                          ? ` · ${subHobbyLabel(project.subHobby) ?? project.subHobby}`
                          : ""}
                      </span>
                      <span className="mt-3 flex items-center gap-1.5 text-xs text-[var(--coral-text)]">
                        <PenLine className="size-3.5" />
                        {updates === 0
                          ? "No updates yet — add the first"
                          : `${updates} ${updates === 1 ? "update" : "updates"} · add another`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {/* The nudge — one, gentle, and only when it's actually true. */}
        {nudge && nudgeDays >= 7 && (
          <div className="mb-11 flex items-center gap-4 rounded-2xl border border-border bg-[color-mix(in_srgb,var(--yellow)_14%,var(--surface))] px-5 py-4">
            <Sprout className="size-5 shrink-0 text-[var(--forest)]" />
            <p className="text-sm">
              <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                {nudge.title}
              </strong>{" "}
              hasn't moved in {nudgeDays} days. Even a photo counts as an update.
            </p>
            <Link to="/log" className="ml-auto shrink-0">
              <Button variant="coral" size="sm">
                Add an update
              </Button>
            </Link>
          </div>
        )}

        <Section
          title="From your Circles"
          copy="Work shared inside the Circles you've joined."
          action={{ label: "All Circles", to: "/circles" }}
        >
          {joinedCircles.length === 0 ? (
            <Empty to="/circles" cta="Browse Circles">
              You haven't joined a Circle yet. Circles are small groups built
              around doing a thing together — a skill level, a city, a project.
            </Empty>
          ) : fromCircles.length === 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {joinedCircles.slice(0, 4).map((circle) => (
                <Link
                  key={circle.id}
                  to="/circles"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                      {circle.name}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      This week: what are you working on?
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="columns-1 gap-4 sm:columns-2">
              {fromCircles.map((post) => (
                <ContentCard key={post.id} post={post} label="Circle" />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Hobbies you're exploring"
          copy="New work in the hobbies you chose to keep up with."
          action={{ label: "Manage", to: "/you" }}
        >
          {exploringWork.length === 0 ? (
            <Empty to="/discover" cta="Find a hobby">
              Keep exploring attaches you to a hobby rather than a person — so
              you see the craft develop, not somebody's posting habits.
            </Empty>
          ) : (
            <div className="columns-1 gap-4 sm:columns-2">
              {exploringWork.map((post) => (
                <ContentCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Projects still moving"
          copy="Ongoing work across NoSpace you could be part of."
          action={{ label: "Discover", to: "/discover" }}
        >
          <ul className="grid gap-3 sm:grid-cols-3">
            {nearbyProjects.map((project) => (
              <li key={project.key}>
                <Link
                  to={`/space/${project.hobbySlug}${project.subHobby ? `?hobby=${project.subHobby}` : ""}`}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)]"
                >
                  <span className="text-base" style={{ fontFamily: "var(--font-serif)" }}>
                    {project.title}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {project.creator} · {project.updates.length} updates
                  </span>
                  <span className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    {getHobby(project.hobbySlug)?.shortName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Saved ideas" copy="Things you kept to come back to." action={{ label: "All saved", to: "/you" }}>
          {savedWork.length === 0 ? (
            <Empty to="/discover" cta="Go to Discover">
              Nothing saved yet. Saving is for you — the maker never sees a score
              either way.
            </Empty>
          ) : (
            <div className="columns-1 gap-4 sm:columns-2">
              {savedWork.map((post) => (
                <ContentCard key={post.id} post={post} label="Saved" />
              ))}
            </div>
          )}
        </Section>

        <div className="flex flex-wrap items-center justify-center gap-3 rounded-3xl border border-border bg-card px-6 py-9 text-center">
          <p className="w-full text-sm text-muted-foreground">
            That's everything new in your space. Nothing loads below this.
          </p>
          <Link to="/log">
            <Button variant="coral">
              <PenLine className="size-4" />
              Log your progress
            </Button>
          </Link>
          <Link to="/discover">
            <Button variant="outline">
              <Bookmark className="size-4" />
              Explore a space
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
