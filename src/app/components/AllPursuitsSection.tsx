import { Link } from "react-router";
import { Plus } from "lucide-react";
import { getHobby } from "../data/hobbies";
import { Project } from "../lib/journal";
import { startedLabel } from "../lib/pursuitTrail";

function relative(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.44);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

/** One section of the All your Pursuits list. Every row is a real link to
 * the Pursuit, in full-strength text, plus its own "Add" to log a Moment
 * without opening the Pursuit first. */
function AllPursuitsGroup({
  title,
  items,
  lastOf,
}: {
  title: string;
  items: Project[];
  lastOf: (p: Project) => number | undefined;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="ns-section-kicker mb-1 text-muted-foreground">
        {title} · {items.length}
      </p>
      <ul className="divide-y divide-border">
        {items.map((p) => {
          const last = lastOf(p);
          const space = p.hobbySlug ? getHobby(p.hobbySlug)?.shortName : p.customSpace || p.interest;
          return (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <Link to={`/pursuit/${p.id}`} className="group min-w-0 flex-1">
                <span
                  className="block truncate text-base text-foreground group-hover:text-accent"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {p.title}
                </span>
                <span className="block truncate text-xs text-foreground/80">
                  {[space, startedLabel(p.startedAt), last ? `last Moment ${relative(last)}` : "no Moments yet"]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
              <Link
                to={`/pursuit/${p.id}/moment`}
                aria-label={`Log a Moment on ${p.title}`}
                className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground hover:border-[var(--coral-deep)]"
              >
                <Plus className="size-3" /> Add
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The id every "See all" entry point scrolls to (lib/scrollToElement.ts) —
 * PursuitsInProgressSection's fixed bar and PursuitsRail's own "See all"
 * alike. `scroll-mt-16` below offsets for Header's fixed 4rem height so the
 * heading doesn't land tucked underneath it. */
export const ALL_PURSUITS_SECTION_ID = "all-pursuits";

/**
 * The full "All your Pursuits" list, grouped In progress / Resting /
 * Completed per docs/glossary.md's Pursuit statuses — an always-present
 * section further down the Home tab, not a dialog. Used to be a shared
 * modal (AllPursuitsDialog) both "See all" entry points opened; replaced
 * with real in-page navigation + smooth scrolling instead, so there's one
 * list on the page rather than one buried in an overlay.
 */
export function AllPursuitsSection({
  active,
  resting,
  complete,
  lastOf,
}: {
  active: Project[];
  resting: Project[];
  complete: Project[];
  lastOf: (p: Project) => number | undefined;
}) {
  if (active.length === 0 && resting.length === 0 && complete.length === 0) return null;
  return (
    <section id={ALL_PURSUITS_SECTION_ID} className="mt-10 scroll-mt-16 border-t border-border pt-8">
      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        All your Pursuits
      </h2>
      <div className="mt-4 space-y-6">
        <AllPursuitsGroup title="In progress" items={active} lastOf={lastOf} />
        <AllPursuitsGroup title="Resting" items={resting} lastOf={lastOf} />
        <AllPursuitsGroup title="Completed" items={complete} lastOf={lastOf} />
      </div>
    </section>
  );
}
