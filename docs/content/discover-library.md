# Resources and Pursuit ideas on Discover

The approved visibility design puts public starter content directly on Discover, below the existing Corner carousel. Visitors no longer have to open a Corner to read a website description or a starter goal and its steps.

## What changes

- Resources shows three editorial website previews on tablet/desktop and two on phones. Each whole card is a credential-free HTTPS outbound link with an accessible source name, a hostname and safe new-tab behavior. No account is needed to visit a source.
- Pursuit ideas shows two template previews on tablet/desktop and one on phones. Each contains its Corner, description and three milestone titles. Start a Pursuit links straight to the existing editable form; it does not open a redundant template detail screen or save anything automatically.
- New Resources and Pursuit ideas jump chips wrap alongside the existing shortcuts. They scroll to the visible sections rather than changing tabs.
- See all resources and See all ideas open an optional collection browser: a bottom sheet on phones and a wide centered dialog from 744px. The full collections start unfiltered and provide optional search and Corner selection.

The other Discover sections keep their existing contents, order, fetching, actions and eligibility. The current Corner carousel is untouched. These additions increase page height; compact phone previews and top shortcuts keep them reachable without more page navigation.

## Shared data and selection

`starterLibrary.ts` reads the existing `starterContent.json` catalog, which is also used by Corner pages. It exposes 16 unique websites and 10 starter Pursuits with canonical Corner labels. It excludes hidden/adults-only Corner entries and unsafe resource URLs and deduplicates website URLs. No user profile or member progress is copied into the library.

The featured order is editorial: Standard Ebooks, The Public Domain Review and Chrome Music Lab; Reading and Painting Pursuit templates. Missing featured IDs fall back to remaining catalog entries. This does not claim to be Stubby-personalized. It remains available when the recommended or unfollowed Corner list is empty.

Existing supplied local photos, responsive variants, alt text and credits are reused where available. Other templates retain the existing Corner photo lookup/fallback. Resource cards contain original descriptions and links, not copied source images, excerpts, logos or embeds. No new source media is downloaded. Website availability and current source terms were not verified by this environment.

## Collection navigation

The Discover URL carries `browse=resources` or `browse=pursuits`, optional `browseQuery`, and a canonical `browseCorner` key. Queries are bounded to 160 characters. Invalid collection types do not open a dialog; unknown Corner filters fall back to All Corners. Existing unrelated parameters, including `window` and `m`, are preserved.

Opening from See all pushes one history entry; filtering replaces that entry. Browser Back and close return to the preceding Discover entry, rather than stepping through each letter typed. Opening a shared collection URL works without that history marker; close then removes only collection parameters and stays on Discover.

Radix handles focus trapping, Escape and body scroll lock. The title receives focus on open, preserving the accessible dialog name and avoiding automatic phone-keyboard opening. Close returns focus to the trigger, with a fallback for shared links and returning from the creation form. Existing page and carousel scroll memory is retained. Collection scroll offsets are cached by history entry in a bounded in-memory map for this tab; returning from the form restores the same collection position. This stores no account data.

Guest/pending Start a Pursuit links use the existing signup redirect with the template ID. Approved accounts go directly to the existing editable checklist form. Auth, owner identity, privacy, quotas, invitations and deliberate creation remain the responsibility of the unchanged creation flow. This feature changes no persistent preference or account record while browsing.

## Validation and rollback

Unit/integration coverage checks the selectors, source deduplication and safety, Corner meanings, public defaults, URL filters, direct form links, history/close/focus behavior and independence from carousel loading. Existing Discover tests continue to check Follow, Join, Ideas and membership prompts.

`npm run e2e:discover-library` exercises the production build with actual CSP and mocked Supabase on phone, tablet, desktop and dark profiles. External navigation is intercepted locally; it tests the real destination URL, popup behavior and opener protection without claiming a live website check. CI runs this runner and uploads evidence.

No migrations, seeds, new dependencies or production data writes are required. Reverting this implementation and redeploying the preceding build removes the previews and collection browser. Existing Corner content and member-created Pursuits remain intact. This session does not merge or deploy; live OAuth/account approval, production creation and deployed behavior remain release checks.
