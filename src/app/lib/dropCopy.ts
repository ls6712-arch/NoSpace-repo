/**
 * Every line a drop's screens say that is not built from its own data
 * (docs/glossary.md, "Drops in the app"). One place, so Home, the drop's page
 * and the reveal can never word the same thing two ways.
 */
export const DROP_COPY = {
  /** Small line over a drop's title, the same words its Stub prints. */
  kicker: "Soosh drop",
  join: "I’m in",
  log: "Log a Moment",
  bring: "Bring someone",
  share: "Share",
  signUp: "Sign up",
  logIn: "Log in",
  closed: "That one has closed.",
  /** Signed out, under the drop. */
  signedOut: "Free, and it opens in your browser.",
  /** Joined, nothing logged yet. */
  joined: "You’re in. Do it, then log a Moment with a photo.",
  /** After you finish, while it is still open. */
  kept: "Your Stub is on your Shelf. The last number is not known until it closes.",
  linkCopied: "Link copied",
  linkFailed: "Couldn’t share the link. Try again.",
  imageSaved: "Saved to your downloads",
  imageFailed: "Couldn’t make the image. Try again.",
} as const;

/** "{Name} wants to do this with you." Shown to someone who opened a friend's link. */
export const invitedLine = (name: string): string => `${name.trim().split(/\s+/)[0]} wants to do this with you.`;
