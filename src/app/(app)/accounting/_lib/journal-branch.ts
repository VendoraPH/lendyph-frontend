/**
 * The journal entry form's Branch field. The server takes a `branch_id` among
 * the caller's own branches (any branch with `branches:view_all`), and a
 * caller without `view_all` who sends none gets their main branch. So only
 * `view_all` is offered "No branch", and everyone else sees the branch the
 * server will assign until they pick another.
 */
import { branchPicker, type BranchBearing } from "@/lib/user-branches";
import type { UserBranch } from "@/types";

/** "No branch" as a Select value: a Select cannot hold null. */
export const NO_BRANCH_VALUE = "none";

export interface JournalBranchField {
  items: { value: string; label: string }[];
  value: string;
}

export function journalBranchField(
  branches: readonly UserBranch[],
  caller: BranchBearing | null | undefined,
  viewAll: boolean,
  branchId: number | null,
): JournalBranchField {
  const picker = branchPicker(branches, caller, viewAll);
  const offered = picker.branches.map((b) => ({ value: String(b.id), label: b.name }));
  const items = viewAll ? [{ value: NO_BRANCH_VALUE, label: "No branch" }, ...offered] : offered;

  if (branchId !== null) return { items, value: String(branchId) };
  if (viewAll) return { items, value: NO_BRANCH_VALUE };

  // As the server's BranchAccess::defaultBranchFor(): the main branch when it
  // is one of theirs, else the first of them.
  const main = caller?.branch?.id;
  const assigned = picker.branches.find((b) => b.id === main) ?? picker.branches[0];
  return { items, value: assigned ? String(assigned.id) : NO_BRANCH_VALUE };
}

/** The `branch_id` sent for a picked value. */
export function journalBranchId(value: string): number | null {
  return value === NO_BRANCH_VALUE ? null : Number(value);
}
