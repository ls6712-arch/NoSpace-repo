import type { HTMLAttributes, ReactNode } from "react";

/**
 * The one page layout for every tab page (Home, Discover, Search, Week, Chats,
 * Notifications, You, Settings). Nothing sets its own width, title size or top
 * offset.
 *
 * - Container: centred in the space right of the rail, content at most 1040px,
 *   gutters 16px on a phone, 24px from `tab` and 32px from `desk`.
 * - Header: the same top offset everywhere; the title in `text-title`
 *   (28px/800 Bricolage), an optional one-line subtitle in the muted colour, an
 *   optional action on the right. No back arrow: tab pages are not drilled into.
 *   `kicker` is the one extra line, above the title, for Discover's "What's out
 *   there in" over the city.
 * - Grids: lists are `PAGE_GRID` (one column, two from `desk`). A single-purpose
 *   card (Your week, Best fit for you, the glance card) spans both columns:
 *   `SPAN_GRID`. That is the one rule for those cards, on every page.
 */
export const PAGE_GRID = "grid gap-6 desk:grid-cols-2";
export const SPAN_GRID = "desk:col-span-2";
/** A list inside a grid cell or on its own: one column, two from `desk`. */
export const LIST_GRID = "grid gap-3 desk:grid-cols-2 desk:gap-4";

/** The container alone, for a page you drill into (another person's profile) that keeps its own back bar. */
export function PageContainer({ children, ...rest }: { children?: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="w-full px-4 pb-10 pt-4 tab:px-6 desk:px-8 max-desk:pt-[calc(var(--safe-top)+1rem)]" {...rest}>
      <div className="mx-auto w-full max-w-[1040px]">{children}</div>
    </div>
  );
}

export function PageShell({
  title,
  kicker,
  subtitle,
  action,
  topBar,
  children,
  ...rest
}: {
  title: ReactNode;
  kicker?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** A bar above the header that only some screens have (Home's pull-to-refresh line). */
  topBar?: ReactNode;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "title">) {
  return (
    <div className="w-full px-4 pb-10 pt-4 tab:px-6 desk:px-8 max-desk:pt-[calc(var(--safe-top)+1rem)]" {...rest}>
      <div className="mx-auto w-full max-w-[1040px]">
        {topBar}
        <header className="mb-6">
          <div className="flex min-h-11 items-start justify-between gap-4">
            <div className="min-w-0">
              {kicker && <p className="text-body text-muted-foreground">{kicker}</p>}
              <h1 className="text-title">{title}</h1>
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
          {/* Under the whole row, so the action never squeezes it onto a second line. */}
          {subtitle && <p className="mt-1 text-small text-muted-foreground">{subtitle}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}
