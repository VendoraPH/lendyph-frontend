/**
 * The options of a list's branch filter (`components/common/branch-filter`),
 * and the `branch_id` it sends. Pure, so it runs under `tsx --test`.
 */

import type { UserBranch } from "@/types";
import {
  branchFilterItems,
  branchPicker,
  type BranchBearing,
  type BranchPicker,
  type BranchSelectItem,
} from "./user-branches";

/** "Every branch" as a Select value: a Select can't hold an empty string. */
export const ALL_BRANCHES = "all";

export interface BranchFilterOptions<T> extends BranchPicker<T> {
  /** The Select's `items`, the "every branch" option first. */
  items: BranchSelectItem[];
}

/**
 * Without `branches:view_all` the API answers 403 to a `branch_id` outside the
 * caller's own branches, so only theirs are offered, under "All my branches".
 */
export function branchFilterOptions<T extends UserBranch>(
  branches: readonly T[],
  user: BranchBearing | null | undefined,
  viewAll: boolean,
): BranchFilterOptions<T> {
  const picker = branchPicker(branches, user, viewAll);
  return { ...picker, items: branchFilterItems(branches, ALL_BRANCHES, picker.viewer) };
}

/** The `branch_id` to send: none for the "every branch" option or an unreadable value. */
export function branchIdParam(value: string): number | undefined {
  if (!/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return id > 0 ? id : undefined;
}
