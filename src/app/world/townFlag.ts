import { PRODUCTION_HOSTNAMES } from "../config";

/**
 * Whether the 3D town shows behind the pages. Off on the live site, so nobody
 * sees any change until the founder decides; on everywhere else (staging,
 * previews, local dev).
 *
 * To preview it on the live site in one browser, open any page with `?town=on`
 * before the `#` (for example https://www.onsoosh.com/?town=on#/discover). The
 * browser remembers it; `?town=off` forgets it. To turn it on for everyone,
 * make this return true and ship.
 */
const KEY = "soosh.town";

export function townBackdropOn(
  loc: Pick<Location, "hostname" | "search"> = window.location,
  store: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = safeStorage(),
): boolean {
  const asked = new URLSearchParams(loc.search).get("town");
  if (asked === "on") store?.setItem(KEY, "on");
  if (asked === "off") store?.removeItem(KEY);
  if (!PRODUCTION_HOSTNAMES.includes(loc.hostname)) return asked !== "off";
  return asked === "on" || store?.getItem(KEY) === "on";
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
