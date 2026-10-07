import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, Search, Share2, X } from "lucide-react";
import { pursuitCorner } from "../lib/pursuitProgress";
import { Project } from "../lib/journal";
import { startedLabel } from "../lib/pursuitTrail";
import { formatWhen } from "../lib/dates";
import { PursuitShareDialog } from "./PursuitShareDialog";
import { track } from "../lib/analytics";
import { plural } from "../lib/plural";

function relative(ms: number): string {
  return formatWhen(ms, { ago: true });
}

/** The Space name shown (and searched) for a Pursuit — same resolution
 * AllPursuitsGroup already displays, pulled out so search matches exactly
 * what's on screen. */
function spaceNameOf(p: Project): string | undefined {
  return pursuitCorner(p);
}

/** One row — its own component (not inlined in the .map() below) purely so
 * it can own its own share-dialog open state; a hook can't live inside a
 * loop body. */
function AllPursuitsRow({ pursuit: p, last }: { pursuit: Project; last: number | undefined }) {
  const [shareOpen, setShareOpen] = useState(false);
  const space = spaceNameOf(p);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link to={`/pursuit/${p.id}`} className="group min-w-0 flex-1">
        <span
          className="block truncate text-body text-foreground group-hover:text-accent"
          style={{ fontFamily: "var(--font-serif)" }}
                 title={p.title}>
          {p.title}
        </span>
        <span className="block truncate text-caption text-foreground/80" title={[space, startedLabel(p.startedAt), last ? `last Moment ${relative(last)}` : "no Moments yet"]
                    .filter(Boolean)
                    .join(" · ")}>
          {[space, startedLabel(p.startedAt), last ? `Last Moment ${relative(last)}` : "No Moments yet"]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => {
          track({ name: "pursuit_share_opened", pursuitId: p.id, from: "all_pursuits_row" });
          setShareOpen(true);
        }}
        aria-label={`Share ${p.title}`}
        className="flex shrink-0 items-center justify-center rounded-full border border-border p-1.5 text-foreground hover:border-[var(--coral-deep)]"
      >
        <Share2 className="size-3" />
      </button>
      <Link
        to={`/create?pursuit=${p.id}`}
        aria-label={`Log a Moment on ${p.title}`}
        className="flex shrink-0 items-center gap-1 rounded-control border border-border px-2.5 py-1 text-caption text-foreground hover:border-[var(--coral-deep)]"
      >
        <Plus className="size-3" /> Add
      </Link>
      <PursuitShareDialog open={shareOpen} onOpenChange={setShareOpen} project={p} />
    </li>
  );
}

/** One section of the All your Pursuits list. Every row is a real link to
 * the Pursuit, in full-strength text, plus its own Share and "Add" (log a
 * Moment without opening the Pursuit first). */
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
        {items.map((p) => (
          <AllPursuitsRow key={p.id} pursuit={p} last={lastOf(p)} />
        ))}
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
      className={`flex h-8 items-center justify-center gap-1 rounded-full border px-3 text-caption transition-colors ${
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

  const total = active.length + resting.length + complete.length;
  const hasAny = total > 0;

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
    <section id={ALL_PURSUITS_SECTION_ID} className="mt-12 scroll-mt-16 border-t border-border pt-8">
      <h2 className="text-lead" style={{ fontFamily: "var(--font-serif)" }}>
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
          className="h-11 w-full rounded-control border border-border bg-card pl-9 pr-9 text-body outline-none focus:border-[var(--coral-deep)]"
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

      {/* Counts here are the raw, un-searched totals — a stable "at a
          glance" reference that doesn’t flicker as the search box above is
          typed into. The "N Pursuits matching" line below carries the
          search-filtered count instead. */}
      <div className="mt-3 flex flex-wrap gap-x-2 gap-y-3" role="group" aria-label="Filter by status">
        <StatusChip active={status === "all"} onClick={() => setStatus("all")}>
          All · {total}
        </StatusChip>
        <StatusChip active={status === "active"} onClick={() => setStatus("active")}>
          In progress · {active.length}
        </StatusChip>
        <StatusChip active={status === "resting"} onClick={() => setStatus("resting")}>
          Paused · {resting.length}
        </StatusChip>
        <StatusChip active={status === "complete"} onClick={() => setStatus("complete")}>
          Finished · {complete.length}
        </StatusChip>
      </div>

      <p className="mt-3 text-caption text-muted-foreground" role="status" aria-live="polite">
        {plural(shownTotal, "Pursuit")}
        {filtersApplied ? " matching" : ""}
      </p>

      {shownTotal === 0 ? (
        <div className="mt-3 rounded-card border border-dashed border-border px-5 py-8 text-center text-small text-muted-foreground">
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
          <AllPursuitsGroup title="Paused" items={shownResting} lastOf={lastOf} />
          <AllPursuitsGroup title="Finished" items={shownComplete} lastOf={lastOf} />
        </div>
      )}
    </section>
  );
}
