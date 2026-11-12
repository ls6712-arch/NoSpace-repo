/**
 * Autocomplete matching shared by matchesFor (one Space), CornerTagField's
 * global mode (every Space) and the catalog merge script: exact, substring
 * either direction, or a shared word prefix ("Pasta" -> "Pasta Making").
 * Kept free of React and Supabase so scripts can import it.
 */
export function matchCorners<T extends { name: string; aliases?: string[] }>(corners: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return corners.slice(0, 6);
  const qWords = q.split(/\s+/);
  return corners
    .filter((c) => {
      const name = c.name.toLowerCase();
      if (name === q) return true;
      if (name.includes(q) || q.includes(name)) return true;
      // An alias counts when it is the whole query or starts with it ("wheel" finds Pottery).
      if (c.aliases?.some((a) => { const al = a.toLowerCase(); return al === q || (q.length >= 3 && al.startsWith(q)); })) return true;
      const nameWords = name.split(/\s+/);
      return qWords.some((qw) => nameWords.some((nw) => nw.startsWith(qw) || qw.startsWith(nw)));
    })
    .slice(0, 6);
}
