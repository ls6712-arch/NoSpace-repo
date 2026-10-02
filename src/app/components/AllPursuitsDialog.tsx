import { Link } from "react-router";
import { Plus } from "lucide-react";
import { getHobby } from "../data/hobbies";
import { Project } from "../lib/journal";
import { startedLabel } from "../lib/pursuitTrail";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

function relative(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.44);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

/**
 * One section of the All your Pursuits list. Every row is a real link to
 * the Pursuit, in full-strength text — the old list set nearly everything
 * in muted type, which read as disabled — plus its own "Add" to log a
 * Moment without opening the Pursuit first.
 */
function AllPursuitsGroup({
  title,
  items,
  lastOf,
  onNavigate,
}: {
  title: string;
  items: Project[];
  lastOf: (p: Project) => number | undefined;
  onNavigate: () => void;
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
              <Link to={`/pursuit/${p.id}`} onClick={onNavigate} className="group min-w-0 flex-1">
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
                onClick={onNavigate}
                aria-label={`Log a Moment on ${p.title}`}
                className="flex shrink-0 items-center gap-1 rounded-control border border-border px-2.5 py-1 text-[11px] text-foreground hover:border-[var(--coral-deep)]"
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

/**
 * The "All your Pursuits" dialog — grouped In progress / Resting /
 * Completed, per docs/glossary.md's Pursuit statuses. Shared by every
 * "See all" entry point (PursuitsRail's right-rail list, the Home tab's
 * horizontal-scroll PursuitsInProgressSection) rather than each owning its
 * own copy of the same grouped list.
 */
export function AllPursuitsDialog({
  open,
  onOpenChange,
  active,
  resting,
  complete,
  lastOf,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  active: Project[];
  resting: Project[];
  complete: Project[];
  lastOf: (p: Project) => number | undefined;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>All your Pursuits</DialogTitle>
        </DialogHeader>
        <AllPursuitsGroup title="In progress" items={active} lastOf={lastOf} onNavigate={() => onOpenChange(false)} />
        <AllPursuitsGroup title="Resting" items={resting} lastOf={lastOf} onNavigate={() => onOpenChange(false)} />
        <AllPursuitsGroup title="Completed" items={complete} lastOf={lastOf} onNavigate={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
