/**
 * Where back goes from a Corner opened on a shared link: its group's page.
 * A Corner's group is only known once its page has loaded (it can come from
 * the database), so CornerDetail records it here as it renders. By the time
 * anyone can press back, the page has loaded and the group is known. Until
 * then, or for a Corner with no group, back goes to /corners.
 */
const categoryByCorner = new Map<string, string>();

export function rememberCornerCategory(cornerSlug: string, categorySlug: string | undefined): void {
  if (categorySlug) categoryByCorner.set(cornerSlug, categorySlug);
}

export function cornerParentPath(cornerSlug: string | undefined): string {
  const category = cornerSlug ? categoryByCorner.get(cornerSlug) : undefined;
  return category ? `/browse/${category}` : "/corners";
}
