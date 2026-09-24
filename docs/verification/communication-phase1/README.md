# Phase 1 Safety — Part C verification

Two separate verification passes, for two separate claims:

1. **The database rules are real**, checked against the actual live Supabase project:
   `supabase/verification/communication_phase1_check.sql`, 56/56 `PASS` against real accounts
   and real tables (see `docs/backend-state-20260924.md`).
2. **The app built on top of those rules behaves correctly.** No real credentials exist for
   three live Supabase accounts in this environment — new signups need email confirmation, and
   there's no service-role key to bypass it (deliberately: `sql/test-account-safeguard.sql`
   exists specifically to keep throwaway QA accounts out of the live, real-user-facing feed).
   So this pass runs the real, already-built React app in a real Chromium browser, at the real
   phone (390px) and laptop (1280px) widths, in both light and dark, with the Supabase REST and
   auth APIs mocked to stand in for six people: Jordan (signed in throughout), Alex (a stranger
   sending a first message), Sam (an accepted Make-together contact), Taylor (someone Jordan
   messaged who hasn't answered), Casey (blocked), and Morgan (an admin reviewing reports).

   12 checks ran against the live app code during the pass (accept/ignore a request, block,
   report with a chosen reason, send into an accepted thread, unblock, mark a report reviewed,
   and the read-side assertions each of those imply) — all 12 passed. Screenshots below are
   from that same run.

## Screenshots

| File | Shows |
| --- | --- |
| `01-messages-requests-phone-light.png` | Message requests tab — Alex's first message, Accept/Ignore/Block/Report |
| `02-block-dialog-phone-light.png` | Block confirmation dialog |
| `03-report-dialog-phone-light.png` | Report dialog — reason, note, "Also block" |
| `04-messages-chats-laptop-dark.png` | Chats tab — Jordan's own pending DM to Taylor ("Waiting to accept" banner, disabled composer) |
| `04b-messages-accepted-chat-laptop-dark.png` | The same session, switched to the accepted Sam thread, after sending a message |
| `05-messages-chats-laptop-light.png` | Chats tab, laptop width, light |
| `06-messages-requests-laptop-light.png` | Message requests tab, laptop width, light |
| `07-settings-blocked-phone-light.png` | Settings → Privacy → Blocked people, phone width |
| `08-settings-blocked-laptop-dark.png` | Settings → Privacy → Blocked people, laptop width, dark |
| `09-admin-reports-laptop-light.png` | Admin Reports page — one open report |
| `10-admin-reports-phone-dark.png` | Admin Reports page, phone width, dark |
