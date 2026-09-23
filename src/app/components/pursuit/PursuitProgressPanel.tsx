import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Check, Plus, Search, UserPlus, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Project, ProgressEntry, PursuitMember, addJoinedProject } from "../../lib/journal";
import { formatAmount, hasMeasure, summarize, targetText, unitFor } from "../../lib/pursuitProgress";
import { usePursuitMembers, usePursuitProgress } from "../../lib/usePursuitProgress";
import {
  PursuitInvite,
  answerInvite,
  fetchMyInvites,
  fetchPursuitAsProject,
  saveInvites,
} from "../../lib/pursuitsRemote";
import { usePeopleSearch } from "../../lib/people";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { PersonAvatar } from "../../pages/CreatePursuit";
import { ProgressBar, SoftPanel } from "./ui";

/**
 * The top of a measured Pursuit's page, in whichever of the three shapes
 * it was created as:
 *   solo      "7 / 20 paintings", a bar, what's left
 *   together  "Paint together" — a column per person, each with their own
 *             count, bar and latest pieces
 *   group     "Community mural" — one shared bar, contributions, and the
 *             journey's milestones
 */
export function PursuitProgressPanel({
  project,
  viewerIsOwner,
}: {
  project: Project;
  viewerIsOwner: boolean;
}) {
  const { user, profile } = useAuth();
  const entries = usePursuitProgress(project.id);
  const ownerFallback: PursuitMember = {
    userId: project.ownerId ?? user?.id,
    displayName: viewerIsOwner ? profile?.display_name?.trim() || "You" : "Owner",
    avatarUrl: viewerIsOwner ? profile?.avatar_url : undefined,
    status: "joined",
    role: "owner",
  };
  const [inviting, setInviting] = useState(false);
  const [membersVersion, setMembersVersion] = useState(0);
  const members = usePursuitMembers(project, ownerFallback, membersVersion);
  if (!hasMeasure(project)) return null;
  const measure = project.measure;
  const mode = project.mode ?? "solo";

  const entriesOf = (m: PursuitMember) =>
    entries.filter((e) => (e.userId ?? user?.id) === m.userId || (!m.userId && m.role === "owner" && !e.userId));
  const nameOf = (m: PursuitMember) => (m.userId && m.userId === user?.id ? "You" : m.displayName);

  const actions = (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {viewerIsOwner && mode !== "solo" ? (
        <Button variant="outline" className="h-11 rounded-xl" onClick={() => setInviting(true)}>
          <UserPlus className="size-4" /> Invite people
        </Button>
      ) : (
        <span />
      )}
      <Link to={`/pursuit/${project.id}/moment`} className={mode === "solo" || !viewerIsOwner ? "col-span-2" : ""}>
        <Button variant="coral" className="h-11 w-full rounded-xl">
          <Plus className="size-4" /> Add a Moment
        </Button>
      </Link>
    </div>
  );

  // ── Solo ─────────────────────────────────────────────────────────────
  if (mode === "solo") {
    const s = summarize(measure, entries);
    return (
      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <Headline current={s.current} target={measure.target} unit={measure.unit} />
        <ProgressBar fraction={s.fraction} className="mt-3" />
        <MetaLine percent={s.percent} remaining={s.remaining} unit={measure.unit} done={s.done} targetDate={measure.targetDate} />
        {measure.kind === "milestones" && <MilestoneList names={measure.milestones ?? []} reached={Math.floor(s.current)} />}
        {measure.whatCounts && <p className="mt-3 text-xs text-muted-foreground">Counts: {measure.whatCounts}</p>}
        {viewerIsOwner && actions}
      </section>
    );
  }

  // ── Side by side ─────────────────────────────────────────────────────
  if (mode === "together") {
    return (
      <section className="mb-6">
        <p className="mb-3 text-sm text-muted-foreground">Everyone has their own goal and journey.</p>
        <div className="grid grid-cols-2 gap-4">
          {members.map((m) => {
            const mine = entriesOf(m);
            const s = summarize(measure, mine, m.role === "owner");
            const pieces = mine.filter((e) => e.image).slice(-3);
            return (
              <div key={m.userId ?? m.displayName} className="min-w-0">
                <PersonAvatar name={m.displayName} src={m.avatarUrl} size="size-16" />
                <p className="mt-2 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                  {nameOf(m)}
                </p>
                {m.status === "invited" ? (
                  <p className="text-xs text-muted-foreground">Invited</p>
                ) : (
                  <>
                    <p className="text-sm">
                      {formatAmount(s.current)} / {targetText(measure)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.done ? "Goal reached" : `${formatAmount(s.remaining)} remaining`}
                    </p>
                    <ProgressBar fraction={s.fraction} thin className="mt-2" />
                  </>
                )}
                {pieces.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {pieces.map((e) => (
                      <img key={e.id} src={e.image} alt={e.note ?? ""} className="aspect-[3/4] w-full rounded-md object-cover" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {actions}
        <InviteDialog open={inviting} onOpenChange={setInviting} project={project} existing={members} onInvited={() => setMembersVersion((v) => v + 1)} />
      </section>
    );
  }

  // ── One shared goal ──────────────────────────────────────────────────
  const s = summarize(measure, entries);
  const joined = members.filter((m) => m.status === "joined");
  return (
    <section className="mb-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <Headline current={s.current} target={measure.target} unit={measure.unit} />
        <ProgressBar fraction={s.fraction} className="mt-3" />
        <MetaLine percent={s.percent} remaining={s.remaining} unit={measure.unit} done={s.done} targetDate={measure.targetDate} />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5" /> {joined.length} contributor{joined.length === 1 ? "" : "s"}
        </p>
      </div>

      <h3 className="mb-2 mt-5 text-sm">Contributions</h3>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {members.map((m) => {
          const theirs = entriesOf(m);
          const total = theirs.reduce((sum, e) => sum + e.amount, 0);
          const last = theirs.filter((e) => e.image).slice(-1)[0];
          return (
            <li key={m.userId ?? m.displayName} className="flex items-center gap-3 px-4 py-3">
              <PersonAvatar name={m.displayName} src={m.avatarUrl} size="size-9" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{nameOf(m)}</p>
                <p className="text-xs text-muted-foreground">
                  {m.status === "invited" ? "Invited" : `${formatAmount(total)} ${unitFor(measure, total)}`}
                </p>
              </div>
              {last && <img src={last.image} alt="" className="size-10 rounded-md object-cover" />}
            </li>
          );
        })}
      </ul>

      <h3 className="mb-2 mt-5 text-sm">Our journey</h3>
      <Journey current={s.current} target={measure.target} unitOf={(n) => unitFor(measure, n)} entries={entries} milestones={measure.milestones} />
      {actions}
      <InviteDialog open={inviting} onOpenChange={setInviting} project={project} existing={members} onInvited={() => setMembersVersion((v) => v + 1)} />
    </section>
  );
}

function Headline({ current, target, unit }: { current: number; target: number; unit: string }) {
  return (
    <p className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
      {formatAmount(current)} / {formatAmount(target)} <span className="text-lg">{unit}</span>
    </p>
  );
}

function MetaLine({
  percent,
  remaining,
  unit,
  done,
  targetDate,
}: {
  percent: number;
  remaining: number;
  unit: string;
  done: boolean;
  targetDate?: number;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
      <span>
        {percent}% · {done ? "Goal reached" : `${formatAmount(remaining)} ${unit} remaining`}
      </span>
      {targetDate && <span>by {new Date(targetDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
    </div>
  );
}

function MilestoneList({ names, reached }: { names: string[]; reached: number }) {
  return (
    <ol className="mt-4 space-y-2">
      {names.map((n, i) => (
        <li key={i} className="flex items-center gap-2.5 text-sm">
          <span
            className={`flex size-5 items-center justify-center rounded-full border text-[10px] ${
              i < reached ? "border-[var(--coral)] bg-[var(--coral)] text-white" : "border-border text-muted-foreground"
            }`}
          >
            {i < reached ? <Check className="size-3" /> : i + 1}
          </span>
          <span className={i < reached ? "" : "text-muted-foreground"}>{n}</span>
        </li>
      ))}
    </ol>
  );
}

/** A line with a marker at each quarter of the goal (or each named
 * milestone), filled once reached, labelled with the date it was reached. */
function Journey({
  current,
  target,
  unitOf,
  entries,
  milestones,
}: {
  current: number;
  target: number;
  unitOf: (n: number) => string;
  entries: ProgressEntry[];
  milestones?: string[];
}) {
  const marks = milestones?.length
    ? milestones.map((name, i) => ({ at: i + 1, label: name }))
    : [0.25, 0.5, 0.75, 1].map((f) => {
        const at = Math.max(1, Math.round(target * f));
        return { at, label: `${formatAmount(at)} ${unitOf(at)}` };
      });
  // When each mark was crossed, from the running total.
  let running = 0;
  const crossedAt = new Map<number, number>();
  for (const e of [...entries].sort((a, b) => a.createdAt - b.createdAt)) {
    running += e.amount;
    for (const m of marks) if (running >= m.at && !crossedAt.has(m.at)) crossedAt.set(m.at, e.createdAt);
  }
  return (
    <SoftPanel>
      <div className="relative flex items-start justify-between px-2 pt-1">
        <span className="absolute left-4 right-4 top-[13px] h-px bg-border" aria-hidden="true" />
        {marks.map((m) => {
          const reached = current >= m.at;
          const when = crossedAt.get(m.at);
          return (
            <div key={m.at} className="relative z-10 flex w-16 flex-col items-center text-center">
              <span
                className={`flex size-6 items-center justify-center rounded-full border ${
                  reached ? "border-[var(--coral)] bg-[var(--coral)] text-white" : "border-border bg-card"
                }`}
              >
                {reached && <Check className="size-3.5" />}
              </span>
              <span className="mt-1.5 text-[10px] leading-tight">{m.label}</span>
              <span className="text-[10px] text-muted-foreground">
                {when ? new Date(when).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : reached ? "Start" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </SoftPanel>
  );
}

/** Owner invites more people to an existing shared Pursuit. */
export function InviteDialog({
  open,
  onOpenChange,
  project,
  existing,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: Project;
  existing: PursuitMember[];
  onInvited?: () => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const { people, loading } = usePeopleSearch(query);
  const [status, setStatus] = useState<string | null>(null);

  const invite = async (personId: string, name: string) => {
    if (!user) return;
    const err = await saveInvites(project.id, user.id, [personId]);
    setStatus(err ? `Couldn't invite ${name}: ${err}` : `Invited ${name}.`);
    if (!err) onInvited?.();
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Invite people</DialogTitle>
          <DialogDescription>They'll see an invite in My Space.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people by name"
            autoFocus
            className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-[var(--coral-deep)]"
          />
        </div>
        <ul className="max-h-60 overflow-y-auto">
          {people
            .filter((p) => p.id !== user?.id && !existing.some((m) => m.userId === p.id))
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => invite(p.id, p.displayName)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-surface-muted"
                >
                  <PersonAvatar name={p.displayName} src={p.avatarUrl} />
                  <span className="flex-1 text-sm">{p.displayName}</span>
                  <span className="text-xs text-accent">Invite</span>
                </button>
              </li>
            ))}
          {query.trim().length >= 2 && !loading && people.length === 0 && (
            <li className="px-2 py-2 text-xs text-muted-foreground">No one found.</li>
          )}
        </ul>
        {status && <p className="text-xs text-muted-foreground">{status}</p>}
      </DialogContent>
    </Dialog>
  );
}

/** "Maya invited you to Paint together" — on My Space, for the invitee. */
export function PursuitInvitesCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState<PursuitInvite[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchMyInvites(user.id).then(setInvites);
  }, [user?.id]);

  if (!user || invites.length === 0) return null;

  const answer = async (inv: PursuitInvite, accept: boolean) => {
    const ok = await answerInvite(inv.pursuitId, user.id, accept);
    if (!ok) return;
    setInvites((l) => l.filter((i) => i.pursuitId !== inv.pursuitId));
    if (accept) {
      const p = await fetchPursuitAsProject(inv.pursuitId);
      if (p) {
        addJoinedProject({ ...p, role: "member", shared: p.shared });
        navigate(`/pursuit/${inv.pursuitId}`);
      }
    }
  };

  return (
    <div className="mb-4 space-y-2">
      {invites.map((inv) => (
        <div key={inv.pursuitId} className="rounded-2xl border border-[var(--coral)]/50 bg-card p-4">
          <div className="flex items-center gap-2.5">
            <PersonAvatar name={inv.ownerName} src={inv.ownerAvatar} />
            <p className="text-sm">
              {inv.ownerName} invited you to{" "}
              <span style={{ fontFamily: "var(--font-serif)" }}>{inv.title}</span>
            </p>
          </div>
          <p className="mt-1 pl-[38px] text-xs text-muted-foreground">
            {inv.mode === "group" ? "One shared goal, everyone contributes." : "Side by side — you'll have your own goal and journey."}
          </p>
          <div className="mt-3 flex gap-2 pl-[38px]">
            <Button variant="coral" size="sm" onClick={() => answer(inv, true)}>
              Join
            </Button>
            <Button variant="outline" size="sm" onClick={() => answer(inv, false)}>
              Not this time
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
