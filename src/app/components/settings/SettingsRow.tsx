import { ReactNode, useEffect, useState } from "react";
import { notify } from "../ui/toaster";
import { TOAST } from "../../lib/stateCopy";

/**
 * The one row pattern every setting in the redesigned /settings uses:
 * label + muted description on the left, a value or control on the right —
 * stacked below 640px (sm:), side by side at sm: and up. Rows live inside a
 * SettingsPanel, which supplies the hairline separators between them.
 */
export function SettingsRow({
  label,
  description,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
      <div className="min-w-0">
        <div className="text-small">{label}</div>
        {description && (
          <p className="mt-0.5 text-caption leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="min-w-0 sm:shrink-0 sm:text-right">{children}</div>
    </div>
  );
}

/** The bordered, 8px-radius card a section's rows sit inside, hairline
 * separators between them (not around the outside — the card's own border
 * already does that). */
export function SettingsPanel({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-[var(--hairline)] rounded-control border border-border bg-card">
      {children}
    </div>
  );
}

/** "Saved" — small caps, fades out after 3s. Call `flash()` right after a
 * successful save; every save-on-change control (Switch, radio, select)
 * uses this same confirmation rather than each inventing its own. */
/**
 * A settings change landed. Confirms with the app's quiet toast
 * ("Changes saved") rather than an inline word, so every save in the app
 * confirms the same way. `saved`/SavedFlash stay for existing call sites
 * and now render nothing.
 */
export function useSavedFlash() {
  return { saved: false, flash: () => notify(TOAST.changesSaved) };
}

export function SavedFlash(_props: { show: boolean }) {
  return null;
}
