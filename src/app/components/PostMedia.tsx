import { GeneratedArt } from "./GeneratedArt";

/**
 * Renders a post/product's actual uploaded photo or video when there is one
 * (a real https:// URL from Supabase Storage), and falls back to the
 * generated illustration otherwise — seed content and any post made without
 * a real account attached still get the illustrated look.
 */
export function PostMedia({
  media,
  type = "photo",
  hobbySlug,
  seed,
  className,
}: {
  media?: string;
  type?: "photo" | "video";
  hobbySlug: string;
  seed: string | number;
  className?: string;
}) {
  const isRealMedia = !!media && /^https?:\/\//.test(media);

  if (isRealMedia && type === "video") {
    return (
      <video
        src={media}
        controls
        className={`${className ?? ""} object-cover bg-black`}
      />
    );
  }

  if (isRealMedia) {
    return (
      <img
        src={media}
        alt=""
        className={`${className ?? ""} object-cover`}
        loading="lazy"
      />
    );
  }

  return <GeneratedArt hobbySlug={hobbySlug} seed={seed} className={className} />;
}
