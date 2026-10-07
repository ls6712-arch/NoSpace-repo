/**
 * App-level feature flags. Plain hardcoded constants for now — there's no
 * admin UI or backend-driven config for these yet, so "flip the flag" means
 * editing this file and shipping a new build.
 */

// The one place the app's name is spelled out. Every other file reads it
// from here — never hardcode "Soosh" in copy (docs/glossary.md).
// index.html's <title> and package.json's "name" can't import this (they
// load before/outside the JS bundle) and are kept in sync by hand.
// TODO(decision: D1): brand is Soosh, domain is trynospace.com (see
// SITE_ORIGIN in lib/invites.ts and PreviewBanner.tsx). Keep, change, or
// add an explanation on the landing page? Waiting on the founder.
export const APP_NAME = "Soosh";

// Buying/selling isn't live (no payments, fees, tax, refunds, or seller
// identity behind any listing yet) — every marketplace surface (the
// Marketplace tab, /shop, /product/:id, a Space's studio booking) stays
// hidden until this flips on.
export const marketplaceEnabled = false;
