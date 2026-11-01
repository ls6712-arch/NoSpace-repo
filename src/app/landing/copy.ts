import { APP_NAME } from "../config";
import type { PhotoKey } from "./photos";

/**
 * Every line on the signed-out landing page, in one place. Example picks, example
 * chats and example Stubs are fixed sample text, so they are written out here
 * rather than built with dates.ts or plural().
 */

export interface ExamplePick {
  /** Small line over the title ("Tonight · Music"). The hero ticket has none. */
  kicker?: string;
  title: string;
  when: string;
  where: string;
  cost: string;
  /** Big number on the stub. */
  time: string;
  /** Short word on the stub over the time. */
  day: string;
  /** Which picture the ticket shows (see photos.ts). */
  image: PhotoKey;
  /** The line shown next to Stubby for this pick. */
  caption: string;
}

export const LANDING_COPY = {
  signUp: "Sign up",
  logIn: "Log in",
  navLinks: [
    { label: "Going solo", href: "#solo" },
    { label: "How it works", href: "#how" },
    { label: "Stubby", href: "#stubby" },
    { label: `Are you on ${APP_NAME}?`, href: "#ask" },
    { label: "FAQ", href: "#faq" },
  ],
  stubbyLabel: "Stubby",

  // Hero
  city: "Now in New York",
  heroLead: "Free tonight? ",
  heroName: "Stubby",
  heroTail: " has a pick.",
  heroSub:
    `Tell ${APP_NAME} when you’re free and what you want to spend. You get one thing to do that fits. Go on your own or bring a friend.`,
  heroCta: "Get your first pick",
  heroSecondary: "How it works",
  stageLabel: "Example pick from Stubby",
  stageTag: "Example pick. Try the buttons.",

  // The ticket you can say yes to
  ticket: {
    when: "When",
    where: "Where",
    cost: "Cost",
    goodSolo: "Good solo",
    going: "I’m going",
    gone: "You’re going",
    nah: "Nah",
    plus: "Bring someone",
    plusOn: "Just me",
    undo: "Undo",
    stamp: "You’re going",
    admitOne: "Admit one",
    admitTwo: "Admit two",
    yesSolo: "It’s on your Home. Have fun.",
    yesFriend: "It’s on your Home. The invite is ready. You tap send.",
    plusOnLine: "The invite is ready. You tap send. Going?",
    plusOffLine: "Solo it is. Still a good night. Going?",
    demoNah: "Change an answer above to see another pick.",
  },
  heroPicks: [
    {
      title: "Drop-in wheel class", image: "ceramics",
      when: "Thu, 6:30 to 8:30 PM",
      where: "Greenpoint, Brooklyn",
      cost: "$35, clay included",
      time: "6:30",
      day: "Thu",
      caption:
        "Thursday 6:30, drop-in wheel class in Greenpoint. Everyone’s a beginner, so going solo is easy. Going?",
    },
    {
      title: "Silent book club", image: "book-clubs",
      when: "Thu, 7:00 to 9:00 PM",
      where: "Fort Greene, Brooklyn",
      cost: "Free, buy a coffee",
      time: "7:00",
      day: "Thu",
      caption: "Something quieter? Silent book club Thursday at 7. Bring the book you keep not finishing. Going?",
    },
    {
      title: "Late jazz set", image: "live-music",
      when: "Thu, 9:30 to 11:00 PM",
      where: "West Village",
      cost: "$15 cover",
      time: "9:30",
      day: "Thu",
      caption: "How about music? Late jazz set Thursday. The bar seats go first, so get there early. Going?",
    },
  ] satisfies ExamplePick[],

  // Group chat
  nightsHeading: "Then it’s Friday and you’re home again.",
  chatLabel: "Example group chat",
  chat: [
    { text: "we should do something this weekend", when: "Mon", out: false },
    { text: "yes 100%", when: "Mon", out: false },
    { text: "ok what day", when: "Wed", out: true },
    { text: "ahh this week is crazy, next week?", when: "Fri, 5:12 PM", out: false },
  ],
  nightsBigLead: `Plans die in the group chat. So ${APP_NAME} gives you something you can do `,
  nightsBigAccent: "tonight",
  nightsBigTail: ", with or without them.",
  nightsSmall: "You don’t need to wait for anyone to agree. Pick something, go, and invite people if they’re free.",

  // Going solo
  soloSays: "Going alone? Sit at the counter. It’s way easier to start talking.",
  soloHeading: "Lots of good nights are solo.",
  soloLine: `${APP_NAME} marks picks that work well on your own: drop-ins, beginner classes where nobody knows anyone, counter seats, things you can leave whenever you want.`,
  solo: [
    { tag: "Music", title: "Jazz at the bar", line: "Late set, one drink, no plans needed.", tip: "Get there for the first set. The bar seats go first." },
    { tag: "Movies", title: "A weeknight matinee", line: "Nobody needs to agree on what to watch.", tip: "Middle seat, center row. Yours." },
    { tag: "Running", title: "Saturday run club", line: "You show up alone, and you leave with people to run with.", tip: "Tell them it’s your first time. They’ll pace you." },
    { tag: "Art", title: "Sketching at a museum", line: "A pencil, a small notebook and a bench.", tip: "Pick one room. Stay an hour." },
    { tag: "Food", title: "Counter dinner", line: "Watch the kitchen, order what the chef likes.", tip: "Ask what they’d order. Then order it." },
    { tag: "Climbing", title: "Bouldering session", line: "Your gym pass might already cover it.", tip: "Watch someone do the route first. Then try." },
    { tag: "Reading", title: "Silent book club", line: "Bring your own book. Read together, talk if you want.", tip: "Bring the book you keep not finishing." },
    { tag: "Outdoors", title: "Sunset walk on the water", line: "Free, close by, and about an hour.", tip: "Leave 30 minutes before sunset. Take the long way." },
  ],

  // Three taps demo
  demoHeading: "Three taps. One pick.",
  demoLine: "When are you free, what do you want to spend, and is anyone coming? Change the answers and watch the pick change.",
  demoTag: "Example picks",
  demoRows: {
    when: { label: "When", options: [{ v: "tonight", label: "Tonight" }, { v: "sat", label: "Saturday" }] },
    budget: { label: "Spend", options: [{ v: "free", label: "Free" }, { v: "25", label: "Under $25" }] },
    who: { label: "Who", options: [{ v: "solo", label: "Just me" }, { v: "friend", label: "A friend" }] },
  },
  demoPicks: {
    "tonight|25|solo": { kicker: "Tonight · Music", title: "Jazz at the bar", image: "live-music", when: "Tonight, 8:30 PM", where: "West Village", cost: "$15 cover", time: "8:30", day: "Tonight", caption: "Easy to go alone, and you can leave whenever. Going?" },
    "tonight|free|solo": { kicker: "Tonight · Reading", title: "Silent book club", image: "book-clubs", when: "Tonight, 7:00 PM", where: "A café in Fort Greene", cost: "Free, buy a coffee", time: "7:00", day: "Tonight", caption: "Bring the book you keep not finishing. Going?" },
    "sat|25|solo": { kicker: "Saturday · Climbing", title: "Bouldering session", image: "climbing", when: "Sat, 11:00 AM", where: "Gowanus", cost: "Covered by your gym pass", time: "11:00", day: "Sat", caption: "Your pass covers it, and the morning’s quiet. Going?" },
    "sat|free|solo": { kicker: "Saturday · Art", title: "Museum free hour", image: "museum", when: "Sat, 4:00 PM", where: "Ten minutes from you", cost: "Free", time: "4:00", day: "Sat", caption: "Pick one room and stay an hour. Going?" },
    "tonight|25|friend": { kicker: "Tonight · Food", title: "Dumpling-folding night", image: "cooking", when: "Tonight, 7:00 PM", where: "Lower East Side", cost: "$22 each", time: "7:00", day: "Tonight", caption: "Better with two. Want to ask Maya?" },
    "tonight|free|friend": { kicker: "Tonight · Games", title: "Board games at a café", image: "board-games", when: "Tonight, 7:30 PM", where: "Park Slope", cost: "Free, buy a drink", time: "7:30", day: "Tonight", caption: "Low effort, and you can talk the whole time. Who’s coming?" },
    "sat|25|friend": { kicker: "Saturday · Pottery", title: "Wheel-throwing taster", image: "pottery", when: "Sat, 2:00 PM", where: "Greenpoint", cost: "$25 each", time: "2:00", day: "Sat", caption: "You’ve both said you want to try this. Bring someone?" },
    "sat|free|friend": { kicker: "Saturday · Outdoors", title: "Bike the waterfront", image: "cycling", when: "Sat, 10:00 AM", where: "Hudson River Greenway", cost: "Free with your bikes", time: "10:00", day: "Sat", caption: "Sunny morning, and it’s flat the whole way. Who’s going?" },
  } satisfies Record<string, ExamplePick>,

  // How it works
  howSays: "Takes about a minute to set up. Then the picks start.",
  howHeading: `How ${APP_NAME} works`,
  steps: [
    { title: "Tell us your week", line: "Which evenings are free, what you want to spend in a month, and anything you already pay for, like a gym or a museum membership." },
    { title: "Get a pick", line: "Stubby suggests one thing with the time, the place, the cost and whether it works solo." },
    { title: "Say I’m going", line: "Go alone or tap Bring someone. The pick shows up on your Home with everything you need." },
    { title: "Go, then tear your Stub", line: "Do the thing. Post a Moment if you want. A new Stub goes on your Shelf." },
  ],

  // Stubby
  stubbyHeading: "This is Stubby.",
  stubbyLine:
    `Stubby is the friend who always knows what’s on. Tell ${APP_NAME} when you’re free. Stubby brings one pick, and cheers when you go.`,
  stubbyRules: [
    "Starts with a pick. You never have to explain what you want from scratch.",
    "Keeps it short, about 60 seconds, then sends you off to do the thing.",
    "Only tells you details it actually has. If it’s unsure, it says to check at the door.",
    "Never books, pays or messages anyone until you tap.",
  ],
  stubbyCaption: "Tap Stubby.",

  // Shelf
  keepSays: "Every time you go, you get a Stub. Alone or with friends.",
  keepA: "LinkedIn has your job. ",
  keepB: "Instagram has your highlights.",
  keepC: ` ${APP_NAME} has the rest of you.`,
  keepLede: "Classes, dinners, runs, Sunday walks. Each one becomes a Stub on your Shelf, so you can see what you’ve actually been doing.",
  keepQuote: "The best feeling isn’t a like. It’s someone wanting to do what you did.",
  shelfLabel: "Your Shelf",
  shelfExample: "Example",
  shelfName: "Example Shelf of Stubs",
  stubs: [
    { tag: "Pottery", title: "First wheel class", image: "pottery", who: "Solo" },
    { tag: "Reading", title: "Silent book club", image: "reading", who: "Solo" },
    { tag: "Running", title: "First 5K with Ana", image: "running", who: "+1" },
    { tag: "Cooking", title: "Sunday dumplings", image: "cooking", who: "+3" },
    { tag: "Outdoors", title: "Sunrise on the pier", image: "pier", who: "Solo" },
    { tag: "Art", title: "Museum free hour", image: "museum", who: "Solo" },
  ],

  // Are you on it
  askSays: "Your friends will see your Stubs. Then they’ll ask.",
  askLead: "Are you on ",
  askAccent: `${APP_NAME}?`,
  askLede: "It starts when a friend sees what you did last weekend and wants in. Every Stub you share is an easy way for someone to join you next time.",
  spread: [
    { title: "Share a Stub", line: "Post what you did, to friends or just yourself." },
    { title: "Count me in", line: "Friends tap it on your Stub and get asked along next time." },
    { title: "Bring someone", line: "Every pick has room for a plus one, if you want one." },
  ],
  phoneLabel: "Example text conversation",
  phoneTag: "Example",
  stubCard: { tag: "Pottery · Solo", title: "First wheel class", from: `Shared from ${APP_NAME}` },
  texts: [
    { text: "wait you made that?? where", out: false },
    { text: "drop-in class in greenpoint, went alone lol", out: true },
    { text: `ok I want to go. are you on ${APP_NAME}?`, out: false },
    { text: "yes, add me. tap Count me in on my Stub", out: true },
    { text: "done. next thursday?", out: false },
  ],

  // FAQ
  faqSays: "Quick answers, then go do something.",
  faqHeading: "Questions",
  faq: [
    { q: `Can I use ${APP_NAME} on my own?`, a: "Yes. Many picks are marked Good solo, like drop-in classes, counter dinners and run clubs. You can always add a friend later." },
    { q: `Where is ${APP_NAME} available?`, a: "New York first. More cities after that." },
    { q: "What does Stubby do?", a: "Stubby brings your picks and cheers when you go. You choose everything with a tap." },
    { q: `Will ${APP_NAME} book, buy or message anyone for me?`, a: "Not without your tap. Stubby can get an invite ready, and you decide whether to send it." },
    { q: "Is this for meeting strangers?", a: `No. ${APP_NAME} helps you get out more, alone or with friends you already have.` },
    { q: "Who sees my Moments?", a: "You choose for each Moment: only you, followers or public. Nothing about your account has to be public." },
    { q: "What are Stubs?", a: "You get a Stub each time you do something. Your Shelf of Stubs is a record of what you’ve done." },
  ],

  // Pictures. Activity-level alt text; the two illustrations are decorative.
  photoAlt: {
    pottery: "Clay pottery",
    ceramics: "A clay pot",
    reading: "An open book",
    "book-clubs": "Books",
    running: "A runner",
    cooking: "Cooking in a kitchen",
    climbing: "Climbing",
    "board-games": "A board game",
    cycling: "Cycling",
    "live-music": "A crowd at a concert",
  } as Partial<Record<PhotoKey, string>>,
  photosLink: "Photos",
  photosUnsplash: "Unsplash",
  photosUnsplashUrl: "https://unsplash.com",

  // Final card
  finalHeading: `Are you on ${APP_NAME} yet?`,
  finalLine: "Thursday’s free, and Stubby has a pick. Setup takes about a minute.",
} as const;
