import { ImageWithFallback } from "../components/ImageWithFallback";
import { hobbyPhoto, photoCredit } from "../data/hobbyPhotos";
import type { ActivityExample } from "./examples";
import { ActivityArt } from "./ActivityArt";

/** Existing activity photography and its recorded credit; never fabricated member or event photos. */
export function activityPhoto(example: ActivityExample, width = 800) {
  if (example.id === "photo-walk") return {
    src: `${import.meta.env.BASE_URL}landing/photos/shelf-pier-${width <= 400 ? 400 : 800}.webp`,
    alt: "A pier over the water at sunset",
    credit: "Richard Fox",
    source: "https://unsplash.com/photos/Uujb21HwpBw",
  };
  const credit = photoCredit(example.corner[1]);
  return {
    src: hobbyPhoto(example.corner[1], example.corner[0], width),
    alt: credit?.alt ?? ({ guitar: "A guitar", cook: "Cooking in a kitchen", read: "Books", birds: "A bird outdoors" } as Record<string, string>)[example.id] ?? example.interest,
    credit: credit?.credit ?? "Unsplash",
    source: credit?.source ?? "https://unsplash.com/license",
  };
}

export function ActivityPhoto({ example, priority = false }: { example: ActivityExample; priority?: boolean }) {
  const photo = activityPhoto(example, priority ? 960 : 400);
  return <ImageWithFallback src={photo.src} alt={photo.alt} priority={priority}
    aspect="16 / 10" className="lp-activity-photo"
    fallback={<ActivityArt art={example.art} tone={example.tone}/>}/>;
}
