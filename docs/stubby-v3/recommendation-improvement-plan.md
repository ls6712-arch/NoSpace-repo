# Implementation plan: better recommendations from clean information

Status: **plan only; application implementation is pending**.
Based on the code reviewed at `cc37c51`, including V3's per-account rollout,
Claude-only provider, care handling, internal Pursuit/Corner suggestions, and
onboarding personalization by default. Older audits describe earlier behavior.

## Outcome

Someone can tell Soosh what they enjoy, what they want more room for, and how
time fits into their life. Stubby, Home, Discover and calendar use consistent
meanings for those answers. Every recommendation distinguishes what is known,
self-reported, estimated or unknown.

Home activities, small personal projects, regular practice, shared experiences
and going out all remain valid. Initial onboarding does not lead with an outing,
a spending form or a requirement to fill every profile field.

Deliver this as six small PRs, in the order below. Existing accounts keep their
answers and do not repeat onboarding. Each PR includes its own relevant checks;
new personalization is released to test accounts before broader activation.

| PR | Change | User-visible result | Depends on |
| --- | --- | --- | --- |
| 1 | Shared meanings and normalized profile | The same answer has the same meaning across Soosh | Existing data audit |
| 2 | Reliable saving, editing and removal | Saved information stays accurate and correctable | PR 1 |
| 3 | Accurate activity facts | Suggestions state requirements and uncertainty honestly | PR 1 |
| 4 | Connect recommendation surfaces | Stubby, Home and calendar respect the same applicable constraints | PRs 2–3 |
| 5 | Short, human onboarding | A few useful questions lead to relevant suggestions | PR 4 |
| 6 | Specific feedback and measured rollout | Recommendations improve without overlearning from a single action | PR 5 |

## PR 1: give existing information shared meanings

Create a versioned personalization contract and adapters over the current
tables. This is one consistent way to read information, not a requirement to
copy all existing records into a new table.

Define these concepts separately:

| Concept | Meaning |
| --- | --- |
| Interest | Canonical Corner/activity ID; existing relationship can remain unspecified |
| Relationship to an interest | Already enjoy, curious to try, returning to it, or unspecified |
| Motivation | A chosen goal such as making, learning, movement, company or personal time |
| Experience | Per activity, supplied by the person; never inferred from enthusiasm |
| Usual rhythm | Soft recurring preferences, with timezone when relevant |
| Current context | This request's time, duration, setting, company and other requirements |
| Equipment | A specific self-reported resource; unrelated to verified admission benefits |
| Money | Monthly planning amount, usual activity preference and explicit current ceiling kept separate |

For saved signals, carry origin, confirmation time when known, visibility and
whether they are a preference or a firm requirement. Give current context a
bounded lifetime. Mark legacy origin and unknown dates honestly; do not invent
confirmation history during migration. Default New York/timezone values remain
defaults rather than becoming facts about the person.

Keep canonical IDs behind editable labels. Reuse existing Corner aliases and
merges. An invite-seeded Corner is a suggestion until confirmed; do not infer
ownership, skill or permanent preference from an invite or an active Pursuit.

Stop interpreting a monthly amount as an activity ceiling or silently dividing
it into a presumed activity allowance. Use a separate activity preference only
when supplied. A skipped budget is unknown; confirmed zero is free-only. Monetary
values carry their currency; do not silently convert unsupported currencies.

Preserve current personalization policy: user-supplied onboarding/saved answers
are used by default; learning from feedback remains a separate opt-in. Keep
private goals and temporary feelings out of the public `profiles.moods` field.
Deprecate obsolete consent flags explicitly rather than allowing different
readers to interpret them differently.

Acceptance:

- Existing onboarding, guest quick context, passes and capability rows have
  explicit mappings; ambiguous legacy entries remain unspecified.
- Existing public capability APIs/exports remain compatible. New fields do not
  bypass the strict existing parser with untyped free-text conventions.
- The same input produces the same normalized facts for every consuming surface.
- No account data is reset and no user is sent back through signup.

## PR 2: make reads, saves and removal dependable

Distinguish loaded, missing, unavailable and invalid data. Distinguish an
unanswered field, an explicit value and an explicit removal.

- Report a real failed save rather than claiming success when schema is missing.
  Let the person continue without claiming their information was remembered.
