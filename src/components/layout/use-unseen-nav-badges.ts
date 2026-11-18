import { useEffect, useMemo, useState } from "react";
import { notificationService } from "@/services/notification.service";
import { tokenManager } from "@/lib/axios-client";
import { countUnseen, viewedAt, type NavTarget, type UnseenCounts } from "@/lib/nav-unseen";
import { createUnreadPoller, isUnauthorizedError } from "@/lib/session-poller";
import { useAuthStore } from "@/store/auth-store";
import { useNavSeenStore } from "@/store/nav-seen-store";
import type { AppNotification } from "@/types/notification";

/** The list endpoint's cap; more unread than this and the oldest aren't counted. */
const UNREAD_PAGE = 100;
const NO_IDS: string[] = [];
const NO_ROWS: AppNotification[] = [];

/**
 * The sidebar's "new" badges: the signed-in user's unread notifications,
 * read every 60 s and on window focus (the bell's schedule), counted per menu
 * section until the user opens the page they point to or a list above it.
 * The ids viewed are remembered per user in this browser (`lendy-nav-seen`).
 * A failed read keeps the last counts; a 401 stops the reads.
 */
export function useUnseenNavBadges(items: readonly NavTarget[], pathname: string): UnseenCounts {
  const userKey = useAuthStore((s) => (s.user?.id != null ? String(s.user.id) : null));
  const seenIds = useNavSeenStore((s) => (userKey ? s.seen[userKey] : undefined) ?? NO_IDS);
  const markSeen = useNavSeenStore((s) => s.markSeen);
  const [result, setResult] = useState<{ owner: string; rows: AppNotification[]; complete: boolean } | null>(null);

  useEffect(() => {
    if (!userKey) return;
    let cancelled = false;
    const poller = createUnreadPoller({
      load: () =>
        notificationService.list({ unread: true, per_page: UNREAD_PAGE }).then((page) => {
          if (cancelled) return;
          const rows = Array.isArray(page?.data) ? page.data : [];
          setResult({ owner: userKey, rows, complete: rows.length < UNREAD_PAGE });
        }),
      isHidden: () => document.hidden,
      hasSession: () => tokenManager.getAccessToken() !== null,
      isSessionEnded: isUnauthorizedError,
      now: () => Date.now(),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
      clearInterval: (handle) => window.clearInterval(handle as number),
    });
    const onVisibility = () => poller.handleVisibilityChange();
    const onFocus = () => poller.handleFocus();
    poller.start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      poller.dispose();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [userKey]);

  // Another user's rows (after a switch, before the first read) count as none.
  const current = result && result.owner === userKey ? result : null;
  const rows = current?.rows ?? NO_ROWS;

  // Opening a page marks what it shows as seen, so leaving it keeps the badge
  // down. Only a complete list may prune ids that are no longer unread: past
  // the first 100, an older unread id is just not in this page.
  useEffect(() => {
    if (!userKey || !current) return;
    const unread = current.complete ? new Set(current.rows.map((r) => r.id)) : undefined;
    markSeen(userKey, viewedAt(current.rows, pathname), unread);
  }, [userKey, current, pathname, markSeen]);

  return useMemo(
    () => countUnseen(rows, items, new Set(seenIds), pathname),
    [rows, items, seenIds, pathname],
  );
}
