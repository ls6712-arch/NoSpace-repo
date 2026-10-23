/**
 * Keeps a number and its unit on one line ("15 minutes", "1 minute") by
 * joining them with a non-breaking space. Only whole numbers followed by a
 * unit word from the list are touched, so ordinary prose is left alone.
 */
const UNITS =
  "(?:minutes?|mins?|hours?|seconds?|days?|weeks?|months?|miles?|km|laps?|reps?|sets?|pages?|words?|photos?|loaves)";
const NUMBER_UNIT = new RegExp(`(\\d+) (${UNITS})\\b`, "gi");

export function tieNumbers(text: string): string {
  return text.replace(NUMBER_UNIT, "$1 $2");
}
