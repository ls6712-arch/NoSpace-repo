import { APP_NAME } from "../config";
import { plural } from "./plural";

/**
 * The words for Stubby's guests: sign-up prompts, the quick-context card, feedback on picks,
 * "Finish setting up", and the birthday lines (21+ picks, under 18, locked). Every line here is
 * approved: the new ones by the founder on Nov 3, 2026 (recorded in docs/glossary.md), the rest
 * reused as written. Kept in one place so an approved change is a one-line edit. Checked by
 * copyRules.test.ts like all copy.
 *
 * No number or time is written into a line (founder, Nov 3, 2026): each comes in as a value, the
 * allowances from the server's own status reply (with the config in stubbyAsk.ts until it answers),
 * times through dates.ts in the person's own time zone, ages from lib/age.ts. guestCopy.test.ts
 * checks that no line has a digit of its own.
 */
export const GUEST_COPY = {
  /** Approved: the button for a new account. */
  signUp: "Sign up",
  /** Approved dismiss label. */
  notNow: "Not now",

  /** The inline card after a guest's 3rd ask. {perDay}: an account's daily asks, from the server. */
  inlineCard: (perDay: number) => `Sign up to keep your picks and get ${plural(perDay, "ask")} a day.`,

  /** Approved: the feature gate's title. */
  gateTitle: "Make an account to do that.",
  /** The sign-up sheet's body, by feature. */
  gate: {
    plan: "Sign up to make this a plan.",
    calendar: "Sign up to add this to your calendar.",
    more: "Sign up to ask Stubby for more.",
  },
  /** The sign-up sheet's body when no feature asked for it: the same line as the inline card. */
  gateKeep: (perDay: number) => `Sign up to keep your picks and get ${plural(perDay, "ask")} a day.`,

  /** Under Stubby's "That's N for today" line at the guest limit. {more} from the server; {time} from dates.ts, local time. */
  limit: (more: number, time: string) => `Sign up for ${plural(more, "more ask", "more asks")} today, or ask again after ${time}.`,
  /** Stubby's line when the guest cap is reached. */
  busy: "Lots of asks right now. Sign up to keep going.",
  /** Approved (founder, Nov 3, 2026): guests aren't open (anonymous sign-ins off, or the server isn't ready). */
  closed: "Log in to use Stubby.",
  /** Approved: Sign in / out is Log in, Log out. */
  logIn: "Log in",
  /** The toast after sign-up. */
  signedUp: "You’re in. Your picks are saved.",

  /** Approved (onboarding, account screens). */
  google: "Continue with Google",
  apple: "Continue with Apple",
  email: "Continue with email",
  /** Approved: the code screen's field and button words. */
  codeLabel: "Code",
  emailLabel: "Email",
  sendCode: "Send me a code",
  /** Approved: the generic retry line. */
  error: "Something went wrong on my end. Try again?",

  /** A Stubby account trying a Spaces, Moments, comments or messaging feature. */
  finishTitle: "Finish setting up",
  finishBody: "Finish setting up your account to join Spaces, log Moments and send messages.",
  /** The founder's change (Nov 3, 2026): the button says what happens, the title stays. */
  finishButton: "Set up now",

  /** The quick-context card. */
  context: {
    line: "Three quick things so my first picks fit you.",
    /** Approved (onboarding). */
    interests: "What do you want more of?",
    city: "Your city",
    cityPlaceholder: "Neighborhood or city",
    useLocation: "Use my location",
    locationNote: "Only the city name is kept.",
    /** Approved (Stubby's line). */
    timing: "When are you free?",
    tonight: "Tonight",
    weekend: "This weekend",
    anytime: "Anytime",
    use: "Use these",
    /** Approved. */
    skip: "Skip",
  },

  /** Screen reader labels on the thumb buttons. */
  goodPick: "Good pick",
  notForMe: "Not for me",
} as const;

/**
 * Birthdays after onboarding (20261111000150_birthdate_rules.sql). The sheet reuses onboarding's
 * approved words (BirthdayScreen.tsx) as they are; the ages come from lib/age.ts.
 */
export const BIRTHDAY_COPY = {
  /** Under the picks, only when 21+ picks were left out because no birthday is on file. */
  adultPrompt: (adultAge: number) => `Add your birthday to see ${adultAge}+ picks.`,
  /** Approved onboarding words. */
  add: "Add your birthday",
  title: "When’s your birthday?",
  label: "Date of birth",
  hint: "Never shown to anyone.",
  badDate: "That date doesn’t look right.",
  saveFailed: "Couldn’t add it. Try again.",
  notNow: "Not now",
  /** After an under-18 date: onboarding's approved line, then the founder's (Nov 3, 2026). */
  under18: (minAge: number) => `${APP_NAME} is for people ${minAge} and over for now.`,
  under18Note: "Your account stays, and you can keep using Stubby.",
  done: "Done",
  /** The button an under-18 account sees on a members-only page. */
  backToStubby: "Back to Stubby",
  /** Trying to change a birthday already on file; followed by SUPPORT_CONTACT's link. */
  locked: "Your birthday can’t be changed here. To fix it, contact support.",
} as const;

/** "That’s N for today. I’ll look again tomorrow." with the day's own allowance (approved wording). */
export const outOfAsksLine = (perDay: number) => `That’s ${perDay} for today. I’ll look again tomorrow.`;
