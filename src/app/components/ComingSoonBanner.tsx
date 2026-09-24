import { Clock } from "lucide-react";

/**
 * The one "buying isn't live yet" notice, shared by every place someone can
 * browse listings (the global /shop page, Discover's Marketplace tab, and
 * each Space's own Marketplace tab) so the wording and look can't drift
 * between them.
 */
export function ComingSoonBanner({
  title = "Marketplace — coming soon",
  description = "Browse what's here — buying isn't live yet.",
  className = "",
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={`mb-8 flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-4 py-3 ${className}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
        <Clock className="size-4" />
      </span>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
