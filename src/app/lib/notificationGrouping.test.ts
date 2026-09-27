import { describe, expect, it } from "vitest";
import { groupNotifications, unreadGroupCount } from "./notificationGrouping";
import { Notification } from "../context/SocialContext";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let nextId = 1;
function notif(overrides: Partial<Notification> & Pick<Notification, "kind" | "createdAt">): Notification {
  return {
    id: nextId++,
    body: "default body",
    read: false,
    actorName: "Someone",
    ...overrides,
  };
}

describe("groupNotifications: same target merges", () => {
  it("merges multiple Thoughts on the same Moment into one group", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/42", actorName: "Nani", createdAt: now, body: "Nani left a thought on your moment." }),
      notif({ kind: "thought", href: "/moment/42", actorName: "Reo", createdAt: now - HOUR, body: "Reo left a thought on your moment." }),
      notif({ kind: "thought", href: "/moment/42", actorName: "Kai", createdAt: now - 2 * HOUR, body: "Kai left a thought on your moment." }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(1);
    expect(groups[0].memberIds).toHaveLength(3);
    expect(groups[0].body).toBe("Nani and 2 others left Thoughts on your Moment.");
  });

  it("uses singular 'and 1 other' for exactly two distinct actors", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/9", actorName: "Nani", createdAt: now }),
      notif({ kind: "thought", href: "/moment/9", actorName: "Reo", createdAt: now - HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups[0].body).toBe("Nani and 1 other left Thoughts on your Moment.");
  });

  it("keeps the newest member's own body when only one distinct actor repeats", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/9", actorName: "Nani", createdAt: now, body: "Nani left a thought on your moment (2nd)." }),
      notif({ kind: "thought", href: "/moment/9", actorName: "Nani", createdAt: now - HOUR, body: "Nani left a thought on your moment (1st)." }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(1);
    expect(groups[0].memberIds).toHaveLength(2);
    expect(groups[0].body).toBe("Nani left a thought on your moment (2nd).");
  });
});

describe("groupNotifications: different Moments never merge", () => {
  it("keeps Thoughts on two different Moments as separate groups", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/1", actorName: "Nani", createdAt: now }),
      notif({ kind: "thought", href: "/moment/2", actorName: "Nani", createdAt: now - HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
  });

  it("keeps a Moment and a Pursuit target separate even with the same numeric id", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/7", createdAt: now }),
      notif({ kind: "pursuit_joined", href: "/pursuit/7", createdAt: now - HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
  });

  it("never merges across different kinds even on the same target", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "pursuit_joined", href: "/pursuit/7", createdAt: now }),
      notif({ kind: "pursuit_progress", href: "/pursuit/7", createdAt: now - HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
  });
});

describe("groupNotifications: generic hrefs never merge", () => {
  it("keeps every hobby_follow-style /my-space notification as its own line", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "joined", href: "/my-space", actorName: "Nani", createdAt: now }),
      notif({ kind: "joined", href: "/my-space", actorName: "Reo", createdAt: now - HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
  });

  it("keeps notifications with no href at all as separate lines", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "accepted", href: undefined, createdAt: now }),
      notif({ kind: "accepted", href: undefined, createdAt: now - HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
  });

  it("never merges on a query-string href like message_request's", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "message_request", href: "/messages?tab=requests", createdAt: now }),
      notif({ kind: "message_request", href: "/messages?tab=requests", createdAt: now - HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
  });
});

describe("groupNotifications: actionable requests never merge", () => {
  it("keeps message_request notifications separate even on an identical href", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "message_request", href: "/moment/1", createdAt: now }), // contrived href to isolate the kind guard
      notif({ kind: "message_request", href: "/moment/1", createdAt: now - HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
  });

  it("keeps connect_request notifications separate the same way", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "connect_request", href: "/moment/1", createdAt: now }),
      notif({ kind: "connect_request", href: "/moment/1", createdAt: now - HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
  });
});

describe("groupNotifications: space_* kinds never merge", () => {
  it("keeps space_join_approved notifications on the same Space separate", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "space_join_approved", href: "/space/pottery", createdAt: now }),
      notif({ kind: "space_join_approved", href: "/space/pottery", createdAt: now - HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
  });
});

