import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../../lib/supabase";
import type { SpaceRow } from "../../lib/spaces";

type Row = { user_id: string; role: "host" | "member"; username: string; displayName: string };

/** No member counts anywhere in this app's Spaces UI — just the roster
 * itself. Visibility of who's on it at all is entirely RLS's call
 * ("roster visibility follows status and the space's access") — this
 * only ever renders whatever rows come back. */
export function SpacePeopleTab({ space }: { space: SpaceRow }) {
  const [rows, setRows] = useState<Row[] | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) return;
      // space_members.user_id references auth.users, not profiles — no FK
      // PostgREST can embed through, so profiles is a separate lookup.
      const { data } = await supabase
        .from("space_members")
        .select("user_id, role, status")
        .eq("space_id", space.id)
        .eq("status", "active")
        .order("role", { ascending: true });
      const userIds = (data ?? []).map((r) => r.user_id as string);
      const { data: profilesData } = userIds.length
        ? await supabase.from("profiles").select("id, username, display_name").in("id", userIds)
        : { data: [] as { id: string; username: string; display_name: string }[] };
      const byId = new Map((profilesData ?? []).map((p) => [p.id, p]));
      if (cancelled) return;
      setRows(
        (data ?? []).map((r: any) => ({
          user_id: r.user_id,
          role: r.role,
          username: byId.get(r.user_id)?.username ?? "",
          displayName: byId.get(r.user_id)?.display_name || "Someone",
        })),
      );
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [space.id]);

  if (rows === "loading") return <div className="min-h-[30vh]" />;
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nobody to show yet.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--hairline)] py-2">
      {rows.map((r) => (
        <li key={r.user_id} className="flex items-center justify-between py-2.5">
          <Link to={`/u/${r.username}`} className="text-sm hover:underline">
            {r.displayName}
          </Link>
          {r.role === "host" && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">Host</span>
          )}
        </li>
      ))}
    </ul>
  );
}