- Make Skip preserve an existing answer. Offer a separate clear/remove action.
- Prevent a failed read or stale edit from overwriting good information with
  empty defaults. Preserve expected-account checks and owner-only access.
- Reuse unambiguous original equipment answers; ask for clarification of generic
  Gear. Do not ask the person to maintain two equipment inventories.
- Use transactional saves when one action changes several records. Handle
  concurrent edits with a revision check or an equivalent conflict mechanism.
- Extend view/edit/delete to the new fields and any new feedback records.
  Explain which original onboarding answers remain after forgetting an extension.

Roll out schema changes additively: readers accept old and new supported
versions before new writers are enabled. Prevent older clients from making
lossy replacements. Keep original values for rollback; do not edit historical
migrations or silently change public visibility.

Acceptance:

- Failed load/save, explicit clear, Skip, reload, account switch and concurrent
  edits have meaningful regression cases.
- Test accounts retain their existing interests, windows, passes and picks.
- Two-account hosted tests prove owner isolation and complete intended deletion.

## PR 3: improve the activity side of matching

Extend the existing activity library and its generated backend representation.
Keep one editable source and the current generation/synchronization check.

Record, where known:

- Explicit suitability for home, a venue, outdoors or online. Indoors alone
  does not establish that a particular first step works at home.
- Fixed event time versus a flexible idea, duration estimate/range, timezone,
  and whether a proposed start is merely a suggestion.
- Beginner suitability and solo/shared formats. Use these facts to support the
  selected motivation without promising an emotional or health outcome.
- Specific requirements, optional items and alternatives: paper **or** a tablet
  should not become a requirement to own both.
- Known cost and required fees/materials, with unknown cost kept distinct from
  zero. A self-reported pass cannot establish free entry.
- Source, fact verification status and check time. A known Soosh page establishes
  an idea's origin; it does not automatically verify affordability or ownership.

Replace unconditional zero-cost assumptions for internal ideas with supported
facts or unknown cost. Retain useful suggestions with clear requirements when
the request allows uncertainty. Abstain when an unknown fact prevents meeting
a firm requirement.

Acceptance:

- A home suggestion with unconfirmed materials cannot be presented as confirmed
  free or fully feasible merely because it is from Soosh.
- Fixed events and flexible ideas cannot acquire fabricated scheduled times.
- Required/optional/alternative resources are represented and checked correctly.
- Missing duration, price, suitability or routing evidence remains visible and
  cannot silently satisfy an applicable hard requirement.

## PR 4: connect every recommendation surface

Apply the shared profile and activity meanings to first-plan onboarding,
Stubby's legacy/V3 paths, Home suggestions, Discover filters and calendar picks.
Keep existing guest/account gates, care handling, quota rules and explicit
RSVP/join/plan actions.

Share pure TypeScript rules where appropriate for browser/Edge code. Home's SQL
ranking needs corresponding rules and parity fixtures; SQL cannot simply import
the TypeScript module. Preserve browser-local calendar/deck privacy and keep
private profile details out of public catalog responses and search queries.

Different surfaces may rank differently: Home can explore while a direct ask
honors explicit intent. Given identical candidates and constraints, their
hard eligibility decisions must agree.

Use this precedence: safety/age/access requirements; explicit current request;
applicable saved firm requirements; saved soft preferences; consented feedback;
general discovery. Current requests may explicitly override soft preferences
without rewriting the profile or bypassing safety requirements.

Generate explanations from actual facts used. Keep curated discovery distinct
from learned affinity. Do not say a time is free, a pass covers entry or a person
likes something when the data does not establish it.

Acceptance:

- Cross-surface fixtures cover money, timezones/DST, resources, city, exclusions,
  current-request overrides and unknown information.
- Guest quick-context values have an explicit consumer or are not asked for;
  supplied information does not disappear when the guest signs up.
- Existing calendar actions, invite destinations, signup return and care paths
  remain compatible. No new third-party analytics of private picks or answers.

## PR 5: introduce the human onboarding

Keep authentication, terms and age checks. Use these three preference cards:

| Card | Question | What is saved |
| --- | --- | --- |
| 1 | What would you like to make more room for? | Optional selected motivation IDs, private |
| 2 | What do you already love, or keep meaning to try? | Canonical interests and optional relationship to each |
| 3 | What does a little free time look like for you? | Optional usual rhythm and duration preferences |

