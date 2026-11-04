# Codex build instructions: clean personalization and human onboarding

Implement the changes below in `ls6712-arch/NoSpace-repo`. This is a coding task.
Deliver working application changes, additive migrations where necessary,
meaningful tests and an implementation PR. Do not stop after writing a plan,
changing copy, creating types without consumers, or opening a documentation PR.

## 1. Start from the actual current code

- Inspect repository instructions, local changes, the latest `main`, and
  `feature/stubby-context-v3`. Preserve others' work and remote history. Work
  on an implementation branch using the existing checkout/workflow.
- Read [the improvement plan](../stubby-v3/recommendation-improvement-plan.md),
  [the onboarding direction](../stubby-v3/onboarding-redesign.md), the latest
  notes in [the index](../stubby-v3/README.md), and relevant source/tests.
  If those documents are absent on main, retrieve them from the plan branch.
- Older audits describe an earlier V3. Verify current behavior rather than
  restoring old assumptions. The reviewed newer implementation uses Claude,
  per-account testing, care handling, personal Pursuit/Corner suggestions and
  saved onboarding by default. Feedback learning is separately opted in.
- Run a relevant baseline, then start implementing. Make ordinary technical
  decisions without stopping to ask which phase to do. Implement all six stages
  as reviewable commits; split into dependent PRs at useful boundaries if needed.
  Do not merge into main in order to complete the work.

## 2. Product requirements

Soosh helps people make room for things they enjoy: at home, in small personal
projects, through practice, with others, online or outside. Going out is one
possibility. The initial experience must not sound like booking an event or
completing a spending questionnaire.

Use these three onboarding preference questions:

1. **What would you like to make more room for?**
   Offer a small set of optional motivations: making something, learning,
   movement, company, personal time or exploring. Calm/quiet preferences must
   not become a diagnosis or a promise of a health outcome.
2. **What do you already love, or keep meaning to try?**
   Search/select canonical interests. Allow one interest, exploration or Skip.
   Support an optional distinction between already enjoying, trying, returning
   and unspecified. Do not force three selections.
3. **What does a little free time look like for you?**
   Optional usual rhythm and duration, including small pockets of time and
   “It changes.” This does not establish availability on a particular date.

Keep required authentication, terms and age checks. Show an editable preference
summary and a useful result before optional photo/card setup or invitation.
Returning guests keep their current ask, context, picks and pending action.

Ask practical follow-ups only when useful: “Where should I look?”, “Would you
rather keep this free?” or “Anything you already have that you'd like to use
more?” Keep monthly budget and complete equipment inventories out of the first
three questions. Use the existing app components, tokens and accessibility
patterns. Update glossary/copy checks with the requested wording. Keep Stubby's
existing reaction/speech rules; do not add an unrelated chat interface.

## 3. Implement the six stages

### Stage A: shared meanings and a normalized read contract

Build a versioned personalization contract with adapters over existing data.
Reuse existing authoritative tables instead of making competing copies.

Represent distinctly:

- Canonical interest ID and relationship to it; per-interest experience only
  when the person supplies it.
- Selected motivations, usual rhythm and duration preferences.
- Specific self-reported equipment, separate from memberships/eligibility.
- Monthly planning amount, usual activity preference and explicit current
  spending ceiling, with currency and soft/firm meaning.
- Current-request time, setting, company, location and requirements, separately
  from persistent preferences.
- Origin, confirmation time when known, private/public visibility, and scope.

Canonicalize Corner aliases. Mark legacy origin and unspecified relationships
honestly. Do not invent confirmation dates, ownership, skill or lasting interest
from an invite-seeded Corner or an active Pursuit. Defaults such as New York
remain labeled defaults. Keep old capability exports/API contracts working.

Remove the assumption that monthly budget is an activity ceiling or must be
divided by four. Unknown budget is not zero. Do not silently convert currency.
Personalization uses supplied saved information under the current product policy;
feedback learning stays off until enabled. Deprecate unused consent flags
explicitly. New private motivations must not leak into public `profiles.moods`.

### Stage B: dependable persistence and correction

- Separate loaded, missing, unavailable and invalid reads. A failed read must
  not become an empty successful save.
- Report missing-schema/save failures truthfully. People can continue without
  saving; do not tell them their information was remembered when it was not.
- Skip preserves existing answers; explicit Clear removes them.
- Protect against stale/concurrent writes and account switching. Retain verified
  caller identity, expected-account checks and owner-only access.
- Reuse unambiguous existing equipment. Generic Gear requires clarification;
  there must not be two inventories for the person to maintain.
- Make saves transactional when one action edits several records.
- Support viewing, editing and deleting the new information and feedback.
  Explain the boundary between deleting an extension and original onboarding.

Use additive migrations with rollback/verification. Deploy compatible readers
before enabling new writers; handle old/new versions without lossy old-client
updates. Never rewrite historical migrations, reset profiles, or force existing
accounts to repeat signup. Preserve raw legacy values where needed for recovery.

### Stage C: truthful activity facts

Extend the existing catalog and its generated backend representation. Keep one
editable source and the synchronization check. Record supported facts about:

- Explicit home/venue/outdoor/online suitability, suitable social formats and
  beginner suitability. Indoor does not automatically mean doable at home.
- Fixed event time versus flexible idea; suggested start versus sourced time;
  duration estimate/range and timezone.
