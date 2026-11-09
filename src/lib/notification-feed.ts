/**
 * Pure helpers behind the header's notification bell: the mapping from the
 * server's rows to what the list shows, and the gate that keeps stale reads
 * off it. The unread-count poller lives in `session-poller.ts`. No React and
 * no DOM, so `node:test` covers them.
 */
import { formatDate } from "@/lib/format";
import type { AppNotification } from "@/types/notification";

/** The bell lists at most this many rows. */
export const FEED_LIMIT = 20;

// ---------------------------------------------------------------------------
// Optimistic changes vs. reads already on the wire
// ---------------------------------------------------------------------------

export interface MutationGate {
  /** Starts an optimistic change; call the returned function once it settles. */
  begin: () => () => void;
  /** The sequence a read records when it starts. */
  token: () => number;
  /**
   * Whether a read that started at `token` may be shown: no change has started
   * or settled since, and none is still on the wire. Otherwise its answer may
   * predate the change (a badge that jumps back up after "Mark all as read").
   */
  accepts: (token: number) => boolean;
  /** No change is on the wire. */
  idle: () => boolean;
}

export function createMutationGate(): MutationGate {
  let seq = 0;
  let pending = 0;
  return {
    begin: () => {
      seq += 1;
      pending += 1;
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        seq += 1;
        pending -= 1;
      };
    },
    token: () => seq,
    accepts: (token) => pending === 0 && token === seq,
    idle: () => pending === 0,
  };
}

/**
 * What to do with a list reply whose read started at `token`. A reply the
 * gate refuses may predate a mark-read and would put a read row back as
 * unread, so the current rows are kept and the list is marked stale, to be
 * read again once the change settles (and on the next open).
 */
export function listReplyOutcome(gate: MutationGate, token: number): { apply: boolean; stale: boolean } {
  return gate.accepts(token) ? { apply: true, stale: false } : { apply: false, stale: true };
}

/** Rapid mark-reads settle into one refresh this long after the last one. */
export const SETTLE_REFRESH_DELAY_MS = 300;

export interface TrailingCall {
  /** (Re)starts the delay; `fn` runs once, `delayMs` after the last call. */
  schedule: () => void;
  cancel: () => void;
}

export function createTrailingCall(
  fn: () => void,
  delayMs: number,
  timers: { setTimeout: (fn: () => void, ms: number) => unknown; clearTimeout: (handle: unknown) => void },
): TrailingCall {
  let handle: unknown = null;
  const cancel = () => {
    if (handle !== null) timers.clearTimeout(handle);
    handle = null;
  };
  return {
    schedule: () => {
      cancel();
      handle = timers.setTimeout(() => {
        handle = null;
        fn();
      }, delayMs);
    },
    cancel,
  };
}

/** Undo an optimistic mark-read on the rows it changed (`ids`, stamped `readAt`), and only those. */
export function revertReadAt(
  rows: readonly AppNotification[],
  ids: ReadonlySet<string>,
  readAt: string,
): AppNotification[] {
  return rows.map((row) =>
    ids.has(String(row.id)) && row.read_at === readAt ? { ...row, read_at: null } : row,
  );
}

// ---------------------------------------------------------------------------
// Who the bell belongs to
// ---------------------------------------------------------------------------

/**
 * The bell's identity: the signed-in user's id, or "signed-out". The header
 * keys the bell on it, so signing out or switching user starts from an empty
 * count, list and status instead of showing the previous user's.
 */
export function bellOwnerKey(user: { id: number | string } | null | undefined): string {
  if (!user || user.id === undefined || user.id === null || user.id === "") return "signed-out";
  return `user:${String(user.id)}`;
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

/**
 * Whether the unread page leaves room for read rows. The bell reads the
 * unread page first, so an older unread notification never falls off the
 * list behind newer read ones, and tops it up with the latest rows only when
 * fewer than `limit` are unread.
 */
export function needsReadTopUp(
  unreadRows: readonly AppNotification[] | null | undefined,
  limit: number = FEED_LIMIT,
): boolean {
  return !Array.isArray(unreadRows) || unreadRows.length < limit;
}

/** The unread page followed by the top-up page; `buildFeed` orders, dedupes and caps it. */
export function combineFeedPages(
  unreadRows: readonly AppNotification[] | null | undefined,
  latestRows: readonly AppNotification[] | null | undefined,
): AppNotification[] {
  return [
    ...(Array.isArray(unreadRows) ? unreadRows : []),
    ...(Array.isArray(latestRows) ? latestRows : []),
  ];
}

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
    case "reminder_failed":
      return "danger";
    case "loan_sent_back":
    case "loan_past_due":
    case "reminder_contact_invalid":
    case "reminder_follow_up":
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
