/**
 * The calendar's sheet and toast wording (calendar brief section 8, Oct 31,
 * 2026), listed in docs/glossary.md under Calendar. Sentence case, no dashes.
 */
export const SHEET = {
  makePlan: "Make a plan",
  makePlanAt: (time: string) => `Make a plan at ${time}`,
  imFree: "I’m free then",
  blockThis: "Block this time",
  justThis: (day: string) => `Just this ${day}`,
  every: (day: string) => `Every ${day}`,
  once: "Just this once",
  everyWeek: "Every week",
  note: "Note",
  noteHint: "Only you see this.",
  save: "Save",
  back: "Back",
  corner: "Corner",
  findCorner: "Find a Corner",
  yourCorners: "Your Corners",
  allCorners: "All Corners",
  noCorner: "No Corner matches.",
  day: "Day",
  when: "When",
  daytime: "Daytime",
  evening: "Evening",
  exactTime: "Exact time (optional)",
  friend: "Bring a friend (optional)",
  nobody: "Just me",
  makeIt: "Make the plan",
  changeTime: "Change the time",
  changeMyTime: "Change my time",
  moveSession: "Move this session",
  bringSomeone: "Bring someone",
  cancelPlan: "Cancel this plan",
  leavePlan: "Leave this plan",
  skipSession: "Skip this session",
  openPursuit: "Open Pursuit",
  openStart: "Open",
  changeTimes: "Change the times",
  notFree: (day: string) => `Not free this ${day}`,
  removeUsual: "Remove from my usual week",
  change: "Change",
  removeBlock: "Remove block",
  removeFree: "Remove free time",
  yourBlock: "Your block",
  stubbysPick: "Stubby’s pick",
  /** The in-slot pick's button that makes a plan straight away (was Keep; Keep now only shortlists, in the deck). Approved Nov 2, 2026. */
  keep: "Make it a plan",
  askToJoin: "Ask to join",
  /** Was Not this: not this time, it can come around again (approved Nov 2, 2026). */
  notThis: "Not now",
  findSomething: "Find something",
  stub: "Stub",
  hostedLine: "The host sets this time.",
  start: "Start",
  end: "End",
} as const;

export const CHANGED = {
  planMade: "Plan made",
  planRemoved: "Plan cancelled",
  planLeft: "You left the plan",
  sessionSkipped: "Session skipped",
  timeChanged: "Time changed",
  freeAdded: "Free time added",
  freeRemoved: "Free time removed",
  notFree: "Marked not free",
  blockAdded: "Block added",
  blockRemoved: "Block removed",
  blockChanged: "Block changed",
  usualRemoved: "Removed from your usual week",
  kept: "Plan made",
  requested: "Request sent",
} as const;

/** The subscribe link: the design's "Your calendars" section, and the same link in Settings. */
export const SUBSCRIBE = {
  heading: "Your calendars",
  title: "Soosh in your calendar",
  hint: "Your plans appear in Google, Apple or Outlook.",
  copy: "Copy subscribe link",
  reset: "Reset link",
  resetHint: "Your old link will stop working, including in any calendar using it.",
  elsewhere: "This device doesn’t have your link. Reset it to get a new one here.",
} as const;

/** Asking Stubby, in the Calendar stage (glossary, Calendar: asking Stubby; and Ask Stubby: the Stubby plan). */
export const ASK_COPY = {
  /** The stage's accessible name, and the button. */
  button: "Ask Stubby",
  label: "What are you in the mood for?",
  placeholder: "Pottery on Saturday, a free run, something outdoors",
  busy: "Looking",
  nothing: "Nothing fit this time. Try asking another way.",
  /** The deck's name, and the label on each card: the same words as his picks in a free slot, one word per idea (founder, Nov 3, 2026; was "Found for you"). */
  listLabel: "Stubby’s picks",
  cardLabel: "Stubby’s pick",
  /** The label on a do-it-yourself pick, instead of a dated ticket (approved Nov 2, 2026). */
  ideaLabel: "An idea",
  open: "Open",
  remove: "Remove",
  /** Quick ideas under the field: each fills it in and asks (one ask, like typing). New, for approval. */
  chipsLabel: "Quick ideas",
  chips: ["Free tonight", "This weekend", "Something outdoors"],
  /** The slim bar at the top of Calendar once the stage scrolls out of view (approved Nov 2, 2026). */
  sticky: "Ask Stubby…",
  /** His steps while he looks, and what stops or repeats an ask (stubby-plan §7, approved Nov 2, 2026). */
  lookingFor: (what: string) => `Looking for: ${what}`,
  picking: "Picking the best for you",
  stop: "Stop",
  earlier: "Earlier today",
  /** The deck and Your selection (stubby-plan §6.5, approved Nov 2, 2026). */
  keep: "Keep",
  notNow: "Not now",
  bringBack: "Bring it back",
  selection: "Your selection",
  makePlan: "Make it a plan",
  seeSkipped: "See the ones you skipped",
  askAgain: "Ask again",
  goToSelection: "Go to your selection",
  count: (n: number, total: number) => `${n} of ${total}`,
  /** Follow-ups under the deck: each adds cards to the back (approved Nov 2, 2026). */
  followUps: [
    { kind: "cheaper", label: "Cheaper" },
    { kind: "closer", label: "Closer" },
    { kind: "later", label: "Later" },
    { kind: "different", label: "Something different" },
    { kind: "more", label: "More like this" },
  ] as const,
} as const;

