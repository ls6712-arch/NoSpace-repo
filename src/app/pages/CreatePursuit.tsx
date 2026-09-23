import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  Hash,
  Lightbulb,
  PenLine,
  Search,
  Sigma,
  Target,
  User,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { AmountStepper, ProgressBar, SoftPanel, StepDots, Toggle, initials } from "../components/pursuit/ui";
import {
  DEFAULT_CHECK_IN_DAYS,
  Measure,
  MeasureKind,
  PursuitMember,
  PursuitMode,
  startProject,
} from "../lib/journal";
import { MEASURE_KINDS, defaultMeasure, formatAmount, targetText } from "../lib/pursuitProgress";
import { mirrorPursuit, mirrorPursuitMeasure, saveInvites } from "../lib/pursuitsRemote";
import { Person, usePeopleSearch } from "../lib/people";

const STEPS = ["Goal", "Measure", "Rules", "People", "Review"];
/** Screens → which step dot is lit. "Define" is the second screen of Measure. */
const SCREEN_STEP = [0, 1, 1, 2, 3, 4];

const KIND_ICON: Record<MeasureKind, typeof Hash> = {
  count: CheckCircle2,
  quantity: Sigma,
  time: Clock,
  milestones: Flag,
  custom: PenLine,
};

/**
 * Create a Pursuit — the mockup flow, one screen per question:
 *   1 Goal     What are you trying to accomplish?
 *   2 Measure  How should progress add up?  →  Define your measurement
 *   3 Rules    Set your rules
 *   4 People   Who's participating?
 *   5 Review   Review your Pursuit → Begin Pursuit
 */
