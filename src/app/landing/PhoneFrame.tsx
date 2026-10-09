import { landingImageUrl, SCREEN_H, SCREEN_W, type LandingImageKey } from "./images";

/** One real screen in the page's one phone frame. */
export function PhoneFrame({
  image,
  alt,
  priority = false,
  className = "",
}: {
  image: LandingImageKey;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={`lp-phone ${className}`} style={{ margin: "0 auto" }}>
      {/* design-token-ignore: real screens from public/landing, hidden when missing so no fallback art */}
      <img
        src={landingImageUrl(image)}
        alt={alt}
        width={SCREEN_W}
        height={SCREEN_H}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </figure>
  );
}
