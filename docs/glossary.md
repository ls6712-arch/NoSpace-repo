# Product glossary

All UI copy uses these terms. Never use a retired term (see the end).
**One word per idea, one idea per word:** never introduce a synonym for a term
below, and never reuse a term below for a different idea.

**Scope:** every screen a member can see. Admin-only screens may say "Category";
nothing a member sees may. Marketplace copy is out of scope while the
marketplace is switched off.

**App name: Soosh** (formerly Sushii, and before that No Space). In code, always
read it from `APP_NAME` in `src/app/config.ts`; never hardcode the name in copy.

## Brand and navigation

| Term | Meaning |
|---|---|
| Home | Your feed (the only "feed" in the app) |
| Discover | Browse and search everything |
| Log a Moment | Main create button (mobile tab may shorten to "Log") |
| You | Your profile, in the nav (desktop and mobile) |
| Messages / Inbox | Chats / notifications and requests |
| Search Moments, people, Spaces | The nav search box placeholder (searches all three) |
| Search Corners and Moments / Search Spaces / Search people | Discover's box, by open tab: it searches what that tab lists |
| See all | Opens the full list when a list shows only some: Discover's Spotlight, the group tiles on Discover's Corners tab (which show the first 8), and a group's row on the Corners home (opens that group's page), and Start here on Discover (opens every Corner for the chosen mood) |

## Door list

Discover's Corners tab (approved Oct 23, 2026). A ticket is a ticket to a real event (decision logged in `docs/corners-build-decisions.md`, Oct 27, 2026). A Corner with no upcoming event shows a plain "How to start" card instead.

| Term | Meaning |
|---|---|
| Issue {n} | Whole weeks since Sept 1, 2026, plus 1, on the line above the masthead |
| Things to do tonight / For members | The two halves of the strip under the masthead |
| Cover story | Kicker on the top card, shown big: a ticket to an event, else a "How to start" card |
| ticket | A ticket to an upcoming event in an Open Space, on Discover: the event title, Space, time, place and "I’m going". Tapping the card opens the event in its Space. Never a first step |
| Admit one | The stamp on an event ticket and on the cover story's sticker when it is an event ticket. Not on a "How to start" card |
| Start here | Heading above the row of cards (event tickets and "How to start" cards) |
| Seen tonight | Heading above the collage of recent public Moments |
| Rooms | Retired (UI removed Oct 28, 2026). Was the heading above the 18 groups of Corners. The groups are now shown by their own names under Browse by |
| Who's in where | Retired (UI removed Oct 28, 2026) with the Rooms heading |
| See all rooms | Retired (UI removed Oct 28, 2026). Use See all |
| You're caught up | End of All Moments, after 30 Moments |
| Welcome in. Pick a door. | Greeting for a member with no Moments yet |
| Got a minute? Pick a door. | Greeting Monday to Friday before 17:00 |
| Evening. Pick a door. | Greeting Monday to Thursday from 17:00 |
| Friday night. Pick a door. / Saturday night. Pick a door. | Greeting on Friday and Saturday from 17:00 |
| Weekend. Pick a door. | Greeting on Saturday and Sunday before 17:00 |
| Sunday night. Pick a door. | Greeting on Sunday from 17:00 |

## Moods

Discover's row of chips and cards (approved in visual spec v1.1). A mood names what you would be doing, never what it will do for you. No counts on chips.

| Term | Meaning |
|---|---|
| What are you in the mood for? | Title of the mood row on Discover |
| 15 minutes | Chip (the default): Corners whose first step fits in about 15 minutes |
| Make something | Chip: Corners where you make or build something |
| Move | Chip: Corners that get you moving |
| Be around people | Chip: Corners you do with other people |
| Some time to yourself | Chip: Corners you do on your own |
| Get outside | Chip: Corners you do outdoors |
| Learn something | Chip: Corners where you pick up a skill |
| Play a game | Chip: game and puzzle Corners |
| Start with what you have | Chip: Corners you can start with what you already have |

Once a chip is picked, this line names it over the row of cards (under "Start here"), so the row visibly answers the chip. New strings, for approval.

| Chip | Line over the tickets |
|---|---|
| 15 minutes | Things you can do in 15 minutes |
| Make something | Things to make tonight |
| Move | Ways to move tonight |
| Be around people | Things to do with other people |
| Some time to yourself | Things to do on your own |
| Get outside | Things to do outside |
| Learn something | Things to learn tonight |
| Play a game | Games to play tonight |
| Start with what you have | Things to start with what you have |

## Hobbies and Spaces

| Term | Meaning |
|---|---|
| Category | Internal word, never shown to members. Two meanings: the 18 groups of Corners (Yarn and fabric, Food and drink, and so on), shown only by their own name as a heading or tile; and the 15 old groups behind Spaces in the code, never shown |
| Corner | A hobby tag anyone can create |
| Space | A group someone creates, with hosts and members |
| Table | A Space's first tab. Sections: "Host picks", then "Latest" |
| Host / Member / Co-host | Space roles; host action: "Invite as co-host" |
| Open / Closed | Who can join a Space |
| Join Space / Request to join → Requested | Joining (Requested can be tapped to cancel) |
| N Moments this month | Space activity. Never show member counts |
| Waiting for a host to approve | Your Moment in an approval-mode Space |
| Settling in / Set up your Space | New-member / host checklists |
| Manage | Hosts' tab: requests, members, approvals |
| Event / I'm going / Starts in 4h | Gatherings and RSVP |
| Online | The place on an event ticket when the event is online and has no neighborhood or city (already the label in the event form; new here, for approval) |
| New Spaces | Home section |
| Book the studio | Hidden until the marketplace is on |

## Corners home

New in the Corners home (`/corners`, `/corners/:slug`). **Every row below is a new string for approval.** The per-Corner copy (the steps under "How to start" and the facts under "What you’ll need" for each of the 33 curated Corners) is in `docs/curated-corners.md`.

