import { useEffect, useMemo, useRef, useState } from "react";
import { downloadIcs } from "../../../lib/calendarFile";
import { PlanTicket } from "../../../components/onboarding/PlanTicket";
import { PillButton } from "../../../components/ui/PillButton";
import { useAuth } from "../../../context/AuthContext";
import { useCorners } from "../../../context/CornersContext";
import { CURATED_CORNERS } from "../../../data/curatedCorners";
import { headlineFor, PLANS_SHOWN_MAX, buildPlans, type Plan } from "../../../lib/firstPlan";
import { goToPlan, loadPlanInput, tearOffHalf, type Owner } from "../../../lib/firstPlanRemote";
import { saveHalf } from "../../../lib/firstPlanHandoff";
import { NEW_YORK } from "../../../lib/neighborhood";
import { ERROR_LINE } from "../../../lib/stateCopy";
import { pickKey } from "../../../lib/tasteRemote";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { ScreenFrame } from "./ScreenFrame";

/**
 * Screen 11: the first plan, as a ticket. It is found from what they answered
 * and what is live near them (lib/firstPlan.ts). "I'm going" does the real
 * thing for the kind of plan it is; "Tear off half" does that and then opens
 * the invite screen with a link. Show me something else walks the next plans,
 * and after three opens Discover.
 */
export function PlanScreen() {
  const { next, finish, react, setStubby, redirectTo } = useOnboarding();
  const { user, profile } = useAuth();
  const { allCorners } = useCorners();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [city, setCity] = useState("");
  const [index, setIndex] = useState(0);
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "I'm going solo" has been done: the ticket stays, with Add to calendar, and the way on is See my week.
  const [went, setWent] = useState(false);
  // What is already done for a plan, so a retry after a failure never does it twice.
  const done = useRef<{ planId: string; ownPursuitId?: string } | null>(null);

  const names = useMemo(() => {
    const m = new Map(allCorners.map((c) => [pickKey(c.spaceSlug, c.slug), c.name] as const));
    for (const c of CURATED_CORNERS) m.set(pickKey(c.spaceSlug, c.slug), c.name);
    return m;
  }, [allCorners]);
  const namesRef = useRef(names);
  namesRef.current = names;

  useEffect(() => {
    if (!user) return;
    let live = true;
    setStubby("thinking");
    void loadPlanInput({ userId: user.id, names: namesRef.current, redirectTo }, now)
      .then((input) => {
        if (!live) return;
        setCity(input.city);
        setPlans(buildPlans(input));
      })
      .catch(() => live && setPlans([]))
      .finally(() => {
        if (!live) return;
        react("stamped");
      });
    return () => {
      live = false;
    };
    // Found once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const owner: Owner | null = user
    ? { id: user.id, username: profile?.username ?? null, displayName: profile?.display_name?.trim() || "You", avatarUrl: profile?.avatar_url }
    : null;
  const plan = plans?.[index];

  const going = async (tear: boolean) => {
    if (!plan || !owner || busy) return;
    setBusy(true);
    setError(null);
    let own = done.current?.planId === plan.id ? done.current.ownPursuitId : undefined;
    if (done.current?.planId !== plan.id) {
      const r = await goToPlan(plan, owner);
      if (r.error) {
        setBusy(false);
        setError(r.error || ERROR_LINE);
        return;
      }
      own = r.ownPursuitId;
      done.current = { planId: plan.id, ownPursuitId: own };
    }
    if (!tear) {
      setBusy(false);
      setWent(true);
      react("stamped");
      return;
    }
    const t = await tearOffHalf(plan, owner, own);
    if (!t.half) {
      setBusy(false);
      setError(t.error ?? ERROR_LINE);
      return;
    }
    done.current = { planId: plan.id, ownPursuitId: t.ownPursuitId };
    saveHalf(owner.id, t.half);
    next({ stamp: true });
  };

  const another = () => {
    if (!plans) return;
    setError(null);
    if (index + 1 >= Math.min(PLANS_SHOWN_MAX, plans.length)) {
      finish("/discover");
      return;
    }
    setIndex(index + 1);
    react("stamped");
  };

  if (plans === null) {
    return (
      <ScreenFrame title="Finding your plan…" hero={<StepStubby size={200} />}>
        <p className="sr-only" role="status">
          Finding your plan
        </p>
      </ScreenFrame>
    );
  }

  if (!plan) {
    return (
      <ScreenFrame
        title="Nothing for this week yet."
        hero={<StepStubby size={150} />}
        intro="Have a look at Discover."
        footer={
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => finish("/discover")}>
            Go to Discover
          </PillButton>
        }
      />
    );
  }

  const outside = plan.kind === "at-home" && !!city && city.trim().toLowerCase() !== NEW_YORK.toLowerCase();
  const last = index + 1 >= Math.min(PLANS_SHOWN_MAX, plans.length);

  return (
    <ScreenFrame
      title={headlineFor(plan.startsAt, now)}
      hero={<StepStubby size={110} />}
      intro={outside ? "Soosh plans in your city are coming. For now, here’s one you can do anywhere." : undefined}
      footer={
        went ? (
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => finish("/")}>
            See my week
          </PillButton>
        ) : (
          <>
            {error && (
              <p role="alert" className="ob-label text-small">
                {error}
              </p>
            )}
            <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => void going(true)} disabled={busy}>
              Tear off half for a friend
            </PillButton>
            <PillButton data-variant="plain" className="ob-button w-full min-h-14" variant="outline" onClick={() => void going(false)} disabled={busy}>
              I’m going solo
            </PillButton>
            <button type="button" className="ob-link self-center" disabled={busy} onClick={another}>
              {last ? "Show me Discover" : "Show me something else"}
            </button>
          </>
        )
      }
    >
      <PlanTicket plan={plan}>
        {went && plan.startsAt !== null && (
          <button
            type="button"
            className="ob-link"
            onClick={() => downloadIcs({ title: plan.title, startsAt: plan.startsAt as number, where: plan.where, note: plan.step })}
          >
            Add to calendar
          </button>
        )}
      </PlanTicket>
    </ScreenFrame>
  );
}
