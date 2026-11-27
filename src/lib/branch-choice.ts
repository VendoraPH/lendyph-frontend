/**
 * A form's required branch choice: which branch a record is made in, picked
 * from the caller's branches, sometimes with a "no branch" option (an "All
 * branches" reconciliation, a head office walk-in GCash transaction). Pure, so
 * it runs under `tsx --test`; each form adds its own rules on top.
 */

import type { BranchSelectItem } from "./user-branches";

/** A Select value standing for "no branch", which the form sends as `branch_id: null`. */
export const NO_BRANCH = "none";

export interface NamedBranch {
  id: number;
  name: string;
}

export interface BranchChoiceSource<T extends NamedBranch> {
  /** `can("branches:view_all")`. */
  viewAll: boolean;
  /** The caller's assigned branches (`userBranches(user)`). */
  own: readonly T[];
  /** The loaded branch list (`useBranches()`), read only with view_all. */
  listed: readonly T[];
}

/**
 * The branches a caller may make a record in: their own, or with view_all
 * every listed branch. Their own are kept even when the list failed to load,
 * so a preselected branch always has its name.
 */
export function pickableBranches<T extends NamedBranch>({ viewAll, own, listed }: BranchChoiceSource<T>): T[] {
  if (!viewAll) return [...own];
  const listedIds = new Set(listed.map((b) => b.id));
  return [...listed, ...own.filter((b) => !listedIds.has(b.id))];
}

/** The Select's `items`: the "no branch" option first when it is offered, then each branch by name. */
export function branchChoiceItems(
  branches: readonly NamedBranch[],
  noBranchLabel?: string,
): BranchSelectItem[] {
  const items = branches.map((b) => ({ value: String(b.id), label: b.name }));
  return noBranchLabel ? [{ value: NO_BRANCH, label: noBranchLabel }, ...items] : items;
}

export type BranchChoiceValue = { picked: false } | { picked: true; branchId: number | null };

/** What a Select value means: nothing picked yet, no branch, or one branch. */
export function parseBranchChoice(value: string | null): BranchChoiceValue {
  if (value === NO_BRANCH) return { picked: true, branchId: null };
  if (value === null || !/^\d+$/.test(value)) return { picked: false };
  const id = Number(value);
  return id > 0 ? { picked: true, branchId: id } : { picked: false };
}