| Term | Meaning |
|---|---|
| Corners | Link at the start of Discover’s tab row that opens the Corners page |
| Corner of the week | Small caption on the first slide of the Corners home billboard: the curated Corner with the most events this week, or with none one curated Corner per week in turn. The other slides have no caption |
| Featured Corners | Accessible name of the billboard (a carousel); not shown on screen. New, for approval |
| Show {Corner} | Accessible name of a billboard dot: shows that slide; not shown as text. New, for approval |
| {n} of {total} | Accessible name of a billboard slide; not shown as text. New, for approval |
| Browse by | Label over the row of 18 group chips on the Corners home and Discover; each chip is a group's own name and opens its page. Approved in the Oct 28 cleanup brief |
| Row headings on the Corners home | With no filter: Happening this week, then each group's own name (a link to its page, with See all). With a filter: one count line, "N Corners" (`plural()`), and Clear. The mood, time and place rows are gone: those are the filters |
| N events this week | The line under a Corner’s name on its card when it has events in the next 7 days. Counts only Open Spaces’ events |
| N Spaces | The line under the name on a card with no events this week but at least one Space |
| 1 hr · Outdoors | The line under the name on a curated Corner’s card, and on the hero, when it has no events and no Spaces: how long it takes and where. An uncurated Corner with nothing to say shows no line. A card never asks you to start a Space |
| Sunrise 5k · Starts in 5h | Hero line when the Corner has an event this week: the next event's title, then when it starts |
| Scroll left / Scroll right | Screen reader labels of the round arrows at the ends of a row, shown from md with a mouse. Hovering or focusing a Corner card also shows what the Corner is in a line or two |
| Photo: {name} on Unsplash | Small credit in a single Corner page hero, linking to the photo on Unsplash. Shown only for photos with a credit on record |
| Explore {Corner} | The hero button that opens the Corner. Beside it, "Log a Moment" |
| Any time / Any mood / Anywhere | The three filter chips on the Corners home. Each opens its options; one that is chosen shows the option and fills with the accent. "Anywhere" is the unset state of the third chip |
| Up to 1 hour / Up to 2 hours / Up to 4 hours | Options under "Any time": Corners that take about that long or less. A Corner with no length on record is left out |
| At home / Outdoors | Options under "Anywhere". Both also show the Corners that work anywhere |
| Clear | Link beside the chips while any is chosen: unsets all three |
| (the eight Moods labels) | Options under "Any mood", the same labels and meanings as in Moods above, minus "15 minutes" |
| No Corners match those choices. / Clear a choice to see more. / Clear choices | Empty state of the chip rows, and its action |
| Back to Corners | Link above a category page, to the Corners page |
| Back to {category} | Link above a single Corner, to its category page ("Back to Food and drink"); "Back to Corners" for a Corner in no category. Approved in the Oct 28 cleanup brief |
| See Spaces | The hero button on a Corner page that has Spaces and no upcoming event: scrolls to its Spaces. Approved in the Oct 28 cleanup brief |
| Happening this week | Heading above the events of the next 7 days on a Corner |
| Spaces in {Corner} | Heading above that Corner's Space cards |
| People into {Corner} | Heading above the Shelves of people who shared a public Moment in that Corner most recently, newest first. No counts. Not shown to signed-out or not-yet-approved visitors |
| Members see who’s going. | The one line a signed-out or not-yet-approved visitor sees on a Corner in place of People into, Recent Moments, hosts and who is going |
| Recent Moments | Heading above a Corner's latest public Moments |
| Why it’s worth it | Heading above four short, plain reasons to try a Corner, on its page (copy in `docs/curated-corners.md`, never a health claim or a promise). New, for approval |
| Your Moments | Heading on a Corner page over your own Moments in that Corner (private ones too), shown as paper cards. Only you see it. New, for approval |
| How to start | Heading above a Corner's numbered steps. Also the label on a Discover card with no event, which shows the Corner's first step and links to the Corner |
| What you’ll need | Heading above 3 to 5 plain facts: gear, place, cost, people. Never a claim about results |
| More Corners like this | Heading above Corners in the same group of 18 |
| Starts in 20m | Time to the next event inside the next hour. Inside 24 hours it is "Starts in 4h"; later it is the day and time |
| You’ve been to one of their events. | Line on a Closed Space card when you hold a Stub from that Space |

The Corners pages reuse existing wording for: Create a Space (the hero button when a Corner has no event and no Spaces, else once at the bottom of a single Corner), Show more, See all, Join Space, Request to join and Requested, I’m going, Create a Space, N Moments this month, Open / Closed, and the Moods labels.

## Moments

| Term | Meaning |
|---|---|
| Moment | Anything you log |
| Log a Moment / Add from my Moments | Create a new one / add an existing one to a Space |
| Group / Followers / Everyone / Only you | Who sees a Moment. One set everywhere (Log, Moment page, Settings). Group appears only in Log, for a Moment that counts toward a Pursuit with people. "Public" and "Friends" are never audience labels |
| Pinned | You choose, on your own profile. Buttons: "Pin" / "Unpin" |
| Host picks | Hosts choose, in a Space. Buttons: "Add to host picks" / "Remove from host picks" (max 3) |
| Spotlight | The Soosh team chooses, on Discover |
| Save / Saved | Bookmark a Moment. Form buttons say "Save changes", so "Save" alone always means bookmarking |

## Stubs

New (Oct 26, 2026). **Every row below is a new string for approval.**

| Term | Meaning |
|---|---|
| Stub | A keepsake on your Shelf, shown in the Shelf's Stubs tab. Types: **silver** (your first Moment in that Corner, by `hobby_slug` and `corner`), **ticket** (a Moment with `from_ticket` set, logged from a ticket), **with someone** (a Moment with a `pursuit_id` whose Pursuit has more than 1 active member), **event** (a host-confirmed row in `public.stubs`: proof you attended a Space event, never self-awarded), **session** (core loop v1: one per posted Moment that counts toward a Pursuit, issued by a server function) and **gold** (a completed Pursuit) and **plain** (everything else). The serial is the Moment's position among your own Moments by `created_at`. Updated Oct 28 (core loop v1): your own Stub count may show on You, and Search may show a friend signal such as "Sneha has 4 pottery Stubs". Stubs are never ranked and there are no leaderboards. A product noun, always capitalized |
| Past events | Heading of a host's list of ended events, on the Space's Events tab |
| Confirm who came | Host button on a past event: opens "Who came?" |
| Who came? | Title of the dialog where a host ticks who showed up from the people who said "I’m going" |
| Confirm / Confirmed | The dialog button / a person already holding a Stub for that event, with a check mark, including right after you confirm them |
| Done | Replaces Cancel in that dialog after a confirm goes through |
| No one said they were going. | Empty state of that dialog |
| N Stubs confirmed. | Message inside the dialog after a host confirms. The dialog stays open |
| Only a host can confirm who came. | Error to anyone else |
| You can confirm who came once the event has ended. | Error before the end |
| This event was cancelled. | Error on a cancelled event |
| Pick at least one person. | Error with nobody ticked |
| Another host has to confirm you. | Error when a host ticks themselves |
| You can only confirm people who said they were going. | Error for someone with no "I’m going" |
| That’s too many people at once. | Error above 500 people |

