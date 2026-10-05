/** A real, loadable media URL (Supabase Storage or an https photo), as opposed to the seed content's
 * placeholders or an empty string. Shared so PostMedia and PostMediaCarousel can't disagree. */
export const isRealMediaUrl = (url?: string | null): url is string => !!url && /^https?:\/\//.test(url);

/**
 * A video URL that makes the browser paint its first frame before anyone presses play.
 * Without a poster image, a <video> shows an empty box until it plays (always on iPhone and
 * Mac Safari, which load nothing up front). A `#t=0.1` media fragment makes the browser fetch
 * just enough to seek there and paint that frame as the cover. Works for https, signed and
 * blob: URLs; a URL that already carries a fragment is left alone.
 */
export const withFirstFrame = (url: string): string => (url.includes("#") ? url : `${url}#t=0.1`);
