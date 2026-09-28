/**
 * The pure half of fetchSharedPursuit (sharedContent.ts) — kept in its own,
 * dependency-free module (not sharedContent.ts itself, which pulls in
 * ContentContext.tsx and, through it, SocialContext.tsx/heic2any) purely so
 * it's importable from a test without dragging a browser-only library into
 * a plain Vitest run.
 */

export interface SharedPursuitPreview {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  /** The Pursuit's own most recent photo Moment, or null if it has none
   * (or that Moment isn't visible to this viewer) — the card falls back to
   * its plain icon placeholder either way, same as a Moment card with no
   * media. */
  coverImage: string | null;
}

/**
 * Builds the preview from already-fetched pieces — pure, so "the owner
 * shown is always the Pursuit's row, never whoever's asking" is something a
 * test can pin down directly, rather than only inferred from reading the
 * two queries in fetchSharedPursuit. `pursuitRow.user_id` is the ONLY
 * source of the owner: this function has no notion of who sent the chat
 * message that's rendering this card, so a sender who isn't the owner
 * (sharing a Pursuit they don't own) can never leak into
 * `ownerName`/`ownerId` even by accident — there's simply no parameter for
 * it to arrive through.
 */
export function buildSharedPursuitPreview(
  pursuitRow: { id: string; title: string; user_id: string },
  ownerDisplayName: string | null | undefined,
  coverImage: string | null,
): SharedPursuitPreview {
  return {
    id: pursuitRow.id,
    title: pursuitRow.title,
    ownerId: pursuitRow.user_id,
    ownerName: ownerDisplayName?.trim() || "Someone",
    coverImage,
  };
}
