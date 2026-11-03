/**
 * Pure helpers behind the header's notification bell: the unread-count poller
 * (interval, focus and tab visibility) and the mapping from the server's rows
 * to what the list shows. No React and no DOM, so `node:test` covers them.
 */
import { formatDate } from "@/lib/format";
import type { AppNotification } from "@/types/notification";

/** How often the unread count is refreshed while the tab is visible. */
export const UNREAD_POLL_MS = 60_000;

/**
 * Focus and `visibilitychange` both fire when the user comes back to the tab;
 * a second refresh inside this gap is skipped, so returning makes one read.
 */
export const UNREAD_MIN_GAP_MS = 2_000;

/** The bell lists at most this many rows. */
export const FEED_LIMIT = 20;

// ---------------------------------------------------------------------------
// Polling
// ---------------------------------------------------------------------------

export interface UnreadPollerDeps {
  /** Reads the count. A rejection is swallowed; the caller keeps its last figure. */
  load: () => Promise<unknown>;
  isHidden: () => boolean;
  now: () => number;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
  intervalMs?: number;
  minGapMs?: number;
}

export interface UnreadPoller {
  /** Reads now and every interval after, unless the tab is hidden. */
  start: () => void;
  /** Stops the interval. */
  stop: () => void;
  /** `visibilitychange`: hidden stops polling; shown reads again and resumes. */
  handleVisibilityChange: () => void;
  /** Window `focus`: reads again (once per gap) and restarts the interval. */
  handleFocus: () => void;
  /** Reads now, outside the schedule (after a mark-read failure, for example). */
  refresh: () => void;
  /** Stops for good: nothing reads after this, even a late event. */
  dispose: () => void;
}

/**
 * The unread-count schedule. The hook creates one only while a user is
 * signed in and disposes of it on sign-out, so a signed-out header makes no
 * reads; a hidden tab makes none either.
 */
export function createUnreadPoller(deps: UnreadPollerDeps): UnreadPoller {
  const intervalMs = deps.intervalMs ?? UNREAD_POLL_MS;
  const minGapMs = deps.minGapMs ?? UNREAD_MIN_GAP_MS;
  let handle: unknown = null;
  let inFlight = false;
  let lastStartedAt: number | null = null;
  let disposed = false;

  const read = (respectGap: boolean) => {
    if (disposed || inFlight || deps.isHidden()) return;
    const now = deps.now();
    if (respectGap && lastStartedAt !== null && now - lastStartedAt < minGapMs) return;
    inFlight = true;
    lastStartedAt = now;
    let pending: Promise<unknown>;
    try {
      pending = Promise.resolve(deps.load());
    } catch (err) {
      pending = Promise.reject(err);
    }
    pending
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
      });
  };

  const stop = () => {
    if (handle !== null) deps.clearInterval(handle);
    handle = null;
  };

  const schedule = () => {
    stop();
    if (disposed || deps.isHidden()) return;
    handle = deps.setInterval(() => read(false), intervalMs);
  };

  const resume = () => {
    read(true);
    schedule();
  };

  return {
    start: resume,
    stop,
    handleVisibilityChange: () => {
      if (deps.isHidden()) stop();
      else resume();
    },
    handleFocus: resume,
    refresh: () => read(false),
    dispose: () => {
      disposed = true;
      stop();
    },
  };
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

export type NotificationTone = "approval" | "success" | "danger" | "warning" | "info";

/** The colour family of a type's icon; an unknown type is plain info. */
export function notificationTone(type: string): NotificationTone {
  switch (type) {
    case "approval_needed":
    case "adjustment_pending":
      return "approval";
    case "loan_approved":
    case "loan_released":
      return "success";
    case "loan_rejected":
    case "payment_voided":
      return "danger";
    case "loan_sent_back":
    case "loan_past_due":
      return "warning";
    default:
      return "info";
  }
}

/**
 * The server's `url` when it is a path inside this app, otherwise null.
 * The bell only ever navigates within the app: an absolute or
 * protocol-relative URL (`https://…`, `//host`, `/\host`) is refused.
 */
export function safeAppPath(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const path = url.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  for (let i = 0; i < path.length; i += 1) {
    const code = path.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }
  return path;
}

function timeOf(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/**
 * "Just now", "5 minutes ago", "3 hours ago", "2 days ago", then the date
 * for anything a week or older. A time slightly in the future (clock skew)
 * reads "Just now"; an unreadable timestamp reads "".
 */
export function formatRelativeTime(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const seconds = Math.floor((nowMs - t) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
  return formatDate(iso);
}

export interface NotificationFeedItem {
  id: string;
  type: string;
  tone: NotificationTone;
  /** As the server wrote it, ₱ amounts included. */
  title: string;
  /** As the server wrote it; null when it sent none. */
  body: string | null;
  /** An in-app path to open, or null when there is nowhere safe to go. */
  href: string | null;
  unread: boolean;
  createdAt: string;
  relativeTime: string;
}

/**
 * The rows the bell lists: unread first, newest first within each group, at
 * most `limit`. Rows without an id are dropped and a repeated id is listed
 * once. Title and body pass through untouched, so a ₱ figure reads exactly as
 * the server sent it.
 */
export function buildFeed(
  rows: readonly AppNotification[] | null | undefined,
  nowMs: number,
  limit: number = FEED_LIMIT,
): NotificationFeedItem[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (!row || row.id === undefined || row.id === null || row.id === "") return false;
    const id = String(row.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const ordered = unique
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const unreadA = a.row.read_at ? 1 : 0;
      const unreadB = b.row.read_at ? 1 : 0;
      if (unreadA !== unreadB) return unreadA - unreadB;
      const byTime = timeOf(b.row.created_at) - timeOf(a.row.created_at);
      if (byTime !== 0 && !Number.isNaN(byTime)) return byTime;
      return a.index - b.index;
    });
  return ordered.slice(0, Math.max(0, limit)).map(({ row }) => ({
    id: String(row.id),
    type: row.type,
    tone: notificationTone(row.type),
    title: typeof row.title === "string" ? row.title : "",
    body: typeof row.body === "string" && row.body !== "" ? row.body : null,
    href: safeAppPath(row.url),
    unread: !row.read_at,
    createdAt: row.created_at,
    relativeTime: formatRelativeTime(row.created_at, nowMs),
  }));
}

/** The rows with one marked read (optimistically), and whether it was unread. */
export function markOneRead(
  rows: readonly AppNotification[],
  id: string,
  readAt: string,
): { rows: AppNotification[]; wasUnread: boolean } {
  let wasUnread = false;
  const next = rows.map((row) => {
    if (String(row.id) !== id || row.read_at) return row;
    wasUnread = true;
    return { ...row, read_at: readAt };
  });
  return { rows: next, wasUnread };
}

/** Every row marked read (optimistically); rows already read keep their time. */
export function markAllRead(rows: readonly AppNotification[], readAt: string): AppNotification[] {
  return rows.map((row) => (row.read_at ? row : { ...row, read_at: readAt }));
}

/** The badge text: none at zero, "9+" above nine so it fits the dot. */
export function unreadBadgeLabel(count: number | null | undefined): string | null {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return null;
  return count > 9 ? "9+" : String(Math.trunc(count));
}

/** The bell's accessible name, with the unread count when there is one. */
export function bellAccessibleName(count: number | null | undefined): string {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return "Notifications";
  const n = Math.trunc(count);
  return `Notifications, ${n} unread`;
}
