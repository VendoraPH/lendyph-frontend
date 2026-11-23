import { formatDate, formatTime } from "@/lib/format";
import type { User, UserBranchHistoryEntry } from "@/types";
import { BRANCH_LOCK_REASON, PERMISSION_LOCK_REASON, type ManageLock } from "./manage-lock";

/**
 * Whether the caller can read this user's branch history, and why not.
 *
 * `GET /users/{user}/branch-history` needs `users:view` (the page's own gate)
 * and the caller's reach (UserReach::reaches), and answers a user out of reach
 * with the same 404 as a missing one, so the row has to know before the click.
 * Reach is only half of `can_manage`: a caller who sees every branch reaches
 * everyone, a super_admin's account included, and anyone reaches themselves.
 * Without every branch, a user who also works in another branch is out of
 * reach, and so is one the server marks `can_manage: false` (permissions the
 * caller lacks).
 */
export function branchHistoryLock(
  user: Pick<User, "can_manage">,
  caller: { viewAll: boolean; isSelf: boolean; branchLocked: boolean },
): ManageLock {
  if (caller.viewAll || caller.isSelf) return { locked: false, reason: null };
  if (caller.branchLocked) return { locked: true, reason: BRANCH_LOCK_REASON };
  if (user.can_manage === false) return { locked: true, reason: PERMISSION_LOCK_REASON };
  return { locked: false, reason: null };
}

/** What changed, in words: never the server's key. */
const CHANGE_LABELS: Record<string, string> = {
  primary: "Primary branch",
  branches: "Branches",
};

export interface BranchHistoryRow {
  key: number;
  change: string;
  /** The server's own sentence. */
  description: string;
  by: string;
  date: string;
  time: string;
}

/** The history's rows as the dialog shows them, in the server's order (newest first). */
export function branchHistoryRows(entries: readonly UserBranchHistoryEntry[]): BranchHistoryRow[] {
  return entries.map((entry) => ({
    key: entry.id,
    change: CHANGE_LABELS[entry.kind] ?? "Branch change",
    description: entry.description,
    by: entry.by?.trim() || "System",
    date: entry.at ? formatDate(entry.at) : "—",
    time: entry.at ? formatTime(entry.at) : "",
  }));
}
