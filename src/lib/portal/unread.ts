import { portalService } from "./portal-api";
import type { UnreadCount } from "./types";

/**
 * The unread count the bell and the announcements page show, kept in step
 * after the member reads something: the screen that marked it read asks the
 * server for the new count once (`/portal/notifications/unread-count`) and
 * hands it to every listener. Nothing is counted in the browser.
 */
export const PORTAL_UNREAD_EVENT = "portal:unread-changed";

export function onUnreadChanged(listener: (count: UnreadCount) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<UnreadCount>).detail);
  window.addEventListener(PORTAL_UNREAD_EVENT, handler);
  return () => window.removeEventListener(PORTAL_UNREAD_EVENT, handler);
}

/** Reads the server's count and tells the listeners; null (and no change) when it can't be read. */
export function refreshUnread(read: () => Promise<UnreadCount> = portalService.unreadCount): Promise<UnreadCount | null> {
  return read().then(
    (count) => {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(PORTAL_UNREAD_EVENT, { detail: count }));
      return count;
    },
    () => null,
  );
}
