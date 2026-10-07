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

## Hobbies and Spaces

| Term | Meaning |
|---|---|
| Category | The 15 hobby groups. Internal only, never shown to members |
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
| Reflection | Private note on a Moment |
| Only you / Followers / Everyone | Who sees a Moment |
| Pinned | You choose, on your own profile. Buttons: "Pin" / "Unpin" |
| Host picks | Hosts choose, in a Space. Buttons: "Add to host picks" / "Remove from host picks" (max 3) |
| Spotlight | The Soosh team chooses, on Discover |
| Save / Saved | Bookmark a Moment. Form buttons say "Save changes", so "Save" alone always means bookmarking |

## Pursuits

| Term | Meaning |
|---|---|
| Pursuit / Start a Pursuit | Named ongoing goal / the only create wording |
| Goal / Measure / Unit | How progress counts |
| Stepping stones | Steps toward the goal |
| Aim for | Optional target date (no urgency language) |
| Check in with me | Gentle Pursuit reminders. "Check in" means only this |
| Just started / In progress / Resting / Completed / Let go | Statuses. Buttons: "Mark as completed", "Let go" (stop without finishing; "Pick it back up" undoes it) |
| Next session | Card at the top of an active Pursuit: when, plus an optional note |
| Times a week / [N] of [M] this week | Your own weekly aim for a Pursuit, and the count toward it (days with a Moment, Mon–Sun) |
| One shared goal / Side by side | Shared Pursuit modes |
| Pursuing together | People in a shared Pursuit |
| Start a Pursuit with [Name]? | Shown after Count me in: opens a new Pursuit with them invited, side by side |

## Profile

| Term | Meaning |
|---|---|
| Shelf | Your profile page |
| Book | One Corner's history on your Shelf ("Your Pottery book") |
| Scrapbook | The photo-book view of your Moments (the /studio page) |
| Cover | Profile cover area |
| Tell your story | Bio |
| Moments logged | Headline stat |
| Quiet Milestones | Private badges, shared one at a time |
| Followers / Following | People connections |

## Home, reactions, connection

| Term | Meaning |
|---|---|
| Contact Sheet / You Inspired / You're caught up | Home sections |
| Love this / Count me in / Thoughts | Reactions |
| [Name] loved your moment. / [Name] and N others loved your moment. | The Love this notification, at most one per moment per day |
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

## Landing page

| Term | Meaning |
|---|---|
| Invite-only for now | Eyebrow above the hero headline, and the waitlist section's kicker |
| A place for everything you do and make. | Hero headline |
| I have an invite | Secondary hero button / waitlist-section button, both going to sign-in |
| Soosh is for people 16 and older. | Age-eligibility line (hero, footer) — read the app name from `APP_NAME`, never hardcode it |
| Choose who sees it / Keep going with a Pursuit | Landing-page value-card titles (the third, "Log a Moment," reuses the existing term above) |
| Find your people, or just your thing. | "Spaces and Corners" section heading |
| Share what you want, with who you want, or with no one. | Statement band, replacing the old "no feed algorithm / no streaks" quote |
| Terms / Privacy Policy / Contact | Footer links and the waitlist form's consent line |

## Saving, states and confirmations

All of these live in `src/app/lib/stateCopy.ts`; use them from there.

| Term | Meaning |
|---|---|
| One sec… | Label beside the spinner while a button's save is in flight |
| Something went wrong. Mind trying again? / Try again | The one error line and its retry |
| Something went wrong loading this. Mind trying again? | The same, when content didn't load |
| You're offline. Anything you've typed stays put. | Banner while offline |
| This is taking a while. Still trying. | Banner when a request runs past 8 seconds |
| Changes saved / Saved / Link copied / Invite sent / You left [Space] | Toasts. "Saved" alone is only for bookmarking |
| That iPhone photo couldn't be converted. Try again, or export it as a JPG first. | HEIC failure |
| That file is too big. Try a smaller one. / That file is over [N] MB. Try a smaller one. | Size failure |
| That upload didn't finish. Check your connection and try again. | Upload failure |
| That Moment is already in this Space. | Adding a Moment twice |
| Keep it | The back-out button on "Cancel this event?" |
| Browse Spaces / Browse Moments / Go to Chats | Empty-state actions, alongside Log a Moment, Start a Pursuit, Go to Discover |

Empty states: a short line ending in a period, an optional one-line hint, one action.

## Writing rules

- Capitalize Soosh's own nouns: Moment, Pursuit, Space, Corner, Reflection,
  Shelf, Book, Scrapbook.
- "hobby" is fine as an everyday word in explanations; any label for a hobby
  tag says Corner.
- "Explore" means only "Explore together". Browsing links say "Browse" or name
  the place ("Go to Discover").

## Retired (never use in UI copy)

Sushii, No Space, Clan, Circle, Update, Category (member-facing), My Space,
Featured, Featured by the hosts, Pinned by the hosts, Pin to Home, On the table
(as a heading), Save to your Space, Feed (outside Home), Studio, archive,
Lifetime sessions, "work" (as a noun for Moments), Start your log, Add Moment,
Add a Moment, Quick moment, Write a moment, Post (as a button), Create a
Pursuit, Create Your Pursuit, Begin Pursuit, Milestones (in Pursuits), Deadline,
Participating, Moving (as a status), Complete (as a status), Thread, Try This,
Obsessed, Needed it, Creation, Entry, Project.
