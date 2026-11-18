/**
 * The sidebar's "new" badges: how many unread notifications point into each
 * menu section that the user has not looked at yet.
 *
 * A notification belongs to the menu entry whose href is the longest prefix of
 * its `url` (`/loans/12` → Loans; `/savings/approvals/4` → Savings, child
 * "Savings Approvals"). It counts as viewed once the user opens its own page
 * or a page above it (`/loans/12` or the `/loans` list): the badge drops at
 * once and the id is remembered, so leaving the page does not bring it back.
 * Reading it in the bell drops it too, since only unread rows are counted.
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

/** The notifications the page at `pathname` shows: its own, and those below it. */
export function viewedAt(rows: readonly UnseenSource[], pathname: string): string[] {
  const here = notificationPath(pathname);
  if (!here) return [];
  return rows
    .filter((row) => {
      const path = notificationPath(row.url);
      return path !== null && isUnderPath(path, here);
    })
    .map((row) => row.id);
}

/**
 * The badge counts: unread rows not yet seen, and not on the page open now
 * (that page is being viewed, so its badge never flashes while it's open).
 */
export function countUnseen(
  rows: readonly UnseenSource[],
  items: readonly NavTarget[],
  seen: ReadonlySet<string>,
  pathname: string,
): UnseenCounts {
  const counts: UnseenCounts = { items: {}, children: {} };
  const viewedNow = new Set(viewedAt(rows, pathname));
  for (const row of rows) {
    if (seen.has(row.id) || viewedNow.has(row.id)) continue;
    const path = notificationPath(row.url);
    const target = path ? navTargetFor(path, items) : null;
    if (!target) continue;
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
