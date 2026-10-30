import { useSocial } from "../../context/SocialContext";

/** What the Chats badge counts: unread chats plus message requests. The one place it is worked out, for the top bar and the rail. */
export function useChatsBadge(): number {
  const social = useSocial();
  return social.chatsUnreadCount + social.messageRequests.length;
}