/**
 * What Stubby understood from an ask, shown as chips at once (stubby-plan §4). The same words
 * as his question chips (approved Nov 2, 2026); a "when" or "who" with no chip of its own
 * isn't shown.
 */
export const UNDERSTOOD_COPY = {
  when: { tonight: "Tonight", tomorrow: "Tomorrow", weekend: "This weekend" } as Record<string, string>,
  who: { solo: "Just me", partner: "With my partner", friends: "With friends", family: "With family" } as Record<string, string>,
};

/** Stubby's one question, answered with a tap (stubby-plan §5, approved Nov 2, 2026). */
export const QUESTION_COPY = {
  /** The answers to "Stay in or head out?" (stubby-agent C4, approved Nov 3, 2026). */
  setting: [
    { label: "Stay in", setting: "in" },
    { label: "Head out", setting: "out" },
  ] as const,
  who: [
    { label: "Just me", who: "solo" },
    { label: "With my partner", who: "partner" },
    { label: "With friends", who: "friends" },
    { label: "With family", who: "family" },
  ] as const,
  when: [
    { label: "Tonight", when: "tonight" },
    { label: "Tomorrow", when: "tomorrow" },
    { label: "This weekend", when: "weekend" },
  ] as const,
  pickADay: "Pick a day",
  what: ["Active", "Make something", "Food & drink", "Chill", "Learn something"] as const,
  surprise: "Surprise me",
};

/**
 * When nothing fits: the honest line, then why, as one short line of the 3 most common reasons
 * ("2 were listing pages, 1 was after midnight"), then three ways on (approved Nov 2, 2026).
 */
/**
 * Stay in, answered from their own Pursuits and Corners (hotfix, Nov 3, 2026). Every string is
 * already in docs/glossary.md: the At-home badge, What you’ll need, Head out, Start a Pursuit,
 * Go to Discover, and the nothing-fit line.
 */
/**
 * The care card (stubby-agent C1). The line is the brief's own; the rest is new, for approval
 * (docs/glossary.md). Resource labels come from the function's reviewed list (careResources.ts).
 */
export const CARE_COPY = {
  resourcesLabel: "Someone to talk to",
};

export const STAY_IN_COPY = {
  badge: "At home",
  needs: "What you’ll need",
  nothing: "Nothing fit this time. Try asking another way.",
  headOut: "Head out",
  startPursuit: "Start a Pursuit",
  discover: "Go to Discover",
};

export const EMPTY_COPY = {
  reasons: {
    listing: ["was a listing page", "were listing pages"],
    midnight: ["was after midnight", "were after midnight"],
    time: ["was outside the time you asked for", "were outside the time you asked for"],
    budget: ["was over your budget", "were over your budget"],
    /** Only free things were asked for and the page gives no price (approved Nov 3, 2026). */
    noprice: ["had no price listed", "had no price listed"],
    adult: ["was a bar or 21+", "were bars or 21+"],
    nopage: ["had no page of its own", "had no page of their own"],
    notime: ["had no clear time", "had no clear time"],
    family: ["was too late for kids", "were too late for kids"],
  } as Record<string, [string, string]>,
  weekend: "This weekend",
  surprise: "Surprise me",
  differentWords: "Try different words",
};

