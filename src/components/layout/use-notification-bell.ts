import { useCallback, useEffect, useRef, useState } from "react";
import { notificationService, NOTIFICATION_FEED_SIZE } from "@/services/notification.service";
import { notifyError } from "@/lib/notify";
import {
  createUnreadPoller,
  markAllRead,
  markOneRead,
  type UnreadPoller,
} from "@/lib/notification-feed";
import type { AppNotification } from "@/types/notification";

export type NotificationListStatus = "idle" | "loading" | "ready" | "error";

/** Undo an optimistic mark-read on the rows it changed, and only those. */
function revertReadAt(rows: AppNotification[], ids: Set<string>, readAt: string): AppNotification[] {
  return rows.map((row) =>
    ids.has(String(row.id)) && row.read_at === readAt ? { ...row, read_at: null } : row,
  );
}

/**
 * The bell's data: the unread count, polled every 60 s and on window focus
 * while `enabled` (a user is signed in) and the tab is visible, and the latest
 * 20 notifications, read when the list opens.
 *
 * A failed count read keeps the last figure, so the header never breaks; a
 * failed list read shows the list's error state. Mark-read is optimistic: the
 * row and badge change at once, and a failed request puts the row back and
 * re-reads the count from the server.
 */
export function useNotificationBell(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null);
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<NotificationListStatus>("idle");
  const [loadedAt, setLoadedAt] = useState(0);
  const pollerRef = useRef<UnreadPoller | null>(null);
  const listSeq = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const poller = createUnreadPoller({
      load: () =>
        notificationService.unreadCount().then((n) => {
          if (!cancelled) setCount(n);
        }),
      isHidden: () => document.hidden,
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
  }, [enabled]);

  const loadList = useCallback(() => {
    if (!enabled) return;
    const seq = ++listSeq.current;
    setStatus((prev) => (prev === "ready" ? "ready" : "loading"));
    notificationService
      .list({ per_page: NOTIFICATION_FEED_SIZE })
      .then((res) => {
        if (seq !== listSeq.current) return;
        setRows(Array.isArray(res?.data) ? res.data : []);
        setLoadedAt(Date.now());
        setStatus("ready");
      })
      .catch(() => {
        if (seq !== listSeq.current) return;
        setStatus("error");
      });
    pollerRef.current?.refresh();
  }, [enabled]);

  const markRead = useCallback((id: string) => {
    const readAt = new Date().toISOString();
    const { rows: next, wasUnread } = markOneRead(rows, id, readAt);
    if (!wasUnread) return;
    setRows(next);
    setCount((c) => (c === null ? c : Math.max(0, c - 1)));
    notificationService.markRead(id).catch(() => {
      setRows((prev) => revertReadAt(prev, new Set([id]), readAt));
      pollerRef.current?.refresh();
    });
  }, [rows]);

  const markAll = useCallback(() => {
    const readAt = new Date().toISOString();
    const changed = new Set(rows.filter((row) => !row.read_at).map((row) => String(row.id)));
    setRows((prev) => markAllRead(prev, readAt));
    setCount(0);
    notificationService.markAllRead().catch((err: unknown) => {
      setRows((prev) => revertReadAt(prev, changed, readAt));
      pollerRef.current?.refresh();
      notifyError(err, "Couldn't mark notifications as read");
    });
  }, [rows]);

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
