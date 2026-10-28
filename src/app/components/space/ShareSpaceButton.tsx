import { useState } from "react";
import { Share2 } from "lucide-react";
import { SITE_ORIGIN } from "../../config";
import { Button } from "../ui/button";

export function spaceShareUrl(slug: string): string {
  return `${SITE_ORIGIN}/#/space/${slug}`;
}

/** A link to this Space: the phone's share sheet when there is one, else it copies the link. */
export function ShareSpaceButton({ slug, name }: { slug: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = spaceShareUrl(slug);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // A cancelled share sheet or a blocked clipboard is not an error worth showing.
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={() => void share()} aria-label={`Share ${name}`}>
      <Share2 className="size-3.5" aria-hidden="true" />
      <span role="status">{copied ? "Link copied" : "Share"}</span>
    </Button>
  );
}
