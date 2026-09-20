import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthContext";
import { CATEGORIES, type Category } from "../data/categories";
import { applySpaceRows, isBuiltInSpace, type SpaceRow } from "../data/hobbies";

/**
 * The category list, plus the way people tell us it's incomplete.
 *
 * The fifteen are in code because they're signage and they change rarely.
 * Anything approved after launch comes from the database and is appended, so
 * the list can grow without a deploy. Neither is stored on a post — a
 * category is a route to things, never a label attached to them, which is why
 * changing this list can't invalidate anybody's hobby.
 */
export interface Suggestion {
  id: number;
  name: string;
  description?: string;
  examples?: string;
  status: "pending" | "approved" | "merged" | "rejected";
  mergedInto?: string;
  reviewNote?: string;
  suggestedBy?: string;
  suggesterName?: string;
  createdAt: number;
}

interface CategoriesContextType {
  /** The fifteen, plus anything approved since. */
  categories: Category[];
  isAdmin: boolean;
  /** Your own suggestions; everyone's if you review them. */
  suggestions: Suggestion[];
  pendingCount: number;
  suggest: (input: {
    name: string;
    description?: string;
    examples?: string;
  }) => Promise<{ error: string | null }>;
  review: (
    id: number,
    decision: "approved" | "merged" | "rejected",
    opts?: { mergedInto?: string; note?: string },
  ) => Promise<{ error: string | null }>;
  refresh: () => Promise<void>;
  /**
   * Admin-managed Spaces (sql/spaces-admin.sql). Every row in `categories`,
   * including its admin fields — the raw material for the /admin/spaces page.
   * A built-in slug here is an override; any other slug is a Space that only
   * exists in the database.
   */
  spaceRows: SpaceRow[];
  saveSpace: (input: {
    slug?: string;
    name: string;
    description?: string;
    prompt?: string;
    active?: boolean;
    sortOrder?: number | null;
  }) => Promise<{ error: string | null; slug?: string }>;
  /** Removes a built-in's override, restoring its defaults. */
  resetSpace: (slug: string) => Promise<{ error: string | null }>;
  /** How many Moments / Pursuits / Circles still point at a Space. */
  spaceUsage: (
    slug: string,
  ) => Promise<{ error: string | null; usage?: { posts: number; pursuits: number; circles: number; corners: number } }>;
  /** Deletes a database-only Space, and only if nothing points at it. */
  deleteSpace: (slug: string) => Promise<{ error: string | null }>;
  /** Moves every Moment, Pursuit and Circle from one Space into another. */
  moveSpaceContent: (
    from: string,
    to: string,
  ) => Promise<{ error: string | null; moved?: { posts: number; pursuits: number; circles: number } }>;
}

