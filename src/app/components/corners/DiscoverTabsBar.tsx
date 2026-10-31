import { Compass, LayoutGrid, ShoppingBag, UserRound } from "lucide-react";
import { PressLink } from "../afterhours/PressLink";
import { marketplaceEnabled } from "../../config";

const tabClass = (active: boolean) =>
  `flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 text-body font-semibold [font-family:var(--font-body)] transition-colors ${
    active ? "border-[var(--accent)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
  }`;

/**
 * Discover's tabs (Corners, Spaces, People, Marketplace) for a page that sits
 * inside Discover but has its own address, so /corners reads as the Corners
 * tab of Discover: Corners is selected, the others open Discover on that tab.
 */
export function DiscoverTabsBar() {
  return (
    <nav aria-label="Discover" className="-mx-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] tab:mx-0 tab:overflow-visible tab:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="inline-flex w-max items-center gap-6">
        <li>
          <PressLink to="/corners" aria-current="page" className={tabClass(true)}>
            <Compass className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            Corners
          </PressLink>
        </li>
        <li>
          <PressLink to="/discover?tab=spaces" className={tabClass(false)}>
            <LayoutGrid className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            Spaces
          </PressLink>
        </li>
        <li>
          <PressLink to="/discover?tab=people" className={tabClass(false)}>
            <UserRound className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            People
          </PressLink>
        </li>
        {marketplaceEnabled && (
          <li>
            <PressLink to="/discover?tab=marketplace" className={tabClass(false)}>
              <ShoppingBag className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              Marketplace
            </PressLink>
          </li>
        )}
      </ul>
    </nav>
  );
}
