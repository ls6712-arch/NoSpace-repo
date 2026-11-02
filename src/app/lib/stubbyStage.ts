/**
 * The Calendar stage's once-a-session hello: Stubby hops once, with one soft ring, the
 * first time Calendar opens in a browser session.
 */
export const HELLO_KEY = "soosh.stubby.hello";

/**
 * True the first time it is asked in this browser session, then false. Without
 * sessionStorage the hello is skipped rather than replayed on every visit.
 */
export function takeHello(): boolean {
  try {
    if (window.sessionStorage.getItem(HELLO_KEY)) return false;
    window.sessionStorage.setItem(HELLO_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
