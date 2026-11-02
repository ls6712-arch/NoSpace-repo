import type { ComponentType } from "react";
import { Compass, House, Plus, UserRound, type LucideIcon } from "lucide-react";
import { StubbyNavIcon } from "./StubbyNavIcon";

/**
 * The destinations every signed-in screen offers, in one place: the bottom
 * bar (phones) and the left rail (tablet and up) both read this list, so the
 * icons, labels and the rule for which one is "current" can never drift apart.
 * Chats, Notifications and Search are not routes of their own in the same way;
 * the rail adds them, the phone's top bar already has them.
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
  match: (pathname: string) => boolean;
  /** The one solid shape: Log a Moment. */
  accent?: boolean;
}

export const HOME: Destination = { to: "/my-space", label: "Home", icon: House, match: (p) => p.startsWith("/my-space") };
export const DISCOVER: Destination = {
  to: "/discover",
  label: "Discover",
  icon: Compass,
  match: (p) =>
    p.startsWith("/discover") || p.startsWith("/corners") || p.startsWith("/browse") || p.startsWith("/space") || p.startsWith("/people"),
};
export const LOG: Destination = {
  to: "/create",
  label: "Log",
  aria: "Log a Moment",
  icon: Plus,
  match: (p) => p.startsWith("/create") || p.startsWith("/log"),
  accent: true,
};
export const CALENDAR: Destination = {
  to: "/calendar",
  label: "Stubby",
  // Stubby lives on Calendar, so its icon is his mark (founder, Nov 2, 2026).
  icon: StubbyNavIcon,
  // /week/free (when you are usually free) is part of the calendar too.
  match: (p) => p.startsWith("/calendar") || p.startsWith("/week"),
};
export const YOU: Destination = { to: "/you", label: "You", icon: UserRound, match: (p) => p.startsWith("/you") };

/** The bottom bar's order. Calendar is not a tab: on a phone it opens from Home's Your week card. */
export const TAB_DESTINATIONS: readonly Destination[] = [HOME, DISCOVER, LOG, YOU];

/** Pages where the member navigation (and so the rail) is not offered: they keep the top header as before. */
export const NO_RAIL_PATHS = (pathname: string) => pathname === "/welcome" || pathname.startsWith("/i/");
