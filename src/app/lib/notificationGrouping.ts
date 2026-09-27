import { Notification } from "../context/SocialContext";

/**
 * Phase 5: turns the bell's flat notification list into the lines it
 * actually shows — same-target repeats collapsed into one, everything
 * else left exactly as it arrived. Pure and framework-free so it's
 * directly testable (see notificationGrouping.test.ts) rather than only
 * exercisable through the rendered menu.
 *
 * Grouping is presentation only — it never changes what's muted (Part A's
 * job, at insert time) or what's in `notifications`; it only decides how
 * to lay out whatever rows already made it through.
 */

/** The specific target this notification is ABOUT, if it has one — the
 * only shape merging ever applies to. `/messages`, `/messages?tab=requests`,
 * `/my-space`, `/circles`, `/space/<slug>...` and no-href notifications are
 * all "generic": each one is its own line, always, never merged with
 * another of the same kind. Deliberately narrow (moment/pursuit only) — a
 * new per-target route later just needs a new case here, not a redesign. */
function specificTarget(href: string | undefined): { entity: "moment" | "pursuit"; id: string } | null {
  if (!href) return null;
  const m = href.match(/^\/(moment|pursuit)\/([^/?]+)$/);
  if (!m) return null;
  return { entity: m[1] as "moment" | "pursuit", id: m[2] };
}

/** Kinds that never merge even when they'd otherwise share a target and
 * kind — every one of these is a request or ask the recipient is meant to
 * act on individually, not a tally. None of them actually carry a specific
 * href today (message_request's is `/messages?tab=requests`; make_together/
 * explore_together's is the generic `/you` — real, live-inserted rows, from
 * requestTogether() in SocialContext.tsx; connect_request is the one that
 * isn't inserted by anything today — see Part A's own fact-check) — listed
 * explicitly anyway so this stays correct if any of that changes, rather
 * than relying on href shape alone. */
const NEVER_MERGE_KINDS = new Set(["connect_request", "message_request", "make_together", "explore_together"]);

function isMergeEligible(n: Notification): boolean {
  if (n.kind.startsWith("space_")) return false;
  if (NEVER_MERGE_KINDS.has(n.kind)) return false;
  return specificTarget(n.href) !== null;
}

/** The verb phrase for a multi-actor summary line — covers only the kinds
 * that can actually reach one (see isMergeEligible/specificTarget above;
 * anything else never enters a multi-member group at all). */
function verbPhrase(kind: string): string {
  switch (kind) {
    case "thought":
      return "left Thoughts on your";
    case "pursuit_joined":
      return "joined your";
    case "pursuit_progress":
      return "logged progress on your";
    default:
      return "were active on your";
  }
}

function targetNoun(entity: "moment" | "pursuit"): string {
  return entity === "moment" ? "Moment" : "Pursuit";
}

export interface NotificationGroup {
  /** The newest member's id — stable across re-renders as long as that
   * row is still present, so it works as both a React key and a "does the
   * caller already have this one open" check. */
  id: string;
  kind: string;
  href?: string;
  /** What the bell actually shows — the newest member's own body
   * unchanged for a group of one (or of several rows from the same single
   * actor); a synthesized "X and N others ..." line once more than one
   * distinct actor is folded in. */
  body: string;
  read: boolean;
  createdAt: number;
  /** Every notification id folded into this line, newest first — the
   * caller marks all of these read together when the group is opened. */
  memberIds: Array<number | string>;
}

const DEDUPE_WINDOW_MS = 5_000;
const MERGE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Drops an exact repeat: same kind, same actor, same target, arriving
 * within a few seconds of one already kept — the same "inserted twice in
 * the same millisecond" shape Part A's fact-check found for hobby_follow,
 * generalized to any kind. Input must already be newest-first. */