## Pursuits

| Term | Meaning |
|---|---|
| Pursuit / Start a Pursuit | Named ongoing goal / the only create wording |
| Goal / Measure / Unit | How progress counts |
| Stepping stones | Steps toward the goal |
| Aim for | Optional target date (no urgency language) |
| Check in with me | Gentle Pursuit reminders. "Check in" means only this |
| Just started / In progress / Paused / Finished | Statuses. Buttons: "Pause", "Resume", "Finish", "Reopen". Filter: "Paused" |
| Next session | Card at the top of an active Pursuit: when, plus an optional note |
| Times a week / [N] of [M] this week | Your own weekly aim for a Pursuit, and the count toward it (days with a Moment, Mon–Sun) |
| One shared goal / Side by side | Shared Pursuit modes |
| Pursuing together | People in a shared Pursuit |
| Start a Pursuit with [Name]? | Shown after Count me in: opens a new Pursuit with them invited, side by side |

## Profile

| Term | Meaning |
|---|---|
| Shelf | Your profile page |
| Cover | Profile cover area |
| Tell your story | Bio |
| What should people call you? / This is how your name shows on your Shelf. | Onboarding name step: required display name, with a live preview under "Your Shelf" |
| Moments logged | Headline stat |
| Is this how you’d like to be known? / Save name | One-time prompt for accounts named after their email; saving unchanged confirms the name |
| I’m 18 or older and agree to the Terms and Privacy Policy | Required sign-up checkbox (email and Google). Both documents are linked. Shown once more, with a Continue button, to any account with no recorded acceptance: in onboarding for a new account, as a prompt that can't be closed for an existing one (Log out is the only other way out) |
| Terms and Privacy Policy | Title of that one-time prompt for existing accounts |
| Milestones | Private badges, shared one at a time |
| Followers / Following | People connections |

## Home, reactions, connection

| Term | Meaning |
|---|---|
| You inspired / You're caught up | Home sections |
| Love this / Count me in / Thoughts | Reactions |
| [Name] loved your moment. / [Name] and N others loved your moment. | The Love this notification, at most one per moment per day |
| Someone wants to try “[caption]”. / N people want to try “[caption]”. | The Save notification, at most one per Moment per day. It shows how many people saved, never who. The caption is the first non-blank line, cut at 40 characters with an ellipsis; with an empty or whitespace-only caption it says "your Moment" instead ("3 people want to try your Moment."). "wants to try" appears only in this notification: the button stays "Save" and the state "Saved" |
| Saves of your Moments | Notifications settings switch for the Save notification |
| Add a thought / Keep going | Comment / quick starter |
| Follow / Follow requests | Connecting |
| Make together / Explore together | Invites that open a chat |
| Chat / Chats | A conversation in Messages (never "thread") |
| Message requests / Seen / Unsend | Messaging |
| Block / Report | Safety (keep safety words plain) |

## Joining Soosh

| Term | Meaning |
|---|---|
| Invite / Invite link | A link a member sends a friend. Sign-up is open to anyone, so an invite is no longer needed to get in |
| Waitlist / You're on the list | Retired (Oct 30, 2026). Sign-up is open. The waitlist table and its data stay, unused |
| Welcome to Soosh | The inviter's button on "[Name] added their first moment": opens it with the reply box ready |

## Landing page copy (website only)

These lines are for the signed-out landing page (`src/app/landing`). They are
marketing wording, not app terms: never use them in the app UI. The page follows
the locked narrative: hero, the line, Save it / Try it / Share it, friends can
come along, privacy, real Shelves (hidden until 6 exist), sign up, footer.
In-app labels on the page still follow the glossary above: "Count me in", "Finished", "In progress", "Privacy Policy".

| Term | Meaning |
|---|---|
| Welcome to the rest of you. | Hero headline |
| Log in | Text link in the landing nav, to /login |
| Sign up | Every landing button, all going to /onboarding. ("Request an invite" is retired.) |
| Save it. Try it. Share it. | Section heading and the three step labels (website only) |
| Example Shelf | Small caption under the hero and step screens (website only). Those people are examples, never real members |
| Example | Small caption under the reward, friends and privacy screens (website only) |
| Your friends can come along. | Friends section heading. The button it names is "Count me in" |
| On Soosh, the best feeling isn't a like. It's someone wanting to do what you did. | Reward section statement (website only) |
| You choose who sees each post. | Privacy section heading |
| Pick Only you, Followers or Everyone for each post. Nothing about your account has to be public. | Privacy section line. Names the real picker options (website only) |
| See who's on Soosh. | Real Shelves heading |
| Join Soosh. | Sign-up section heading, a neutral placeholder to be rewritten ("Soosh is invite-only." is retired) |
| Create an account to get started. | Sign-up section line, a neutral placeholder to be rewritten |
| Privacy Policy / Terms | Footer links. Contact, Instagram and TikTok appear once set in `src/app/config.ts` |

## Core loop v1 (Oct 28, 2026)

New words approved in the core loop brief (section 7). Screen copy lands with each screen's PR; the terms are listed here so they are not reworded.

| Term | Meaning |
|---|---|
| Make it a Pursuit | Title of the sheet on a Corner that starts a Pursuit |
| Open group | A Pursuit anyone nearby can join, run by a host. The other choices are Friends and Just me |
| Next together | Card at the top of a Pursuit page with the next shared session and the I'm in button |
| What's next | The three rows after a Moment is posted |
| Was there | Reserved for a person's attendance at a session; used only if a screen needs it |
| Keep going | Heading of the choices after a Pursuit is complete |
| Do this with people | The one primary button on a Corner page. It opens Make it a Pursuit. "Set a solo goal" and "I did this" are text links under it |

