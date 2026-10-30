/**
 * The minimum age for Soosh. Plans mean meeting people in person and some
 * places serve alcohol; 13+ would need a separate teen mode (onboarding brief,
 * section 10.2). The same number is written in the database trigger
 * `private.check_birthdate()` (migration 20261103000000): change both.
 */
export const MIN_AGE = 18;

/** Whole years between a birth date ("YYYY-MM-DD") and a day. Null when the date is not a real one. */
export function ageOn(birthdate: string, today: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(Date.UTC(y, mo - 1, d));
  if (real.getUTCFullYear() !== y || real.getUTCMonth() !== mo - 1 || real.getUTCDate() !== d) return null;
  let age = today.getFullYear() - y;
  const hadBirthday = today.getMonth() + 1 > mo || (today.getMonth() + 1 === mo && today.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

export type BirthdateCheck = "ok" | "under" | "invalid";

/** "invalid" for a date that is not real, in the future, or before 1900; "under" for younger than MIN_AGE. */
export function checkBirthdate(birthdate: string, today: Date = new Date()): BirthdateCheck {
  const age = ageOn(birthdate, today);
  if (age === null || age < 0 || Number(birthdate.slice(0, 4)) < 1900) return "invalid";
  return age >= MIN_AGE ? "ok" : "under";
}
