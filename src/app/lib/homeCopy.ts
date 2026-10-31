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
  keyPlan: "Plan",
  keyFree: "Free",
  cityPicks: "This week in New York",
  pickedBy: "Picked by Soosh",
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

/** The calendar for someone not signed in. Title approved Oct 31, 2026; body and button are the Week page's. */
export const CALENDAR_SIGNED_OUT = {
  title: "Your plans, Stubs and free time, in one place.",
  body: WEEK_SIGNED_OUT.body,
  cta: WEEK_SIGNED_OUT.cta,
};

/** Home's greeting when the person has no name on record. */
export const GREETING_NO_NAME = "Welcome back";

/** The admin page for "This week in New York" picks. Listed in docs/glossary.md, Week view. */
export const ADMIN_PICKS = {
  title: "City picks",
  line: "The hand-picked things on the Week view, This week in New York. Published picks show to everyone signed in.",
  add: "Add a pick",
  edit: "Edit pick",
  noAccessTitle: "Nothing here for you",
  noAccessBody: "This screen is for whoever manages City picks.",
  emptyTitle: "No picks yet.",
  emptyBody: "Add a pick, then publish it.",
  deleteBody: "This removes the pick for good.",
} as const;
