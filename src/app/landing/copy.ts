import { APP_NAME } from "../config";

/** Every line on the signed-out landing page, in one place. */
export const LANDING_COPY = {
  signUp: "Sign up",
  logIn: "Log in",
  heroHeadline: "Welcome to the rest of you.",
  heroSub: "Save what you want to try, go do it, and share who you’re becoming.",
  line: `LinkedIn has your job. Instagram has your highlights. ${APP_NAME} has the rest of you.`,
  stepsHeading: "Save it. Try it. Share it.",
  steps: [
    { label: "Save it.", line: "See something a friend did and want to try it? Save it for later." },
    { label: "Try it.", line: "Start it, and it goes on your Shelf right away, marked in progress." },
    { label: "Share it.", line: "Post as you go. When you’re done, mark it finished." },
  ],
  exampleCaption: "Example Shelf",
  exampleScreenCaption: "Example",
  rewardLine: `On ${APP_NAME}, the best feeling isn’t a like. It’s someone wanting to do what you did.`,
  comeAlongHeading: "Your friends can come along.",
  comeAlongLine: "Your friends don’t just watch what you do. Tap “Count me in” and do it together next time.",
  privacyHeading: "You choose who sees each post.",
  privacyLine: "Pick Only you, Followers or Public for each post. Nothing about your account has to be public.",
  shelvesHeading: `See who’s on ${APP_NAME}.`,
  joinHeading: `Join ${APP_NAME}.`,
  joinLine: "Create an account to get started.",
} as const;

/** Alt text for each real screen. */
export const LANDING_ALT = {
  hero: "Discover: ideas for what you could do, and Corners new to you.",
  save: "A friend’s post with the Save button.",
  try: "A Shelf item marked in progress.",
  share: "The same item on the Shelf, marked finished.",
  reward: "A notification saying 14 people want to try a post.",
  comeAlong: "A friend’s post with the Count me in button.",
  privacy: "The picker for choosing who sees a post.",
} as const;
