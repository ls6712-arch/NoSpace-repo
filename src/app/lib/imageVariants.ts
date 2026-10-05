/**
 * Resized copies of Supabase Storage images (Storage image transformations).
 *
 * Off unless VITE_IMAGE_TRANSFORMS=on: transformations are a Supabase Pro-plan
 * feature, and on the free plan the render endpoint refuses the request. When
 * on, a card asks for a thumbnail-sized copy and ImageWithFallback retries the
 * original URL if that request fails, so turning it on can never leave a hole.
 * Anything that isn't a Supabase Storage URL (the Unsplash seed photos already
 * carry their own `w=`) is returned untouched.
 */
const OBJECT_PUBLIC = "/storage/v1/object/public/";
const OBJECT_SIGN = "/storage/v1/object/sign/";
const RENDER_PUBLIC = "/storage/v1/render/image/public/";
const RENDER_SIGN = "/storage/v1/render/image/sign/";

export function imageTransformsEnabled(): boolean {
  return import.meta.env.VITE_IMAGE_TRANSFORMS === "on";
}

/** Storage image transformations refuse anything wider than this. */
export const MAX_VARIANT_WIDTH = 2500;

export interface VariantOptions {
  /** Width in CSS pixels at 1x. */
  width: number;
  quality?: number;
}

/** Pure: the URL for a resized copy, or the same URL when it can't or shouldn't be resized. */
export function variantUrl(url: string, { width, quality = 75 }: VariantOptions, enabled = imageTransformsEnabled()): string {
  if (!enabled || !url || url.startsWith("data:") || url.startsWith("blob:")) return url;
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  let path: string;
  if (u.pathname.startsWith(OBJECT_PUBLIC)) path = RENDER_PUBLIC + u.pathname.slice(OBJECT_PUBLIC.length);
  else if (u.pathname.startsWith(OBJECT_SIGN)) path = RENDER_SIGN + u.pathname.slice(OBJECT_SIGN.length);
  else return url;
  u.pathname = path;
  u.searchParams.set("width", String(Math.min(MAX_VARIANT_WIDTH, Math.round(width))));
  u.searchParams.set("quality", String(quality));
  u.searchParams.set("resize", "cover");
  return u.toString();
}

/** `srcset` for 1x and 2x screens; undefined when nothing would change. */
export function variantSrcSet(url: string, width: number, enabled = imageTransformsEnabled()): string | undefined {
  const one = variantUrl(url, { width }, enabled);
  if (one === url) return undefined;
  // No 2x candidate past the cap: it would be refused and send the image back to the original.
  if (width * 2 > MAX_VARIANT_WIDTH) return one;
  return `${one} 1x, ${variantUrl(url, { width: width * 2 }, enabled)} 2x`;
}
