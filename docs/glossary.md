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
| Rooms | Heading above the 18 groups of Corners, shown as rows |
| Who's in where | Muted note on the right of the Rooms heading |
| See all rooms | Opens the rest of the Rooms rows |
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
| Only you / Followers / Public | Who sees a Moment |
| Pinned | You choose, on your own profile. Buttons: "Pin" / "Unpin" |
| Host picks | Hosts choose, in a Space. Buttons: "Add to host picks" / "Remove from host picks" (max 3) |
| Spotlight | The Soosh team chooses, on Discover |
| Save / Saved | Bookmark a Moment. Form buttons say "Save changes", so "Save" alone always means bookmarking |

## Stubs

New (Oct 26, 2026). **Every row below is a new string for approval.**

| Term | Meaning |
|---|---|
| Stub | A keepsake on your Shelf, shown in the Shelf's Stubs tab. Types: **silver** (your first Moment in that Corner, by `hobby_slug` and `corner`), **ticket** (a Moment with `from_ticket` set, logged from a ticket), **with someone** (a Moment with a `pursuit_id` whose Pursuit has more than 1 active member), **event** (a host-confirmed row in `public.stubs`: proof you attended a Space event, never self-awarded) and **plain** (everything else). The serial is the Moment's position among your own Moments by `created_at`. No totals or counts of Stubs anywhere. A product noun, always capitalized |
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
| I’m 16 or older and agree to the Terms and Privacy Policy | Required sign-up checkbox (email and Google). Both documents are linked. Shown once more, with a Continue button, to any account with no recorded acceptance: in onboarding for a new account, as a prompt that can't be closed for an existing one (Log out is the only other way out) |
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
| Invite / Invite link | How someone gets in while Soosh is invite-only |
| Waitlist / You're on the list | Asking to join without an invite |
| Welcome to Soosh | The inviter's button on "[Name] added their first moment": opens it with the reply box ready |

## Landing page copy (website only)

These lines are for the signed-out landing page (`src/app/landing`). They are
marketing wording, not app terms: never use them in the app UI. The page follows
the locked narrative: hero, the line, Save it / Try it / Share it, friends can
come along, privacy, real Shelves (hidden until 6 exist), invite, footer.
In-app labels on the page still follow the glossary above: "Count me in", "Finished", "In progress", "Privacy Policy".

| Term | Meaning |
|---|---|
| Welcome to the rest of you. | Hero headline |
| Log in | Text link in the landing nav, to /login |
| Request an invite | Every landing button and the waitlist form button, all going to the waitlist form |
| Save it. Try it. Share it. | Section heading and the three step labels (website only) |
| Example Shelf | Small caption under the hero and step screens (website only). Those people are examples, never real members |
| Example | Small caption under the reward, friends and privacy screens (website only) |
| Your friends can come along. | Friends section heading. The button it names is "Count me in" |
| On Soosh, the best feeling isn't a like. It's someone wanting to do what you did. | Reward section statement (website only) |
| You choose who sees each post. | Privacy section heading |
| Pick Only you, Followers or Public for each post. Nothing about your account has to be public. | Privacy section line. Names the real picker options (website only) |
| See who's on Soosh. | Real Shelves heading |
| Soosh is invite-only. | Invite section heading |
| Privacy Policy / Terms | Footer links. Contact, Instagram and TikTok appear once set in `src/app/config.ts` |
