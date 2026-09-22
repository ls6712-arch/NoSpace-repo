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
    <div className="myspace-welcome relative mb-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-col items-stretch gap-6 p-6 sm:flex-row sm:items-center sm:p-7">
        <div className="min-w-0 flex-1">
          <p className="ns-section-kicker text-gold-text">WELCOME TO MY SPACE</p>
          <h2 className="mt-2 text-xl leading-snug sm:text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
            The one page here that is not ranked, curated, or competing for your time
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Your Contact Sheet holds real days from the people and Spaces you follow.
            Nothing algorithmic, nothing inserted. The Shelf tracks what you have
            actually bound. Both grow only as honestly, and only as quickly, as you do.
          </p>
        </div>
        <GeneratedArt
          hobbySlug="crafts-making"
          seed="myspace-welcome"
          className="h-28 w-full shrink-0 rounded-xl sm:h-auto sm:w-40"
        />
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          dismiss();
          setDismissed(true);
        }}
        className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