Allow one genuine interest, exploration or a skip; remove the three-interest
minimum. Preserve search and existing answers. Ask at most one relevant optional
follow-up, such as returning to guitar or having a bike, rather than interrogating
every selected interest.

Show an editable summary before recommendations. Explain saved personalization
and the separate feedback choice plainly. Keep photo/card setup and invitations
after the useful result. Returning guests resume their current ask rather than
being forced into a second questionnaire.

Ask practical questions when useful: Where should I look? Would you rather keep
this free? Anything you already have that you'd like to use more? Keep monthly
budget, exact scheduling and complete equipment inventories out of the initial
cards. Unknowns remain acceptable unless needed for a specific request.

Acceptance:

- Every new answer demonstrably changes retrieval, suitability or ranking in a
  controlled fixture; no question exists only to populate a profile.
- Home practice, a small personal project, online/shared experiences and going
  out all work as first suggestions.
- Back, resume, skip, edit, screen-reader announcements and reduced motion work.
- Test the roughly 60–90-second preference-flow target with people; do not treat
  that target as a measured result or include authentication time in it.

## PR 6: add specific feedback and validate improvement

Keep Good pick, Not for me and Save. Optionally ask a short reason after rejection:
price, time, distance, activity, or just today. Let the person distinguish this
request from a usual preference before saving a lasting change.

Extend the owner-only feedback contract with target dimension, scope and time
where needed. Respect feedback opt-in, its read window and deletion. A save is
interest rather than attendance; a rejection today is not permanent dislike.
Do not introduce passive inference of diagnoses, relationships or financial status.

Before rollout, run a common scenario set through the current and updated
matchers. Require zero violations of the agreed hard constraints and no regression
in the required scenario groups. Include sparse profiles, new/returning interests,
unknown price/resources, stale facts, failed saves and conflicting preferences.

Then use the existing per-account tester mechanism in an approved test environment:

1. Verify additive migrations, owner access/deletion and mixed-client compatibility
   against the complete hosted schema, using test accounts.
2. Reuse existing Claude server bindings for live checks. Measure total latency
   and usage, including any enabled shadow comparison; keep spend and retry bounds.
3. Ask a small volunteer cohort whether suggestions fit. Compare usefulness,
   time to a useful result, corrections and empty results with the baseline.
   Keep raw answers, pick details and feedback reasons out of third-party analytics.
4. Expand only after these checks pass and the owner reviews the release. A
   production merge/deploy remains a separate action. Use reversible flags and
   retain old readers/data for rollback.

Acceptance:

- Feedback-off behavior stays off, and a temporary rejection does not mutate
  enduring preferences.
- Tests show that a correction changes the intended dimension only.
- Live quality, cost and latency evidence is recorded separately from mocks.
- Rollback has been exercised in the approved test environment.

## First implementation task

Start PR 1 with a short decision matrix for unknown/zero cost, monthly/activity
budget, usual/current availability, resource ownership and source confidence.
Implement the normalized read contract and compatibility adapters against that
matrix. Follow with reliable persistence before enabling new onboarding writers.

The code evaluation ran 78 targeted checks successfully; those checks describe
the existing behavior, not completion of this plan. No application code, schema,
live data or production setting was changed while writing it.

## Implementation references

- [Human onboarding direction](onboarding-redesign.md)
- [Existing onboarding persistence](../../src/app/lib/onboardingRemote.ts)
  and [taste/pass adapter](../../src/app/lib/tasteRemote.ts)
- [Capability parser](../../supabase/functions/_shared/capabilityProfile.ts)
  and [read-only onboarding contract](../../supabase/functions/_shared/onboardingCapability.ts)
- [V3 context](../../supabase/functions/stubby-scout/v3/context.ts),
  [candidate types](../../supabase/functions/stubby-scout/v3/types.ts),
  [internal suggestions](../../supabase/functions/stubby-scout/v3/soosh.ts)
- [First-plan matching](../../src/app/lib/firstPlan.ts),
  [calendar picks](../../src/app/lib/stubbyPicks.ts),
  [Home items](../../src/app/lib/homeItems.ts)
- [Home SQL ranking](../../supabase/migrations/20261030172959_home_suggestions.sql)
  and [shared catalog generator](../../scripts/cornerHomeData.ts)
- [Current rollout instructions](environment-and-rollout.md)