const CategoriesContext = createContext<CategoriesContextType | undefined>(undefined);

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [extra, setExtra] = useState<Category[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [spaceRows, setSpaceRows] = useState<SpaceRow[]>([]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: cats } = await supabase.from("categories").select("*");
      // Apply admin overrides / database-only Spaces to the shared list
      // *before* publishing state, so subscribers re-render against it.
      const rows: SpaceRow[] = ((cats ?? []) as any[]).map((c) => ({
        slug: c.slug,
        name: c.name,
        description: c.description ?? null,
        prompt: c.prompt ?? null,
        active: c.active ?? true,
        sort_order: c.sort_order ?? null,
      }));
      applySpaceRows(rows);
      setSpaceRows(rows);
      setExtra(
        ((cats ?? []) as any[]).map((c) => ({
          slug: c.slug,
          name: c.name,
          description: c.description ?? "",
          examples: c.examples ?? [],
          keywords: c.keywords ?? [],
          tint: "var(--pastel-stone)",
        })),
      );
    } catch {
      // The built-in fifteen still work offline; this list is additive.
    }

    if (!user) {
      setSuggestions([]);
      setIsAdmin(false);
      return;
    }

    try {
      const { data: me } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      const admin = !!(me as any)?.is_admin;
      setIsAdmin(admin);

      const { data } = await supabase
        .from("category_suggestions")
        .select("*")
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as any[];
      // Reviewers see who asked; a suggester only ever sees their own row.
      let names: Record<string, string> = {};
      if (admin) {
        const ids = [...new Set(rows.map((r) => r.suggested_by).filter(Boolean))];
        if (ids.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", ids);
          for (const p of (profs ?? []) as any[]) {
            names[p.id] = p.display_name?.trim() || "A member who's away";
          }
        }
      }

      setSuggestions(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description ?? undefined,
          examples: r.examples ?? undefined,
          status: r.status,
          mergedInto: r.merged_into ?? undefined,
          reviewNote: r.review_note ?? undefined,
          suggestedBy: r.suggested_by ?? undefined,
          suggesterName: r.suggested_by ? names[r.suggested_by] : undefined,
          createdAt: new Date(r.created_at).getTime(),
        })),
      );
    } catch {
      setSuggestions([]);
      setIsAdmin(false);
    }
  }, [user?.id, profile?.display_name]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const suggest: CategoriesContextType["suggest"] = async (input) => {
    if (!supabase || !user) return { error: "Sign in to suggest a category." };
    const name = input.name.trim();
    if (!name) return { error: "Give it a name." };
    try {
      const { error } = await supabase.from("category_suggestions").insert({
        suggested_by: user.id,
        name: name.slice(0, 60),
        description: input.description?.trim()?.slice(0, 300) || null,
        examples: input.examples?.trim()?.slice(0, 300) || null,
      });
      if (error) {
        return {
          error: /relation .* does not exist/i.test(error.message)
            ? "Suggestions aren't set up yet. Run sql/categories.sql in Supabase."
            : error.message,
        };
      }
      await refresh();
      return { error: null };
    } catch {
      return { error: "Couldn't reach the server. Try again in a moment." };
    }
  };

  const review: CategoriesContextType["review"] = async (id, decision, opts) => {
    if (!supabase || !user) return { error: "Sign in first." };
    const target = suggestions.find((s) => s.id === id);
    if (!target) return { error: "That suggestion is gone." };

    try {
      // Approving makes it a real category. Merging and rejecting record the
      // decision so the person who asked can see what happened.
      if (decision === "approved") {
        const slug = slugify(target.name);
        const { error: catError } = await supabase.from("categories").upsert(
          {
            slug,
            name: target.name,
            description: target.description ?? null,
            examples: target.examples
              ? target.examples.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
              : [],
            // The name itself is the first keyword, so posts using it match.
            keywords: [
              target.name.toLowerCase(),
              ...(target.examples
                ? target.examples.split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean)
                : []),
            ],
          },
          { onConflict: "slug" },
        );
        if (catError) return { error: catError.message };
      }

      const { error } = await supabase
        .from("category_suggestions")
        .update({
          status: decision,
          merged_into: decision === "merged" ? (opts?.mergedInto ?? null) : null,
          review_note: opts?.note?.trim() || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) return { error: error.message };

      await refresh();
      return { error: null };
    } catch {
      return { error: "Couldn't reach the server. Try again in a moment." };
    }
  };

  const saveSpace: CategoriesContextType["saveSpace"] = async (input) => {
    if (!supabase || !user) return { error: "Sign in first." };
    if (!isAdmin) return { error: "Only an admin can do that." };
    const name = input.name.trim();
    if (!name) return { error: "Give the Space a name." };
    const slug = (input.slug ?? slugify(name)).trim();
    if (!slug) return { error: "That name doesn't make a usable link. Try plain letters." };

    const isNew = input.slug === undefined;
    if (isNew && (isBuiltInSpace(slug) || spaceRows.some((r) => r.slug === slug))) {
      return { error: "A Space with that name already exists. Edit it instead." };
    }

    try {
      const { error } = await supabase.from("categories").upsert(
        {
          slug,
          name: name.slice(0, 60),
          description: input.description?.trim()?.slice(0, 300) || null,
          prompt: input.prompt?.trim()?.slice(0, 120) || null,
          active: input.active ?? true,
          sort_order: input.sortOrder ?? null,
          // The name is the first keyword, so a database-only Space also
          // collects Moments people tagged with it by hand.
          ...(isNew ? { keywords: [name.toLowerCase()] } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" },
      );
      if (error) {
        return {
          error: /column .* does not exist|active|prompt|sort_order/i.test(error.message)
            ? "Run sql/spaces-admin.sql in Supabase first."
            : error.message,
        };
      }
      await refresh();
      return { error: null, slug };
    } catch {
      return { error: "Couldn't reach the server. Try again in a moment." };
    }
  };

  const resetSpace: CategoriesContextType["resetSpace"] = async (slug) => {
    if (!supabase || !user || !isAdmin) return { error: "Only an admin can do that." };
    if (!isBuiltInSpace(slug)) return { error: "Only built-in Spaces can be reset." };
    try {
      const { error } = await supabase.from("categories").delete().eq("slug", slug);
      if (error) return { error: error.message };
      await refresh();
      return { error: null };
    } catch {
      return { error: "Couldn't reach the server. Try again in a moment." };
    }
  };

  const spaceUsage: CategoriesContextType["spaceUsage"] = async (slug) => {
    if (!supabase || !user || !isAdmin) return { error: "Only an admin can do that." };
    try {
      const { data, error } = await supabase.rpc("space_usage", { p_slug: slug });
      if (error) {
        return {
          error: /function .* does not exist/i.test(error.message)
            ? "Run sql/spaces-admin.sql in Supabase first."
            : error.message,
        };
      }
      const u = (data ?? {}) as any;
      return {
        error: null,
        usage: {
          posts: Number(u.posts ?? 0),
          pursuits: Number(u.pursuits ?? 0),
          circles: Number(u.circles ?? 0),
          corners: Number(u.corners ?? 0),
        },
      };
    } catch {
      return { error: "Couldn't reach the server. Try again in a moment." };
    }
  };

  const deleteSpace: CategoriesContextType["deleteSpace"] = async (slug) => {
    if (!supabase || !user || !isAdmin) return { error: "Only an admin can do that." };
    if (isBuiltInSpace(slug)) {
      return { error: "Built-in Spaces can be hidden, not deleted." };
    }
    try {
      const { error } = await supabase.rpc("admin_delete_space", { p_slug: slug });
      if (error) return { error: error.message };
      await refresh();
      return { error: null };
    } catch {
      return { error: "Couldn't reach the server. Try again in a moment." };
    }
  };

  const moveSpaceContent: CategoriesContextType["moveSpaceContent"] = async (from, to) => {
    if (!supabase || !user || !isAdmin) return { error: "Only an admin can do that." };
    try {
      const { data, error } = await supabase.rpc("admin_move_space_content", {
        p_from: from,
        p_to: to,
      });
      if (error) return { error: error.message };
      const m = (data ?? {}) as any;
      await refresh();
      return {
        error: null,
        moved: {
          posts: Number(m.posts ?? 0),
          pursuits: Number(m.pursuits ?? 0),
          circles: Number(m.circles ?? 0),
        },
      };
    } catch {
      return { error: "Couldn't reach the server. Try again in a moment." };
    }
  };

  // Approved additions append to the fifteen rather than replacing them, and
  // a duplicate slug never shadows a built-in one.
  const builtinSlugs = new Set(CATEGORIES.map((c) => c.slug));
  const categories = [...CATEGORIES, ...extra.filter((c) => !builtinSlugs.has(c.slug))];

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        isAdmin,
        suggestions,
        pendingCount,
        suggest,
        review,
        refresh,
        spaceRows,
        saveSpace,
        resetSpace,
        spaceUsage,
        deleteSpace,
        moveSpaceContent,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories must be used inside CategoriesProvider");
  return ctx;
}
