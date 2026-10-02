import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, Copy, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCategories } from "../context/CategoriesContext";
import { supabase } from "../../lib/supabase";
import { createInvite, inviteLink, revokeInvite } from "../lib/invites";
import { fetchWaitingFirstMoments, type WaitingFirstMoment } from "../lib/firstResponse";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { APP_NAME } from "../config";

/**
 * Step 2 (invite-only sign-up) — admin-only "Create invite" + the list of
 * every invite ever created, plus the waitlist. Invisible unless the
 * profiles row says is_admin (same guard as every other admin page).
 *
 * The `invites`/`waitlist` column names read below (`from("invites")`,
 * `from("waitlist")`) are confirmed against the live schema (migration
 * 20260929202136_step2_invite_only.sql). `invites` also has its own
 * `status` column ('open'/'claimed'/'revoked'), but `revoked_at` and
 * `claimed_by` are what's read here since `inviteStatus()` below already
 * derives "Claimed by {name}" / "Expired" client-side from them.
 */

interface InviteRow {
  code: string;
  note: string | null;
  createdAt: number;
  expiresAt: number;
  claimedByName: string | null;
  revoked: boolean;
}

interface WaitlistRow {
  email: string;
  hobby: string | null;
  createdAt: number;
}

function when(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function inviteStatus(row: InviteRow): { label: string; done: boolean } {
  if (row.claimedByName) return { label: `Claimed by ${row.claimedByName}`, done: true };
  if (row.revoked) return { label: "Revoked", done: true };
  if (row.expiresAt < Date.now()) return { label: "Expired", done: true };
  return { label: "Open", done: false };
}

export function AdminInvites() {
  const { user } = useAuth();
  const { isAdmin } = useCategories();

  const [rows, setRows] = useState<InviteRow[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  // Step 4: first moments nobody has written a thought on yet.
  const [waiting, setWaiting] = useState<WaitingFirstMoment[]>([]);
  const [waitingError, setWaitingError] = useState<string | null>(null);

  const load = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError(null);

    const [{ data: invites, error: invitesErr }, { data: wait }] = await Promise.all([
      supabase
        .from("invites")
        .select("code, note, created_at, expires_at, claimed_by, revoked_at")
        .order("created_at", { ascending: false }),
      supabase.from("waitlist").select("email, hobby, created_at").order("created_at", { ascending: false }),
    ]);

    if (invitesErr) {
      setListError("Couldn't load invites — the columns this page expects may not match the live schema yet.");
      setLoading(false);
      return;
    }

    const claimedIds = [...new Set((invites ?? []).map((r: any) => r.claimed_by).filter(Boolean))];
    const { data: people } = claimedIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", claimedIds)
      : { data: [] as any[] };
    const nameOf = (id: string | null) =>
      id ? (people ?? []).find((p: any) => p.id === id)?.display_name?.trim() || "Someone" : null;

    setRows(
      (invites ?? []).map((r: any) => ({
        code: r.code,
        note: r.note,
        createdAt: new Date(r.created_at).getTime(),
        expiresAt: new Date(r.expires_at).getTime(),
        claimedByName: nameOf(r.claimed_by),
        revoked: !!r.revoked_at,
      })),
    );
    setWaitlist(
      (wait ?? []).map((r: any) => ({
        email: r.email,
        hobby: r.hobby,
        createdAt: new Date(r.created_at).getTime(),
      })),
    );
    setLoading(false);
  };

  const loadWaiting = async () => {
    const result = await fetchWaitingFirstMoments();
    setWaiting(result.rows);
    setWaitingError(result.error ? "Couldn't load first moments. Try again in a moment." : null);
  };

  useEffect(() => {
    if (isAdmin) {
      void load();
      void loadWaiting();
    }
  }, [isAdmin]);

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="text-center">
          <h2 className="mb-3 text-title" style={{ fontFamily: "var(--font-serif)" }}>
            Nothing here for you
          </h2>
          <p className="mb-6 max-w-sm text-small text-muted-foreground">This screen is for whoever sends invites.</p>
          <Link to="/discover">
            <Button variant="outline">Back to Discover</Button>
          </Link>
        </div>
      </div>
    );
  }

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    setNewLink(null);
    setCopied(false);
    const result = await createInvite(note);
    setCreating(false);
    if (result.error || !result.code) {
      setCreateError(result.error || "Couldn't create that invite.");
      return;
    }
    setNewLink(inviteLink(result.code));
    setNote("");
    await load();
  };

  const copyLink = async () => {
    if (!newLink) return;
    try {
      await navigator.clipboard.writeText(newLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — the link is still shown on screen to copy by hand.
    }
  };

  const revoke = async (code: string) => {
    if (busyCode) return;
    setBusyCode(code);
    const ok = await revokeInvite(code);
    setBusyCode(null);
    if (ok) await load();
  };

  return (
    <div className="min-h-viewport bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-display" style={{ fontFamily: "var(--font-serif)" }}>
          Invites
        </h1>
        <p className="mb-8 mt-2 text-small text-muted-foreground">
          {APP_NAME} is invite-only for now — create a link for someone to join with.
        </p>

        <div className="mb-8 rounded-card border border-border bg-card p-4">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 280))}
            placeholder="A note for them, optional — shown on their arrival page."
            className="mb-2"
          />
          <div className="mb-3 text-right text-caption text-muted-foreground">{note.length}/280</div>
          {createError && <p className="mb-3 text-caption text-destructive">{createError}</p>}
          <Button variant="coral" disabled={creating} onClick={create}>
            {creating ? "Creating…" : "Create invite"}
          </Button>

          {newLink && (
            <div className="mt-4 flex items-center gap-2 rounded-card border border-[var(--hairline)] bg-surface-muted px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate text-caption">{newLink}</code>
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
        </div>

        <Tabs defaultValue="invites">
          <TabsList className="mb-6">
            <TabsTrigger value="invites">Invites{rows.length > 0 ? ` (${rows.length})` : ""}</TabsTrigger>
            <TabsTrigger value="waitlist">Waitlist{waitlist.length > 0 ? ` (${waitlist.length})` : ""}</TabsTrigger>
            <TabsTrigger value="first-moments">
              First moments{waiting.length > 0 ? ` (${waiting.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invites">
            {listError && <p className="mb-4 text-small text-destructive">{listError}</p>}
            {loading ? (
              <p className="py-12 text-center text-small text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="rounded-card border border-dashed border-border px-6 py-12 text-center text-small text-muted-foreground">
                No invites created yet.
              </div>
            ) : (
              <ul className="space-y-3">
                {rows.map((r) => {
                  const status = inviteStatus(r);
                  return (
                    <li key={r.code} className="rounded-card border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 text-small">
                          <p className="font-mono text-caption uppercase tracking-wide text-muted-foreground">{r.code}</p>
                          {r.note && <p className="mt-1 italic text-foreground">“{r.note}”</p>}
                          <p className="mt-1 text-caption text-muted-foreground">Created {when(r.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-control border px-2.5 py-1 text-caption ${
                              status.done
                                ? "border-border text-muted-foreground"
                                : "border-[var(--coral-deep)]/40 text-[var(--coral-deep)]"
                            }`}
                          >
                            {status.label}
                          </span>
                          {!status.done && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyCode === r.code}
                              onClick={() => revoke(r.code)}
                            >
                              <X className="size-3.5" />
                              Revoke
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="waitlist">
            {waitlist.length === 0 ? (
              <div className="rounded-card border border-dashed border-border px-6 py-12 text-center text-small text-muted-foreground">
                Nobody on the waitlist yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {waitlist.map((w, i) => (
                  <li
                    key={`${w.email}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-card px-4 py-3 text-small"
                  >
                    <span className="min-w-0 truncate">{w.email}</span>
                    <span className="text-caption text-muted-foreground">
                      {w.hobby ? `${w.hobby} · ` : ""}
                      {when(w.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="first-moments">
            <p className="mb-4 text-small text-muted-foreground">
              New people's first moments from the last 14 days with no thought from anyone yet,
              oldest first. Anything over 24 hours is ours to answer.
            </p>
            {waitingError && <p className="mb-4 text-small text-destructive">{waitingError}</p>}
            {waiting.length === 0 ? (
              <div className="rounded-card border border-dashed border-border px-6 py-12 text-center text-small text-muted-foreground">
                Every first moment has a thought.
              </div>
            ) : (
              <ul className="space-y-3">
                {waiting.map((m) => {
                  const overdue = m.hoursWaiting >= 24;
                  return (
                    <li key={m.postId} className="rounded-card border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 text-small">
                          <p className="font-medium text-foreground">{m.authorName}</p>
                          {m.caption && <p className="mt-1 line-clamp-2 text-muted-foreground">{m.caption}</p>}
                          <p className="mt-1 text-caption text-muted-foreground">
                            {m.inviterName ? `Invited by ${m.inviterName} · ` : ""}
                            {m.hoursWaiting < 1 ? "Just now" : `${m.hoursWaiting}h waiting`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {overdue && (
                            <span className="rounded-control border border-destructive/40 px-2.5 py-1 text-caption text-destructive">
                              Over 24h
                            </span>
                          )}
                          {m.canView ? (
                            <Button asChild variant="coral" size="sm">
                              <Link to={`/moment/${m.postId}?reply=1`}>Add a thought</Link>
                            </Button>
                          ) : (
                            <span className="text-caption text-muted-foreground">Followers only</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
