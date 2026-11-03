import { ContactEmail, LegalPage } from "../components/LegalPage";
import { APP_NAME } from "../config";

// DRAFT FOR REVIEW — landing page spec §2.5, §10.5. Needs a lawyer's read
// before launch. The operator, contact email, governing law and last-updated
// date are filled in; the production build refuses to ship any placeholder.
// Written only from what the code
// actually does (AuthContext, DataSection.tsx,
// PauseOrLeaveSection.tsx) — nothing here is aspirational.

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="November 3, 2026">
      <h2>What we collect</h2>
      <p>
        Your email, display name, and password (or your Google account, if you log in
        that way), and whatever you add to your profile. The Moments you log (photos
        and notes), plus thoughts, messages, who you follow, and the Moments you
        save. If you
        join the waitlist before you have an invite, we keep the email and the optional
        "what do you make?" answer you give us.
      </p>
      <p>
        We ask for your date of birth to confirm you’re 18 or over. It’s kept private,
        never shown on your profile or to anyone else, and never used for ads.
      </p>
      <p>
        Your date of birth is also how Stubby knows whether to show you picks for people 21
        and over. Once it’s on file it can’t be changed in the app; to correct it, contact us.
        If a date shows you’re under 18, we don’t keep the date, and your account can only use
        Stubby.
      </p>
      <p>
        We keep a short record of the suggestions we show you on Home and which ones
        you open or join, for 90 days. We use it to make suggestions fit you better.
        Only you can see it, and it is deleted with your account.
      </p>
      <p>
        When you ask Stubby to find something, what you type is sent once to Anthropic, which
        runs the search, and we don’t keep it. What Stubby finds is saved for you only, and
        deleted two days after it happens. Things he finds can also be added to the picks
        everyone sees, without your name or what you asked. We keep a record of when you
        asked for 30 days, so we can limit how many asks each person gets a day. What you
        tell Stubby about yourself (a city name, what you want more of, when you’re free) and
        the thumbs up or down you give his picks are kept with your account, used only to fit
        his picks to you, and deleted with your account.
      </p>

      <h2>Trying Stubby without an account</h2>
      <p>
        You can ask Stubby a few things before you sign up. The first time you ask, we make a
        guest account for you in this browser. It has no email, name or password. We keep the
        same things for a guest as for an account: what you tell Stubby about yourself, the
        thumbs up or down you give his picks, and the picks themselves.
      </p>
      <p>
        So one person can’t use up everyone’s asks, we keep a scrambled, one-way form of your
        network address (a salted hash) with each guest ask, for 2 days. We never keep the
        address itself. To suggest your city, we use the approximate city your connection
        comes from; only the city name is used, and only if you keep it.
      </p>
      <p>
        If you sign up, everything you did as a guest moves into your new account. If you log
        in to an account you already have instead, the guest’s picks aren’t added to it. A
        guest account with no activity for 30 days is deleted, with everything in it.
      </p>

      <h2>Who else sees it</h2>
      <p>
        {APP_NAME} runs on Supabase, which hosts our database, handles login, and
        stores your photos, and on Vercel, which hosts the app itself. When you add an iPhone
        photo in HEIC format, Vercel converts it to a JPEG and doesn’t keep it. Anthropic runs the web
        search when you ask Stubby to find something. If you log in
        with Google, Google is involved in that one step. We don’t sell your
        information to anyone.
      </p>
      <p>
        We use Google Analytics on {APP_NAME} to count visits and see which parts of
        the app get used. It sets cookies in your browser and records the part of
        the app you opened, such as Spaces or Moments, and steps like asking Stubby or
        signing up, as counts only. It never receives what you write, what you ask Stubby,
        your username, or the ID of a Moment. It is turned off if your
        browser sends Do Not Track or Global Privacy Control.
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