### Core loop v1, screens 1 to 3 (Oct 28, 2026)

Strings from the founder's screens (`docs/design/core-loop/01` to `03`), added with PR 2.

| Term | Meaning |
|---|---|
| What do you want more of? | Title of onboarding and of the sheet that changes the choice. The chips are the 8 mood labels under Moods above |
| Pick a few. We’ll show you things to do this week, and who’s doing them. | Onboarding subline |
| Your city | Label of the city field |
| Show me what to do | Onboarding button. With a Pursuit invite it reads "Join {Name}’s Pursuit" |
| Pick at least one | Helper text while no mood is picked, instead of a dead button |
| Takes 10 seconds. Change it any time. | Onboarding footnote. The change happens from the city name on Discover |
| {Name} invited you to {Pursuit} | Card on top of onboarding when you arrive from an invite link |
| This week in | Muted line over the city name on Discover. With no city it reads "This week" over "Discover" |
| Your friends are doing | Discover carousel of Pursuits that people you follow share |
| Browse | Discover grid of the 18 groups of Corners. Each tile shows the group's own name |
| Your first time | Corner page heading over the numbered steps. Replaces "How to start" on that page only |
| Good with a friend | Last part of a Corner's meta line when the Corner suits company |
| {Name} is into this | Corner page line beside the avatars: people who shared a Moment in that Corner. Never a count |
| Do this with people | The one primary button on a Corner page |
| Set a solo goal | Text link under it: starts a Pursuit for yourself |
| I did this | Text link under it: opens Log in that Corner |

### Core loop v1, screens 4, 5 and 13 (Oct 28, 2026)

Strings from `docs/design/core-loop/04`, `05` and `13`, added with PR 3. The brief's sentence "People who do it together finish far more often" is not used (an outcome claim, section 3 fix 2).

| Term | Meaning |
|---|---|
| Make it a Pursuit | Title of the sheet over a Corner. Subline: "A small goal with an end date." |
| Who with | Label over the choice: Open group, Friends, Just me |
| Open group | A Pursuit anyone can ask to join; the host sets how many people fit. See below for who joins at once |
| {N} of {M} spots | Badge on an open group: people in it of its capacity. The host counts as one |
| Hosted by {Name} · First session {time}, {place} · or do your own version at home | Line on the open group card |
| Goal | Label over the stepper: "Do {Corner} {N} times in {M} weeks". The weeks number changes when tapped, the times with − and + |
| Join {Name}’s Pursuit / Start with friends / Start | The button, by choice. After joining a full or half-full group it reads Requested |
| No open group for {Corner} yet. Start one and up to {N} people can join. | Shown on Open group when there is none, and the button starts one |
| The host will let you in. | Under a request to join |
| Pursuit · {Corner} · ends {date} | Line over a Pursuit page's title |
| Next together | Accent card on a Pursuit page: the group's next session. Button I’m in, then You’re in |
| Set next session | Host button on that card; the sheet asks When, Where and Note |
| The group | Heading over the people in a Pursuit, in the order they joined, each with "{N} of {M}" and a bar. Never sorted by progress, never ranked |
| Let in / Not now | The host's answers to a request to join |
| Latest | Heading over the three newest Moments in a Pursuit |
| Log {corner} #{N} | The fixed button on a Pursuit page: the next Moment to log |
| See the recap | Link on a finished Pursuit |
| Pursuit complete · {N} days | Kicker on the recap |
| You finished {N} {unit} | Title of the recap |
| Share the recap | Makes a 1080 by 1920 image of the Moments and the gold Stub |
| Keep going | Heading of the next steps: Level up (same group, harder goal), Host it for beginners, Try something new |

Joining an open group: instant while at most half the spots are taken (the host counts as one), then the host decides (Let in or Not now).

### Core loop v1, screens 6, 7, 8 and 14 (Oct 28, 2026)

Strings from `docs/design/core-loop/06`, `07`, `08` and `14`, added with PR 4.

**Reaction.** In code the thing is a *reaction* (`reactions` table, `toggleReaction`, `loveCount`). In the UI it is only ever **Love this** (and Count me in). The brief's word "cheer" is not used anywhere a member can read it, and the notification says "{Name} loved your Moment".

| Term | Meaning |
|---|---|
| Cancel / Log a Moment | Top of the Log sheet: Cancel on the left, the title in the middle |
| Add photo / + {N} more | On the photo: add another (up to 8); how many more photos follow the first |
| Add a thought | Placeholder of the caption box under the photo |
| Activity / Pick one | Row that sets the Moment's Corner. The sheet that opens is titled Activity |
| Counts toward / Nothing | Row that sets the Pursuit the Moment adds to. "Nothing" when there is none. The sheet is titled Counts toward |
| With | Row listing the other people in the chosen Pursuit. Read only. Hidden when it is a Pursuit for one |
| Details / Add | Row for tags, "This is something happening" and Where |
| Who sees this | Label of the picker: Group (only when the Moment counts toward a Pursuit with people), Followers, Everyone, Only you. The same four words are used on every screen |
| People in your Pursuit can see this. / People who follow you can see this. / Anyone can find this in {Corner}. / Only you can see this. | The line under the picker |
| Post / Keep it private | The one fixed button. Every row above it is optional with a default, so a photo posts in one tap. It reads Keep it private when Only you is picked |
| Pick a Corner for this Moment. | Shown, with the Activity sheet open, when Post is tapped without a Corner |
| Posted to your group / Posted to your followers / Posted to everyone | First line of the Posted screen |
| {Name} loved your Moment | Card that appears on the Posted screen when someone reacts while you are there |
| People who do {Corner} also try {Corner} | A What's next row |
| Group session {time} / Plan your next one | A What's next row for the Pursuit's next session |
| Invite a friend to the next one / They join your Pursuit | A What's next row |
| Go to Home | Button at the bottom of Posted |
| Undo | Text button under What's next. Takes the Moment back |
| Home | Title of the feed |
| {Pursuit} · {N} of {M} / Open | The Pursuit bar at the top of Home. "{N} of {M}" is the person's own count and never a rank |
| Love this / Loved | The reaction button on a Moment. Loved when you have reacted |
| Count me in / You’re in | The action on a Moment that is an upcoming event |
| See {Corner} | The action on a Moment from a Space or Corner you follow and not from a person you follow |
| Pull to refresh / Let go to refresh / Refreshing… | Home pull-down states |
| You’re caught up | End of the Home feed |
| See all Moments | Link under the end of Home. Opens the older grid at /my-space/all |
| Soosh is better with your people | Title of the first card on Home when nothing from your people has arrived yet |
| Bring a friend and start your first Pursuit together. | Line under it. The brief's gold Stub promise is not made here |
| Invite on WhatsApp / Find contacts | The two buttons on that card |
| Happening near you this week | Events in open Spaces in the next 7 days |
| Follow a few Spaces | Three open Spaces to look at |

