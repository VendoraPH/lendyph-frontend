/**
 * The sidebar's "new" badges: how many unread notifications point into each
 * menu section that the user has not looked at yet.
 *
 * A notification belongs to the menu entry whose href is the longest prefix of
 * its `url` (`/loans/12` → Loans; `/savings/approvals/4` → Savings, child
 * "Savings Approvals"). One the user can't open (by permission) is never
 * counted, not even under its section. It counts as viewed once the user
 * opens its own page or a page between it and the menu link its badge sits on
 * (`/loans/12` or the `/loans` list, but not the `/savings` accounts list for
 * a Savings Approvals notice): the badge drops at once and the id is
 * remembered, so leaving the page does not bring it back. Reading it in the
 * bell drops it too, since only unread rows are counted.
 *
 * No React and no DOM, so `node:test` covers it.
 */
import { safeAppPath } from "@/lib/notification-feed";

/** The part of a menu entry this needs; `NavItem` fits it. */
export interface NavTarget {
  href: string;
  children?: { href: string }[];
}

/** The part of a notification this needs; `AppNotification` fits it. */
export interface UnseenSource {
  id: string;
  url: string | null;
}

export interface UnseenCounts {
  /** New notifications per top-level menu entry, keyed by its href. */
  items: Record<string, number>;
  /** New notifications per child link, keyed by the child's href. */
  children: Record<string, number>;
}

/** The notification's page path, without query or hash; null if unusable. */
export function notificationPath(url: string | null | undefined): string | null {
  const safe = safeAppPath(url);
  if (!safe) return null;
  const path = safe.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  return path || null;
}

/** `path` is `base` or a page below it (`/loans/12` under `/loans`, not `/loansx`). */
export function isUnderPath(path: string, base: string): boolean {
  if (!base || base === "/") return false;
  return path === base || path.startsWith(`${base}/`);
}

/** The menu entry (and child link, if any) a page path belongs to. */
export function navTargetFor(
  path: string,
  items: readonly NavTarget[],
): { item: string; child: string | null } | null {
  let best: { item: string; child: string | null; length: number } | null = null;
  const consider = (base: string, item: string, child: string | null) => {
    if (!isUnderPath(path, base)) return;
    // Longest prefix wins; on a tie the child does, so it gets its own count.
    if (!best || base.length > best.length || (base.length === best.length && child && !best.child)) {
      best = { item, child, length: base.length };
    }
  };
  for (const item of items) {
    consider(item.href, item.href, null);
    for (const child of item.children ?? []) consider(child.href, item.href, child.href);
  }
  if (!best) return null;
  const { item, child } = best;
  return { item, child };
}

/**
 * The notifications the page at `pathname` shows: its own, and those below it,
 * as long as the page is (or is below) the menu link the badge sits on.
 */
export function viewedAt(rows: readonly UnseenSource[], pathname: string, items: readonly NavTarget[]): string[] {
  const here = notificationPath(pathname);
  if (!here) return [];
  return rows
    .filter((row) => {
      const path = notificationPath(row.url);
      if (path === null || !isUnderPath(path, here)) return false;
      const target = navTargetFor(path, items);
      return !target || isUnderPath(here, target.child ?? target.item);
    })
    .map((row) => row.id);
}

/** Whether the user can open a menu entry (and its child link, when there is one). */
export type NavTargetAllowed = (item: string, child: string | null) => boolean;

/**
 * The badge counts: unread rows not yet seen, and not on the page open now
 * (that page is being viewed, so its badge never flashes while it's open).
 */
export function countUnseen(
  rows: readonly UnseenSource[],
  items: readonly NavTarget[],
  seen: ReadonlySet<string>,
  pathname: string,
  allowed: NavTargetAllowed = () => true,
): UnseenCounts {
  const counts: UnseenCounts = { items: {}, children: {} };
  const viewedNow = new Set(viewedAt(rows, pathname, items));
  for (const row of rows) {
    if (seen.has(row.id) || viewedNow.has(row.id)) continue;
    const path = notificationPath(row.url);
    const target = path ? navTargetFor(path, items) : null;
    // Matched against the whole menu, then dropped if hidden: a page the user
    // can't open never falls back to its section's count.
    if (!target || !allowed(target.item, target.child)) continue;
    counts.items[target.item] = (counts.items[target.item] ?? 0) + 1;
    if (target.child) counts.children[target.child] = (counts.children[target.child] ?? 0) + 1;
  }
  return counts;
}

/** Remembered ids are capped; the oldest go first. */
export const SEEN_LIMIT = 500;

/**
 * The seen ids to keep: the old ones that are still unread, then the newly
 * viewed ones. An id that is no longer unread can't be counted again, so it's
 * dropped; dropping also means a missing `unread` list keeps everything.
 */
export function mergeSeen(
  previous: readonly string[],
  viewed: readonly string[],
  stillUnread?: ReadonlySet<string>,
): string[] {
  const kept = stillUnread ? previous.filter((id) => stillUnread.has(id)) : [...previous];
  const merged = [...new Set([...kept, ...viewed])];
  return merged.length > SEEN_LIMIT ? merged.slice(merged.length - SEEN_LIMIT) : merged;
}

/**
 * What was saved in this browser, cleaned: per user, string ids only, capped.
 * Anything else (an older shape, a hand-edited value) is dropped.
 */
export function sanitizeSeen(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const clean: Record<string, string[]> = {};
  for (const [user, ids] of Object.entries(value)) {
    if (!Array.isArray(ids)) continue;
    const kept = ids.filter((id): id is string => typeof id === "string");
    if (kept.length > 0) clean[user] = kept.slice(-SEEN_LIMIT);
  }
  return clean;
}

/** The unread rows last read for the badges: whose, at which bell count, when. */
export interface UnseenFeed {
  owner: string;
  count: number;
  at: number;
  rows: UnseenSource[];
  /** The page held every unread row (fewer than the page size). */
  complete: boolean;
}

/**
 * The unread list is read again at least this often while the bell's count
 * holds still: a notification read and a new one arriving between two counts
 * leave the count unchanged.
 */
export const UNSEEN_MAX_AGE_MS = 5 * 60_000;

/**
 * After each of the bell's unread-count reads: read the list again ("read"),
 * keep the last one ("keep"), or, with nothing unread, empty it without a
 * request ("empty"). The badges so follow the bell's schedule instead of
 * polling on their own.
 */
export function unseenFeedAction(
  last: Pick<UnseenFeed, "owner" | "count" | "at"> | null,
  owner: string,
  count: number,
  now: number,
): "read" | "keep" | "empty" {
  const same = last !== null && last.owner === owner && last.count === count;
  if (count === 0) return same ? "keep" : "empty";
  if (same && now - last.at < UNSEEN_MAX_AGE_MS) return "keep";
  return "read";
}
