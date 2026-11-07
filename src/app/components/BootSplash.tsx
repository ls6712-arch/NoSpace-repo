/**
 * The Stub mark on the app background: the same markup as the splash in
 * index.html (its styles are in that file's <style>, which stays in the page).
 * React replaces the splash in index.html when it first renders, so while the
 * first page's file is still downloading this puts it back. Without it a shared
 * link to a page that has not loaded yet shows a blank screen.
 *
 * If the splash in index.html has already faded in (300 ms), this one starts
 * fully visible so the mark does not blink out and fade in again.
 */
export function BootSplash() {
  const shown = typeof performance !== "undefined" && performance.now() >= 300;
  return (
    <div className={shown ? "boot-splash boot-splash--held" : "boot-splash"} role="status" aria-label="Loading">
      {/* design-token-ignore: same bare mark as index.html's splash; no fallback image to swap in */}
      <img src="/favicon.svg" alt="" width={72} height={72} />
    </div>
  );
}