### Corner on a Moment (Oct 28, 2026)

| Term | Meaning |
|---|---|
| Add it to a Corner | Heading on Posted, shown only when the Moment has no Corner. Up to three chips follow, then Skip |
| Added to {Corner} | Replaces the chips after one is tapped |
| Skip | Dismisses the chips. The Moment stays without a Corner |
| Couldn’t add it. Try again. | Shown if the save failed |

A Corner is never guessed for a person. It comes from something they chose that carries one: the Activity row, a Pursuit (picked in Counts toward, or the one Log was opened from), a Corner's own "I did this" link, or a tap on one of these chips. The chips show only when nothing picked carries a Corner.

### Core loop v1, screens 9 to 12 (Oct 28, 2026)

Strings from `docs/design/core-loop/09` to `12`, added with PR 5. The brief's "follower" and "people doing it" counts, "You're one behind" and "cheered" are not used (counts on Spaces and people, comparison wording, the word cheer).

| Term | Meaning |
|---|---|
| {City} · {N} Stubs · {N} Corners | Line under your name on You. City only if you gave one. Corners is how many you have logged in |
| Stubs / Pursuits / Moments | The three tabs on You. Stubs newest first; Pursuits active first, then finished with their gold Stub; Moments grouped by Corner |
| Shelf, links and badges | Link at the bottom of You to the fuller page (/you/all) |
| No Stubs yet. / Log a Moment toward a Pursuit and you get one. | Empty Stubs tab |
| No Pursuits yet. / Start one from any Corner. | Empty Pursuits tab |
| No Moments yet. / Anything you log shows up here. | Empty Moments tab |
| Finished / complete | Meta on a gold Stub |
| Share / Link copied | Button on a full-screen Stub and on a Space; what it says once the link is on the clipboard |
| Search Moments, people, Spaces | Search field. Cancel leaves it |
| This week / Up to 2 hr / With people | Search filter chips. "Free" is not offered yet: only events carry a price and Search does not list events |
| Activity / Open Pursuits near you / Spaces / People | Search sections, in that order. Activity rows show the group and how long it takes, never a count of people |
| Type something to search. | Search with no query |
| Ask Soosh | Card shown first when a search reads like a sentence. Behind `askSooshEnabled`, off by default; plans are fixtures |
| Notifications | Title of the screen. "← Home" goes back |
| Needs you / Earlier | The two sections. Needs you holds cards with two buttons that collapse away when answered |
| {Pursuit} is {time} · {N} going | Accent card for the next session of a Pursuit you are in and have not answered. Buttons I’m going and Can’t make it |
| {Name} wants to join “{Pursuit}” | Card for someone asking to join an open group you run. Buttons Let in, Not now, and a View profile link |
| {Name} wants to follow your Shelf | Follow request card. Buttons Accept and Decline |
| {Pursuit} has been quiet for {N} weeks. Pause it? | A nudge in Earlier after 5 weeks with nothing logged. Button Pause. Never a score |
| Nothing here yet. | Empty Earlier |
| Open Pursuits | Heading on a Space page over the open groups its hosts run. Badge "{N} spots" is the spots left |
| Price (optional) / Spots (optional) / Booking link (optional) | Event fields. Under the link: "People pay and book on your page." |
| Book on the host’s page | Link out from an event with a booking link. Nothing is paid inside Soosh |

A Space is listed on Discover, Corner pages, Search and Home only once members (people who are not its hosts) have shared an approved Moment in it. On its own page, members' Moments come first and the hosts' own after.

## Onboarding (Soosh onboarding brief, Oct 29, 2026)

**Approved by the founder, Oct 30, 2026** (brief section 10.8). Stubby is the character's name. It is not a product noun, so it is written "Stubby" and never gets a rule of its own. Stubs (the keepsakes) keep their name.

| Term | Meaning |
|---|---|
| Stubby | The character: a ticket with a face. It never talks; it reacts |
| Admit one | Printed on Stubby's tab (also the stamp on an event ticket, above) |
| Stop saying you’ll do it. | Welcome headline |
| Get started | Welcome button |
| What would you say yes to? | Heading of the picks question: pick three or more Corners |
| When are you usually free? | Heading of the free-time question |
| What’s already yours? | Heading of the passes and gear question |
| A month for doing things | Label of the monthly budget choice. Private: never on a profile, a Stub or any shared view |
| Put a face on your card | Heading of the member card photo |
| Tonight’s yours. | First plan headline. By time: Tomorrow’s yours. / This weekend’s yours. / Here’s one for this week. |
| Tear off half for a friend | Button on the first plan: invite one person to it |
| Who gets the other half? | Heading of the invite screen |
| Take my half | Button on the invite arrival screen |
| {Name} saved you a spot | Headline on the invite arrival screen |
| Back | Button (arrow) on every onboarding screen except the welcome and the first plan |
| Next | Button on an onboarding screen that has only one thing to do |
| {n} of 3 | Step counter on the three taste questions only. Not a progress score: no levels, no streaks |

### Onboarding, account screens (PR 2)

**Approved by the founder, Oct 30, 2026.** The strings the brief gives for these screens (I already have an account, Continue with Google, Continue with Apple, Continue with email, Never shown to anyone, Use my location, the wrong code line and the under-age line) are used as written. The rest are new.

