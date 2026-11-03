/**
 * Crisis resources by country, for the care card (stubby-agent C1). The US line is the brief's own
 * (988, call or text); the others are each country's well-known national line. NOT YET VERIFIED:
 * written on DRAFTED_ON without network access, so no service's own page was checked. Before this
 * reaches anyone but V3 testers, each entry must be checked against the service's own page and the
 * whole care step must pass the separate expert review the brief requires. Nothing here is ever
 * personalised or stored.
 */
export const DRAFTED_ON = "2026-11-03";
/** Set to the date once each entry is checked against its own page. */
export const VERIFIED_ON: string | null = null;
export const EXPERT_REVIEW = "pending" as const;

export interface CareResource {
  /** What to do, as a button label. */
  label: string;
  /** Who answers. */
  detail: string;
  /** tel:, sms: or https: only. */
  href: string;
}
export interface CareCountry {
  country: string;
  resources: CareResource[];
  /** In danger right now. */
  emergency: CareResource;
}

const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;

export const CARE_RESOURCES: Readonly<Record<string, CareCountry>> = {
  US: {
    country: "US",
    resources: [
      { label: "Call 988", detail: "988 Suicide and Crisis Lifeline, any time", href: tel("988") },
      { label: "Text 988", detail: "988 Suicide and Crisis Lifeline, by text", href: "sms:988" },
    ],
    emergency: { label: "Call 911", detail: "If you’re in danger right now", href: tel("911") },
  },
  CA: {
    country: "CA",
    resources: [
      { label: "Call 988", detail: "9-8-8 Suicide Crisis Helpline, any time", href: tel("988") },
      { label: "Text 988", detail: "9-8-8 Suicide Crisis Helpline, by text", href: "sms:988" },
    ],
    emergency: { label: "Call 911", detail: "If you’re in danger right now", href: tel("911") },
  },
  GB: {
    country: "GB",
    resources: [{ label: "Call 116 123", detail: "Samaritans, free, any time", href: tel("116123") }],
    emergency: { label: "Call 999", detail: "If you’re in danger right now", href: tel("999") },
  },
  IE: {
    country: "IE",
    resources: [{ label: "Call 116 123", detail: "Samaritans, free, any time", href: tel("116123") }],
    emergency: { label: "Call 112", detail: "If you’re in danger right now", href: tel("112") },
  },
  AU: {
    country: "AU",
    resources: [{ label: "Call 13 11 14", detail: "Lifeline, any time", href: tel("131114") }],
    emergency: { label: "Call 000", detail: "If you’re in danger right now", href: tel("000") },
  },
  NZ: {
    country: "NZ",
    resources: [{ label: "Call or text 1737", detail: "Need to talk?, free, any time", href: tel("1737") }],
    emergency: { label: "Call 111", detail: "If you’re in danger right now", href: tel("111") },
  },
  IN: {
    country: "IN",
    resources: [{ label: "Call 14416", detail: "Tele MANAS, free, any time", href: tel("14416") }],
    emergency: { label: "Call 112", detail: "If you’re in danger right now", href: tel("112") },
  },
};

/** Anywhere else: Throughline's directory of free helplines, by country. */
export const CARE_ELSEWHERE: CareCountry = {
  country: "other",
  resources: [{ label: "Find a helpline", detail: "Free helplines in your country", href: "https://findahelpline.com" }],
  emergency: { label: "Call your local emergency number", detail: "If you’re in danger right now", href: "https://findahelpline.com" },
};

const ZONES: [RegExp, string][] = [
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise|Juneau|Sitka|Nome|Adak|Menominee|North_Dakota)/, "US"],
  [/^Pacific\/Honolulu$/, "US"],
  [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Whitehorse|Yellowknife|Iqaluit)/, "CA"],
  [/^Europe\/London$/, "GB"],
  [/^Europe\/Dublin$/, "IE"],
  [/^Australia\//, "AU"],
  [/^Pacific\/Auckland$/, "NZ"],
  [/^Asia\/(Kolkata|Calcutta)$/, "IN"],
];
const CITIES: [RegExp, string][] = [
  [/\b(new york|nyc|brooklyn|queens|bronx|manhattan|staten island|boston|chicago|seattle|austin|los angeles|san francisco|san jose)\b/i, "US"],
  [/\b(toronto|vancouver|montreal)\b/i, "CA"],
  [/\b(london|manchester)\b/i, "GB"],
  [/\bdublin\b/i, "IE"],
  [/\b(sydney|melbourne)\b/i, "AU"],
  [/\b(mumbai|delhi|new delhi|kolkata|bengaluru)\b/i, "IN"],
];

/** The person's country from the city or time zone they gave. Soosh runs in New York: the US unless they said otherwise. */
export function careCountry(city: string | null | undefined, timeZone: string | null | undefined): CareCountry {
  for (const [re, cc] of CITIES) if (city && re.test(city)) return CARE_RESOURCES[cc];
  if (city && city.trim()) return CARE_ELSEWHERE;
  for (const [re, cc] of ZONES) if (timeZone && re.test(timeZone)) return CARE_RESOURCES[cc];
  if (timeZone && timeZone !== "America/New_York") return CARE_ELSEWHERE;
  return CARE_RESOURCES.US;
}
