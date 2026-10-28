/** "With Priya and Sneha": who did it with you. Nothing when nobody did. */
export function withLine(names: readonly string[]): string {
  const n = names.map((x) => x.trim()).filter(Boolean).map((x) => x.slice(0, 40));
  if (n.length === 0) return "";
  if (n.length === 1) return `With ${n[0]}`;
  if (n.length === 2) return `With ${n[0]} and ${n[1]}`;
  return `With ${n[0]}, ${n[1]} and ${n.length - 2 === 1 ? n[2] : "others"}`;
}
