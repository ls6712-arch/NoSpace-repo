/**
 * Crisis resources by country, for the care card (stubby-agent C1). Only a verified country is ever
 * shown (Nov 4, 2026). Everywhere else gets CARE_ELSEWHERE: "Call your local emergency number" and
 * nothing more, until that country's entry is checked against the service's own page and moved
 * from UNVERIFIED_DRAFTS into CARE_RESOURCES with its own verifiedOn date.
 *
 * The care step as a whole still needs the brief's separate expert review (EXPERT_REVIEW), which
 * the founder is arranging. Nothing here is ever personalised or stored.
 */
export const DRAFTED_ON = "2026-11-03";
export const EXPERT_REVIEW = "pending" as const;

export interface CareResource {
  /** What to do, as a button label. */
  label: string;
  /** Who answers. */
  detail: string;
  /** tel:, sms: or https: only. Null: shown as text, with nothing to tap (no number is known). */
  href: string | null;
}
export interface CareCountry {
  country: string;
  /** When each entry was checked, and against what. Null: not verified, so never shown. */
  verifiedOn: string | null;
  verifiedAgainst: string | null;
  resources: CareResource[];
  /** In danger right now. */
  emergency: CareResource;
}

const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;
const DANGER = "If you’re in danger right now";

/** Verified entries only: the only ones careCountry returns. */
export const CARE_RESOURCES: Readonly<Record<string, CareCountry>> = {
  US: {
    country: "US",
    // Checked by the founder against SAMHSA's 988 fact sheet (Nov 4, 2026): call or text 988, chat at
    // 988lifeline.org, in Spanish press 2 when calling or text AYUDA. 911 is the US emergency number.
    verifiedOn: "2026-11-04",
    verifiedAgainst: "SAMHSA 988 fact sheet",
    resources: [
      { label: "Call 988", detail: "988 Suicide and Crisis Lifeline, any time", href: tel("988") },
      { label: "Text 988", detail: "988 Suicide and Crisis Lifeline, by text", href: "sms:988" },
      { label: "Chat online", detail: "988lifeline.org", href: "https://988lifeline.org" },
      { label: "Text AYUDA to 988", detail: "In Spanish, or call 988 and press 2", href: "sms:988" },
    ],
    emergency: { label: "Call 911", detail: DANGER, href: tel("911") },
  },
};

/** Anywhere without a verified entry: the emergency line in words, nothing to tap. */
export const CARE_ELSEWHERE: CareCountry = {
  country: "other",
  verifiedOn: null,
  verifiedAgainst: null,
  resources: [],
  emergency: { label: "Call your local emergency number", detail: DANGER, href: null },
};

/**
 * Drafted on DRAFTED_ON without network access: NOT verified, never shown (careCountry ignores this).
 * Kept so each can be checked against the service's own page and moved into CARE_RESOURCES.
 */
export const UNVERIFIED_DRAFTS: Readonly<Record<string, { resources: CareResource[]; emergency: CareResource }>> = {
  CA: { resources: [{ label: "Call 988", detail: "9-8-8 Suicide Crisis Helpline, any time", href: tel("988") }, { label: "Text 988", detail: "9-8-8 Suicide Crisis Helpline, by text", href: "sms:988" }], emergency: { label: "Call 911", detail: DANGER, href: tel("911") } },
  GB: { resources: [{ label: "Call 116 123", detail: "Samaritans, free, any time", href: tel("116123") }], emergency: { label: "Call 999", detail: DANGER, href: tel("999") } },
  IE: { resources: [{ label: "Call 116 123", detail: "Samaritans, free, any time", href: tel("116123") }], emergency: { label: "Call 112", detail: DANGER, href: tel("112") } },
  AU: { resources: [{ label: "Call 13 11 14", detail: "Lifeline, any time", href: tel("131114") }], emergency: { label: "Call 000", detail: DANGER, href: tel("000") } },
  NZ: { resources: [{ label: "Call or text 1737", detail: "Need to talk?, free, any time", href: tel("1737") }], emergency: { label: "Call 111", detail: DANGER, href: tel("111") } },
  IN: { resources: [{ label: "Call 14416", detail: "Tele MANAS, free, any time", href: tel("14416") }], emergency: { label: "Call 112", detail: DANGER, href: tel("112") } },
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

/**
 * The card for the person's country, from the city or time zone they gave. Soosh runs in New York:
 * the US unless they said otherwise. A country with no verified entry gets CARE_ELSEWHERE.
 */
export function careCountry(city: string | null | undefined, timeZone: string | null | undefined): CareCountry {
  const verified = (cc: string) => CARE_RESOURCES[cc] ?? CARE_ELSEWHERE;
  for (const [re, cc] of CITIES) if (city && re.test(city)) return verified(cc);
  if (city && city.trim()) return CARE_ELSEWHERE;
  for (const [re, cc] of ZONES) if (timeZone && re.test(timeZone)) return verified(cc);
  if (timeZone && timeZone !== "America/New_York") return CARE_ELSEWHERE;
  return CARE_RESOURCES.US;
}