| Term | Meaning |
|---|---|
| Sign up | Heading of screen 2 (the button of that name on the log in page is unchanged) |
| Continue | Button after the email is typed, which sends the code |
| Add your email / Add your first name / Add your birthday / Add a neighborhood | The primary button while its field is empty: it says what is missing |
| That doesn’t look like an email address. | Email field error |
| Check your email | Heading of the “Check your email” confirmation after a password reset link is sent (the code screen has its own, below) |
| Code | Label of the code field |
| That code didn’t match. Try again or send a new one. | Wrong or expired code (Stubby shrugs) |
| New code sent. | After a resend |
| First name / Username | Labels on the name screen. What should people call you? is the heading |
| @{username} is free | Under the username while it is available |
| @{username} is taken. @{next} is free. / Use @{next} | A taken username: the next free one, never an error dialog |
| Use 3 to 20 letters, numbers or underscores. | Username rules |
| When’s your birthday? / Date of birth | Heading and label. Never shown to anyone. sits under the field |
| That date doesn’t look right. | Date field error |
| Soosh is for people 18 and over for now. | Stop screen under the minimum age (Stubby tilts). Its button is Log out |
| Where are you? / Neighborhood or city | Heading and label on screen 6 |
| Location is off. Type your neighborhood instead. | Location denied. Shown once, no repeat |
| That’s outside New York. Type your city instead. | Location read, but not in New York |

### Onboarding, taste screens (PR 3)

The four questions (What would you say yes to? / When are you usually free? / What’s already yours? / A month for doing things) are approved above. **Approved by the founder, Oct 30, 2026:** the rest of these screens. Nothing here says what a pass saves, ranks a Corner, or scores a person.

| Term | Meaning |
|---|---|
| Pick {n} more | Disabled Next on the picks question while fewer than 3 are picked. No maximum |
| (Corners as chips) | Text only, no emoji, in two columns. One chip per activity: where two Corners are the same activity (Running and Run clubs), only one is offered |
| + Something else | Link under the Corners: opens a search of Corners that already exist. It never makes a Corner |
| Find a Corner | Label of that search field |
| No Corner by that name. | Empty state of that search |
| {FirstName}’s going | Line under a Corner picked from a friend’s invite: the friend whose Pursuit is in it, first name only. It starts picked and can be unpicked |
| Pick a time | Disabled Next on the free-time question while no window is on |
| {n} windows a week | Live count under the grid, through `plural()`. Daytime and Evening, by day |
| Daytime · Evening | Row headings of the grid. A cell reads "Saturday daytime, on" |
| Connect a calendar · Coming soon | A row that does nothing yet |
| Skip for now | Second button on the free-time question, same size as Next (already approved above) |
| Passes and gear | Heading of the kinds a person already has |
| Climbing · Museum · Library · Bike · Fitness · Gear · Other | The kinds of pass. One each, with an optional place |
| {Kind} place (optional) | Label of the place field under a pass |
| Only you see this. | Line under A month for doing things: the budget is private, never on a profile, a Stub or any shared view |
| Free only · $50 · $100 · $200 · Skip | The monthly budget choices. Skip sits beside the amounts at the same size and saves no budget |
| Your first plan will use free things and what your passes cover. | Line shown after Skip on the budget |

### Onboarding, first win screens (PR 4)

Put a face on your card, Tonight’s yours., Tomorrow’s yours., This weekend’s yours., Here’s one for this week., Tear off half for a friend, Who gets the other half? and Admit one are approved above. **Approved by the founder, Oct 30, 2026:** the rest of these screens. A reason line only repeats an answer that matched. Nothing here says what a pass saves: a pass is named ("You have a climbing pass."), never turned into "$0".

| Term | Meaning |
|---|---|
| No. {n} · Joined {month year} | The member card: the number, then when they joined (through `formatMonthYear`) |
| Add a photo · Later | Buttons on the card screen, same size. Add a photo (and the photo circle on the card) opens the photo picker, and reads Next once there is a photo |
| Finding your plan… | While the first plan is looked for (Stubby thinks) |
| Today’s yours. | First plan headline when the plan is today before 5pm (Tonight’s yours. is today from 5pm) |
| I’m going solo | Button on the first plan: do it without tearing off half. The action is the same as I’m going: an event’s own I’m going, joining an open Pursuit, or a small Pursuit of their own for a plan at home |
| Show me something else · Show me Discover | The link under the first plan. After the third plan it reads Show me Discover and opens Discover |
| {Corner} at home | Title of a plan to do at home, from the Corner’s guide |
| With {FirstName} | Line on a plan that is someone’s open Pursuit |
| {FirstName} is already in. | Reason line on a friend’s plan |
| You said {Day} {daytimes or evenings} work, and you picked {Corner}. | Reason line when a free window matched. With no free windows given: You picked {Corner}. |
| You have a {kind} pass. | Added to a reason line when one of their passes is for that Corner (climbing, bike). Never "$0 with your pass" |
| Free · ${n} | The cost line, only when the listing gives a price. No price known means no cost line |
| Soosh plans in your city are coming. For now, here’s one you can do anywhere. | Under the headline when someone outside New York gets a plan at home |
| Nothing for this week yet. · Have a look at Discover. · Go to Discover | When no plan fits |
| {FirstName} saved you a spot | On the half-ticket preview on the invite screen: what the friend receives (Stubby’s stamp, this line, the plan, the day and time). The friend’s own arrival screen says the same with the sender’s name |
| Send · Nothing to send | Buttons on the invite screen. Send opens the phone’s share sheet, or copies the link where there is none (Link copied, already approved). Nothing to send shows when the link is gone |
| Sent. Now it’s a plan. | Headline once the half is sent. Send and Skip are gone and one button is left |
| See my week | The one button after going or sending: ends onboarding and opens Home |
| Add to calendar | A link under the plan once they are going, and on the sent screen: downloads an .ics with an alarm an hour before. No notification permission is asked for |
| I’m doing {title} on {when}. Take the other half: {link} | The message that goes with the link |

### Log in (Soosh log in brief, Oct 29, 2026)

**Approved by the founder, Oct 30, 2026.** Reuses Continue with Google, Continue with Apple, Continue with email, Get started, the wrong code line, New code sent. and Log out from above. Existing line kept: Forgot your password?. Replaced by the log in brief, revision 2: Use my password instead and the separate password screen (the password is on the log in screen now) and the old reset confirmation ("If there’s an account for that address, a reset link is on its way…").

