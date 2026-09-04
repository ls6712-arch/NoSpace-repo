import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Bell, CircleDot, Sprout } from "lucide-react";
import { circles } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { daysSince, useJournal } from "../lib/journal";
import { Button } from "./ui/button";

/**
 * Nudges, not notifications-as-engagement-bait. Everything here is derived
 * from things that are actually true right now — a project that hasn't moved,
 * a prompt open in a Circle you joined — rather than a count engineered to
 * pull you back. When there's nothing real to say, it says so.
 */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isCircleJoined } = useContent();
  const journal = useJournal();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const stalled = journal.projects
    .filter((p) => !p.finishedAt && daysSince(p.startedAt) >= 7)
    .slice(0, 3);
  const joined = circles.filter((c) => isCircleJoined(c.id)).slice(0, 3);
  const count = stalled.length + joined.length;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={count ? `Nudges (${count})` : "Nudges"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span
            className="absolute right-1.5 top-1.5 size-1.5 rounded-full [background-color:var(--coral-deep)]"
            aria-hidden="true"
          />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <div className="border-b border-[var(--hairline)] px-4 py-3 text-sm">Nudges</div>

          {count === 0 ? (
            <p className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
              Nothing needs you right now. Start a project or join a Circle and
              this is where the gentle reminders will show up.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {stalled.map((project) => (
                <li key={project.id}>
                  <Link
                    to="/log"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted"
                  >
                    <Sprout className="mt-0.5 size-4 shrink-0 text-[var(--coral-text)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{project.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        No update in {daysSince(project.startedAt)} days — add one?
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
              {joined.map((circle) => (
                <li key={circle.id}>
                  <Link
                    to="/circles"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted"
                  >
                    <CircleDot className="mt-0.5 size-4 shrink-0 text-[var(--forest)]" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{circle.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        This week: what are you working on?
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
