/**
 * App-level feature flags. Plain hardcoded constants for now — there's no
 * admin UI or backend-driven config for these yet, so "flip the flag" means
 * editing this file and shipping a new build.
 */

// Buying/selling isn't live (no payments, fees, tax, refunds, or seller
// identity behind any listing yet) — every marketplace surface (the
// Marketplace tab, /shop, /product/:id, a Space's studio booking) stays
// hidden until this flips on.
export const marketplaceEnabled = false;
