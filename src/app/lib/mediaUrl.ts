/** A real, loadable media URL (Supabase Storage or an https photo), as opposed to the seed content's
 * placeholders or an empty string. Shared so PostMedia and PostMediaCarousel can't disagree. */
export const isRealMediaUrl = (url?: string | null): url is string => !!url && /^https?:\/\//.test(url);
