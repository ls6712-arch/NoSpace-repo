/**
 * "Open this Moment at its thoughts." The Thoughts icon and "See thoughts" on a
 * card set this just before the surface opens the Moment; the opened Moment
 * reads it once and scrolls to its thoughts. It lives outside React so every
 * surface keeps its own way of opening a Moment (a URL param, local state).
 */
let wanted: number | null = null;

export function wantThoughts(postId: number): void {
  wanted = postId;
}

/** True once for the Moment that was asked for, then cleared. */
export function takeThoughtsIntent(postId: number): boolean {
  if (wanted !== postId) return false;
  wanted = null;
  return true;
}