| Term | Meaning |
|---|---|
| Welcome back. | Headline of the returning-user screen (Stubby wakes up when you tap or type) |
| New here? Get started | Link on it, to the onboarding |
| Log in | Heading of the log in screen, and the Log in button after a reset link |
| Send me a code · Log in with password | The two equal buttons on the log in screen; the one this device used last comes first. Either is off until what it needs is typed |
| That email and password don’t match. | The one message for a wrong email, a wrong password and an account with no password (Stubby shrugs). Never says which |
| Password (if you have one) | Label of the password field on the log in screen |
| If there’s an account for {email}, we’ve sent a link. | After Send reset link, for any address |
| Reset your password | Heading of the forgot-password screen |
| Send reset link | Button on it. Check your email follows, with the line above and a Log in button |
| Signing you in… | While the session is made (Stubby thinks) |

### The code screen, in stages (log in brief revision 3, Oct 30, 2026)

**Approved by the founder, Oct 30, 2026.** Used by log in and by sign-up. Nothing on it depends on whether the address has an account: a late code must never suggest the person is new, and an address with no account sees the same words at the same times as one with an account.

| Term | Meaning |
|---|---|
| Check your inbox at {email}. | Heading, from the first second |
| Codes usually arrive in under a minute. | Line under it, for the first 30 seconds |
| Send a new code in {m:ss} | Countdown for the first 30 seconds (0:30, 0:29, and so on) |
| Still nothing? Check your spam folder. | Replaces the two lines above after 30 seconds |
| Send a new code · Log in with password · Use a different email | Three equal options after 30 seconds. Sign-up has no Log in with password. Send a new code starts the 30 seconds again |
| New to Soosh? Get started | Footer link on the log in code screen, from the first second. Opens sign-up with the email typed. Not on the sign-up code screen, where the person is already doing that |
| You can ask for another code in {time}. | Shown under the code field, instead of an error, when too many codes were asked for. The time is worded by `formatWait` in dates.ts (45 seconds, 1 minute) |
| Too many codes for now. Try again in a little while, or log in with your password. | The hourly cap on codes, which has no time to give (so none is guessed): instead of an error, on log in. Sign-up drops "or log in with your password", since it has none |

### Passwords (log in brief, revisions 1 and 2)

**Approved by the founder, Oct 30, 2026.** A password is a real option, never a hidden link, and never required.

| Term | Meaning |
|---|---|
| Want a password too? | Heading of the one optional screen after an email code is accepted at sign-up (not a numbered step; never shown after Google or Apple) |
| Optional. You can always log in with a code. | Line under it, and under Add a password in Settings |
| Add a password · Skip for now | The two equal answers on that screen. Add a password is also the Settings > Account button for an account without a password |
| Change password | Settings > Account button for an account that has one (as before) |

## Profile

The profile rebuild (`/you`, `/u/:username`). **Every row below is a new string, taken from the build brief, for approval.** The profile shows no "Shelf", "Corner" or "stamps".

