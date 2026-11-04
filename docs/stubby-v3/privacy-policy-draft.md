# Privacy Policy: draft for Stubby V3 (Nov 3, 2026, for approval)

**Not live.** The live policy (`src/app/pages/PrivacyPolicy.tsx`) stays as it is while V3 reaches
only `STUBBY_V3_TESTERS`, because it describes the engine everyone else still uses. Apply this when
the founder switches V3 on for everyone, in the same PR that removes the legacy ask engine, and bump
`TERMS_VERSION` if the change needs everyone to accept it again.

## Replaces the paragraph that starts "When you ask Stubby to find something"

> When you ask Stubby to find something, what you type is sent to Anthropic, which runs the search,
> and we don’t keep it. What Stubby finds is saved for you only, and deleted two days after it
> happens. We keep a record of when you asked for 30 days, so we can limit how many asks each person
> gets a day, with a short record of how Stubby chose your picks (the kinds of thing, the time and
> budget it used, and the picks’ titles), never what you typed.
>
> To fit his picks to you, Stubby uses your onboarding answers (the Corners you picked, when you’re
> usually free, your monthly budget, your city and your passes) and anything you save under What
> Stubby knows (a timezone, a budget for an activity, equipment, goals, what you prefer and
> memberships). You can change or delete these at any time; deleting what you saved keeps your
> onboarding answers. Stubby learns from the thumbs up or down you give his picks only if you turn on
> Learn from my feedback, and then only from the last 60 days. All of it is kept with your account,
> used only for your picks, and deleted with your account.

## New paragraph, after it

> If what you ask sounds like you’re going through something really hard, Stubby shows ways to reach
> someone to talk to instead of picks. To decide, what you typed may be checked once by Anthropic.
> We don’t keep what you typed, that Stubby showed this, or anything about how you feel, and it
> doesn’t use up an ask.

## What changes against the live policy, and why

| Live policy | V3 | Why |
|---|---|---|
| Stubby's picks can be added to the picks everyone sees | V3 never adds anything to the shared picks | V3 saves only your own picks |
| Thumbs up or down are used to fit picks | Only with Learn from my feedback on, last 60 days | Learning is the only opt-in (founder, Nov 3, 2026) |
| (not mentioned) | The care check on what you typed, never kept | Step 1 of every V3 ask (stubby-agent C1) |
| (not mentioned) | What Stubby knows: saved timezone, budget, equipment, goals, preferences, memberships | V3's saved information (migration `20261112000000_stubby_capabilities.sql`) |
