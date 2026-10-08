import { APP_NAME } from "../config";
import { useState } from "react";
import { X } from "lucide-react";
import { GeneratedArt } from "./GeneratedArt";

const KEY = "sushii.myspace.welcomeDismissed";

/** Local-first, same reasoning as lib/mySpaceVisit.ts: a "have you seen
 * this banner" flag is a per-browser convenience, not something any other
 * device or person needs to read — no account-wide table for it. */
function isDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Best effort — worst case it shows again next visit.
  }
}

/**
 * My Space's own explanation of itself — what makes this page different
 * from a ranked feed. Dismissible, not removed outright: closing it just
 * sets the same local flag lib/mySpaceVisit.ts's pattern already
 * established, so it quiets down after someone's actually seen it once
 * rather than nagging every visit, without needing a synced preference.
 */
export function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(isDismissed);

  if (dismissed) return null;

  return (
    <div className="myspace-welcome relative mb-6 overflow-hidden rounded-card border border-border bg-card">
      <div className="flex flex-col items-stretch gap-6 p-6 sm:flex-row sm:items-center sm:p-7">
        <div className="min-w-0 flex-1">
          <p className="ns-section-kicker text-gold-text">Welcome to {APP_NAME}</p>
          <h2 className="mt-2 text-title leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
            Your Home and your Shelf
          </h2>
          <p className="mt-3 max-w-2xl text-small leading-relaxed text-muted-foreground">
            Home shows Moments from the people and Spaces you follow.
            Your Shelf holds everything you have logged.
          </p>
        </div>
        <GeneratedArt
          hobbySlug="crafts-making"
          seed="myspace-welcome"
          className="h-28 w-full shrink-0 rounded-card sm:h-auto sm:w-40"
        />
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          dismiss();
          setDismissed(true);
        }}
        className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
