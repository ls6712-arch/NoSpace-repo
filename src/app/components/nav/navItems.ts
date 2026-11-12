import type { ComponentType } from "react";
import { Compass, House, Plus, UserRound, type LucideIcon } from "lucide-react";
import { StubbyNavIcon } from "./StubbyNavIcon";
import type { TabKey } from "../../lib/routeHandle";

/**
 * The destinations every signed-in screen offers, in one place: the bottom
 * bar (phones) and the left rail (tablet and up) both read this list, so the
 * icons, labels and the rule for which one is "current" can never drift apart.
 * Chats, Notifications and Search are not routes of their own in the same way;
 * the rail adds them, the phone's top bar already has them.
 *
 * Which destination is "current" is not decided here: each route says which tab
 * it belongs to in its `handle` (routes.ts), and `useCurrentTab()` reads it.
 */
/** A destination's icon: a Lucide icon, or one of ours that takes the same props (Stubby on Calendar). */
export type NavIcon = LucideIcon | ComponentType<{ className?: string; strokeWidth?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;

export interface Destination {
  to: string;
  /** What is written under the icon, and on the rail from 1280px. */
  label: string;
  /** The accessible name when it is not the label. */
  aria?: string;
  icon: NavIcon;
  /** The route `handle.tab` this destination answers to. */
  tab: TabKey;
  /** The one solid shape: Log a Moment. */
  accent?: boolean;
}

export const HOME: Destination = { to: "/my-space", label: "Home", icon: House, tab: "my-space" };
export const DISCOVER: Destination = {
  to: "/discover",
  label: "Discover",
  icon: Compass,
  tab: "discover",
};
export const LOG: Destination = {
  to: "/create",
  label: "Log",
  aria: "Log a Moment",
  icon: Plus,
  tab: "create",
  accent: true,
};
export const CALENDAR: Destination = {
  to: "/calendar",
  label: "Stubby",
  // Stubby lives on Calendar, so its icon is his mark (founder, Nov 2, 2026).
  icon: StubbyNavIcon,
  // /week/free (when you are usually free) is part of the calendar too.
  tab: "calendar",
};
export const YOU: Destination = { to: "/you", label: "You", icon: UserRound, tab: "you" };

/** The bottom bar's order, with Stubby directly reachable on phones too. */
export const TAB_DESTINATIONS: readonly Destination[] = [HOME, DISCOVER, LOG, CALENDAR, YOU];

/** Pages where the member navigation (and so the rail) is not offered: they keep the top header as before. */
export const NO_RAIL_PATHS = (pathname: string) => pathname === "/welcome" || pathname.startsWith("/i/");
