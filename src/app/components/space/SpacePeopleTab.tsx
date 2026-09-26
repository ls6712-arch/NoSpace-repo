import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../../lib/supabase";
import { inviteHost, type SpaceRow } from "../../lib/spaces";
import { Button } from "../ui/button";

type Row = { user_id: string; role: "host" | "member"; username: string; displayName: string };

/** No member counts anywhere in this app's Spaces UI — just the roster
 * itself. Visibility of who's on it at all is entirely RLS's call
 * ("roster visibility follows status and the space's access") — this
 * only ever renders whatever rows come back. */
export function SpacePeopleTab({ space, isHost }: { space: SpaceRow; isHost: boolean }) {
  const [rows, setRows] = useState<Row[] | "loading">("loading");
  // Members already invited (space_host_invites.status = 'invited') —
  // invite_host's own unique(space_id, invited_user_id, status)
  // constraint would otherwise turn a second click into a raw DB error,
  // so this both disables the button and labels it "Invited".
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    async function loadInvites() {
      // "hosts and the invitee see the invite" — a non-host querying this
      // just gets their own invite rows back, which never matters here
      // since the button this drives only renders for isHost anyway.
      if (!supabase || !isHost) return;
      const { data } = await supabase
        .from("space_host_invites")
        .select("invited_user_id")
        .eq("space_id", space.id)
        .eq("status", "invited");
      if (!cancelled) setInvitedIds(new Set((data ?? []).map((r) => r.invited_user_id as string)));
    }
    loadInvites();
    return () => {
      cancelled = true;
    };
  }, [space.id, isHost]);

  const invite = async (userId: string) => {
    setInviteError(null);
    setInviteBusyId(userId);
    const { error } = await inviteHost(space.id, userId);
    setInviteBusyId(null);
    if (error) return setInviteError(error);
    setInvitedIds((prev) => new Set(prev).add(userId));
  };

  if (rows === "loading") return <div className="min-h-[30vh]" />;

  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nobody to show yet.</p>;
  }

  const otherMemberCount = rows.filter((r) => r.role === "member").length;

  return (
    <div className="py-2">
      {isHost && otherMemberCount === 0 && (
        <p className="mb-2 text-xs text-muted-foreground">Once people join, you can invite a co-host here.</p>
      )}
      {inviteError && <p className="mb-2 text-xs text-destructive">{inviteError}</p>}
      <ul className="divide-y divide-[var(--hairline)]">
        {rows.map((r) => (
          <li key={r.user_id} className="flex items-center justify-between py-2.5">
            <Link to={`/u/${r.username}`} className="text-sm hover:underline">
              {r.displayName}
            </Link>
            {r.role === "host" ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">Host</span>
            ) : (
              isHost && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={inviteBusyId === r.user_id || invitedIds.has(r.user_id)}
                  onClick={() => invite(r.user_id)}
                >
                  {invitedIds.has(r.user_id) ? "Invited" : inviteBusyId === r.user_id ? "Inviting…" : "Invite as co-host"}
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
