/**
 * Whether the 3D town shows behind the pages. On for everyone (founder, Nov 10,
 * 2026), on the live site and everywhere else.
 *
 * One browser can hide it with `?town=off` before the `#` (for example
 * https://www.onsoosh.com/?town=off#/discover); the browser remembers it, and
 * `?town=on` brings it back. To turn it off for everyone, make this return
 * false and ship.
 *
 * Always off under browser automation (end-to-end tests), so those runs see
 * the app exactly as before and do not spend their CPU drawing a park.
 */
const KEY = "soosh.town";

export function townBackdropOn(
  loc: Pick<Location, "search"> = window.location,
  store: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = safeStorage(),
  automated: boolean = typeof navigator !== "undefined" && navigator.webdriver === true,
): boolean {
  if (automated) return false;
  const asked = new URLSearchParams(loc.search).get("town");
  if (asked === "off") store?.setItem(KEY, "off");
  if (asked === "on") store?.removeItem(KEY);
  if (asked) return asked !== "off";
  return store?.getItem(KEY) !== "off";
}

/**
 * Phones and laptops with little memory or few cores, or a browser asking to
 * save data, get the park as one still picture instead of a moving one, so it
 * never slows them down.
 */
export function lowPowerDevice(nav: Partial<Navigator & { deviceMemory: number; connection: { saveData?: boolean } }> = navigator): boolean {
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return true;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return true;
  return false;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