describe("groupNotifications: 24-hour window", () => {
  it("merges two Thoughts on the same Moment within 24 hours", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/5", actorName: "Nani", createdAt: now }),
      notif({ kind: "thought", href: "/moment/5", actorName: "Reo", createdAt: now - (24 * HOUR - 1000) }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(1);
  });

  it("starts a new group once the gap exceeds 24 hours", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/5", actorName: "Nani", createdAt: now }),
      notif({ kind: "thought", href: "/moment/5", actorName: "Reo", createdAt: now - (DAY + HOUR) }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
  });

  it("chains a run rather than anchoring only to the very first member", () => {
    // Three Thoughts, each 20h after the previous (60h span total) — no
    // single pair is >24h apart, so they all chain into one group even
    // though the oldest and newest are 60h apart.
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/5", actorName: "A", createdAt: now }),
      notif({ kind: "thought", href: "/moment/5", actorName: "B", createdAt: now - 20 * HOUR }),
      notif({ kind: "thought", href: "/moment/5", actorName: "C", createdAt: now - 40 * HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(1);
    expect(groups[0].memberIds).toHaveLength(3);
  });
});

describe("groupNotifications: exact duplicate removal", () => {
  it("drops an exact repeat (same kind, actor, target) inserted a moment later", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "hobby_follow", href: "/my-space", actorName: "Me", actorId: "u1", createdAt: now }),
      notif({ kind: "hobby_follow", href: "/my-space", actorName: "Me", actorId: "u1", createdAt: now + 200 }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(1);
    expect(groups[0].memberIds).toHaveLength(1);
  });

  it("does not treat two different actors on the same target within a few seconds as duplicates", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/1", actorName: "Nani", actorId: "u1", createdAt: now }),
      notif({ kind: "thought", href: "/moment/1", actorName: "Reo", actorId: "u2", createdAt: now + 200 }),
    ];
    const groups = groupNotifications(list);
    // Merged into one GROUP (same target, same kind, well within 24h) —
    // but both members survive dedup since they're different actors.
    expect(groups).toHaveLength(1);
    expect(groups[0].memberIds).toHaveLength(2);
  });

  it("does not dedupe the same actor's two genuinely separate events (seconds apart is fine; minutes apart is not a duplicate)", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/1", actorName: "Nani", actorId: "u1", createdAt: now }),
      notif({ kind: "thought", href: "/moment/1", actorName: "Nani", actorId: "u1", createdAt: now - 60_000 }),
    ];
    const groups = groupNotifications(list);
    expect(groups[0].memberIds).toHaveLength(2);
  });
});

describe("groupNotifications: unread-if-any-unread", () => {
  it("marks a group unread if any member is unread, even the oldest one", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/1", createdAt: now, read: true }),
      notif({ kind: "thought", href: "/moment/1", createdAt: now - HOUR, read: false }),
    ];
    const groups = groupNotifications(list);
    expect(groups[0].read).toBe(false);
  });

  it("marks a group read only when every member is read", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/1", createdAt: now, read: true }),
      notif({ kind: "thought", href: "/moment/1", createdAt: now - HOUR, read: true }),
    ];
    const groups = groupNotifications(list);
    expect(groups[0].read).toBe(true);
  });
});

describe("groupNotifications: ordering", () => {
  it("returns groups newest-first, and shows the newest actor first in a merged line", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/1", actorName: "Old", createdAt: now - HOUR }),
      notif({ kind: "thought", href: "/moment/1", actorName: "New", createdAt: now }),
      notif({ kind: "accepted", href: undefined, createdAt: now - 2 * HOUR }),
    ];
    const groups = groupNotifications(list);
    expect(groups[0].kind).toBe("thought");
    expect(groups[0].body).toBe("New and 1 other left Thoughts on your Moment.");
    expect(groups[0].createdAt).toBe(now);
    expect(groups[1].kind).toBe("accepted");
  });
});

describe("unreadGroupCount", () => {
  it("counts only unread groups, not unread rows", () => {
    const now = Date.now();
    const list = [
      notif({ kind: "thought", href: "/moment/1", createdAt: now, read: false }),
      notif({ kind: "thought", href: "/moment/1", createdAt: now - HOUR, read: false }),
      notif({ kind: "accepted", href: undefined, createdAt: now, read: true }),
    ];
    const groups = groupNotifications(list);
    expect(groups).toHaveLength(2);
    expect(unreadGroupCount(groups)).toBe(1);
  });
});