| Term | Meaning |
|---|---|
| Friend | Two people who follow each other. Shown as a count ("Friends") and as the button "Friends" on a friend's profile |
| Follower | Someone who follows you, one way. A profile you follow without being followed back shows "Following"; one that follows you first shows "Follow back"; otherwise "Follow", then "Requested" while it waits for them to accept |
| Level 4 of 8 | Eyebrow on the level card. Sentence case (the brief's all-caps eyebrow is not used: no ALL CAPS) |
| Just Getting Started, First Step, Out & About, Weekend Regular, Plan Maker, Good Company, Neighborhood Regular, Local Legend | The eight levels, at 0, 1, 3, 7, 10, 20, 35 and 50 Stubs. Kept in `src/app/lib/levels.ts` and in the database function `private.level_for`; `levels.test.ts` pins the thresholds |
| 7 of 10 Stubs · 3 more to Plan Maker | Progress line on your own level card. Others see "Level 4 of 8 · 7 Stubs" with no progress |
| Log 1 Moment to earn your first Stub and reach First Step. | Level card with 0 Stubs |
| All levels | Link on the level card that lists all 8 |
| You both | Eyebrow on a friend's profile over the Pursuit categories you share, written as given and joined naturally ("Climbing and Pottery.") |
| You do this too | Tag on a friend's Pursuit in a category you also have a Pursuit in |
| Friends with Sam R. and 2 others you know | Mutual friends on a friend's profile. A follower sees a count only; others see nothing |
| Plan something together | Primary button on a friend's profile. Replaced by "{name} isn’t taking plans right now" when they paused planning |
| Plan with {first name} | Title of the plan sheet. Sections: Do what?, When you’re both free, Where |
| Something new | The always-there option under Do what? |
| Picked from both your schedules. Neither of you sees the other’s full availability. | Line under the times |
| Suggest somewhere else · Send invite · Send an open invite | Plan sheet actions. "Send an open invite" replaces the times when none are shared (No shared times in the next 2 weeks.) |
| {first name} sees the plan, not who suggested which time. | Caption under Send invite |
| Invite sent to {first name} | Toast after sending |
| You both have memberships here · {name} is a member | The note on a suggested place |
| Your planning | Owner-only card. Rows: Availability, Free time, Budget, Memberships & gear, Calendar (Not connected), Pause planning |
| Only you see this | Pill on the planning card |
| Friends: shared times only, when planning · Only you · Only you, never shared · Friends: names only | Who sees each planning row |
| Pause planning · Hide you from all suggestions and plans | Owner switch and its line |
| Who can see my time | Link to the page that lists each time-related field and who sees it |
| Pick your Pursuits | New-user heading over the category pills. Picking one starts an ongoing Pursuit; picking it again takes it back |
| Active · n, Finished · n | The two filter pills on the Pursuits tab |
| Finish · Reopen · Archive · Unarchive · Delete | Owner actions on a Pursuit, in its detail sheet. Archive hides it from everyone but you and keeps its Stubs; Delete asks first ("Its Stubs go with it. Its Moments stay. To keep the Stubs, archive it instead.") |
| Archived · n | Third filter pill on your own Pursuits tab, shown only when something is archived |
| Morning · Afternoon · Evening | The three day parts of Your planning (the availability buttons, screen reader labels like "Mon morning") and of Plan together (the time cards, "Sat, Nov 7 / Afternoon"). Approved Oct 30, 2026. In running text they are lowercase: "Thu evenings", "Mon mornings and evenings". **Daytime:** Morning and Afternoon together make up Daytime, the word the free-time grid on onboarding uses (Daytime · Evening). **Hours:** none are stored (`planning_prefs` holds only the part, one of `morning`, `afternoon`, `evening`). The only hours the app defines are for Daytime and Evening, in `slotOf()` in `src/app/lib/firstPlan.ts`: Daytime is 6am to 5:59pm and Evening is 6pm to midnight. Where Morning ends and Afternoon begins is not defined anywhere, so no hours are given for those two |
| Add when you’re usually free to get plan suggestions. · Not now | One-time prompt on Your planning while no availability is set |
| GIFs can’t be added here. Choose a photo. | Shown when a GIF is picked for a Moment. Moments take photos only, because video and GIF files carry GPS and creation time the app can’t strip |
| Your Moments show up here. | Caption under the first-run Moments grid. **Changed Oct 30, 2026:** it used to continue "Friends see the day and neighborhood, never the exact time." That line is held back until exact times are really private (`docs/tickets/posts-column-privacy.md`), because the old columns can still be read directly. Restore it when that ticket ships |
| Visible to others at 7:42 pm | Owner-only label on a Moment inside its 2 hour delay |
| This profile is private. | Shown to a stranger on a private profile, with the name, the level name and Follow |
| Add your neighborhood and a short bio | The link on your profile while both are empty |
| Private profile | Settings > Profile switch: people who don’t follow you see only your name and level |

### The 2 hour hold on new Moments

New, for approval. A new Moment is visible only to its owner for 2 hours (everywhere in the app, not only on the profile), unless the owner shares it now.

| Term | Meaning |
|---|---|
| Share now | Switch on Log a Moment, off by default, shown when anyone but you can see the Moment. Also the confirm button below |
| Shows this Moment to others right away. | Helper text under Share now |
| Share now? | Title of the confirm that appears when you send a still-held Moment into a chat, or add it to a Space (Add from my Moments) |
| Anyone who can see your Moments will see this one too. | Body of that confirm. Cancel, or a failed release, leaves the Moment held and shares nothing; Share now shows it to others, then sends it. A Space's hosts are told about an approval share only after the release |

## Home v2 (Oct 30, 2026)

Approved by the founder on Oct 30, 2026. Counts use `plural()`, dates use `dates.ts`.

| Where | String |
|---|---|
| Greeting | Hi {FirstName} |
| Greeting subline | {Neighborhood or city} · {Weekday}, {Mon} {D} |
| Your week card: title / link | Your week / Open |
| Your week card: count line | {N} free windows left · {N} plan (the plan part only when there is one or more) |
| Your week card: day chips | Free evening, Free all day, Free daytime, or the plan's short title and time ("Bouldering 7 PM") |
| Best fit label | Best fit for you |
| Best fit buttons | I’m going (event), Ask to join (open Pursuit), Start (at home), Invite a friend |
| At-home badge | At home |
| At-home detail | Your first step: {the guide's first step} |
| At-home row in More ways | At home · about {duration} (for example "At home · about 30 min"; just "At home" when the Corner has no typical time) |
| More ways heading / link | More ways this week / See all |
| Log card | Log a Moment / Did something today? Log it and get a Stub. |
| Feed heading | From your people |
| Bottom bar | Home, Discover, Log, Week, You |
| Why: `fits_window` | Fits your {Weekday} {evening, daytime} |
| Why: `picked` | One of your picks |
| Why: `friend_going` | {FirstName}’s going (only where you could already see who is going) |
| Why: `pass` | Your {pass kind} pass (for example "Your museum pass") |
| Why: `affinity`, no pick | You might like this |
| Why: `nearby` | Close to you |
| Why: `trending` | People are joining |
| Why: `soon` | Starting soon |
| Your week card, no free time saved | Add when you’re usually free (opens the free time screen) |
| Week page (placeholder) | Week / Your week is coming soon. / Back to Home |
| Week page, signed out | Your week lives here / Make an account to see your free time and your plans in one place. / Create an account |
| Greeting, no name on record | Welcome back |

Two reasons join with " · " ("Fits your Thursday evening · Priya’s going"). The free time screen reuses "When are you usually free?" and the "{N} windows a week" line from onboarding, with Save.

## Navigation rail (Oct 30, 2026)

From 744px wide (and 480px tall) a signed-in person gets a left rail in place of the bottom bar and the top header. Icons only up to 1279px, icons and words from 1280px. Labels are the same as the bottom bar's.

| Where | String |
|---|---|
| Rail items, top to bottom | Home, Discover, Search, Log, Week, Chats, Notifications |
| Rail items, bottom | You, More |
| Log's accessible name | Log a Moment |
| Search | Opens a panel beside the rail with the same box as the top header's ("Search Moments, people, Spaces") |
| More | Menu from the rail with Settings, Reports (admins only), Theme (System, Light, Dark) and Log out. The top header's account menu is the same menu, plus You. Approved Oct 30, 2026 |
| Skip to content | First link on a page with the rail, for keyboard and screen reader users. Approved Oct 30, 2026 |

## Discover v2 (Oct 30, 2026)

The Moment city, from PR 1 (approved Oct 30, 2026). The Discover page strings come with PR 2.

| Where | String |
|---|---|
| City chip on the composer | {city}, with a close mark (for example "New York"). Removing it saves no city. |
| City chip, accessible label | Remove {city} from this Moment |
| Moment card meta line | {Corner} · {city} (for example "Pottery · New York"), shown only when the Moment has a city |

## Retired terms

Never use these in UI copy.

| Term | Retired | Use instead |
|---|---|---|
| Rooms | Oct 28, 2026 (UI removed) | The group's own name, under Browse by |
| See all rooms | Oct 28, 2026 (UI removed) | See all |
| We sent a 6-digit code to {email}. | Oct 30, 2026 | Check your inbox at {email}. |
| Send a new code in {n} seconds | Oct 30, 2026 | Send a new code in {m:ss} |
| That email and password didn’t match. | Oct 30, 2026 | That email and password don’t match. |
