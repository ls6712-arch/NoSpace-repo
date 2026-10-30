/** "A", "A and B", "A, B and C". */
export function joinNaturally(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The line under "You both": the shared Pursuit categories as activity names.
 * Given as written ("Climbing" reads "Climb"), so the verb is the category
 * itself: "Climbing and Pottery." Null when nothing is shared.
 */
export function youBothSentence(categories: string[]): string | null {
  const names = categories.map((c) => c.trim()).filter(Boolean);
  if (names.length === 0) return null;
  return `${joinNaturally(names)}.`;
}
