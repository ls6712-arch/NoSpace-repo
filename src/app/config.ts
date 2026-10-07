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

// Landing page section 5 also promises Spaces ("join a group around what you
// do"). Only one Space is active, so that line is hidden. Turn this on when 3
// or more Spaces are active.
export const landingShowsSpaces = false;
