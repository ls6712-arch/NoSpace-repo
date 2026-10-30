/**
 * Home v2 wording that is not a one-liner in a component. Approved by the
 * founder on Oct 30, 2026 and listed in docs/glossary.md, Home v2.
 */

/** The Your week card when no free time is saved. */
export const ADD_FREE_TIME_COPY = "Add when you’re usually free";

/** The Week view (/week). Wording from the Week view brief, Oct 30, 2026; listed in docs/glossary.md, Week view. */
export const WEEK_VIEW = {
  title: "Your week",
  place: "New York",
  backToHome: "Back to Home",
  keyPlan: "Plan",
  keyFree: "Free",
  freeEvenings: "Free evenings you told us",
  change: "Change",
  monthlyBudget: "Monthly budget",
  findSomething: "Find something",
  bringSomeone: "Bring someone",
  flipTitle: "Sunday night, this week flips",
  flipBody: "Your Stubs from this week become one card you can share, and next week fills with new ideas.",
  changeFree: "Change when you’re free",
  noFreeTitle: "Tell us when you’re usually free",
} as const;

/** The Week page for someone not signed in. */
export const WEEK_SIGNED_OUT = {
  title: "Your week lives here",
  body: "Make an account to see your free time and your plans in one place.",
  cta: "Create an account",
};

/** Home's greeting when the person has no name on record. */
export const GREETING_NO_NAME = "Welcome back";
