/** How long "Post in 2 hours" keeps a new Moment to its owner. The database caps any hold at this. */
export const MOMENT_HOLD_MS = 2 * 60 * 60 * 1000;

/**
 * A new Moment is shown to others right away (posts.visible_at = now). "Post in 2 hours"
 * asks for a visible_at 2 hours out instead, so a Moment taken somewhere the person still is
 * shows up after they have left. The database clamps visible_at to [created_at, created_at + 2 hours].
 * visible_at is always sent, so a Moment is never held by accident whatever the column default is.
 */
export function withHold<T extends object>(row: T, postLater: boolean | undefined, now: number = Date.now()): T & { visible_at: string } {
  return { ...row, visible_at: new Date(postLater ? now + MOMENT_HOLD_MS : now).toISOString() };
}
