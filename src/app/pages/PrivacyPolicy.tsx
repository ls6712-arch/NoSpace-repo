import { ContactEmail, LegalPage } from "../components/LegalPage";
import { APP_NAME } from "../config";

// DRAFT FOR REVIEW — landing page spec §2.5, §10.5. Needs a lawyer's read
// before launch. The operator, contact email, governing law and last-updated
// date are filled in; the production build refuses to ship any placeholder.
// Written only from what the code
// actually does (AuthContext, WaitlistForm, DataSection.tsx,
// PauseOrLeaveSection.tsx) — nothing here is aspirational.

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="October 9, 2026">
      <h2>What we collect</h2>
      <p>
        Your email, display name, and password (or your Google account, if you log in
        that way), and whatever you add to your profile. The Moments you log (photos
        and notes), plus thoughts, messages, who you follow, and the Moments you
        save. If you
        join the waitlist before you have an invite, we keep the email and the optional
        "what do you make?" answer you give us.
      </p>
      {/* TODO(landing page spec §4, deferred to its own PR): once the age
          gate ships, this section needs a line for date of birth — not
          added yet since nothing collects it today. */}

      <h2>Who else sees it</h2>
      <p>
        {APP_NAME} runs on Supabase, which hosts our database, handles login, and
        stores your photos, and on Vercel, which hosts the app itself. If you log in
        with Google, Google is involved in that one step. We don’t sell your
        information to anyone.
      </p>
      <p>
        The Moments you save are stored with your account, so they are there on every
        device you log in on. Nobody else can see which Moments you saved. The person
        who posted a Moment is told how many people saved it, never who, and can turn
        that notification off in Notifications settings.
      </p>

      <h2>What you control</h2>
      <p>
        Every Moment you log, you choose who sees it: only you, your followers, or
        the public, each time you post it. A Moment marked “Only you” is kept
        and never shown anywhere else, including to {APP_NAME} staff reviewing a
        report.
      </p>

      <h2>Pausing or deleting your account</h2>
      <p>
        Self-serve account pausing and deletion are coming soon and aren’t built yet.
        Until then, if you'd like your account or data deleted, contact us at{" "}
        <ContactEmail />{" "}
        and we’ll handle it directly.
      </p>

      <h2>Questions</h2>
      <p>
        Contact us at{" "}
        <ContactEmail />
        . {APP_NAME} is operated by Sushmitha Lekkala, an individual, governed by the
        laws of the State of New Jersey, United States.
      </p>
    </LegalPage>
  );
}
