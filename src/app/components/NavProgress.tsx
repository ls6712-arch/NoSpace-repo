/**
 * A thin coral bar across the top while a page is loading (see
 * useSlowNavigation). It slides; with reduced motion it is a still bar
 * (theme.css `.nav-progress`).
 */
export function NavProgress({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div role="progressbar" aria-label="Loading" className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden">
      <div className="nav-progress-bar h-full w-full bg-coral" />
    </div>
  );
}
