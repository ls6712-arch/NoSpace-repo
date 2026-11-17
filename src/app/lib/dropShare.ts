import { createInvite } from "./invites";
import { dropLink, dropShareText, type Drop } from "./drops";

const KEY = (slug: string) => `soosh.dropInvite.${slug}`;

/**
 * One invite per drop per device: tapping Bring someone again reuses the same
 * code and does not spend another of your invites. Null when you have none to give.
 */
async function inviteCodeFor(slug: string): Promise<string | null> {
  try {
    const kept = localStorage.getItem(KEY(slug));
    if (kept) return kept;
  } catch {
    // No storage: make one each time.
  }
  const invite = await createInvite("").catch(() => null);
  const code = invite?.code ?? null;
  if (code) {
    try {
      localStorage.setItem(KEY(slug), code);
    } catch {
      // Not kept; the link still works.
    }
  }
  return code;
}

export type BringOutcome = "shared" | "copied" | "failed";

/**
 * Bring someone into a drop: one link that opens the drop itself. It carries
 * one of your invites when you have one to give, so the friend who signs up
 * from it is counted as yours; with none left it is the plain link, which works
 * the same for them. Opens the phone's share sheet, or copies the link.
 */
export async function bringSomeone(drop: Drop, now = Date.now()): Promise<BringOutcome> {
  const url = dropLink(drop.slug, await inviteCodeFor(drop.slug));
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: drop.title, text: dropShareText(drop, now), url });
      return "shared";
    }
  } catch {
    // Closing the share sheet is not an error.
    return "shared";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
