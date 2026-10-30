import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { groupNotifications, unreadGroupCount } from "./notificationGrouping";
import { useIncomingFollowRequests } from "./useIncomingFollowRequests";

/**
 * What the bell counts: unread notification groups, requests to do something
 * together that wait on you, and follow requests. The one place this is worked
 * out, so the bell in the header and the dot on Home never disagree. Never a
 * request you sent yourself, never one from a blocked person.
 */
export function useNotificationBadge(followRefreshKey = 0) {
  const social = useSocial();
  const { user } = useAuth();
  const incomingFollows = useIncomingFollowRequests(user?.id, followRefreshKey) ?? [];
  const groups = useMemo(() => groupNotifications(social.notifications), [social.notifications]);
  const groupedUnread = unreadGroupCount(groups);
  const incoming = social.participations.filter(
    (p) =>
      p.status === "pending" &&
      (p.kind === "make_together" || p.kind === "explore_together") &&
      (user ? p.toUser === user.id : false) &&
      !social.blockedIds.includes(p.fromUser),
  );
  return { groups, groupedUnread, incoming, incomingFollows, badgeCount: groupedUnread + incoming.length + incomingFollows.length };
}
