/** The local Moments counter never goes below what the account really has. */
export function reconcilePostsCreated(local: number, remote: number): number {
  return Math.max(local, remote);
}
