import { useCallback, useEffect, useRef, useState } from "react";
import { notificationService, NOTIFICATION_FEED_SIZE } from "@/services/notification.service";
import { notifyError } from "@/lib/notify";
import { tokenManager } from "@/lib/axios-client";
import {
  FEED_LIMIT,
  SETTLE_REFRESH_DELAY_MS,
  combineFeedPages,
  createMutationGate,
  createTrailingCall,
  createUnreadPoller,
  isUnauthorizedError,
  listReplyOutcome,
  markAllRead,
  markOneRead,
  needsReadTopUp,
  revertReadAt,
  type TrailingCall,
  type UnreadPoller,
} from "@/lib/notification-feed";
import type { AppNotification } from "@/types/notification";

export type NotificationListStatus = "idle" | "loading" | "ready" | "error";

/**
 * The bell's data: the unread count, polled every 60 s and on window focus
 * while `enabled` (a user is signed in) and the tab is visible, and the latest
 * 20 notifications, read when the list opens: every unread one first
 * (`unread=1`), topped up with the latest rows when fewer than 20 are unread.
 *
 * A failed count read keeps the last figure, so the header never breaks; a
 * failed list read shows the list's error state. Mark-read is optimistic: the
 * row and badge change at once, a failed request puts the row back, and either
 * way the count is re-read once the requests settle (one refresh, 300 ms after
 * the last). A count or list read that started before or during a mark-read
 * is dropped (the mutation gate), so a stale reply can't overwrite the
 * optimistic badge or put a read row back as unread; a dropped list is read
 * again after the change settles.
 *
 * The header keys the bell on the signed-in user (`bellOwnerKey`), so signing
 * out or switching user remounts it with an empty count, list and status.
 * Once the session ends (no access token stored, or a 401 from a count or
 * list read) the poll stops while the "Session Expired" dialog shows, and the
 * remount on the next sign-in starts it again.
 */
export function useNotificationBell(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null);
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<NotificationListStatus>("idle");
  const [loadedAt, setLoadedAt] = useState(0);
  const pollerRef = useRef<UnreadPoller | null>(null);
  const listSeq = useRef(0);
  const listStale = useRef(false);
  const settledRefresh = useRef<TrailingCall | null>(null);
  const [gate] = useState(createMutationGate);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const poller = createUnreadPoller({
      load: () => {
        const token = gate.token();
        return notificationService.unreadCount().then((n) => {
          if (!cancelled && gate.accepts(token)) setCount(n);
        });
      },
      isHidden: () => document.hidden,
      hasSession: () => tokenManager.getAccessToken() !== null,
      isSessionEnded: isUnauthorizedError,
      now: () => Date.now(),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
      clearInterval: (handle) => window.clearInterval(handle as number),
    });
    pollerRef.current = poller;
    const onVisibility = () => poller.handleVisibilityChange();
    const onFocus = () => poller.handleFocus();
    poller.start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      poller.dispose();
      pollerRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, gate]);

  const loadList = useCallback(() => {
    if (!enabled) return;
    const seq = ++listSeq.current;
    if (tokenManager.getAccessToken() === null) {
      setStatus("error");
      return;
    }
    const token = gate.token();
    listStale.current = false;
    setStatus((prev) => (prev === "ready" ? "ready" : "loading"));
    notificationService
      .list({ unread: true, per_page: NOTIFICATION_FEED_SIZE })
      .then(async (unreadPage) => {
        const unreadRows = Array.isArray(unreadPage?.data) ? unreadPage.data : [];
        let latestRows: AppNotification[] = [];
        if (needsReadTopUp(unreadRows, FEED_LIMIT)) {
          latestRows = await notificationService
            .list({ per_page: NOTIFICATION_FEED_SIZE })
            .then((res) => (Array.isArray(res?.data) ? res.data : []))
            .catch(() => []);
        }
        if (seq !== listSeq.current) return;
        const outcome = listReplyOutcome(gate, token);
        if (!outcome.apply) {
          listStale.current = outcome.stale;
          // A change still on the wire schedules the reload when it settles.
          if (gate.idle()) settledRefresh.current?.schedule();
          return;
        }
        setRows(combineFeedPages(unreadRows, latestRows));
        setLoadedAt(Date.now());
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (isUnauthorizedError(err)) pollerRef.current?.halt();
        if (seq !== listSeq.current) return;
        setStatus("error");
      });
    pollerRef.current?.refresh();
  }, [enabled, gate]);

  useEffect(() => {
    const trailing = createTrailingCall(
      () => {
        pollerRef.current?.refresh();
        if (listStale.current && gate.idle()) loadList();
      },
      SETTLE_REFRESH_DELAY_MS,
      {
        setTimeout: (fn, ms) => window.setTimeout(fn, ms),
        clearTimeout: (handle) => window.clearTimeout(handle as number),
      },
    );
    settledRefresh.current = trailing;
    return () => {
      trailing.cancel();
      settledRefresh.current = null;
    };
  }, [loadList, gate]);

  const markRead = useCallback((id: string) => {
    const readAt = new Date().toISOString();
    const { rows: next, wasUnread } = markOneRead(rows, id, readAt);
    if (!wasUnread) return;
    const settle = gate.begin();
    setRows(next);
    setCount((c) => (c === null ? c : Math.max(0, c - 1)));
    notificationService
      .markRead(id)
      .catch(() => {
        setRows((prev) => revertReadAt(prev, new Set([id]), readAt));
      })
      .finally(() => {
        settle();
        settledRefresh.current?.schedule();
      });
  }, [rows, gate]);

  const markAll = useCallback(() => {
    const readAt = new Date().toISOString();
    const changed = new Set(rows.filter((row) => !row.read_at).map((row) => String(row.id)));
    const settle = gate.begin();
    setRows((prev) => markAllRead(prev, readAt));
    setCount(0);
    notificationService
      .markAllRead()
      .catch((err: unknown) => {
        setRows((prev) => revertReadAt(prev, changed, readAt));
        notifyError(err, "Couldn't mark notifications as read");
      })
      .finally(() => {
        settle();
        settledRefresh.current?.schedule();
      });
  }, [rows, gate]);

  return {
    count: enabled ? count : null,
    rows: enabled ? rows : [],
    status: enabled ? status : "idle",
    loadedAt,
    loadList,
    markRead,
    markAll,
  };
}
