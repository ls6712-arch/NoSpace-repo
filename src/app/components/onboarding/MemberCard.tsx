import { ImageWithFallback } from "../ImageWithFallback";

/**
 * The member card (screen 10): "No. 12" in Archivo Black, a dashed rule, the
 * first name and when they joined. The photo slot shows the photo once there is
 * one, else the first letter.
 */
export function MemberCard({ number, name, joined, photoUrl }: { number: number | null; name: string; joined: string; photoUrl?: string }) {
  return (
    <div className="transfer-card" data-testid="member-card">
      <p className="transfer-card-number" aria-label={number === null ? undefined : `Number ${number}`}>
        {number === null ? "Soosh" : `No. ${number}`}
      </p>
      <hr className="transfer-card-rule" />
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="transfer-headline break-words text-title">{name}</p>
          <p className="transfer-label mt-1 text-small">{joined ? `Joined ${joined}` : ""}</p>
        </div>
        <div className="transfer-card-photo flex shrink-0 items-center justify-center" aria-hidden="true">
          {photoUrl ? <ImageWithFallback src={photoUrl} alt="" className="size-full" /> : <span className="transfer-headline text-title">{name.slice(0, 1).toUpperCase()}</span>}
        </div>
      </div>
    </div>
  );
}
