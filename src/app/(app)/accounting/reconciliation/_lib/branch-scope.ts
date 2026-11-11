import {
  branchChoiceItems,
  parseBranchChoice,
  pickableBranches,
  type BranchChoiceSource,
  type NamedBranch,
} from "@/lib/branch-choice";
import type { BranchSelectItem } from "@/lib/user-branches";
import type { ReconciliationListQuery } from "@/services/accounting.service";

/**
 * Reconciliation per account per branch (backend #283): each reconciliation
 * proves one branch's journal lines on the account, or, for head office
 * (`branches:view_all`), every line ("All branches"). The server decides what
 * each caller may pick and see; these rules only keep the screen from offering
 * a choice it would refuse.
 */

/** What the server names a reconciliation with no branch (`ReconciliationMatcher::ALL_BRANCHES`). */
export const ALL_BRANCHES_SCOPE = "All branches";

export type ReconciliationBranchChoice =
  | { kind: "pick"; items: BranchSelectItem[]; preselected: string | null }
  /** A branch user with no branch: the server refuses every start, so none is offered. */
  | { kind: "unassigned" };

/**
 * The start form's branch. Required for everyone: a branch user picks one of
 * their own (preselected when they have exactly one); view_all also gets "All
 * branches" and picks on purpose, since the old default (every line) and a
 * branch's own books prove different things.
 */
export function reconciliationBranchChoice<T extends NamedBranch>(
  source: BranchChoiceSource<T>,
): ReconciliationBranchChoice {
  const branches = pickableBranches(source);
  if (!source.viewAll && branches.length === 0) return { kind: "unassigned" };
  if (!source.viewAll) {
    return {
      kind: "pick",
      items: branchChoiceItems(branches),
      preselected: branches.length === 1 ? String(branches[0].id) : null,
    };
  }
  return { kind: "pick", items: branchChoiceItems(branches, ALL_BRANCHES_SCOPE), preselected: null };
}

/** The start body's `branch_id`, or why it can't be sent yet. */
export function startBranchId(value: string | null): { ok: true; branchId: number | null } | { ok: false } {
  const choice = parseBranchChoice(value);
  return choice.picked ? { ok: true, branchId: choice.branchId } : { ok: false };
}

/** The list filter's "no filter" option: every reconciliation the caller can see. */
export const ANY_BRANCH = "any";

/** `GET /accounting/reconciliations?branch_id=all`: the "All branches" ones, view_all only. */
const ALL_SCOPE_PARAM = "all";

/**
 * The list's branch filter. "All branches" is a reconciliation's scope, so the
 * no-filter option can't share that name: it reads "All reconciliations" for
 * view_all and "All my branches" for a branch user.
 */
export function reconciliationFilterItems(
  viewAll: boolean,
  branches: readonly NamedBranch[],
): BranchSelectItem[] {
  const any = { value: ANY_BRANCH, label: viewAll ? "All reconciliations" : "All my branches" };
  const scopeAll = viewAll ? [{ value: ALL_SCOPE_PARAM, label: ALL_BRANCHES_SCOPE }] : [];
  return [any, ...scopeAll, ...branchChoiceItems(branches)];
}

/** What a filter option sends. */
export function reconciliationFilterParams(value: string): ReconciliationListQuery {
  if (value === ALL_SCOPE_PARAM) return { branch_id: ALL_SCOPE_PARAM };
  const choice = parseBranchChoice(value);
  return choice.picked && choice.branchId !== null ? { branch_id: choice.branchId } : {};
}

/**
 * A reconciliation's branch in words: the server's `branch_name`, "All
 * branches" for one with no branch. Null from an API older than #283, which
 * sends neither field.
 */
export function branchScopeLabel(r: { branch_id?: number | null; branch_name?: string | null }): string | null {
  if (typeof r.branch_name === "string" && r.branch_name) return r.branch_name;
  if (r.branch_id === null) return ALL_BRANCHES_SCOPE;
  return null;
}
