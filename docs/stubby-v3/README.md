# Stubby 3.0

**[Codex coding brief](../briefs/codex-build-clean-personalization.md):** executable
instructions for building the planned data, matching and onboarding changes.

For the next implementation, follow **[the recommendation improvement plan](recommendation-improvement-plan.md)**:
shared data meanings, reliable saves, accurate activity facts, consistent matching,
human onboarding, feedback and measured rollout. This plan accounts for the newer
branch changes described at the end of this page.

Start with **[the complete Stubby guide](guide.md)** for what changed, the
architecture and request flow, memory and consent, Claude credits, configuration,
code map, testing and release gaps.

This branch contains a locally tested V3 milestone behind server/frontend flags.
It is not enabled or deployed. Live/provider and broader interpretation work
remains; see [the final audit](final-audit.md) for detailed evidence and blockers.

- [Latest compatibility review and merge holds](compatibility-review.md)
- [Prepared pull request description](pull-request.md)
- [Earlier pull request review](pr-review.md)
- [Onboarding review and redesign proposal](onboarding-redesign.md)
- [Claude provider and existing API credits](claude-provider.md)
- [Second code review and reasoning checks](code-review.md)
- [Initial audit](audit.md)
- [Architecture](architecture.md)
- [Security and privacy](security.md)
- [Test configuration, deployment and rollback](environment-and-rollout.md)
- [Evaluation harness and reports](../../evals/stubby/README.md)

## Nov 3, 2026: before merge

- **Claude only.** The OpenAI provider is removed (`v3/openai.ts`, its tests and settings).
- **Per account.** `STUBBY_V3_TESTERS` turns V3 on for those accounts only, with the legacy engine run
  on the same ask and both decks saved in the trace (shadow compare). See environment-and-rollout.md.
- **Care step first** (stubby-agent C1, `v3/care.ts`): clear distress gets a care card, no picks, no
  ask used, nothing stored. Reviewed keyword list plus a Claude check, erring toward the card. The
  resources are a dated draft; expert review is still pending.
- **Onboarding answers by default.** Corners, free windows, budget, city and passes personalise V3
  with no opt-in, as does anything saved in What Stubby knows. Learning from feedback is the only
  opt-in. Privacy Policy wording for rollout: privacy-policy-draft.md.
- **Ported from legacy:** the request contract and decision trace (PR 7), "Stay in or head out?",
  the soonest-after fallback, Stay in from their own Pursuits and Corners (#317, now `v3/soosh.ts`),
  and the scenario set: every PR 7 scenario now runs through both engines, reported by group, and no
  V3 group may pass fewer than legacy.
- **Decks:** not all one kind when good alternatives exist; places (a park, a walking route) are
  their own kind, never an event listing; their own picks say what they need ("You’ll need flour and
  a loaf tin.") instead of being marked uncertain.
- The older review notes in this folder describe V3 before these changes (OpenAI, consent switches
  that started off, a global engine flag).
