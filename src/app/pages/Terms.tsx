import { ContactEmail, LegalPage } from "../components/LegalPage";
import { APP_NAME } from "../config";

// DRAFT FOR REVIEW — landing page spec §2.5, §10.5. Needs a lawyer's read
// before launch. The operator, contact email, governing law and last-updated
// date are filled in; the production build refuses to ship any placeholder.

export function Terms() {
  return (
    <LegalPage title="Terms" lastUpdated="October 9, 2026">
      <h2>Who can use {APP_NAME}</h2>
      <p>
        You must be at least 16 years old to create an account. By signing up, you’re
        confirming you meet that age.
      </p>

      <h2>Invites</h2>
      <p>
        While {APP_NAME} is invite-only, an invite is for the person it's meant for, not
        something to sell, trade, or hand out publicly. We can revoke an invite or the
        account it created if it’s misused.
      </p>

      <h2>What you post</h2>
      <p>
        You keep ownership of everything you post: your Moments, photos, and notes
        stay yours. By posting, you're giving {APP_NAME} the permission it
        needs to store and display it back to you and to whoever you choose to share it
        with.
      </p>

      <h2>How to behave</h2>
      <p>
        Be honest about who you are, and respect other people’s boundaries and privacy.
        Don’t harass, impersonate, or post anything illegal or meant to harm someone.
        You can block anyone, and report a Moment, a chat, or a profile. We review
        reports and act on them.
      </p>

      <h2>Removal</h2>
      <p>
        We can remove content that breaks these rules, or suspend or close an account,
        including for a safety report, abuse, or if someone no longer meets the age
        requirement above.
      </p>

      <h2>Questions</h2>
      <p>
        Contact us at{" "}
        <ContactEmail />
        . {APP_NAME} is operated by Sushmitha Lekkala, an individual. These terms are
        governed by the laws of the State of New Jersey, United States.
      </p>
    </LegalPage>
  );
}
