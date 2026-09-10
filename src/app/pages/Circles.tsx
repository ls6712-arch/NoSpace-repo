import { useState } from "react";
import { Link } from "react-router";
import { Eye, HelpCircle, MapPin, PenLine, CalendarDays, Shield, Users } from "lucide-react";
import { Circle, circles } from "../data/circles";
import { getHobby } from "../data/hobbies";
import { useContent } from "../context/ContentContext";
import { useConnections } from "../context/ConnectionsContext";
import { Button } from "../components/ui/button";

/**
 * Circles are for doing, not for chatting. Each one leads with who it's for and
 * what it's asking of you this week, and every tab is a kind of participation —
 * updates, projects, questions, events — rather than one undifferentiated
 * stream of messages.
 *
 * Rules and moderators are visible before you join, not buried in a menu after.
 */
const TINTS = [
  "var(--pastel-sage)",
  "var(--pastel-stone)",
  "var(--pastel-clay)",
  "var(--pastel-sky)",
  "var(--pastel-wheat)",
  "var(--pastel-rose)",
];

const TABS = [
  { id: "updates", label: "Updates", icon: PenLine },
  { id: "projects", label: "Pursuits", icon: Users },
  { id: "questions", label: "Questions", icon: HelpCircle },
  { id: "events", label: "Events", icon: CalendarDays },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ACTIVITY_DOT: Record<Circle["activity"], string> = {
  Quiet: "var(--pastel-stone)",
  Steady: "var(--pastel-sage)",
  Busy: "var(--coral)",
};

function CircleCard({ circle, tint }: { circle: Circle; tint: string }) {
  const { isCircleJoined, joinCircle, leaveCircle, circleFeed, circleMemberCounts, refetchCircleMemberCounts } =
    useContent();
  const connections = useConnections();
  const [tab, setTab] = useState<TabId>("updates");
  // Two ways in: the local-only direct Join button (this browser, no
  // account needed), or a real invitation accepted from another account
  // (ConnectionsContext's circle_invites) — either counts as "joined" here.
  const locallyJoined = isCircleJoined(circle.id);
  const reallyJoined = connections.myCircleIds.includes(circle.id);
  const joined = locallyJoined || reallyJoined;
  // The static baseline plus real accepted invites (visible to everyone,
  // joined or not) plus this browser's own local join — but only if that
  // local join isn't the same membership already counted for real above,
  // or a real invite-accept would double the bump.
  const displayedMemberCount =
    circle.memberCount +
    (circleMemberCounts[circle.id] ?? 0) +
    (locallyJoined && !reallyJoined ? 1 : 0);
  const hobby = getHobby(circle.hobbySlug);
  const updates = circleFeed(circle.id);

  const emptyCopy: Record<TabId, string> = {
    updates: joined
      ? "No updates yet. Yours would be the first, a photo counts."
      : "Join to see what members are working on.",
    projects: "No shared pursuits running right now.",
    questions: "Nobody's asked anything yet. Ask for a second pair of eyes.",
    events: circle.location
      ? `No meetups on the calendar for ${circle.location} yet.`
      : "No events scheduled. This Circle meets online.",
  };

  return (
    <article
      className="rounded-2xl p-5"
      style={{
        backgroundColor: `color-mix(in srgb, ${tint} 12%, var(--surface))`,
        border: `1px solid color-mix(in srgb, ${tint} 28%, transparent)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base" style={{ fontFamily: "var(--font-serif)" }}>
            {circle.name}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{circle.purpose}</p>
        </div>
        <Button
          variant={joined ? "outline" : "coral"}
          size="sm"
          className="shrink-0"
          onClick={() => {
            if (joined) {
              // A real accepted invitation needs its own row updated, not
              // just the local flag — otherwise leaving would silently do
              // nothing for someone who joined that way.
              if (reallyJoined) {
                connections.leaveCircleInvite(circle.id).then(refetchCircleMemberCounts);
              }
              if (locallyJoined) leaveCircle(circle.id);
            } else {
              joinCircle(circle.id);
            }
          }}
        >
          {joined ? "Joined" : "Join"}
        </Button>
      </div>

      {/* Who's here, how busy, and who can read it */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <Users className="size-3" strokeWidth={1.8} />
          {displayedMemberCount.toLocaleString()} members
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: ACTIVITY_DOT[circle.activity] }}
            aria-hidden="true"
          />
          {circle.activity}
        </li>
        {circle.location && (
          <li className="flex items-center gap-1.5">
            <MapPin className="size-3" strokeWidth={1.8} />
            {circle.location}
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <Eye className="size-3" strokeWidth={1.8} />
          {circle.visibility}
        </li>
      </ul>

      {/* The current prompt — the thing the Circle is actually asking of you */}
      <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-surface px-4 py-3">
        <div className="text-[10px] uppercase tracking-wide text-[var(--coral-text)]">
          This week
        </div>
        <p className="mt-1 text-sm" style={{ fontFamily: "var(--font-serif)" }}>
          {circle.prompt}
        </p>
        <Link to={`/create?hobby=${circle.hobbySlug}`} className="mt-2 inline-block">
          <Button variant="coral" size="sm">
            <PenLine className="size-3.5" />
            Add an update
          </Button>
        </Link>
      </div>

      {/* Ways to take part */}
      <div className="mt-4">
        <div role="tablist" aria-label={`${circle.name} sections`} className="flex flex-wrap gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] transition-colors ${
                tab === id
                  ? "text-white [background-image:var(--gradient-brand)]"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-14 rounded-xl bg-surface px-4 py-3">
          {tab === "updates" && updates.length > 0 ? (
            <ul className="space-y-2">
              {updates.slice(0, 3).map((post) => (
                <li key={post.id} className="text-xs leading-relaxed">
                  <span className="text-foreground">{post.creator}</span>{" "}
                  <span className="text-muted-foreground">: {post.caption}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">{emptyCopy[tab]}</p>
          )}
        </div>
      </div>

      {/* House rules and who keeps them */}
      <details className="mt-3 group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
          <Shield className="size-3" strokeWidth={1.8} />
          Rules and moderators
        </summary>
        <ul className="mt-2 space-y-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
          {circle.rules.map((rule) => (
            <li key={rule} className="list-disc">
              {rule}
            </li>
          ))}
        </ul>
        <p className="mt-2 pl-4 text-[11px] text-muted-foreground">
          Moderated by {circle.moderators.join(" and ")}
          {hobby ? ` · ${hobby.shortName}` : ""}
        </p>
      </details>
    </article>
  );
}

/**
 * The Circles list itself, grouped by Space — no page chrome of its own, so
 * it can be dropped into a full /circles page or embedded as Discover's
 * Circles tab without either one duplicating this grouping/rendering logic.
 *
 * `query`, when set, filters by name/description/purpose/location — this is
 * what lets Discover's search box keep working after switching from the
 * Spaces tab to this one, instead of the query silently going nowhere.
 */
export function CirclesBrowser({ query = "" }: { query?: string }) {
  const q = query.trim().toLowerCase();
  const matching = q
    ? circles.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.purpose.toLowerCase().includes(q) ||
          (c.location ?? "").toLowerCase().includes(q),
      )
    : circles;

  const bySpace = new Map<string, Circle[]>();
  for (const circle of matching) {
    bySpace.set(circle.hobbySlug, [...(bySpace.get(circle.hobbySlug) ?? []), circle]);
  }

  if (q && bySpace.size === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted-foreground">
        No Circles match "{query}" yet.
      </p>
    );
  }

  return (
    <>
      {[...bySpace.entries()].map(([hobbySlug, list], groupIndex) => {
        const hobby = getHobby(hobbySlug);
        return (
          <section key={hobbySlug} className="mb-11">
            <div className="mb-3 flex items-end justify-between gap-4">
              <h2 className="text-xl" style={{ fontFamily: "var(--font-serif)" }}>
                {hobby?.name ?? hobbySlug}
              </h2>
              <Link
                to={`/space/${hobbySlug}`}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Open space →
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {list.map((circle, i) => (
                <CircleCard
                  key={circle.id}
                  circle={circle}
                  tint={TINTS[(groupIndex + i) % TINTS.length]}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

export function Circles() {
  return (
    <div className="min-h-screen bg-surface py-10 sm:py-14">
      <div className="container mx-auto max-w-4xl px-4">
        <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
          Circles
        </h1>
        <p className="mb-10 mt-2 max-w-xl text-lg text-muted-foreground">
          Smaller communities built around doing.
        </p>

        <CirclesBrowser />
      </div>
    </div>
  );
}
