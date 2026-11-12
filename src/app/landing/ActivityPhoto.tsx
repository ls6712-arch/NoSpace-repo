import { ImageWithFallback } from "../components/ImageWithFallback";
import type { ActivityExample } from "./examples";
import { ActivityArt } from "./ActivityArt";

/** Owner-supplied originals. Credits and source ids are retained from their filenames. */
const PHOTOS: Record<string, { file: string; alt: string; credit: string; id: string }> = {
  paint: { file: "painting", alt: "A person painting oranges and leaves with watercolors", credit: "Sincerely Media", id: "s3tPywNsLSo" },
  guitar: { file: "guitar", alt: "Hands playing a white electric guitar", credit: "Parker Coffman", id: "GgsG8aNLgjQ" },
  "photo-walk": { file: "photography", alt: "A person photographing flowers beside a walkway", credit: "Alex Gorin", id: "31KvOn6d818" },
  cook: { file: "cooking", alt: "People chopping vegetables together at a table", credit: "Maarten van den Heuvel", id: "EzH46XCDQRY" },
  read: { file: "reading", alt: "A person reading an open book beside a window", credit: "Sergei Nikulin", id: "tglfT2WsX8E" },
  "read-outside": { file: "reading-outside", alt: "A person reading a book in a chair outside", credit: "Paniz GM", id: "XGZ72Knysyg" },
};

export function activityPhoto(example: ActivityExample, width = 800, placement: "preview" | "gallery" = "preview") {
  if (example.id === "photo-walk" && placement === "gallery") {
    const base = `${import.meta.env.BASE_URL}landing/photos/shelf-pier`;
    return { src: `${base}-${width <= 400 ? 400 : 800}.webp`, srcSet: `${base}-400.webp 400w, ${base}-800.webp 800w`, alt: "A pier over the water at sunset", credit: "Richard Fox", source: "https://unsplash.com/photos/Uujb21HwpBw" };
  }
  const photo = PHOTOS[example.id];
  // Older example ids remain valid without introducing a new remote-image dependency.
  if (!photo) return { src: undefined, srcSet: undefined, alt: `${example.interest} activity illustration`, credit: undefined, source: undefined };
  const size = width <= 400 ? 400 : width <= 800 ? 800 : 1600;
  const base = `${import.meta.env.BASE_URL}landing/photos/${photo.file}`;
  return {
    src: `${base}-${size}.webp`,
    srcSet: [400, 800, 1600].map(w => `${base}-${w}.webp ${w}w`).join(", "),
    alt: photo.alt,
    credit: photo.credit,
    source: `https://unsplash.com/photos/${photo.id}`,
  };
}

export function ActivityPhoto({ example, priority = false, sizes, onLoad, onFail }: { example: ActivityExample; priority?: boolean; sizes?: string; onLoad?: () => void; onFail?: () => void }) {
  const photo = activityPhoto(example, priority ? 1600 : 800, priority ? "preview" : "gallery");
  return <ImageWithFallback src={photo.src} srcSet={photo.srcSet} alt={photo.alt} priority={priority} onLoad={onLoad} onFail={onFail}
    sizes={sizes ?? (priority ? "(min-width: 1280px) 540px, (min-width: 960px) 44vw, calc(100vw - 84px)" : "(min-width: 1280px) 360px, (min-width: 744px) 28vw, (min-width: 360px) 40vw, calc(100vw - 80px)")}
    aspect={priority ? "16 / 9" : "16 / 10"} className="lp-activity-photo"
    fallback={<ActivityArt art={example.art} tone={example.tone}/>}/>;
}
