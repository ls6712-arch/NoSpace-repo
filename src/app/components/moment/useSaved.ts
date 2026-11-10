import { toggleSaved, useJournalSlice } from "../../lib/journal";
import { syncBookmark } from "../../lib/bookmarksRemote";
import { haptic } from "../../lib/motionTokens";
import { notify } from "../ui/toaster";
import { TOAST } from "../../lib/stateCopy";
import { track } from "../../lib/analytics";

const TOLD_KEY = "soosh.saved-toast-shown";

/** The "Saved" toast shows the first time someone saves on this device, then never again. */
function tellOnce() {
  try {
    if (window.localStorage.getItem(TOLD_KEY) === "1") return;
    window.localStorage.setItem(TOLD_KEY, "1");
  } catch {
    // No storage (a private window): say it, since there is no way to know it was said.
  }
  notify(TOAST.bookmarked);
}

/**
 * Save, the one "I want this" on a Moment. Written on the device first so it is
 * instant (lib/journal.ts), then mirrored to the database (lib/bookmarksRemote.ts).
 */
export function useSaved(postId: number) {
  const saved = useJournalSlice((s) => s.saved.includes(postId));
  const toggle = () => {
    const next = !saved;
    toggleSaved(postId);
    void syncBookmark(postId, next);
    if (next) {
      haptic();
      tellOnce();
      track({ name: "moment_saved", postId });
    }
  };
  return { saved, toggle };
}
