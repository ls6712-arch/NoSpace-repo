# O6: what Soosh collects about age (read-only report)

Checked on this branch and, by read-only query, on the live project
(`eyzokuhhbyidvmuqfmwm`). Nothing was changed.

## Findings

| Question | Answer |
|---|---|
| Is a date of birth, age or age band stored? | **No.** No column in `public` or `auth` matches birth, dob, age, adult, minor or consent. 0 users have an age-like key in `auth.users.raw_user_meta_data`. No function in `public` mentions birth or age. No check constraint touches age. |
| Where is it asked? | **Nowhere.** The sign-up form (`src/app/pages/Login.tsx`) asks for name, email and password. Google sign-in asks nothing more. Onboarding asks for name, a first Moment, tags and a cover. The waitlist keeps an email and an optional "what do you make?" answer. |
| Is the minimum age stated? | Yes, in two places people read before signing up: "Soosh is for people 16 and older." on the landing hero and footer (`Home.tsx:142`, `Home.tsx:306`), and "You must be at least 16 years old to create an account. By signing up, you’re confirming you meet that age." in the Terms (`Terms.tsx:14`). |
| Are under-16s blocked? | **No.** Nothing checks or blocks. The sign-up form has no checkbox, no link to the Terms and no age line, so "by signing up, you’re confirming" refers to a page the form never shows. Anyone can sign up with email or Google. |
| Does anything else decide by age? | No. No feature, default or content setting differs by age. |

## Consequences to decide on (not done)

- The 16+ rule is stated but not enforced or acknowledged at sign-up. If it must hold up, the options are a required "I’m 16 or older" checkbox with a Terms link on the sign-up form, or a date of birth. A date of birth is personal data, so it would also need the Privacy Policy line already marked as a TODO in `PrivacyPolicy.tsx` (landing page spec §4).
- Waitlist and invite sign-ups go through the same form, so one change would cover them.
- The Terms and Privacy Policy are drafts with placeholders; the lawyer or founder decides the wording. No legal text was written here.
