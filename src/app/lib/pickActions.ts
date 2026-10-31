import { supabase } from "../../lib/supabase";
import { friendlyError } from "./friendlyError";
import { listingWhen, type Plan } from "./firstPlan";
import { goToPlan, type Owner } from "./firstPlanRemote";
import { cancelRsvp } from "./spaces";
import { ERROR_LINE } from "./stateCopy";
import type { StubbyPick } from "./stubbyPicks";


/**
 * Keep: the pick becomes a plan, by the same "I'm going" the first plan uses
 * (an event's own RSVP, or joining the open Pursuit). Nothing is sent about the
 * pick itself; only the RSVP or the join, which is the plan.
 */
export async function keepPick(pick: StubbyPick, owner: Owner): Promise<{ error?: string; requested?: boolean }> {
  const plan: Plan = {
    id: pick.id,
    kind: pick.kind,
    title: pick.title,
    corner: pick.corner,
    startsAt: pick.startsAt,
    when: listingWhen(pick.startsAt),
    where: pick.where,
    reason: pick.reason,
    eventId: pick.eventId,
    pursuitId: pick.pursuitId,
  };
  const r = await goToPlan(plan, owner);
  return r.error ? { error: r.error } : { requested: r.requested };
}

/** Takes a Keep back: leaves the event, or the Pursuit (or the request to join it). */
export async function undoKeep(pick: StubbyPick, userId: string): Promise<string | null> {
  if (pick.kind === "event" && pick.eventId !== undefined) {
    const r = await cancelRsvp(pick.eventId);
    return r.error;
  }
  if (!supabase || !pick.pursuitId) return ERROR_LINE;
  try {
    const { error } = await supabase.from("pursuit_members").delete().eq("pursuit_id", pick.pursuitId).eq("user_id", userId);
    return error ? friendlyError(error) : null;
  } catch (e) {
    return friendlyError(e);
  }
}
