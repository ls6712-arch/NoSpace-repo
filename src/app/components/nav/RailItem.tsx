import type { ReactNode } from "react";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import { formatBadgeCount } from "../../lib/messageSync";

/**
 * One item on the left rail. Icon only from 744px (the name is the accessible
 * name and a tooltip on hover and keyboard focus), icon and words from 1280px.
 * A link when it goes somewhere (`to`), a button when it opens something
 * (`onClick`). A badge is a number on the icon, never hidden at any width.
 */
export function RailItem({
  icon: Icon,
  label,
  aria,
  to,
  onClick,
  active = false,
  expanded,
  badge = 0,
  accent = false,
  leading,
}: {
  icon?: LucideIcon;
  label: string;
  /** The accessible name when it is not the label. */
  aria?: string;
  to?: string;
  onClick?: () => void;
  active?: boolean;
  /** For an item that opens a panel. */
  expanded?: boolean;
  badge?: number;
  accent?: boolean;
  /** Replaces the icon (the avatar on You). */
  leading?: ReactNode;
}) {
  const name = aria ?? label;
  const shape = accent
    ? "[background-color:var(--accent)] text-[var(--accent-foreground)]"
    : active
      ? "text-accent-text"
      : "text-foreground hover:bg-surface-muted";
  const className = `group relative flex min-h-12 w-full items-center justify-center gap-3 rounded-control px-3 text-left transition-colors wide:justify-start ${shape}`;
  const body = (
    <>
      <span className="relative inline-flex size-6 shrink-0 items-center justify-center">
        {leading ?? (Icon && <Icon className="size-6" strokeWidth={accent ? 2.4 : 1.75} aria-hidden="true" />)}
        {badge > 0 && (
          <span
            className="absolute -right-2 -top-1.5 flex min-w-4 items-center justify-center rounded-full px-1 text-caption leading-4 text-on-brand tabular-nums [background-color:var(--coral-deep)]"
            aria-hidden="true"
          >
            {formatBadgeCount(badge)}
          </span>
        )}
      </span>
      <span className={`hidden text-body wide:inline ${active || accent ? "font-bold" : "font-medium"}`}>{label}</span>
      {/* Tooltip while only the icon shows: on hover and on keyboard focus. */}
      <span
        role="presentation"
        aria-hidden="true"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-control bg-foreground px-2.5 py-1.5 text-caption text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 wide:hidden"
      >
        {label}
      </span>
    </>
  );
  return to ? (
    <Link to={to} aria-label={name} aria-current={active ? "page" : undefined} className={className}>
      {body}
    </Link>
  ) : (
    <button type="button" aria-label={name} aria-expanded={expanded} onClick={onClick} className={className}>
      {body}
    </button>
  );
}
