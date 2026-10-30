/**
 * A new Moment is held back from everyone else for 2 hours (posts.visible_at,
 * set by the database). "Share now" asks for a visible_at at the moment of
 * posting; the database clamps it to the Moment's created_at.
 */
export function withShareNow<T extends object>(row: T, shareNow: boolean | undefined, now: number = Date.now()): T | (T & { visible_at: string }) {
  return shareNow ? { ...row, visible_at: new Date(now).toISOString() } : row;
}
