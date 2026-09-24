import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import {
  approveJoinRequest,
  declineJoinRequest,
  banMember,
  unbanMember,
  removeMember,
  demoteHost,
  inviteHost,
  acceptHostHandoff,
  requestSpaceDeletion,
  respondToDeletionRequest,
  cancelDeletionRequest,
  type SpaceRow,
} from "../../lib/spaces";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type JoinRequestRow = {
  user_id: string;
  answers: { message?: string; post_id?: number } | null;
  displayName: string;
  postCaption?: string;
};
type MemberRow = { user_id: string; role: "host" | "member"; status: "active" | "banned"; displayName: string };
type InviteRow = { id: number; invited_user_id: string; displayName: string };
type DeletionRequest = {
  id: number;
  requested_by: string;
  status: string;
  expires_at: string;
  approvals: { host_user_id: string; decision: string; displayName: string }[];
};

export function SpaceManageTab({
  space,
  isHost,
  viewerJoinedAt,
}: {
  space: SpaceRow;
  isHost: boolean;
  viewerJoinedAt?: string;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [deletion, setDeletion] = useState<DeletionRequest | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const eligibleForHandoff = !!(
    space.host_handoff_started_at &&
    viewerJoinedAt &&
    new Date(viewerJoinedAt).getTime() < new Date(space.host_handoff_started_at).getTime()
  );

  const refetch = async () => {
    if (!supabase || !isHost) return;
    const [{ data: reqs }, { data: memberRows }, { data: inviteRows }, { data: delReqs }] = await Promise.all([
      supabase.from("space_join_requests").select("user_id, answers").eq("space_id", space.id),
      supabase
        .from("space_members")
        .select("user_id, role, status")
        .eq("space_id", space.id)
        .in("status", ["active", "banned"]),
      supabase
        .from("space_host_invites")
        .select("id, invited_user_id")
        .eq("space_id", space.id)
        .eq("status", "invited"),
      supabase
        .from("space_deletion_requests")
        .select("id, requested_by, status, expires_at")
        .eq("space_id", space.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);

    const postIds = (reqs ?? []).map((r: any) => r.answers?.post_id).filter((id: unknown): id is number => typeof id === "number");
    const { data: postRows } = postIds.length
      ? await supabase.from("posts").select("id, caption").in("id", postIds)
      : { data: [] as { id: number; caption: string }[] };
    const captionById = new Map((postRows ?? []).map((p) => [p.id, p.caption]));

    let approvalRows: { host_user_id: string; decision: string }[] = [];
    if (delReqs) {
      const { data: approvals } = await supabase
        .from("space_deletion_approvals")
        .select("host_user_id, decision")
        .eq("deletion_request_id", delReqs.id);
      approvalRows = approvals ?? [];
    }

    // None of space_join_requests/space_members/space_host_invites/
    // space_deletion_approvals has a direct FK to profiles (they all
    // reference auth.users, and profiles is a sibling of that, not a
    // child of these) — no PostgREST embed is possible, so every name
    // shown here comes from one combined lookup instead.
    const userIds = [
      ...new Set([
        ...(reqs ?? []).map((r: any) => r.user_id as string),
        ...(memberRows ?? []).map((r: any) => r.user_id as string),
        ...(inviteRows ?? []).map((r: any) => r.invited_user_id as string),
        ...approvalRows.map((a) => a.host_user_id),
      ]),
    ];
    const { data: profilesData } = userIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", userIds)
      : { data: [] as { id: string; display_name: string }[] };
    const nameById = new Map((profilesData ?? []).map((p) => [p.id, p.display_name || "Someone"]));

    setJoinRequests(
      (reqs ?? []).map((r: any) => ({
        user_id: r.user_id,
        answers: r.answers,
        displayName: nameById.get(r.user_id) ?? "Someone",
        postCaption: r.answers?.post_id ? captionById.get(r.answers.post_id) : undefined,
      })),
    );
    setMembers(
      (memberRows ?? []).map((r: any) => ({
        user_id: r.user_id,
        role: r.role,
        status: r.status,
        displayName: nameById.get(r.user_id) ?? "Someone",
      })),
    );
    setInvites(
      (inviteRows ?? []).map((r: any) => ({
        id: r.id,
        invited_user_id: r.invited_user_id,
        displayName: nameById.get(r.invited_user_id) ?? "Someone",
      })),
    );

    setDeletion(
      delReqs
        ? {
            id: delReqs.id,
            requested_by: delReqs.requested_by,
            status: delReqs.status,
            expires_at: delReqs.expires_at,
            approvals: approvalRows.map((a) => ({
              host_user_id: a.host_user_id,
              decision: a.decision,
              displayName: nameById.get(a.host_user_id) ?? "Someone",
            })),
          }
        : null,
    );
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space.id, isHost]);

  const run = async (key: string, action: () => Promise<{ error: string | null }>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    const { error: err } = await action();
    setBusy(null);
    if (err) return setError(err);
    refetch();
  };

  const claimHosting = async () => {
    setBusy("claim");
    setError(null);
    const { error: err } = await acceptHostHandoff(space.id);
    setBusy(null);
    if (err) return setError(err);
    window.location.reload();
  };

  const sendInvite = async () => {
    // A plain username lookup keeps this simple — the invite itself still
    // requires the target to already be an active member (invite_host's
    // own check), so a typo just surfaces that RPC's own friendly error.
    if (!supabase || !inviteUsername.trim()) return;
    setBusy("invite");
    setError(null);
    const { data: target } = await supabase.from("profiles").select("id").eq("username", inviteUsername.trim()).maybeSingle();
    if (!target) {
      setBusy(null);
      return setError("No one with that username.");
    }
    const { error: err } = await inviteHost(space.id, target.id);
    setBusy(null);
    if (err) return setError(err);
    setInviteUsername("");
    refetch();
  };

  const startDeletion = async () => {
    const isSoleHost = members.filter((m) => m.role === "host" && m.status === "active").length <= 1;
    if (isSoleHost && deleteConfirmName.trim() !== space.name) {
      return setError(`Type "${space.name}" exactly to confirm.`);
    }
    setBusy("delete");
    setError(null);
    const { data, error: err } = await requestSpaceDeletion(space.id);
    setBusy(null);
    if (err) return setError(err);
    if (data === "deleted") {
      window.location.hash = "#/discover";
    } else {
      setNotice("Deletion requested — every other host needs to approve within 7 days.");
      refetch();
    }
  };

  const respond = async (decision: "approved" | "declined") => {
    if (!deletion) return;
    setBusy("respond");
    setError(null);
    const { data, error: err } = await respondToDeletionRequest(deletion.id, decision);
    setBusy(null);
    if (err) return setError(err);
    if (data === "deleted") {
      window.location.hash = "#/discover";
      return;
    }
    if (data === "expired") setNotice("That request had already expired and is now cancelled.");
    else if (data === "cancelled") setNotice("The deletion request was cancelled.");
    else if (data === "pending") setNotice("Your response is recorded — waiting on other hosts.");
    refetch();
  };

  if (!isHost) {
    return (
      <div className="py-8 text-center">
        {space.host_handoff_started_at ? (
          <div className="mx-auto max-w-sm rounded-2xl border border-[var(--coral-deep)]/30 bg-[var(--coral-deep)]/5 p-4">
            <p className="text-sm">This Space has no host right now.</p>
            {eligibleForHandoff ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  You were here before it lost its host — you can step up.
                </p>
                <Button className="mt-3" variant="coral" size="sm" disabled={busy === "claim"} onClick={claimHosting}>
                  {busy === "claim" ? "Claiming…" : "Claim hosting"}
                </Button>
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Only members who were here before this happened can claim it.
              </p>
            )}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Only a host can manage this Space.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 py-6">
      {error && <p className="text-xs text-destructive">{error}</p>}
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}

      <section>
        <h3 className="mb-2 text-sm font-medium">Pending requests</h3>
        {joinRequests.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing pending.</p>
        ) : (
          <ul className="space-y-2">
            {joinRequests.map((r) => (
              <li key={r.user_id} className="rounded-xl border border-border p-3">
                <p className="text-sm">{r.displayName}</p>
                {r.answers?.message && <p className="mt-1 text-xs text-muted-foreground">"{r.answers.message}"</p>}
                {r.postCaption && <p className="mt-1 text-xs text-muted-foreground">Attached: {r.postCaption}</p>}
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="coral"
                    disabled={busy === `approve-${r.user_id}`}
                    onClick={() => run(`approve-${r.user_id}`, () => approveJoinRequest(space.id, r.user_id))}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === `decline-${r.user_id}`}
                    onClick={() => run(`decline-${r.user_id}`, () => declineJoinRequest(space.id, r.user_id))}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium">Members</h3>
        <ul className="divide-y divide-[var(--hairline)]">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between py-2">
              <span className="text-sm">
                {m.displayName}
                {m.role === "host" && <span className="ml-1.5 text-[10px] text-muted-foreground">Host</span>}
                {m.status === "banned" && <span className="ml-1.5 text-[10px] text-destructive">Banned</span>}
              </span>
              {m.user_id !== user?.id && (
                <div className="flex gap-1.5">
                  {m.status === "banned" ? (
                    <Button size="sm" variant="outline" disabled={busy === `unban-${m.user_id}`} onClick={() => run(`unban-${m.user_id}`, () => unbanMember(space.id, m.user_id))}>
                      Unban
                    </Button>
                  ) : (
                    <>
                      {m.role === "host" ? (
                        <Button size="sm" variant="outline" disabled={busy === `demote-${m.user_id}`} onClick={() => run(`demote-${m.user_id}`, () => demoteHost(space.id, m.user_id))}>
                          Demote
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" disabled={busy === `invite-${m.user_id}`} onClick={() => run(`invite-${m.user_id}`, () => inviteHost(space.id, m.user_id))}>
                            Make host
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy === `remove-${m.user_id}`} onClick={() => run(`remove-${m.user_id}`, () => removeMember(space.id, m.user_id))}>
                            Remove
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy === `ban-${m.user_id}`} onClick={() => run(`ban-${m.user_id}`, () => banMember(space.id, m.user_id))}>
                            Ban
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {invites.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Pending host invites</h3>
          <ul className="space-y-1">
            {invites.map((i) => (
              <li key={i.id} className="text-xs text-muted-foreground">{i.displayName} — waiting on their response</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-medium">Invite a co-host</h3>
        <div className="flex gap-2">
          <Input placeholder="username" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} />
          <Button size="sm" variant="outline" disabled={busy === "invite" || !inviteUsername.trim()} onClick={sendInvite}>
            Invite
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">They need to already be a member.</p>
      </section>

      <section className="border-t border-[var(--hairline)] pt-6">
        <h3 className="mb-2 text-sm font-medium text-destructive">Delete this Space</h3>
        {deletion ? (
          <div className="rounded-xl border border-border p-3 text-sm">
            <p>A deletion request is open, expiring {new Date(deletion.expires_at).toLocaleDateString()}.</p>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {deletion.approvals.map((a) => (
                <li key={a.host_user_id}>{a.displayName}: {a.decision}</li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              {deletion.approvals.some((a) => a.host_user_id === user?.id && a.decision === "pending") && (
                <>
                  <Button size="sm" variant="outline" disabled={busy === "respond"} onClick={() => respond("approved")}>Approve</Button>
                  <Button size="sm" variant="outline" disabled={busy === "respond"} onClick={() => respond("declined")}>Decline</Button>
                </>
              )}
              {deletion.requested_by === user?.id && (
                <Button size="sm" variant="outline" disabled={busy === "cancel-deletion"} onClick={() => run("cancel-deletion", () => cancelDeletionRequest(deletion.id))}>
                  Cancel request
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-sm space-y-2">
            {members.filter((m) => m.role === "host" && m.status === "active").length <= 1 && (
              <>
                <p className="text-xs text-muted-foreground">You're the only host — type the Space's name to delete it now.</p>
                <Input value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} placeholder={space.name} />
              </>
            )}
            <Button size="sm" variant="outline" className="text-destructive" disabled={busy === "delete"} onClick={startDeletion}>
              {busy === "delete" ? "Working…" : "Request deletion"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
