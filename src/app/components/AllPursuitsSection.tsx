import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, Search, X } from "lucide-react";
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

/** The Space name shown (and searched) for a Pursuit — same resolution
 * AllPursuitsGroup already displays, pulled out so search matches exactly
 * what's on screen. */
function spaceNameOf(p: Project): string | undefined {
  return p.hobbySlug ? getHobby(p.hobbySlug)?.shortName : p.customSpace || p.interest;
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
          const space = spaceNameOf(p);
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

type StatusFilter = "all" | "active" | "resting" | "complete";

/** Same active/inactive look CreatePursuit.tsx's own ChipButton already
 * uses for this kind of single-pick toggle group. */
function StatusChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-8 items-center justify-center gap-1 rounded-full border px-3 text-xs transition-colors ${
        active
          ? "border-[var(--coral)] bg-[color-mix(in_srgb,var(--coral)_12%,var(--card))] text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
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
 *
 * Search + status filter, both client-side: every Pursuit here is already
 * loaded in memory (lib/journal.ts is local-first — there's no paginated
 * search API to call, and typically at most a few dozen Pursuits, so no
 * debounce/throttle or loading state either — filtering a plain array on
 * every keystroke is effectively free at this size). Matches against the
 * same title/Space text each row already shows, never an internal-only
 * field like Category (never shown to users, per CLAUDE.md).
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
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const hasAny = active.length > 0 || resting.length > 0 || complete.length > 0;

  const matchesQuery = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return () => true;
    return (p: Project) => p.title.toLowerCase().includes(q) || (spaceNameOf(p)?.toLowerCase().includes(q) ?? false);
  }, [query]);

  const shownActive = status === "all" || status === "active" ? active.filter(matchesQuery) : [];
  const shownResting = status === "all" || status === "resting" ? resting.filter(matchesQuery) : [];
  const shownComplete = status === "all" || status === "complete" ? complete.filter(matchesQuery) : [];
  const shownTotal = shownActive.length + shownResting.length + shownComplete.length;
  const filtersApplied = query.trim() !== "" || status !== "all";

  const clearFilters = () => {
    setQuery("");
    setStatus("all");
  };

  if (!hasAny) return null;

  return (
    <section id={ALL_PURSUITS_SECTION_ID} className="mt-10 scroll-mt-16 border-t border-border pt-8">
      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        All your Pursuits
      </h2>

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your Pursuits"
          aria-label="Search your Pursuits"
          className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-9 text-sm outline-none focus:border-[var(--coral-deep)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <StatusChip active={status === "all"} onClick={() => setStatus("all")}>
          All
        </StatusChip>
        <StatusChip active={status === "active"} onClick={() => setStatus("active")}>
          In progress
        </StatusChip>
        <StatusChip active={status === "resting"} onClick={() => setStatus("resting")}>
          Resting
        </StatusChip>
        <StatusChip active={status === "complete"} onClick={() => setStatus("complete")}>
          Completed
        </StatusChip>
      </div>

      <p className="mt-3 text-xs text-muted-foreground" role="status" aria-live="polite">
        {shownTotal} Pursuit{shownTotal === 1 ? "" : "s"}
        {filtersApplied ? " matching" : ""}
      </p>

      {shownTotal === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          {query.trim() ? (
            <>No Pursuits match "{query.trim()}".</>
          ) : (
            <>No Pursuits in this status.</>
          )}{" "}
          <button type="button" onClick={clearFilters} className="text-accent hover:underline">
            Clear filters
          </button>
          .
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <AllPursuitsGroup title="In progress" items={shownActive} lastOf={lastOf} />
          <AllPursuitsGroup title="Resting" items={shownResting} lastOf={lastOf} />
          <AllPursuitsGroup title="Completed" items={shownComplete} lastOf={lastOf} />
        </div>
      )}
    </section>
  );
}
