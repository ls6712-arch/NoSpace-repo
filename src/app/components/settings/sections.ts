/** The six Settings sections, in order. Each is its own route; the group
 * and the section are the same thing here (no nested sub-items), matching
 * the flat numbered list the redesign spec gives. */
export interface SettingsSectionMeta {
  key: string;
  n: number;
  name: string;
  path: string;
  summary: string;
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  {
    key: "appearance",
    n: 1,
    name: "Appearance",
    path: "/settings/appearance",
    summary: "Light, dark, or match your device.",
  },
  {
    key: "profile",
    n: 2,
    name: "Profile",
    path: "/profile",
    summary: "Name, bio, and photo.",
  },
  {
    key: "account",
    n: 3,
    name: "Account",
    path: "/account",
    summary: "Email, password, and sessions.",
  },
  {
    key: "privacy",
    n: 4,
    name: "Privacy",
    path: "/privacy",
    summary: "Who sees your Circles, and who sees new Moments by default.",
  },
  {
    key: "data",
    n: 5,
    name: "Your data",
    path: "/data",
    summary: "Only you Moments, and your points.",
  },
  {
    key: "pause-or-leave",
    n: 6,
    name: "Pause or leave",
    path: "/pause-or-leave",
    summary: "Pause your account, or delete it.",
  },
];
