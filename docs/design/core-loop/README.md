# Core loop v1: design reference

The founder's 14-screen core loop (Oct 28, 2026). Build PRs 2 to 5 of `claude-code-brief-core-loop-v1` against these images.

**Order of authority:** the brief's §3 fixes, then these images, then the brief's §4 text, then `docs/soosh-visual-spec-v1.md`. Where an image breaks a §3 fix, the fix wins. For example:
- screen 03 shows three buttons, but the Corner page has one primary button
- screen 05 shows progress bars, but the group is listed in join order with no ranking
- screens 10 and 12 show member and follower counts, which are removed
- screen 11 says "You're one behind", which is removed

| File | Screen | Brief section |
|---|---|---|
| `01-onboarding.png` | What do you want more of? | §4.1 |
| `02-discover.png` | Discover | §4.2 |
| `03-corner-pasta.png` | Corner page | §4.3 |
| `04-make-it-a-pursuit.png` | Make it a Pursuit | §4.4 |
| `05-pursuit.png` | Pursuit page | §4.5 |
| `06-log.png` | Log a Moment | §4.6 |
| `07-posted-stub.png` | Posted and stub reveal | §4.7 |
| `08-home.png` | Home | §4.8 |
| `09-you.png` | You | §4.9 |
| `10-search.png` | Search | §4.10 |
| `11-notifications.png` | Notifications | §4.11 |
| `12-host-space.png` | Host Space | §4.12 |
| `13-pursuit-complete.png` | Pursuit complete | §4.13 |
| `14-home-empty.png` | Home, empty | §4.14 |

The brown and muted fills in the images are placeholders. Use real photos, the v1.1 category colours and the tilted category-icon art (brief §2.2).

`Soosh_Core_Loop.pdf` is the original export.
