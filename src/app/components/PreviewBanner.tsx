const PRODUCTION_HOSTNAMES = new Set(["trynospace.com", "www.trynospace.com"]);
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

/** A slim "this isn't the live site" notice above the Header — shown on
 * every hostname except the two production domains, so a Vercel preview or
 * a local dev server is never mistaken for trynospace.com itself. Sits in
 * normal document flow (not fixed/overlaid) so it pushes the Header and
 * everything below it down by its own height, rather than covering the
 * Header's buttons. The hostname can't change without a full page reload,
 * so this needs no effect/listener — read once at render time. */
export function PreviewBanner() {
  const hostname = window.location.hostname;
  if (PRODUCTION_HOSTNAMES.has(hostname)) return null;

  const label = LOCAL_HOSTNAMES.has(hostname) ? "Local" : "Preview";

  return (
    <div
      role="status"
      className="w-full border-b text-center text-[11px] font-medium tracking-wide"
      style={{
        backgroundColor: "var(--surface-muted)",
        borderColor: "var(--hairline)",
        color: "var(--muted-foreground)",
        paddingTop: "calc(env(safe-area-inset-top) + 0.3rem)",
        paddingBottom: "0.3rem",
      }}
    >
      {label} · not the live site
    </div>
  );
}
