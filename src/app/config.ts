/**
 * App-level feature flags. Plain hardcoded constants for now — there's no
 * admin UI or backend-driven config for these yet, so "flip the flag" means
 * editing this file and shipping a new build.
 */

// The one place the app's name is spelled out. Every other file reads it
// from here — never hardcode "Soosh" in copy (docs/glossary.md).
// index.html's <title> and package.json's "name" can't import this (they
// load before/outside the JS bundle) and are kept in sync by hand.
export const APP_NAME = "Soosh";

// The one place the live domain is written. Every other file reads it from
// here (the invite link, the "not the live site" preview banner). When the
// Soosh domain is bought, change SITE_DOMAIN and nothing else in src/.
// Outside src/, two things still have to be changed by hand: the Supabase
// Auth "Site URL" and redirect URLs, and the Vercel production domain.
export const SITE_DOMAIN = "trynospace.com";
export const SITE_ORIGIN = `https://www.${SITE_DOMAIN}`;
export const PRODUCTION_HOSTNAMES: readonly string[] = [SITE_DOMAIN, `www.${SITE_DOMAIN}`];

// Buying/selling isn't live (no payments, fees, tax, refunds, or seller
// identity behind any listing yet) — every marketplace surface (the
// Marketplace tab, /shop, /product/:id, a Space's studio booking) stays
// hidden until this flips on.
export const marketplaceEnabled = false;

// Today's sheet, Books and the Public Scrapbook are named concepts outside
// the five product nouns (Moment, Shelf, Pursuit, Corner, Space), so they are
// hidden for now. The code and data stay; flip this to bring them back.
// While it is off: no Scrapbook links, /studio redirects to Shelf, and Home
// shows no "Today's sheet" labels.
export const extraConceptsEnabled = false;

// The version of the Terms and Privacy Policy that people accept at sign-up.
// It is the date that version took effect ("YYYY-MM-DD"), and it is the one
// place it is written: the checkbox sends it, the database records it with its
// own clock, and anyone with no record of THIS version is asked again. Change
// it when the Terms or Privacy Policy change in a way people should accept
// again, and when the real text replaces the draft. Never a future date: the
// database refuses one more than a day ahead.
export const TERMS_VERSION = "2026-10-08";

// Onboarding's first step normally uses its own short "first Moment" form.
// When this is on, it shows the one Log a Moment form instead (same fields,
// same Undo, same Pursuit and Corner choices), so there is one form to
// maintain. Off by default until it has been tried on a fresh invite; see
// docs/qa/round-3/onboarding-test.md.
export const onboardingUsesMainForm = import.meta.env.VITE_ONBOARDING_MAIN_FORM === "true";

// Footer links on the signed-out landing page. Each renders only when it has a
// value, so adding one later is a one-line change here and no layout work.
// CONTACT_EMAIL is a bare address; the others are full URLs. A test keeps it set.
// The Terms and Privacy Policy pages read CONTACT_EMAIL too.
export const CONTACT_EMAIL = "sushmithalekkala@gmail.com";
export const INSTAGRAM_URL = "";
export const TIKTOK_URL = "";