export function CreatePursuit() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [screen, setScreen] = useState(0);

  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const [kind, setKind] = useState<MeasureKind | null>(null);
  const [measure, setMeasure] = useState<Measure>(defaultMeasure("count"));
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [participation, setParticipation] = useState<"solo" | "invite">("solo");
  const [mode, setMode] = useState<Exclude<PursuitMode, "solo">>("together");
  const [invitees, setInvitees] = useState<Person[]>([]);
  const [query, setQuery] = useState("");
  const { people: results, loading: searching } = usePeopleSearch(query);
  const [saving, setSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const patch = (p: Partial<Measure>) => setMeasure((m) => ({ ...m, ...p }));

  const pickKind = (k: MeasureKind) => {
    setKind(k);
    const d = defaultMeasure(k);
    // Guess the unit from the goal text when it reads "Paint 10 paintings".
    const m = title.match(/([\d,.]+)\s+([a-zA-Z][a-zA-Z ]*)$/);
    if (m && (k === "count" || k === "quantity" || k === "custom")) {
      d.target = Number(m[1].replace(/,/g, "")) || d.target;
      d.unit = m[2].trim();
    }
    setMeasure(d);
  };

  const finalMeasure: Measure = useMemo(
    () => ({
      ...measure,
      target: measure.kind === "milestones" ? (measure.milestones ?? []).filter((x) => x.trim()).length || measure.target : measure.target,
      milestones: measure.kind === "milestones" ? (measure.milestones ?? []).map((x) => x.trim()).filter(Boolean) : undefined,
      targetDate: hasDeadline && deadline ? new Date(deadline).getTime() : undefined,
    }),
    [measure, hasDeadline, deadline],
  );

  const canContinue = [
    title.trim().length > 0,
    kind !== null,
    finalMeasure.target > 0 && finalMeasure.unit.trim().length > 0,
    !hasDeadline || !!deadline,
    participation === "solo" || invitees.length > 0,
    true,
  ][screen];

  const next = () => canContinue && setScreen((s) => Math.min(5, s + 1));
  const back = () => (screen === 0 ? navigate(-1) : setScreen((s) => s - 1));

  const begin = async () => {
    if (saving) return;
    setSaving(true);
    setInviteError(null);
    const pursuitMode: PursuitMode = participation === "solo" ? "solo" : mode;
    const ownerMember: PursuitMember = {
      userId: user?.id,
      username: profile?.username ?? null,
      displayName: profile?.display_name?.trim() || "You",
      avatarUrl: profile?.avatar_url,
      status: "joined",
      role: "owner",
    };
    const members: PursuitMember[] =
      pursuitMode === "solo"
        ? []
        : [
            ownerMember,
            ...invitees.map((p) => ({
              userId: p.id,
              username: p.username,
              displayName: p.displayName,
              avatarUrl: p.avatarUrl,
              status: "invited" as const,
              role: "member" as const,
            })),
          ];
    const project = startProject({
      title: title.trim(),
      measure: finalMeasure,
      mode: pursuitMode,
      members,
      checkInDays: DEFAULT_CHECK_IN_DAYS,
      // Invited people have to be able to open it.
      shared: false,
    });
    if (user) {
      await mirrorPursuit(user.id, project);
      await mirrorPursuitMeasure(project.id, pursuitMode, finalMeasure);
      if (pursuitMode !== "solo") {
        const err = await saveInvites(project.id, user.id, invitees.map((p) => p.id));
        if (err) setInviteError(err);
      }
    }
    setSaving(false);
    navigate(`/pursuit/${project.id}?new=1`);
  };

  const heading = (text: string, sub?: string) => (
    <>
      <h1 className="text-[1.9rem] leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
        {text}
      </h1>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </>
  );

  return (
    <div className="min-h-screen bg-surface pb-44 lg:pb-28">
      <div className="container mx-auto max-w-md px-5 pt-6">
        <div className="mb-5 flex items-center justify-between">
          <button type="button" onClick={back} aria-label="Back" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-base" style={{ fontFamily: "var(--font-serif)" }}>
            Sushii
          </span>
          <Link to="/my-space" aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </Link>
        </div>

        <StepDots steps={STEPS} current={SCREEN_STEP[screen]} />

        {screen === 0 && (
          <section>
            {heading("Create a Pursuit", "What are you trying to accomplish?")}
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), next())}
              placeholder="Write 20,000 words"
              rows={4}
              autoFocus
              className="mt-6 w-full resize-none rounded-xl border border-border bg-card p-4 text-base text-foreground outline-none focus:border-[var(--coral-deep)]"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              For example: Paint 10 paintings, Run 100 miles, Practice guitar 50 hours
            </p>
          </section>
        )}

        {screen === 1 && (
          <section>
            {heading("How should progress add up?")}
            <ul className="mt-6 space-y-2.5">
              {MEASURE_KINDS.map((m) => {
                const Icon = KIND_ICON[m.kind];
                const selected = kind === m.kind;
                return (
                  <li key={m.kind}>
                    <button
                      type="button"
                      onClick={() => pickKind(m.kind)}
                      aria-pressed={selected}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                        selected
                          ? "border-[var(--coral)] bg-[color-mix(in_srgb,var(--pastel-stone)_22%,var(--card))]"
                          : "border-border bg-card hover:border-[var(--coral-deep)]"
                      }`}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-foreground">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-foreground">{m.title}</span>
                        <span className="block text-xs text-muted-foreground">{m.copy}</span>
                      </span>
                      <span
                        className={`size-4 shrink-0 rounded-full border ${selected ? "border-[5px] border-[var(--coral)]" : "border-border"}`}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-center text-xs text-muted-foreground">You can change this later from the Pursuit.</p>
          </section>
        )}

        {screen === 2 && (
          <section>
            {heading("Define your measurement")}
            <div className="mt-6 space-y-4">
              {measure.kind === "milestones" ? (
                <div>
                  <label className="mb-1.5 block text-sm">Milestones, in order</label>
                  <div className="space-y-2">
                    {(measure.milestones ?? []).map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
                        <input
                          value={m}
                          onChange={(e) => {
                            const list = [...(measure.milestones ?? [])];
                            list[i] = e.target.value.slice(0, 60);
                            patch({ milestones: list });
                          }}
                          placeholder={["Learn three songs", "Play for friends", "First open mic"][i] ?? "Next milestone"}
                          className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-[var(--coral-deep)]"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => patch({ milestones: [...(measure.milestones ?? []), ""] })}
                    className="mt-2 text-xs text-accent hover:underline"
                  >
                    + Add a milestone
                  </button>
                </div>
              ) : (
                <>
                  <Field label="Target amount">
                    <input
                      inputMode="decimal"
                      value={measure.target ? formatAmount(measure.target) : ""}
                      onChange={(e) => patch({ target: Number(e.target.value.replace(/,/g, "")) || 0 })}
                      className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-[var(--coral-deep)]"
                    />
                  </Field>
                  <Field label="Unit name">
                    <input
                      value={measure.unit}
                      onChange={(e) => patch({ unit: e.target.value.slice(0, 30) })}
                      placeholder="words"
                      className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-[var(--coral-deep)]"
                    />
                  </Field>
                </>
              )}
              <Field label={measure.kind === "milestones" ? "What counts as reaching one?" : "What counts as one?"}>
                <input
                  value={measure.whatCounts ?? ""}
                  onChange={(e) => patch({ whatCounts: e.target.value.slice(0, 140) })}
                  placeholder={measure.kind === "quantity" ? "Any words included in the manuscript draft" : "A finished piece I'd show someone"}
                  className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-[var(--coral-deep)]"
                />
              </Field>
              <SoftPanel className="flex gap-2.5 text-xs text-foreground">
                <Lightbulb className="mt-0.5 size-4 shrink-0" />
                This helps Sushii understand how to track your progress.
              </SoftPanel>
              <SoftPanel>
                <p className="text-[11px] text-muted-foreground">Your goal</p>
                <p className="mt-0.5 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                  {measure.kind === "milestones"
                    ? `${(measure.milestones ?? []).filter((x) => x.trim()).length} milestones`
                    : targetText(measure)}
                </p>
              </SoftPanel>
            </div>
          </section>
        )}

        {screen === 3 && (
          <section>
            {heading("Set your rules", "You can change these anytime.")}
            <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
              <RuleRow label="Allow partial amounts" hint="Log 0.5 of a painting">
                <Toggle checked={measure.allowPartial} onChange={(v) => patch({ allowPartial: v })} label="Allow partial amounts" />
              </RuleRow>
              <RuleRow label="Allow decimals" hint="e.g. 1.5 hours">
                <Toggle checked={measure.allowDecimals} onChange={(v) => patch({ allowDecimals: v })} label="Allow decimals" />
              </RuleRow>
              <RuleRow label="Default amount per Moment">
                <AmountStepper
                  value={measure.defaultAmount}
                  onChange={(v) => patch({ defaultAmount: v })}
                  step={measure.kind === "quantity" ? 100 : 1}
                  unit=""
                  allowDecimals={measure.allowDecimals}
                />
              </RuleRow>
              <RuleRow label="Starting amount" hint="Anything you've already done">
                <AmountStepper
                  value={measure.startingAmount}
                  onChange={(v) => patch({ startingAmount: v })}
                  step={measure.kind === "quantity" ? 100 : 1}
                  unit=""
                  allowDecimals={measure.allowDecimals}
                />
              </RuleRow>
            </div>
            <p className="mb-2 mt-5 text-sm">Deadline</p>
            <div className="grid grid-cols-2 gap-2">
              <ChipButton active={!hasDeadline} onClick={() => setHasDeadline(false)}>
                No deadline
              </ChipButton>
              <ChipButton active={hasDeadline} onClick={() => setHasDeadline(true)}>
                <CalendarDays className="size-3.5" /> Pick a date
              </ChipButton>
            </div>
            {hasDeadline && (
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-3 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-[var(--coral-deep)]"
              />
            )}
          </section>
        )}

        {screen === 4 && (
          <section>
            {heading("Who's participating?")}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <ChipButton active={participation === "solo"} onClick={() => setParticipation("solo")}>
                <User className="size-3.5" /> Just me
              </ChipButton>
              <ChipButton active={participation === "invite"} onClick={() => setParticipation("invite")}>
                <Users className="size-3.5" /> Invite people
              </ChipButton>
            </div>

            {participation === "invite" && (
              <>
                {!user && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    <Link to="/login?redirect=/pursuits/new" className="text-accent hover:underline">
                      Log in
                    </Link>{" "}
                    to invite people.
                  </p>
                )}
                <p className="mb-2 mt-5 text-sm">How will you pursue it?</p>
                <div className="space-y-2">
                  <ModeOption
                    active={mode === "together"}
                    onClick={() => setMode("together")}
                    title="Side by side"
                    copy="Everyone has their own goal and journey."
                  />
                  <ModeOption
                    active={mode === "group"}
                    onClick={() => setMode("group")}
                    title="One shared goal"
                    copy="Everyone contributes to the same total."
                  />
                </div>

                <div className="relative mt-5">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people by name"
                    disabled={!user}
                    className="h-11 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-[var(--coral-deep)] disabled:opacity-60"
                  />
                </div>
                {query.trim().length >= 2 && (
                  <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border bg-card">
                    {(results ?? [])
                      .filter((p) => p.id !== user?.id && !invitees.some((i) => i.id === p.id))
                      .map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setInvitees((l) => [...l, p]);
                              setQuery("");
                            }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-muted"
                          >
                            <PersonAvatar name={p.displayName} src={p.avatarUrl} />
                            <span className="text-sm">{p.displayName}</span>
                            {p.username && <span className="text-xs text-muted-foreground">@{p.username}</span>}
                          </button>
                        </li>
                      ))}
                    {!searching && results.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No one found.</li>}
                  </ul>
                )}

                {invitees.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {invitees.map((p) => (
                      <li key={p.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2">
                        <PersonAvatar name={p.displayName} src={p.avatarUrl} />
                        <span className="flex-1 text-sm">{p.displayName}</span>
                        <span className="rounded-full bg-[color-mix(in_srgb,var(--pastel-stone)_30%,var(--card))] px-2 py-0.5 text-[11px]">
                          Invited
                        </span>
                        <button
                          type="button"
                          onClick={() => setInvitees((l) => l.filter((x) => x.id !== p.id))}
                          aria-label={`Remove ${p.displayName}`}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}

        {screen === 5 && (
          <section>
            {heading("Review your Pursuit")}
            <div className="mt-5 flex h-28 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--pastel-stone)_22%,var(--card))]">
              <Target className="size-10 text-[var(--coral-deep)]" strokeWidth={1.4} />
            </div>
            <h2 className="mt-5 text-xl" style={{ fontFamily: "var(--font-serif)" }}>
              {title.trim()}
            </h2>
            <ProgressBar fraction={finalMeasure.target ? finalMeasure.startingAmount / finalMeasure.target : 0} className="mt-3" />
            <p className="mt-1.5 text-sm">
              {formatAmount(finalMeasure.startingAmount)} / {targetText(finalMeasure)}
            </p>
            <p className="text-xs text-muted-foreground">{formatAmount(Math.max(0, finalMeasure.target - finalMeasure.startingAmount))} remaining</p>

            <ul className="mt-5 divide-y divide-border rounded-xl border border-border bg-card text-sm">
              <ReviewRow icon={Hash} label="Unit" value={finalMeasure.unit} />
              {finalMeasure.whatCounts && <ReviewRow icon={CheckCircle2} label="What counts" value={finalMeasure.whatCounts} />}
              <ReviewRow icon={Sigma} label="Starting amount" value={formatAmount(finalMeasure.startingAmount)} />
              <ReviewRow
                icon={CalendarDays}
                label="Deadline"
                value={
                  finalMeasure.targetDate
                    ? new Date(finalMeasure.targetDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                    : "No deadline"
                }
              />
              <ReviewRow
                icon={Users}
                label="Participating"
                value={
                  participation === "solo"
                    ? "Just you"
                    : `You + ${invitees.map((p) => p.displayName).join(", ")} · ${mode === "group" ? "one shared goal" : "side by side"}`
                }
              />
            </ul>
            {inviteError && <p className="mt-3 text-xs text-destructive">Invites didn't send: {inviteError}</p>}
          </section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-40 border-t border-border bg-surface/95 px-5 pb-3 pt-3 backdrop-blur lg:bottom-0 lg:pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <div className="mx-auto max-w-md">
          {screen < 5 ? (
            <Button variant="coral" className="h-11 w-full rounded-xl" disabled={!canContinue} onClick={next}>
              Continue <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button variant="coral" className="h-11 w-full rounded-xl" disabled={saving} onClick={begin}>
              {saving ? "Starting…" : "Begin Pursuit"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm">{label}</label>
      {children}
    </div>
  );
}

function RuleRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div>
        <p className="text-sm">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border text-sm transition-colors ${
        active
          ? "border-[var(--coral)] bg-[color-mix(in_srgb,var(--coral)_12%,var(--card))] text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ModeOption({ active, onClick, title, copy }: { active: boolean; onClick: () => void; title: string; copy: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${
        active ? "border-[var(--coral)] bg-[color-mix(in_srgb,var(--pastel-stone)_22%,var(--card))]" : "border-border bg-card"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{title}</span>
        <span className="block text-xs text-muted-foreground">{copy}</span>
      </span>
      <span className={`size-4 shrink-0 rounded-full border ${active ? "border-[5px] border-[var(--coral)]" : "border-border"}`} aria-hidden="true" />
    </button>
  );
}

function ReviewRow({ icon: Icon, label, value }: { icon: typeof Hash; label: string; value: string }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1">{value}</span>
    </li>
  );
}

export function PersonAvatar({ name, src, size = "size-7" }: { name: string; src?: string; size?: string }) {
  return (
    <Avatar className={size}>
      {src && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
