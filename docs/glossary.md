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
| See all | Opens the full list when a list shows only some: Discover's Spotlight, and the group tiles on Discover's Corners tab (which show the first 8) |

## Door list

Discover's Corners tab (approved Oct 23, 2026). A ticket is a first step to take; "Admit one" is its stamp.

| Term | Meaning |
|---|---|
| Issue {n} | Whole weeks since Sept 1, 2026, plus 1, on the line above the masthead |
| Things to do tonight / For members | The two halves of the strip under the masthead |
| Cover story | Kicker on the top ticket, shown big |
| ticket | A Corner's first step, shown as a card or the cover story |
| Admit one | The stamp on a ticket and on the cover story's sticker |
| Take the ticket | Link under the cover story that opens the Corner |
| Start here | Heading above the row of tickets |
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
| New Spaces | Home section |
| Book the studio | Hidden until the marketplace is on |

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
| Stub | A keepsake on your Shelf, shown in the Shelf's Stubs tab. One concept with five types: silver, ticket, with someone, event and plain. The Door list brief defines the types and derives them from your Moments; the **event** type is proof you attended a Space event, confirmed by the host, and is never self-awarded. A product noun, always capitalized. No counts, rankings or leaderboards |
| Past events | Heading of a host's list of ended events, on the Space's Events tab |
| Confirm who came | Host button on a past event: opens "Who came?" |
| Who came? | Title of the dialog where a host ticks who showed up from the people who said "I’m going" |
| Confirm / Confirmed | The dialog button / a person already holding a Stub for that event |
| No one said they were going. | Empty state of that dialog |
| N Stubs confirmed. | Toast after a host confirms |
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