function dedupeExact(sorted: Notification[]): Notification[] {
  const kept: Notification[] = [];
  for (const n of sorted) {
    const dup = kept.some(
      (k) =>
        k.kind === n.kind &&
        k.href === n.href &&
        (k.actorId ?? k.actorName) === (n.actorId ?? n.actorName) &&
        Math.abs(k.createdAt - n.createdAt) <= DEDUPE_WINDOW_MS,
    );
    if (!dup) kept.push(n);
  }
  return kept;
}

function dedupeKeepOrder(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

interface Builder {
  kind: string;
  href?: string;
  read: boolean;
  createdAt: number;
  memberIds: Array<number | string>;
  /** One entry per merged member, newest first, not yet deduped. */
  actorNames: string[];
  /** The newest member's own body — used verbatim whenever the group
   * never grows past one distinct actor. */
  newestBody: string;
  /** The oldest member folded in so far — chaining, not anchoring: a run
   * of same-target notifications each ≤24h after the previous one merges
   * even if the oldest and newest are much further apart than that. */
  oldestSoFar: number;
}

function finalize(b: Builder): NotificationGroup {
  const distinctActors = dedupeKeepOrder(b.actorNames.map((n) => n || "Someone"));
  let body = b.newestBody;
  if (distinctActors.length > 1) {
    const [lead, ...rest] = distinctActors;
    const others = rest.length === 1 ? "and 1 other " : rest.length > 1 ? `and ${rest.length} others ` : "";
    const target = specificTarget(b.href);
    const noun = target ? targetNoun(target.entity) : "";
    body = `${lead} ${others}${verbPhrase(b.kind)} ${noun}.`.replace(/\s+/g, " ");
  }
  return {
    id: String(b.memberIds[0]),
    kind: b.kind,
    href: b.href,
    body,
    read: b.read,
    createdAt: b.createdAt,
    memberIds: b.memberIds,
  };
}

/**
 * Groups a flat notification list for the bell. Input order doesn't
 * matter — sorted newest-first internally, and returned newest-first.
 */
export function groupNotifications(notifications: Notification[]): NotificationGroup[] {
  const sorted = [...notifications].sort((a, b) => b.createdAt - a.createdAt);
  const deduped = dedupeExact(sorted);

  const builders: Builder[] = [];
  // kind+target -> index into `builders` of the still-open (mergeable) run
  // for that pair, so a notification more than 24h older than the OLDEST
  // member folded in so far starts a fresh group instead of joining a
  // stale one — chaining, not anchoring to the run's original newest.
  const openRun = new Map<string, number>();

  for (const n of deduped) {
    const eligible = isMergeEligible(n);
    const target = eligible ? specificTarget(n.href) : null;
    const key = target ? `${n.kind}:${target.entity}:${target.id}` : null;

    const runIdx = key ? openRun.get(key) : undefined;
    const run = runIdx !== undefined ? builders[runIdx] : undefined;
    const withinWindow = run !== undefined && n.createdAt >= run.oldestSoFar - MERGE_WINDOW_MS;

    if (run && withinWindow) {
      run.memberIds.push(n.id);
      run.actorNames.push(n.actorName ?? "");
      if (!n.read) run.read = false;
      run.oldestSoFar = n.createdAt;
      continue;
    }

    const fresh: Builder = {
      kind: n.kind,
      href: n.href,
      read: n.read,
      createdAt: n.createdAt,
      memberIds: [n.id],
      actorNames: [n.actorName ?? ""],
      newestBody: n.body,
      oldestSoFar: n.createdAt,
    };
    builders.push(fresh);
    if (key) openRun.set(key, builders.length - 1);
  }

  return builders.map(finalize);
}

/** How many groups are unread, capped the same way every other bell/badge
 * count in this app is (see formatBadgeCount in messageSync.ts) — kept as
 * a plain count here since the bell renders its own "9+" formatting. */
export function unreadGroupCount(groups: NotificationGroup[]): number {
  return groups.filter((g) => !g.read).length;
}