- Required resources, optional resources and alternatives. “Paper or tablet”
  must not become a requirement to own both.
- Known cost, required fees/materials, unknown cost, source and freshness.

Stop assigning confirmed zero cost to every internal idea. A trusted Soosh
origin verifies where an idea came from, not affordability, owned resources or
all feasibility facts. Self-reported passes do not establish free admission.

Preserve useful ideas when uncertainty is acceptable. If an unknown fact prevents
meeting a firm requirement, clarify or abstain. Do not fabricate dates, duration,
opening hours, travel times, equipment ownership or eligibility to fill a deck.

### Stage D: connect all recommendation surfaces

Use the normalized data and shared meanings in first-plan onboarding, Stubby,
Home, Discover and calendar picks. Every new field needs an actual retrieval,
eligibility or ranking consumer; do not merely pass it to a model prompt.

Share pure rules between browser and Edge where possible. Add corresponding SQL
rules/parity fixtures for Home; SQL cannot import TypeScript. Keep browser-local
calendar/deck data local under existing privacy rules. Private profile records
must not enter public catalog responses. Preserve the coarse search payload;
keep raw asks, private goals, equipment and feedback out of hosted-search queries.

Safety/age/access checks take precedence. Honor explicit current instructions,
applicable saved firm requirements, soft preferences, consented feedback and
general discovery in that order. Current soft-preference overrides do not
silently rewrite the profile or bypass safety. Different surfaces can rank
differently, but identical candidates and constraints must produce consistent
hard eligibility decisions.

Explain recommendations using facts actually used. Distinguish curated discovery
from learned affinity. Preserve care handling, limits, streaming, source checks,
guest readiness, and explicit RSVP/join/plan actions.

### Stage E: build the onboarding screens

Implement the three product questions and summary from section 2. Integrate
them with the real persistence and recommendation consumers from stages A–D.
Do not ship mock-only form state. Persist selections and restore them on reload.

Preserve existing answers, invite/redirect handling, guest continuity, Back,
resume, Skip, editing, keyboard/screen-reader access and reduced motion. Confirm
timezone/location when relevant without making an exact address mandatory.
Small at-home practice must work as a first recommendation.

### Stage F: feedback and evaluation

Keep Good pick, Not for me and Save. Add optional rejection reasons for price,
time, distance, activity, or just today. Separate one-request feedback from a
usual preference; confirm lasting changes appropriately. Respect feedback opt-in,
its read window, owner access and deletion. A save is not attendance, and a
single rejection is not permanent dislike.

Compare old/new behavior with the same scenarios and candidate facts. Retain
bounded per-account testing and existing care behavior. Measure live usefulness,
latency and total provider usage separately from mock results. Do not add private
answer/pick/feedback details to third-party analytics or create passive profiling.

## 4. Required behavior checks

Add meaningful regression/integration cases for at least:

1. Old accounts retain their answers and normalize without fabricated facts.
2. The same constraints mean the same thing across recommendation surfaces.
3. Failed load/save, missing schema, Skip, Clear, reload and concurrent edits.
4. Two accounts and account switching cannot read, overwrite or delete each
   other's information. Guests retain their context and private picks without
   gaining access to account-only capability memory.
5. At-home ideas with unknown material cost cannot satisfy confirmed-free claims.
6. Required, optional and alternative equipment behave differently.
7. Fixed times, flexible ideas, missing duration and timezone/DST boundaries.
8. A current request overrides a saved soft preference without changing it.
9. One genuine interest, curiosity and returning interests affect recommendations
   appropriately; invite seeding does not silently become permanent preference.
10. Feedback off, temporary rejection, targeted correction and deletion.
11. Care, age/role gates, quotas, signup return and existing plan actions.
12. New onboarding answers save/reload and change a real recommendation outcome.

Run relevant existing tests during implementation, then the full current suite,
frontend/backend type checks, lint, production build, migration-order/access
checks and mocked browser flows. Check the real UI at mobile and desktop widths.
Use existing SQL/Edge verification tooling where applicable. Do not pin success
to an old test count or disable assertions to make incompatible behavior pass.

## 5. Compatibility, release and delivery boundaries

- Keep Claude and existing server bindings. Do not introduce another paid
  provider, background inference job, automatic booking or messaging.
- Do not expose keys or request credential values in chat. Reuse configured
  authentication and keep new calls bounded, including shadow comparison costs.
- Follow the repository's client/Edge versioning checks if a wire contract
  changes. Do not forge deployment records, read-back evidence or live results.
- Build migrations and tests locally. A live write/migration needs an approved
  isolated test project; production activation/deployment/merge requires explicit
  owner authorization. No unrelated production operations are authorized here.
- If live validation is unavailable, finish all independent coding and local
  checks, open the implementation PR and state the exact remaining release gates.
  Do not describe mocks as live proof or call the feature production-ready.
- Push the implementation and open a PR with its final scope, schema changes,
  compatibility approach, tests and rollout/rollback. Do not substitute another
  documentation-only PR. If GitHub API access is blocked, preserve/push the work,
  report the actual error and provide the prepared PR command/body without
  claiming a PR exists.

Finish by reporting what works, the files/schema changed, checks actually run,
the PR link if created, and any concrete remaining blockers. Keep implementing
until the requested local build is complete; do not end with an offer to start.
