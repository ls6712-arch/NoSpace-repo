import { supabase } from "../../lib/supabase";
import { DEFAULT_CHECK_IN_DAYS, addJoinedProject, startProject, type PursuitMember } from "./journal";
import { fetchCornersLive } from "./cornersLive";
import { eventPlace } from "./eventTicket";
import { joinTokenFrom } from "./joinToken";
import { fetchNextSession, fetchOpenPursuits, joinOpenPursuit, mirrorPursuitOpen, saveSession } from "./openPursuits";
import { endsAtFor } from "./pursuitGoal";
import { defaultMeasure } from "./pursuitProgress";
import {
  fetchInvitePreview,
  fetchPursuitAsProject,
  getOrCreateInviteLink,
  inviteUrl,
  joinViaLink,
  mirrorPursuit,
  mirrorPursuitMeasure,
} from "./pursuitsRemote";
import { rsvpToEvent } from "./spaces";
import { ERROR_LINE } from "./stateCopy";
import { eventPrices } from "./weekPlans";
import { fetchPasses, fetchTaste, fetchCornerActivity, fetchInviteCorner } from "./tasteRemote";
import type { InviteInput, LiveEventInput, LivePursuitInput, Plan, PlanInput } from "./firstPlan";
import type { Pass } from "./tasteModel";

/**
 * What the first plan reads and does. Reads are best effort: any one that
 * fails just means fewer plans (the at-home ones need none of them). The
 * three "I'm going" actions each make something real, and tell the caller if
 * they could not.
 */

export interface PlanContext {
  userId: string;
  /** Corner key to the name to show, for every Corner a pick can be. */
  names: ReadonlyMap<string, string>;
  /** Where the flow is heading: a /join/TOKEN here means a friend's plan comes first. */
  redirectTo: string;
}

export interface LoadedPlanInput extends PlanInput {
  passes: Pass[];
  /** Their city, as saved. Empty when they never gave one. */
  city: string;
  /** Their area, as saved. Empty when they never gave one. */
  area: string;
}

export async function privatePlace(userId: string): Promise<{ city: string; area: string }> {
  if (!supabase) return { city: "", area: "" };
  try {
    const { data } = await supabase.from("profile_private").select("city, area").eq("user_id", userId).maybeSingle();
    const row = data as { city?: string | null; area?: string | null } | null;
    return { city: row?.city?.trim() ?? "", area: row?.area?.trim() ?? "" };
  } catch {
    return { city: "", area: "" };
  }
}

async function friendsPlan(token: string): Promise<InviteInput | null> {
  const preview = await fetchInvitePreview(token);
  if (!preview) return null;
  const [cornerKey, session] = await Promise.all([fetchInviteCorner(token), fetchNextSession(preview.pursuitId)]);
  return {
    pursuitId: preview.pursuitId,
    token,
    title: preview.title,
    hostName: preview.ownerName,
    cornerKey: cornerKey ?? undefined,
    startsAt: session?.startsAt ?? null,
  };
}

export async function loadPlanInput(ctx: PlanContext, now = Date.now()): Promise<LoadedPlanInput> {
  const [taste, passes, place] = await Promise.all([fetchTaste(ctx.userId), fetchPasses(ctx.userId), privatePlace(ctx.userId)]);
  const picks = taste.picks.flatMap((key) => {
    const name = ctx.names.get(key);
    const [spaceSlug, slug] = key.split("/");
    return name && spaceSlug && slug ? [{ key, name, spaceSlug, slug }] : [];
  });

  const token = joinTokenFrom(ctx.redirectTo);
  const [activity, invite] = await Promise.all([place.city ? fetchCornerActivity(place.city) : Promise.resolve(new Map<string, number>()), token ? friendsPlan(token) : Promise.resolve(null)]);

  // Only Corners the server says have something near this person are looked up.
  const targets = picks.filter((p) => (activity.get(p.key) ?? 0) > 0);
  const events: LiveEventInput[] = [];
  const pursuits: LivePursuitInput[] = [];
  if (targets.length > 0) {
    const [live, groups] = await Promise.all([
      fetchCornersLive({ targets: targets.map((t) => ({ spaceSlug: t.spaceSlug, slug: t.slug })), full: false, openOnly: true }),
      Promise.all(targets.map((t) => fetchOpenPursuits(t.spaceSlug, t.slug, 3).then((list) => ({ key: t.key, list })))),
    ]);
    const found: { cornerKey: string; e: import("./cornersLive").LiveEvent; space?: import("./cornersLive").LiveSpace }[] = [];
    for (const t of targets) {
      const l = live.get(t.key);
      if (!l) continue;
      const spaces = new Map(l.spaces.filter((s) => s.access === "open").map((s) => [s.id, s]));
      for (const e of l.events) {
        const space = spaces.get(e.spaceId);
        if (space && !e.teaser) found.push({ cornerKey: t.key, e, space });
      }
    }
    const prices = await eventPrices(found.map((f) => f.e.id));
    for (const f of found) {
      events.push({
        cornerKey: f.cornerKey,
        eventId: f.e.id,
        title: f.e.title,
        startsAt: new Date(f.e.startsAt).getTime(),
        endsAt: f.e.endsAt ? new Date(f.e.endsAt).getTime() : null,
        place: eventPlace(f.e) || [f.space?.neighborhood, f.space?.city].filter(Boolean).join(", "),
        price: prices.get(f.e.id) ?? null,
        online: f.e.meets === "online",
      });
    }
    for (const g of groups) {
      for (const p of g.list) {
        if (!p.session || p.session.startsAt <= now || p.taken >= p.capacity || p.mine === "joined" || p.mine === "declined") continue;
        pursuits.push({ cornerKey: g.key, pursuitId: p.pursuitId, title: p.title, startsAt: p.session.startsAt, hostName: p.ownerName });
      }
    }
  }

  return { now, picks, windows: taste.windows, budget: taste.budget, passes, events, pursuits, invite, city: place.city, area: place.area };
}

