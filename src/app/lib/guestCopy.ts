import { plural } from "./plural";

/**
 * The words for Stubby's guests: sign-up prompts, the quick-context card, feedback on picks and
 * "Finish setting up". Every row marked NEW is waiting for the founder's approval (drafted from
 * docs/glossary.md, Nov 2, 2026); the rest are approved strings reused as written. Kept in one
 * place so an approved change is a one-line edit. Checked by copyRules.test.ts like all copy.
 */
export const GUEST_COPY = {
  /** Approved: the button for a new account. */
  signUp: "Sign up",
  /** Approved dismiss label. */
  notNow: "Not now",

  /** NEW: the inline card after a guest's 3rd ask. */
  inlineCard: (perDay: number) => `Sign up to keep your picks and get ${plural(perDay, "ask")} a day.`,

  /** Approved: the feature gate's title. */
  gateTitle: "Make an account to do that.",
  /** NEW: the feature gate's body, by feature. */
  gate: {
    plan: "Sign up to make this a plan.",
    calendar: "Sign up to add this to your calendar.",
    more: "Sign up to ask Stubby for more.",
    keep: "Sign up to keep your picks and get more asks a day.",
  },

  /** NEW: under Stubby's "That's N for today" line at the guest limit. {time} from dates.ts. */
  limit: (more: number, time: string) => `Sign up for ${plural(more, "more ask", "more asks")} today, or ask again after ${time}.`,
  /** NEW: Stubby's line when the guest cap is reached. */
  busy: "Lots of asks right now. Sign up to keep going.",
  /** Approved (founder, Nov 3, 2026): guests aren't open (anonymous sign-ins off, or the server isn't ready). */
  closed: "Log in to use Stubby.",
  /** Approved: Sign in / out is Log in, Log out. */
  logIn: "Log in",
  /** NEW: the toast after sign-up. */
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

  /** NEW: a Stubby account trying a Spaces, Moments, comments or messaging feature. */
  finishTitle: "Finish setting up",
  finishBody: "Finish setting up your account to join Spaces, log Moments and send messages.",
  finishButton: "Finish setting up",

  /** NEW: the quick-context card. */
  context: {
    line: "Three quick things so my first picks fit you.",
    /** Approved (onboarding). */
    interests: "What do you want more of?",
    city: "Your city",
    cityPlaceholder: "Neighborhood or city",
    useLocation: "Use my location",
    /** NEW */
    locationNote: "Only the city name is kept.",
    /** Approved (Stubby's line). */
    timing: "When are you free?",
    tonight: "Tonight",
    weekend: "This weekend",
    /** NEW */
    anytime: "Anytime",
    /** NEW */
    use: "Use these",
    /** Approved. */
    skip: "Skip",
  },

  /** NEW: screen reader labels on the thumb buttons. */
  goodPick: "Good pick",
  notForMe: "Not for me",
} as const;

/** "That’s N for today. I’ll look again tomorrow." with the day's own allowance (approved wording). */
export const outOfAsksLine = (perDay: number) => `That’s ${perDay} for today. I’ll look again tomorrow.`;
