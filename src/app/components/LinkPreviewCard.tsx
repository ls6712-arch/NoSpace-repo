import { Link2 } from "lucide-react";
import { urlDomain } from "../lib/linkPreview";

/**
 * A passive, text-only stand-in for a full Open-Graph preview: no backend
 * exists in this app to fetch a page's real title/image (most sites also
 * block that fetch from a browser via CORS), so this shows what can be
 * known for certain — the domain and the link itself — rather than a
 * placeholder that pretends to be more than it is.
 */
export function LinkPreviewCard({ url }: { url: string }) {
  const domain = urlDomain(url);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-surface px-3.5 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
        <Link2 className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm">{domain ?? "Link"}</div>
        <div className="truncate text-xs text-muted-foreground">{url}</div>
      </div>
    </div>
  );
}
