import { LegalPage } from "../components/LegalPage";
import { APP_NAME } from "../config";

// DRAFT FOR REVIEW — landing page spec §2.5, §10.5. Needs a lawyer's read
// before launch. Placeholders still to fill in: the legal name/entity
// operating Soosh, a real contact email, and the governing law/jurisdiction
// (both marked [PLACEHOLDER] below). Written only from what the code
// actually does (AuthContext, WaitlistForm, DataSection.tsx,
// PauseOrLeaveSection.tsx) — nothing here is aspirational.

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy policy" lastUpdated="[PLACEHOLDER: draft, not yet published]">
      <h2>What we collect</h2>
      <p>
        Your email, display name, and password (or your Google account, if you log in
        that way), and whatever you add to your profile. The Moments you log (photos
        and notes), plus Thoughts, messages, and who you follow. If you
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

      <h2>What you control</h2>
      <p>
        Every Moment you log, you choose who sees it: just you, your followers, or
        everyone, each time you post it. A Moment marked "only you" is kept
        and never shown anywhere else, including to {APP_NAME} staff reviewing a
        report.
      </p>

      <h2>Pausing or deleting your account</h2>
      <p>
        Self-serve account pausing and deletion are coming soon and aren’t built yet.
        Until then, if you'd like your account or data deleted, contact us at{" "}
        <a href="mailto:hello@example.com" className="underline hover:text-foreground">
          [PLACEHOLDER contact email]
        </a>{" "}
        and we’ll handle it directly.
      </p>

      <h2>Questions</h2>
      <p>
        Contact us at{" "}
        <a href="mailto:hello@example.com" className="underline hover:text-foreground">
          [PLACEHOLDER contact email]
        </a>
        . {APP_NAME} is operated by [PLACEHOLDER legal name/entity], governed by the
        laws of [PLACEHOLDER governing law/jurisdiction].
      </p>
    </LegalPage>
  );
}
