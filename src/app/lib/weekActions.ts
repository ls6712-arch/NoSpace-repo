import { shareUrl } from "./homeActions";
import { tearOffHalf, type Owner } from "./firstPlanRemote";
import { ERROR_LINE } from "./stateCopy";
import type { Plan } from "./firstPlan";
import type { WeekPlanDetail } from "./weekView";

/**
 * "Bring someone": the link for tearing off half of a plan, then the share
 * sheet. A Pursuit the person owns is shared as it is. Anything else (an event
 * they are going to, a Pursuit they only joined) gets a small Pursuit of their
 * own for the plan, the same as the first plan does, so that needs a Corner.
 */
export const canBring = (plan: Pick<WeekPlanDetail, "mine" | "pursuitId" | "cornerKey">): boolean =>
  (!!plan.mine && !!plan.pursuitId) || !!plan.cornerKey?.includes("/");

export async function bringSomeone(plan: WeekPlanDetail, owner: Owner): Promise<{ ok: boolean; error?: string }> {
  if (!canBring(plan)) return { ok: false, error: ERROR_LINE };
  const [spaceSlug = "", slug = ""] = plan.cornerKey?.split("/") ?? [];
  const asPlan: Plan = {
    id: plan.id,
    kind: plan.kind === "event" ? "event" : "open-pursuit",
    title: plan.title,
    corner: { key: plan.cornerKey ?? "", name: slug, spaceSlug, slug },
    startsAt: plan.startsAt,
    when: null,
    where: plan.place,
    reason: "",
  };
  const r = await tearOffHalf(asPlan, owner, plan.mine ? plan.pursuitId : undefined);
  if (!r.half) return { ok: false, error: r.error ?? ERROR_LINE };
  return shareUrl(plan.title, r.half.url);
}
