import { MapPinOff } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { initials } from "./pursuit/ui";
import { HoldToShareButton } from "./HoldToShareButton";
import { ImageWithFallback } from "./ImageWithFallback";

/**
 * Step 3, §3 "Friction only for Everyone": before a Moment actually goes out
 * to strangers, show exactly what they'll see — photo, caption, name,
 * Corner, and the city in place of anything more precise — then require a
 * hold, not a tap, to actually publish. Only me and Followers never see
 * this; it's rendered only when the audience chip is set to Everyone.
 */
export function EveryoneShareConfirm({
  name,
  cornerLabel,
  caption,
  photoPreviewUrl,
  cityLabel,
  onConfirm,
  disabled = false,
}: {
  name: string;
  cornerLabel: string;
  caption: string;
  photoPreviewUrl?: string | null;
  /** City-level only — the composer never passes a precise location here. */
  cityLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-caption font-medium uppercase tracking-[0.06em] text-muted-foreground">
        What strangers will see
      </p>
      <div className="overflow-hidden rounded-card border border-border bg-card">
        {photoPreviewUrl && (
          <ImageWithFallback src={photoPreviewUrl} alt="" className="aspect-[4/3] w-full" />
        )}
        <div className="space-y-1.5 p-3">
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-caption">{initials(name)}</AvatarFallback>
            </Avatar>
            <span className="text-small font-medium">{name}</span>
            <span className="text-caption text-muted-foreground">· {cornerLabel}</span>
          </div>
          {caption && <p className="text-small">{caption}</p>}
          {cityLabel && (
            <p className="flex items-center gap-1 text-caption text-muted-foreground">
              <MapPinOff className="size-3" />
              Exact location hidden · shows {cityLabel}
            </p>
          )}
        </div>
      </div>
      <HoldToShareButton onConfirm={onConfirm} disabled={disabled} />
      <p className="text-center text-caption text-muted-foreground">Your reflection is never shared.</p>
    </div>
  );
}
