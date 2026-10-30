/**
 * The first thing a keyboard or screen reader user reaches on a page with the
 * rail: jump past the rail to the page itself. Hidden until it has focus, and
 * only present where the rail is.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      onClick={(e) => {
        // The app uses hash routes, so a plain "#main-content" would navigate. Move focus instead.
        e.preventDefault();
        document.getElementById("main-content")?.focus();
      }}
      className="sr-only hidden rail:block focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-foreground focus:px-4 focus:py-2.5 focus:text-small focus:font-semibold focus:text-background"
    >
      Skip to content
    </a>
  );
}
