import { useEffect } from "react";
import { notificationService } from "@/services/notification.service";
import { navChildAllowed, navItemAllowed, type NavItem } from "@/constants/navigation";
import { countUnseen, unseenFeedAction, viewedAt, type UnseenCounts } from "@/lib/nav-unseen";
import { useAuthStore } from "@/store/auth-store";
import { useNavSeenStore } from "@/store/nav-seen-store";
import { useUnreadCountStore } from "@/store/unread-count-store";
import type { Permission } from "@/types";

/** The list endpoint's cap; more unread than this and the oldest aren't counted. */
const UNREAD_PAGE = 100;
const NO_IDS: string[] = [];

/** The latest list read started; an older answer arriving late is dropped. */
let readSeq = 0;
/** The read on the wire, so the desktop and mobile menus never ask twice. */
let reading: string | null = null;

const userKeyOf = (id: number | string | null | undefined) => (id != null ? String(id) : null);

/**
 * The sidebar's "new" badges: the signed-in user's unread notifications,
 * counted per menu section until the user opens the page they point to or
 * the menu link's own page above it.
 *
 * It makes no schedule of its own: after each of the bell's unread-count reads
 * (every 60 s and on focus, paused while the tab is hidden, stopped on a 401)
 * it reads the unread list only when the count moved, or every 5 minutes
 * while it holds (`unseenFeedAction`). A failed read keeps the last counts and
 * is tried again at the bell's next read, never sooner.
 *
 * `items` is the whole menu; entries the user can't open are left out here.
 * The ids viewed are remembered per user in this browser (`lendy-nav-seen`).
 */
export function useUnseenNavBadges(
  items: readonly NavItem[],
  pathname: string,
  can: (permission: Permission) => boolean,
): UnseenCounts {
  const userKey = useAuthStore((s) => userKeyOf(s.user?.id));
  const seenIds = useNavSeenStore((s) => (userKey ? s.seen[userKey] : undefined) ?? NO_IDS);
  const markSeen = useNavSeenStore((s) => s.markSeen);
  const setFeed = useNavSeenStore((s) => s.setFeed);
  const feed = useNavSeenStore((s) => s.feed);
  const count = useUnreadCountStore((s) => s.count);
  const countAt = useUnreadCountStore((s) => s.readAt);

  useEffect(() => {
    if (!userKey || count === null) return;
    const now = Date.now();
    const action = unseenFeedAction(useNavSeenStore.getState().feed, userKey, count, now);
    if (action === "keep") return;
    if (action === "empty") {
      setFeed({ owner: userKey, count: 0, at: now, rows: [], complete: true });
      return;
    }
    const key = `${userKey}:${count}:${countAt}`;
    if (reading === key) return;
    reading = key;
    const seq = ++readSeq;
    notificationService
      .list({ unread: true, per_page: UNREAD_PAGE })
      .then((page) => {
        // A newer read started, or the user signed out or changed meanwhile.
        if (seq !== readSeq || userKeyOf(useAuthStore.getState().user?.id) !== userKey) return;
        const rows = (Array.isArray(page?.data) ? page.data : []).map((row) => ({
          id: String(row.id),
          url: row.url ?? null,
        }));
        setFeed({ owner: userKey, count, at: Date.now(), rows, complete: rows.length < UNREAD_PAGE });
      })
      .catch(() => {
        // Keeps the last counts; the bell's next read tries again.
      })
      .finally(() => {
        if (reading === key) reading = null;
      });
  }, [userKey, count, countAt, setFeed]);

  // Another user's rows (after a switch, before the first read) count as none.
  const current = feed && feed.owner === userKey ? feed : null;

  // Opening a page marks what it shows as seen, so leaving it keeps the badge
  // down. Only a complete list may prune ids that are no longer unread: past
  // the first 100, an older unread id is just not in this page.
  useEffect(() => {
    if (!userKey || !current) return;
    const unread = current.complete ? new Set(current.rows.map((r) => r.id)) : undefined;
    markSeen(userKey, viewedAt(current.rows, pathname, items), unread);
  }, [userKey, current, pathname, items, markSeen]);

  // A notification for a page the user can't open (by permission; a page
  // whose flag is off isn't in the menu at all) is never counted.
  const allowed = (itemHref: string, childHref: string | null) => {
    const item = items.find((i) => i.href === itemHref);
    if (!item || !navItemAllowed(item, can)) return false;
    if (childHref === null) return true;
    const child = item.children?.find((c) => c.href === childHref);
    return child !== undefined && navChildAllowed(child, can);
  };

  return countUnseen(current?.rows ?? [], items, new Set(seenIds), pathname, allowed);
}
