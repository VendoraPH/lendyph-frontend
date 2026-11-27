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

/** What a branch picker reads while the branch list loads. */
export const LOADING_BRANCHES = "Loading branches…";

/**
 * What a branch filter's trigger shows for `value`: the value when its items
 * name it; otherwise nothing picked, with "Loading branches…" while the list
 * loads (a preset working branch the list hasn't brought yet), else "Select a
 * branch". Never the raw id.
 */
export function shownBranchValue(
  value: string,
  items: readonly BranchSelectItem[],
  loading: boolean,
): { value: string | null; placeholder: string | undefined } {
  if (items.some((i) => i.value === value)) return { value, placeholder: undefined };
  return { value: null, placeholder: loading ? LOADING_BRANCHES : "Select a branch" };
}

/**
 * The Branch filter's label: shown above the field, or kept for screen readers
 * only when the filter sits in a row of unlabelled filters (the Audit Trail's),
 * so the row stays on one line.
 */
export function branchFilterLabelClass(hidden: boolean): string {
  return hidden ? "sr-only" : "text-xs text-muted-foreground";
}
