/**
 * Where a Corner's page lives: /corners/:slug, for every Corner. The Space
 * slug is accepted so callers can pass what they have, but the page resolves a
 * bare slug itself (the three Corners that sit in two Spaces are one Corner
 * each; see cornerModel.ts). The older /corner/:slug links redirect here.
 */
export function cornerPath(_spaceSlug: string | undefined, slug: string): string {
  return `/corners/${slug}`;
}