// ── "I'm going" ───────────────────────────────────────────────────────────

export interface Owner {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl?: string;
}

/**
 * A small Pursuit of the person's own for this plan: one week, friends only,
 * with the plan's day and time as its next session, so a friend who takes the
 * other half has something real to join.
 */
export async function startSmallPursuit(plan: Plan, owner: Owner, now = Date.now()): Promise<{ pursuitId?: string; error?: string }> {
  try {
    const endsAt = endsAtFor(1, new Date(now));
    const member: PursuitMember = {
      userId: owner.id,
      username: owner.username,
      displayName: owner.displayName,
      avatarUrl: owner.avatarUrl,
      status: "joined",
      role: "owner",
    };
    const project = startProject({
      title: plan.title,
      hobbySlug: plan.corner.spaceSlug,
      subHobby: plan.corner.slug,
      measure: { ...defaultMeasure("count"), target: 1, unit: "times", targetDate: endsAt },
      mode: "together",
      members: [member],
      checkInDays: DEFAULT_CHECK_IN_DAYS,
      shared: false,
    });
    await mirrorPursuit(owner.id, project);
    await mirrorPursuitMeasure(project.id, "together", project.measure);
    await mirrorPursuitOpen(project.id, { visibility: "friends", endsAt });
    if (plan.startsAt) {
      await saveSession(project.id, owner.id, { startsAt: plan.startsAt, place: plan.where, note: plan.kind === "at-home" ? plan.step : plan.title });
    }
    return { pursuitId: project.id };
  } catch {
    return { error: ERROR_LINE };
  }
}

/**
 * "I'm going". An event: the event's own "I'm going". An open Pursuit: join it.
 * A friend's Pursuit: join through their link. An at-home plan: a small
 * Pursuit of their own. Returns the Pursuit id when one is the person's own.
 */
export async function goToPlan(plan: Plan, owner: Owner): Promise<{ ownPursuitId?: string; requested?: boolean; error?: string }> {
  if (plan.kind === "event" && plan.eventId !== undefined) {
    const { error } = await rsvpToEvent(plan.eventId);
    return error ? { error } : {};
  }
  if (plan.kind === "open-pursuit" && plan.pursuitId) {
    const r = await joinOpenPursuit(plan.pursuitId);
    if (!r.status) return { error: r.error ?? ERROR_LINE };
    if (r.status === "joined") {
      const project = await fetchPursuitAsProject(plan.pursuitId);
      if (project) addJoinedProject({ ...project, role: "member" });
    }
    return { requested: r.status === "requested" };
  }
  if (plan.kind === "invite" && plan.joinToken) {
    const r = await joinViaLink(plan.joinToken);
    if (!r.pursuitId) return { error: r.error ?? ERROR_LINE };
    const project = await fetchPursuitAsProject(r.pursuitId);
    if (project) addJoinedProject({ ...project, role: "member" });
    return {};
  }
  if (plan.kind === "at-home") {
    const r = await startSmallPursuit(plan, owner);
    return r.pursuitId ? { ownPursuitId: r.pursuitId } : { error: r.error ?? ERROR_LINE };
  }
  return { error: ERROR_LINE };
}

export interface SharedHalf {
  url: string;
  title: string;
  when: string | null;
  /** For Add to calendar. Null for a plan with no time yet. */
  startsAt: number | null;
  where?: string;
}

/**
 * The link for tearing off half. It is always to a Pursuit the person owns
 * (links can only be made by an owner): the one just made for an at-home
 * plan, else a small one made now for this plan.
 */
export async function tearOffHalf(plan: Plan, owner: Owner, ownPursuitId?: string): Promise<{ half?: SharedHalf; ownPursuitId?: string; error?: string }> {
  let pursuitId = ownPursuitId;
  if (!pursuitId) {
    const r = await startSmallPursuit(plan, owner);
    if (!r.pursuitId) return { error: r.error ?? ERROR_LINE };
    pursuitId = r.pursuitId;
  }
  const link = await getOrCreateInviteLink(pursuitId, owner.id);
  if (!link.token) return { error: link.error ?? ERROR_LINE };
  return { half: { url: inviteUrl(link.token), title: plan.title, when: plan.when, startsAt: plan.startsAt, where: plan.where }, ownPursuitId: pursuitId };
}
