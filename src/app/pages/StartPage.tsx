import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useSocial } from "../context/SocialContext";
import { useFeedInputs } from "../lib/useFeedInputs";
import { useHomeData } from "../lib/useHomeData";
import { fetchDiscoverMoments, type DiscoverMoment } from "../lib/discover";
import { inspirationPosts, inspiredPost } from "../lib/startInspiration";
import { startContent } from "../lib/startContent";
import { START } from "../lib/startCopy";
import { addItem, draftKey, gotLine, inviteText, listText, loadDraft, removeItem, saveDraft, toggleItem, type StartDraft } from "../lib/startList";
import { cancelStartPlan, loadStartPlan, makeStartPlan, moveStartPlan, type StartPlanRef } from "../lib/startPlan";
import { defaultPart, isOnOrAfterDay, plannedLabel, whenLong, whenShort, whenToStartsAt, type WhenChoice } from "../lib/startWhen";
import { parseClock, type DayPart } from "../lib/calendarActions";
import { dateParam, parseDateParam } from "../lib/calendarView";
import { downloadIcs } from "../lib/calendarFile";
import { weekDays } from "../lib/weekView";
import { cornerPath } from "../lib/cornerPath";
import { openPathFor } from "../lib/homeActions";
import { recordStartAction } from "../lib/startActions";
import { tearOffHalf } from "../lib/firstPlanRemote";
import { announceChange } from "../lib/undo";
import { ERROR_LINE } from "../lib/stateCopy";
import { haptic, page, PAGE_FROM, PAGE_TO, pop, sheet } from "../lib/motionTokens";
import { formatDate } from "../lib/dates";
import { HOME_TZ } from "../lib/homeWeek";
import { notify, notifyError } from "../components/ui/toaster";
import { PillButton } from "../components/ui/PillButton";
import { NeedsList } from "../components/start/NeedsList";
import { WhenSection } from "../components/start/WhenSection";
import { InspirationStrip } from "../components/start/InspirationStrip";
import { WhenFields } from "../components/calendar/CalendarSheets";
import { Skeleton } from "../components/ui/skeleton";
import type { Post } from "../data/posts";
import type { Owner } from "../lib/firstPlanRemote";

/**
 * Start (/start/:spaceSlug/:cornerSlug): what Start on a suggestion opens. It
 * answers four things in one scroll, none of them a form: what you need, how
 * to start, when, and with whom. The camera is never here. It comes at the end,
 * from the one bottom button once the person says they are doing it or done
 * ("Done? Log it"). Closing the page keeps the list and leaves nothing else.
 */
export function StartPage() {
  const { spaceSlug = "", cornerSlug = "" } = useParams();
  const content = useMemo(() => startContent(spaceSlug, cornerSlug), [spaceSlug, cornerSlug]);
  // A Corner the app does not know goes to the Corner page.
  if (!content) return <Navigate to={cornerPath(spaceSlug, cornerSlug)} replace />;
  return <StartBody key={content.key} content={content} />;
}

const LOGIN_TITLE = "Log in to keep your Moments";
const LOGIN_BODY = "Your Moments are saved to your account and are here next time you log in.";

