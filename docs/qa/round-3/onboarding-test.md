# Onboarding preview test (O1, O2, O3, O4)

Do this on the Vercel preview of this branch, with a **fresh invite** and an
email address that has never signed up. Allow 10 minutes.

The merged form is behind `onboardingUsesMainForm` (default off). To try it,
set `VITE_ONBOARDING_MAIN_FORM=true` in the Vercel **Preview** environment
variables and redeploy the preview. Run the steps once with it unset (the
current first-Moment form) and once with it set to `true`.

## Before you start

1. Create an invite from an existing account (Settings, invites) and copy the link.
2. Open the link in a private window.

## Steps

| # | Do this | Expect |
|---|---|---|
| 1 | Open the invite link and sign up with a new email. In **Name**, type a long name (60+ characters). | The field stops at 50 characters. |
| 2 | Clear the name and try Sign up. | "What should people call you?" and no account is created. |
| 3 | Type a real name, finish sign-up, confirm the email if asked. | You land on onboarding, step 1 of 4. |
| 4 | Look at the name field. | It holds the name you typed at sign-up, **not** your email prefix. (Sign in with Google instead to check it starts empty.) |
| 5 | Clear it and press Continue. | "What should people call you?" and you stay on this step. |
| 6 | Type `  Test   Name ` (extra spaces). | The "Your Shelf" box shows `Test Name`. |
| 7 | Press Continue. | Step 2 of 4, the first Moment. Later, your Shelf shows `Test Name`. |
| 8 | **Flag off:** type a line, pick Only you, press Log. **Flag on:** you see the Log a Moment form with no Back link; write a line, keep it private, save. | A confirmation appears. |
| 9 | Press **Undo** (small row at the bottom of the screen, flag on; the "Your first Moment is in." row, flag off). | Flag on: back on the form with your text still there. Flag off: back to the empty first-Moment form. Check your Shelf later: the Moment is gone. |
| 10 | Save again and press Continue. | Step 3 of 4, "What are you into?" |
| 11 | Add a tag, Continue, then Start with a blank page. | The invite card or your Shelf. Your Shelf title is `Test Name`. |
| 12 | Open Settings. | No "Is this how you'd like to be known?" banner for a name you chose. |

## Existing account named after its email (O2)

1. Use an account whose name is its email prefix (4 exist on the live project;
   do not edit them). Sign in.
2. Expect one dialog, "Is this how you'd like to be known?", with the name filled in.
3. Press **Save name** without editing: the dialog closes, the stored name does
   not change. Sign out and in again: it does not return.
4. On another such account, edit the name and press Save name: the new name shows on the Shelf.

## Pass criteria

All "Expect" cells match, with the flag off and on. If the flag-on run is
clean, flip the default in `src/app/config.ts` in a follow-up.

The same path runs automatically against fixtures in CI
(`node scripts/visual/qa-round3.ts`); screenshots are in this folder.
