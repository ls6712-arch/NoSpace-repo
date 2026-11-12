# Discover resource and Pursuit visibility

Approved design implemented on `feature/discover-resource-visibility`, based on main after the Corner starter-content PR (#334).

## What was verified

| Check | Result |
| --- | --- |
| Full Vitest suite | 251 files, 2,360 tests passed |
| Final targeted component suite after the photo-credit layout fix | 6 tests passed |
| TypeScript | Passed |
| Design-token lint | Passed, zero violations |
| Production build | Passed; existing large JavaScript chunk warning remains |
| Migration ordering against main | Passed, 233 files; no migration changes |
| Tracked-output check | Passed |
| Production UI/CSP browser runner | Five profiles plus guest shared-link/signup case passed |

The saved [browser report](report.json) states the scope. The runner uses fixture Supabase accounts and responses. External navigation is intercepted locally, not fetched from the destination. None of these checks is a live production, OAuth, source-availability or deployment test.

## Regression coverage

- Public previews render on Discover without opening a Corner and remain available if the recommended Corner list is empty.
- Featured websites link directly to the actual catalog URL in a separate tab, with no opener and no signup interstitial. Resource cards contain no third-party media or embeds.
- Phone preview: two resources and one Pursuit idea. Tablet/desktop preview: three resources and two Pursuit ideas. Goals show their milestone titles before a click.
- Whole-page overflow and new preview controls are checked at 320px, 390px, 768px and 1440px, plus 390px dark mode, with reduced motion.
- Full resource and template collections have 16 and 10 entries respectively. Search, Corner filters, no matches and Clear filters work through URL state.
- The accessible collection title receives focus. Tab stays inside the open dialog; Escape and Close return focus and the Discover scroll position. Browser Back closes after filter edits rather than undoing each typed letter.
- Approved-account Start a Pursuit goes straight to the existing editable checklist form. Back restores the filter. A phone check also opens the last item in the long unfiltered list and confirms the same scroll offset on return. Reserving photo-credit space avoids loading-related list shifts.
- Guest shared collection URLs work, close stays on Discover, and the chosen template is retained through the existing signup handoff.
- No creation RPC is called during browsing or while opening a form. Existing Corner link destinations and text remain unchanged before/after collection browsing. Existing unit regressions continue checking Follow, Join, Ideas and membership prompts.
- Catalog regressions reject unsafe links, duplicate websites and adults-only Corner entries, and preserve canonical Corner aliases.

## Screenshots

- [Phone previews](mobile-previews.png)
- [Desktop previews](desktop-previews.png)
- [320px resource browser](small-phone-resources-browser.png)
- [Desktop resource browser](desktop-resources-browser.png)
- [Dark previews](dark-previews.png)

Focused preview screenshots omit existing fixed navigation/action overlays only while capturing the section. All interaction, layout and touch checks run with actual navigation visible. Collection screenshots retain normal overlays and demonstrate that the dialog is above them. Surrounding account/live content is fixture data. Screenshots were visually inspected.

## Remaining release gates

The branch still needs a PR review, merge by the owner and deployment before this appears on the live site. No merge or deployment is performed here. Confirm guest signup/account approval and deliberate creation with a real approved account on the released build. Check current availability and source terms of external resources before release; this change does not assert copyright-free material or copy source media.

Architecture, navigation parameters, privacy and rollback are documented in [Discover library notes](../../content/discover-library.md). No database rollback or deletion of member-created Pursuits is needed.