function StartBody({ content }: { content: NonNullable<ReturnType<typeof startContent>> }) {
  const navigate = useNavigate();
  const { user, profile, loading, isConfigured } = useAuth();
  const [params, setParams] = useSearchParams();
  const now = useMemo(() => Date.now(), []);
  const planParam = params.get("plan");
  const owner: Owner | null = user
    ? { id: user.id, username: profile?.username ?? null, displayName: profile?.display_name?.trim() || "", avatarUrl: profile?.avatar_url ?? undefined }
    : null;

  // ---- the plan, when there is one ----
  const [plan, setPlan] = useState<StartPlanRef | null>(null);
  const [planLoading, setPlanLoading] = useState(!!planParam);
  const [busy, setBusy] = useState(false);
  const [justPlanned, setJustPlanned] = useState(false);
  const [changing, setChanging] = useState(false);
  const planNow = useRef(plan);
  planNow.current = plan;
  useEffect(() => {
    if (!planParam) return setPlanLoading(false);
    if (!user) return;
    // A plan just made here is already in hand.
    if (planNow.current?.pursuitId === planParam) return setPlanLoading(false);
    let live = true;
    void loadStartPlan(planParam, user.id).then((p) => {
      if (!live) return;
      setPlan(p);
      setPlanLoading(false);
    });
    return () => {
      live = false;
    };
  }, [planParam, user?.id]);

  // ---- the person's own list and dish, kept in this browser ----
  const key = draftKey(user?.id, content.key, plan?.pursuitId ?? null);
  const [draft, setDraft] = useState<StartDraft>(() => loadDraft(key, content.needs));
  const loadedKey = useRef(key);
  useEffect(() => {
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setDraft(loadDraft(key, content.needs));
  }, [key, content.needs]);
  const update = (next: StartDraft) => {
    setDraft(next);
    saveDraft(key, next);
  };

  // ---- when ----
  const [choice, setChoice] = useState<WhenChoice | null>(null);
  const [part, setPart] = useState<DayPart>(() => defaultPart(now));
  const [day, setDay] = useState(() => dateParam(weekDays(now, 2)[1].noonMs));
  const [exact, setExact] = useState("");
  const exactBad = exact !== "" && !parseClock(exact);
  const dayStartsAt = whenToStartsAt({ choice, part, dayMs: parseDateParam(day) ?? now, exact: exactBad ? "" : exact, now });
  const past = dayStartsAt != null && dayStartsAt <= now;
  const doing = choice === "now" && !plan;

  const what = draft.dish.trim() || content.name;
  const verb = content.kind === "making" ? "making" : "doing";

  // ---- others' Moments, the people row ----
  const { publicFeed } = useContent();
  const { blockedIds } = useSocial();
  const { inputs } = useFeedInputs();
  const [discover, setDiscover] = useState<DiscoverMoment[]>([]);
  useEffect(() => {
    if (!user) return;
    let live = true;
    void fetchDiscoverMoments({ corner: content.key, limit: 12 }).then((m) => live && setDiscover(m));
    return () => {
      live = false;
    };
  }, [user?.id, content.key]);
  const others = useMemo(() => inspirationPosts({ posts: publicFeed, cornerKey: content.key, inputs, discover, blockedIds }), [publicFeed, content.key, inputs, discover, blockedIds]);
  const [inspired, setInspired] = useState<Post | null>(null);
  const inspiredParam = params.get("inspired");
  useEffect(() => {
    // An unknown or unviewable id is ignored without a word.
    setInspired(inspiredPost(inspiredParam, publicFeed, blockedIds, user?.id));
  }, [inspiredParam, publicFeed, blockedIds, user?.id]);
  const clearInspired = () => {
    setInspired(null);
    const next = new URLSearchParams(params);
    next.delete("inspired");
    setParams(next, { replace: true });
  };
  const makeThisToo = (post: Post) => {
    setInspired(post);
    const next = new URLSearchParams(params);
    next.set("inspired", String(post.id));
    setParams(next, { replace: true });
  };

  const home = useHomeData(user?.id);
  const withPeople = home.items.find((i) => i.kind !== "at_home" && i.corner.key === content.key);

  // ---- actions ----
  const close = () => (window.history.length > 1 ? navigate(-1) : navigate("/my-space"));

  const logIt = () => {
    const q = new URLSearchParams({ hobby: content.spaceSlug, sub: content.cornerSlug });
    if (plan) q.set("pursuit", plan.pursuitId);
    if (draft.dish.trim()) q.set("caption", draft.dish.trim());
    if (inspired) q.set("inspired", String(inspired.id));
    q.set("ref", "start");
    navigate(`/create?${q.toString()}`);
  };

  const addToWeek = async () => {
    if (!owner || busy || dayStartsAt == null || past || exactBad) return;
    setBusy(true);
    const r = await makeStartPlan(
      { title: what, corner: { key: content.key, name: content.name, spaceSlug: content.spaceSlug, slug: content.cornerSlug }, startsAt: dayStartsAt, step: content.steps[0] },
      owner,
    );
    setBusy(false);
    if (!r.plan) {
      notifyError(r.error ?? ERROR_LINE);
      return;
    }
    const made = r.plan;
    saveDraft(draftKey(user?.id, content.key, made.pursuitId), draft);
    setPlan(made);
    setJustPlanned(true);
    window.setTimeout(() => setJustPlanned(false), 1600);
    haptic();
    recordStartAction("going", content.key);
    const next = new URLSearchParams(params);
    next.set("plan", made.pursuitId);
    setParams(next, { replace: true });
    announceChange(START.onCalendar(whenShort(made.startsAt, exact !== "")), {
      undo: () => {
        void cancelStartPlan(made).then((e) => e && notifyError(e));
        saveDraft(draftKey(user?.id, content.key, null), draft);
        setPlan(null);
        setJustPlanned(false);
        const back = new URLSearchParams(params);
        back.delete("plan");
        setParams(back, { replace: true });
      },
    });
  };

  const cancelPlan = async () => {
    if (!plan) return;
    const e = await cancelStartPlan(plan);
    if (e) return notifyError(e);
    saveDraft(draftKey(user?.id, content.key, null), draft);
    setPlan(null);
    setChoice(null);
    setChanging(false);
    const back = new URLSearchParams(params);
    back.delete("plan");
    setParams(back, { replace: true });
  };

  const changePlan = async (ms: number) => {
    if (!plan) return;
    const e = await moveStartPlan(plan, ms);
    if (e) return notifyError(e);
    setPlan({ ...plan, startsAt: ms });
    setChanging(false);
  };

  const inviteId = useRef<string | undefined>(undefined);
  const invite = async () => {
    if (!owner) return;
    const when = plan ? whenLong(plan.startsAt) : dayStartsAt != null && choice !== "now" ? whenLong(dayStartsAt, exact !== "") : null;
    const text = inviteText({ name: owner.displayName.split(" ")[0] ?? "", verb, what, when, items: draft.items, needsHeading: START.shareHeading });
    const r = await tearOffHalf(
      { id: `at_home:${content.key}`, kind: "at-home", title: what, corner: { key: content.key, name: content.name, spaceSlug: content.spaceSlug, slug: content.cornerSlug }, startsAt: plan?.startsAt ?? null, when, reason: "", step: content.steps[0] },
      owner,
      plan?.pursuitId ?? inviteId.current,
      { asPlan: true },
    );
    if (!r.half) return notifyError(r.error ?? ERROR_LINE);
    inviteId.current = r.ownPursuitId;
    await shareText(`${text}\n\n${r.half.url}`, what);
  };

  // ---- the one bottom button ----
  const planDay = plan ? isOnOrAfterDay(plan.startsAt, now) : false;
  let bottom: { label: string; onClick: () => void; disabled?: boolean; done?: boolean };
  if (plan) {
    bottom = planDay
      ? { label: START.doneLogIt, onClick: logIt }
      : { label: START.addToCalendar, onClick: () => downloadIcs({ title: plan.title, startsAt: plan.startsAt, note: content.steps[0] }), done: justPlanned };
  } else if (choice === "now") bottom = { label: START.doneLogIt, onClick: logIt };
  else if (choice) bottom = { label: START.addToWeek, onClick: () => void addToWeek(), disabled: busy || past || exactBad };
  else bottom = { label: START.startNow, onClick: () => setChoice("now") };

  // ---- signed out, loading ----
  if (isConfigured && !loading && !user) {
    return (
      <Shell onClose={close}>
        <div className="mt-10 rounded-card border border-border bg-card p-8 text-center">
          <h2 className="mb-2 text-title">{LOGIN_TITLE}</h2>
          <p className="mb-6 text-muted-foreground">{LOGIN_BODY}</p>
          <Link to={`/login?redirect=${encodeURIComponent(`/start/${content.key}`)}`} className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-body font-semibold text-accent-foreground">
            Log in
          </Link>
        </div>
      </Shell>
    );
  }
  if (loading || planLoading) {
    return (
      <Shell onClose={close}>
        <div className="mt-6 flex flex-col gap-4" aria-hidden="true">
          <Skeleton className="h-10 w-2/3 rounded-control" />
          <Skeleton className="h-6 w-1/3 rounded-control" />
          <Skeleton className="h-48 w-full rounded-card" />
        </div>
      </Shell>
    );
  }
  // A ?plan= that is gone or not the person's leaves a fresh Start page.

  return (
    <Shell
      onClose={close}
      bottom={
        <PillButton className="w-full" variant="primary" disabled={bottom.disabled} done={bottom.done} doneLabel={START.addedToWeek} onClick={bottom.onClick}>
          {bottom.label}
        </PillButton>
      }
    >
      <header className="mt-2">
        <h1 className="text-title">
          <span aria-hidden="true">{content.emoji} </span>
          {content.name}
        </h1>
        <p className="mt-1 text-small text-muted-foreground">
          {doing && <span className="font-semibold text-accent-text">{START.doingNow}</span>}
          {doing && content.meta && " · "}
          {content.meta}
        </p>
        {inspired && (
          <p className="mt-2 flex items-center gap-1 text-small text-muted-foreground">
            {START.inspiredBy(inspired.creator.split(" ")[0] || inspired.creator)}
            <button type="button" aria-label={START.clearInspired} onClick={clearInspired} className="flex size-11 items-center justify-center rounded-full">
              <X className="size-4" aria-hidden="true" />
            </button>
          </p>
        )}
      </header>

      <InspirationStrip posts={others} cornerName={content.name} onMakeThisToo={makeThisToo} />

      {withPeople && (
        <Link to={openPathFor(withPeople)} className="mt-6 flex min-h-12 items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3">
          <span className="min-w-0">
            <span className="block text-caption text-muted-foreground">{START.withPeople}</span>
            <span className="block truncate text-body font-semibold">{`${withPeople.title} · ${withPeople.detail}`}</span>
          </span>
          <span aria-hidden="true" className="text-lead text-muted-foreground">→</span>
        </Link>
      )}

      <motion.div key={plan ? "planned" : doing ? "doing" : "ready"} initial={PAGE_FROM} animate={PAGE_TO} transition={page}>
        {content.kind === "making" && (
          <section className="mt-8">
            <label htmlFor="start-dish" className="block text-lead" style={{ fontFamily: "var(--font-display)" }}>
              {START.making}
            </label>
            <input
              id="start-dish"
              value={draft.dish}
              maxLength={80}
              placeholder={START.placeholder(content.example)}
              onChange={(e) => update({ ...draft, dish: e.target.value })}
              className="mt-2 min-h-11 w-full rounded-control border border-border bg-card px-3 text-body text-foreground"
            />
          </section>
        )}

        {doing && draft.items.length > 0 ? (
          <details className="mt-8 rounded-card border border-border bg-card px-4">
            <summary className="flex min-h-12 cursor-pointer items-center text-body font-semibold">{gotLine(draft.items)}</summary>
            <div className="pb-4">
              <NeedsList className="mt-0" items={draft.items} onToggle={(id) => update(toggleItem(draft, id))} onAdd={(t) => update(addItem(draft, t))} onRemove={(id) => update(removeItem(draft, id))} onShare={() => void shareList(content.name, draft)} />
            </div>
          </details>
        ) : (
          <NeedsList items={draft.items} onToggle={(id) => update(toggleItem(draft, id))} onAdd={(t) => update(addItem(draft, t))} onRemove={(id) => update(removeItem(draft, id))} onShare={() => void shareList(content.name, draft)} />
        )}

        {content.steps.length > 0 && (
          <section aria-labelledby="start-steps" className="mt-8">
            <h2 id="start-steps" className="text-lead" style={{ fontFamily: "var(--font-display)" }}>
              {START.howToStart}
            </h2>
            <ol className="mt-2 flex flex-col gap-2">
              {content.steps.map((s, i) => (
                <li key={s} className="flex items-start gap-4 rounded-card bg-card p-4">
                  <span className="text-title font-semibold text-accent-text" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="pt-1 text-body">{s}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {plan ? (
          <section aria-labelledby="start-when" className="mt-8">
            <h2 id="start-when" className="text-lead" style={{ fontFamily: "var(--font-display)" }}>
              When
            </h2>
            <motion.p initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={pop} className="mt-2 text-body font-semibold">
              {plannedLabel(plan.startsAt)}
            </motion.p>
            <p className="text-small text-muted-foreground">{formatDate(plan.startsAt, { weekday: "short", timeZone: HOME_TZ })}</p>
            <div className="flex gap-4">
              <button type="button" onClick={() => setChanging((c) => !c)} className="inline-flex min-h-11 items-center text-small font-semibold text-accent-text underline-offset-4 hover:underline">
                {START.change}
              </button>
              <button type="button" onClick={() => void cancelPlan()} className="inline-flex min-h-11 items-center text-small font-semibold text-accent-text underline-offset-4 hover:underline">
                {START.cancelPlan}
              </button>
            </div>
            {changing && <WhenFields startMs={plan.startsAt} saveLabel="Save" onSave={(ms) => void changePlan(ms)} />}
          </section>
        ) : (
          <WhenSection choice={choice} onChoice={setChoice} part={part} onPart={setPart} day={day} onDay={setDay} exact={exact} onExact={setExact} now={now} past={past || exactBad} />
        )}

        <section aria-labelledby="start-with" className="mt-8">
          <h2 id="start-with" className="text-lead" style={{ fontFamily: "var(--font-display)" }}>
            {START.with}
          </h2>
          <button type="button" onClick={() => void invite()} className="mt-2 flex min-h-12 w-full items-center rounded-control border border-border bg-card px-4 text-left text-body font-semibold">
            {START.inviteFriend}
          </button>
        </section>
      </motion.div>
    </Shell>
  );
}

async function shareText(text: string, title: string): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") await navigator.share({ title, text });
    else {
      await navigator.clipboard.writeText(text);
      notify("Link copied");
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    notifyError(ERROR_LINE);
  }
}

function shareList(name: string, draft: StartDraft): Promise<void> {
  return shareText(listText(START.shareHeading, draft.items), name);
}

/** A full-screen sheet on a phone that rises from the bottom, a centred page from 744px. The one button sits at the bottom. */
function Shell({ children, onClose, bottom }: { children: React.ReactNode; onClose: () => void; bottom?: React.ReactNode }) {
  return (
    <motion.div initial={{ y: "8%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={sheet} className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col px-4">
        <div className="-mx-2 pt-3">
          <button type="button" aria-label={START.close} onClick={onClose} className="flex size-11 items-center justify-center rounded-full text-foreground">
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 pb-6">{children}</div>
        {bottom && <div className="sticky bottom-0 -mx-4 border-t border-border bg-background px-4 pb-[max(1rem,var(--safe-bottom))] pt-3">{bottom}</div>}
      </div>
    </motion.div>
  );
}
