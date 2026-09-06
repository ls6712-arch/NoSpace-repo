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

  const refresh = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: cats } = await supabase.from("categories").select("*");
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
            names[p.id] = p.display_name?.trim() || "Someone";
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

  // Approved additions append to the fifteen rather than replacing them, and
  // a duplicate slug never shadows a built-in one.
  const builtinSlugs = new Set(CATEGORIES.map((c) => c.slug));
  const categories = [...CATEGORIES, ...extra.filter((c) => !builtinSlugs.has(c.slug))];

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  return (
    <CategoriesContext.Provider
      value={{ categories, isAdmin, suggestions, pendingCount, suggest, review, refresh }}
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
