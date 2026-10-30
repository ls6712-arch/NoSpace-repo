/** A Pursuit invite link, as the sign-up flow carries it in `?redirect=`. */
export function joinTokenFrom(redirectTo: string): string | null {
  return /^\/join\/([^/?#]+)/.exec(redirectTo)?.[1] ?? null;
}
