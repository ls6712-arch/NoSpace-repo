export interface Circle {
  id: number;
  hobbySlug: string;
  name: string;
  /** Undefined = global circle. Set = a geographic sub-layer within the hobby. */
  location?: string;
  description: string;
  memberCount: number;
  /** Who this Circle is for, in one line — shown before anyone joins. */
  purpose: string;
  /** How busy it actually is, so "3,402 members" isn't the only signal. */
  activity: "Quiet" | "Steady" | "Busy";
  /** The open prompt right now. Circles are for doing, so there is always one. */
  prompt: string;
  /** Plain-language house rules. Three is enough for anyone to actually read them. */
  rules: string[];
  moderators: string[];
  /** Whether non-members can read it, stated up front rather than discovered. */
  visibility: "Open to read" | "Members only";
}

export const circles: Circle[] = [
  // Workbench
  {
    id: 1,
    hobbySlug: "workbench",
    name: "Crafting Beginners",
    description: "Just starting out with any tactile craft — questions welcome.",
    purpose: "For anyone in their first year of a hands-on craft, whatever the craft is.",
    memberCount: 1284,
    activity: "Busy",
    prompt: "What are you working on this week?",
    rules: [
      "First attempts are the point — show the wonky one.",
      "Answer questions the way you'd want to be answered at week one.",
      "No selling here. The marketplace is a space away.",
    ],
    moderators: ["Alix Torres", "Priya N."],
    visibility: "Open to read",
  },
  {
    id: 2,
    hobbySlug: "workbench",
    name: "NYC Pottery Beginners",
    location: "New York City",
    description: "Wheel-throwing and hand-building meetups around NYC.",
    purpose: "For people learning the wheel in New York who want to practise with company.",
    memberCount: 96,
    activity: "Steady",
    prompt: "Show your progress — throw anything this week?",
    rules: [
      "Meetups go up a week ahead, never same-day.",
      "Studio recommendations welcome; affiliate links aren't.",
      "If you booked a wheel and can't make it, say so.",
    ],
    moderators: ["Dani R."],
    visibility: "Open to read",
  },

  // In Motion
  {
    id: 5,
    hobbySlug: "inmotion",
    name: "Pickleball & Padel Regulars",
    description: "Find a match, share drills, compare paddles.",
    purpose: "For people who already play weekly and want better games, not an intro to the sport.",
    memberCount: 3402,
    activity: "Busy",
    prompt: "Ask for a second pair of eyes on your serve.",
    rules: [
      "Match requests need a location and a level.",
      "Gear talk goes in the gear thread, not the match thread.",
      "Beginners get a real answer, not a link.",
    ],
    moderators: ["Nate Ruiz", "Sam O."],
    visibility: "Open to read",
  },
  {
    id: 6,
    hobbySlug: "inmotion",
    name: "Austin Weekend Pickleball",
    location: "Austin",
    description: "Sunday morning games at Pease Park courts.",
    purpose: "For Austin players who show up on Sunday mornings, rain or shine.",
    memberCount: 74,
    activity: "Steady",
    prompt: "Add an update — who's in this Sunday?",
    rules: [
      "Confirm by Saturday noon so courts get booked.",
      "All levels; we split by level on the day.",
      "Cancel loudly rather than quietly.",
    ],
    moderators: ["Marcus L."],
    visibility: "Open to read",
  },

  // Kitchen Table
  {
    id: 7,
    hobbySlug: "kitchentable",
    name: "Home Barista Club",
    description: "Latte art, grind settings, and gear talk for the home setup.",
    purpose: "For people dialling in espresso at home — not cafés, not competition.",
    memberCount: 1875,
    activity: "Busy",
    prompt: "Share what you learned dialling in this week.",
    rules: [
      "Share your grind, dose and time with any shot photo.",
      "No gear shaming — a €90 grinder makes good coffee.",
      "Recipes over brand loyalty.",
    ],
    moderators: ["Theo Reyes"],
    visibility: "Open to read",
  },
  {
    id: 8,
    hobbySlug: "kitchentable",
    name: "Portland Coffee Corners",
    location: "Portland",
    description: "Show off your home café setup, swap beans.",
    purpose: "For Portland home brewers who want to trade beans in person.",
    memberCount: 41,
    activity: "Quiet",
    prompt: "Show your progress — share your current setup.",
    rules: [
      "Bean swaps are person-to-person, no money.",
      "Roast date on everything you offer.",
      "One setup photo per week, please.",
    ],
    moderators: ["Wren A."],
    visibility: "Members only",
  },

  // Rabbit Hole
  {
    id: 9,
    hobbySlug: "rabbithole",
    name: "Nostalgic Collectors",
    description: "Trading cards, thrifted finds, and visible mending.",
    purpose: "For collectors who care about where an object came from more than what it's worth.",
    memberCount: 1560,
    activity: "Steady",
    prompt: "Share what you learned about something you found.",
    rules: [
      "Tell us where it came from, not what it's worth.",
      "Valuation questions belong elsewhere.",
      "Repairs and restorations very welcome.",
    ],
    moderators: ["Reo Tanaka", "Jo M."],
    visibility: "Open to read",
  },
  {
    id: 10,
    hobbySlug: "rabbithole",
    name: "Chicago Thrift & Trade",
    location: "Chicago",
    description: "Meetups to trade cards and secondhand finds in person.",
    purpose: "For Chicago collectors who'd rather trade in a room than a marketplace.",
    memberCount: 63,
    activity: "Quiet",
    prompt: "What are you working on this week?",
    rules: [
      "Trades happen in person, in public places.",
      "Bring what you listed.",
      "New collectors get first pick at the beginner table.",
    ],
    moderators: ["Ines B."],
    visibility: "Open to read",
  },
];

export function circlesByHobby(slug: string) {
  return circles.filter((c) => c.hobbySlug === slug);
}

export function getCircle(id: number) {
  return circles.find((c) => c.id === id);
}
