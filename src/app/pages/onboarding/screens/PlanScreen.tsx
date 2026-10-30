import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { PlanTicket } from "../../../components/onboarding/PlanTicket";
import { TransferButton } from "../../../components/onboarding/TransferButton";
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

/** How long Stubby's stamp has to land before the screen moves on. */
const STAMP_BEAT_MS = 600;

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
  const reduce = useReducedMotion() ?? false;
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [city, setCity] = useState("");
  const [index, setIndex] = useState(0);
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const beat = (fn: () => void) => (reduce ? fn() : void setTimeout(fn, STAMP_BEAT_MS));

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
      react("stamped");
      beat(() => finish());
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
          <TransferButton onClick={() => finish("/discover")} onDark>
            Go to Discover
          </TransferButton>
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
        <>
          {error && (
            <p role="alert" className="transfer-label text-small">
              {error}
            </p>
          )}
          <TransferButton onClick={() => void going(true)} disabled={busy} onDark>
            Tear off half for a friend
          </TransferButton>
          <TransferButton variant="plain" onClick={() => void going(false)} disabled={busy} onDark>
            I’m going solo
          </TransferButton>
          <button type="button" className="transfer-link self-center" disabled={busy} onClick={another}>
            {last ? "Show me Discover" : "Show me something else"}
          </button>
        </>
      }
    >
      <PlanTicket plan={plan} />
    </ScreenFrame>
  );
}
