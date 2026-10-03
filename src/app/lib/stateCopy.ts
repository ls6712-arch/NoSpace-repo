/**
 * Every line of loading / empty / error / done copy that isn't specific to
 * one screen lives here, so the app has one tone for these states instead
 * of each component writing its own. Wording follows docs/glossary.md
 * ("Saving, states and confirmations"); don't add a line here that isn't
 * in the glossary.
 */

/** Busy label inside a button while its save is in flight. */
export const BUSY_LABEL = "One sec…";

/** The one error tone. Shown with a TRY_AGAIN button wherever a retry is possible. */
export const ERROR_LINE = "Something went wrong. Mind trying again?";
export const LOAD_ERROR_LINE = "Something went wrong loading this. Mind trying again?";
export const TRY_AGAIN = "Try again";

export const OFFLINE_LINE = "You’re offline. Anything you’ve typed stays put.";
export const SLOW_LINE = "This is taking a while. Still trying.";

/** Quiet confirmations (toasts). */
export const TOAST = {
  changesSaved: "Changes saved",
  bookmarked: "Saved",
  linkCopied: "Link copied",
  inviteSent: "Invite sent",
  leftSpace: (name: string) => `You left ${name}`,
} as const;

/** Plain sentences for failure cases people can do something about. */
export const UPLOAD_COPY = {
  tooBig: (maxMb?: number) =>
    maxMb ? `That file is over ${maxMb} MB. Try a smaller one.` : "That file is too big. Try a smaller one.",
  wrongType: "That kind of file can’t be added. Try a JPG, PNG or WebP photo.",
  heic: "That iPhone photo couldn’t be converted. Try again, or export it as a JPG first.",
  heicMany: (n: number) =>
    n === 1
      ? "One iPhone photo couldn’t be converted and wasn’t added. Try again, or export it as a JPG first."
      : `${n} iPhone photos couldn’t be converted and weren’t added. Try again, or export them as JPGs first.`,
  failed: "That upload didn’t finish. Check your connection and try again.",
} as const;
