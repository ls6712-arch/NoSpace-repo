/**
 * Where a Corner's page lives: /corners/:slug, for every Corner. The Space
 * slug is accepted so callers can pass what they have, but the page resolves a
 * bare slug itself (a Corner that sits in two Spaces is one Corner; see
 * cornerModel.ts). The older /corner/:slug links, and Corners merged into
 * another, redirect here.
 */
export function cornerPath(_spaceSlug: string | undefined, slug: string): string {
  return `/corners/${slug}`;
}
