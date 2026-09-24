import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { SpaceForm } from "../components/SpaceForm";
import { Button } from "../components/ui/button";
import type { SpaceRow } from "../lib/spaces";

export function EditSpace() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState<
    | "loading"
    | "not-found"
    | "not-host"
    | { space: SpaceRow; corners: { spaceSlug: string; slug: string; name: string }[]; address?: string }
  >("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase || !user) {
        if (!cancelled) setState("not-host");
        return;
      }
      const { data: space } = await supabase.from("spaces").select("*").eq("slug", slug).maybeSingle();
      if (!space) return void (!cancelled && setState("not-found"));

      const { data: membership } = await supabase
        .from("space_members")
        .select("role, status")
        .eq("space_id", space.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!membership || membership.role !== "host" || membership.status !== "active") {
        return void (!cancelled && setState("not-host"));
      }

      const { data: cornerRows } = await supabase
        .from("space_corners")
        .select("is_primary, added_at, corners(slug, name, space_slug)")
        .eq("space_id", space.id)
        .order("is_primary", { ascending: false })
        .order("added_at", { ascending: true });
      const corners = (cornerRows ?? [])
        .map((r: any) => r.corners && { spaceSlug: r.corners.space_slug, slug: r.corners.slug, name: r.corners.name })
        .filter(Boolean);

      const { data: details } = await supabase
        .from("space_private_details")
        .select("exact_address")
        .eq("space_id", space.id)
        .maybeSingle();

      if (!cancelled) setState({ space: space as SpaceRow, corners, address: details?.exact_address ?? undefined });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, user]);

  if (state === "loading") return <div className="min-h-[60vh]" />;
  if (state === "not-found") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-center">
        <div>
          <h2 className="text-xl mb-4">That Space doesn't exist</h2>
          <Link to="/discover"><Button variant="outline">Back to Discover</Button></Link>
        </div>
      </div>
    );
  }
  if (state === "not-host") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-center">
        <div>
          <h2 className="text-xl mb-4">Only a host can edit this Space</h2>
          <Link to={`/space/${slug}`}><Button variant="outline">Back to the Space</Button></Link>
        </div>
      </div>
    );
  }
  return <SpaceForm mode="edit" space={state.space} initialCorners={state.corners} initialAddress={state.address} />;
}
