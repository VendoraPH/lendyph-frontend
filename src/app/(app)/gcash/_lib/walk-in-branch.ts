import {
  branchChoiceItems,
  parseBranchChoice,
  pickableBranches,
  type BranchChoiceSource,
  type NamedBranch,
} from "@/lib/branch-choice";
import type { BranchSelectItem } from "@/lib/user-branches";
import type { GCashParty } from "@/types";

/**
 * Where a walk-in Cash In or Cash Out is done, so its journal posts in that
 * branch (`StoreGCashTransactionRequest`, backend #283). The server resolves
 * and checks the branch; these rules only decide what the form offers and
 * which `branch_id` it sends. A member's transaction follows the member's
 * branch and sends none.
 */

/** The view_all option that sends `branch_id: null`. */
export const HEAD_OFFICE_LABEL = "None (head office)";

/** The server's own words for a missing pick, so the form and a 422 read alike. */
export const PICK_BRANCH = "Pick the branch where this walk-in transaction is done.";

export const NO_BRANCH_EXPLANATION =
  "You have no branch assigned, so you can't record a walk-in transaction. Ask an administrator to assign you a branch.";

export type WalkInBranchChoice =
  /** A member's transaction: no picker, no key. */
  | { kind: "member" }
  /** No branch and no view_all: the server refuses it (422); the form says why. */
  | { kind: "unassigned" }
  /** Exactly one branch and no view_all: the server uses it; the form names it. */
  | { kind: "fixed"; branch: NamedBranch }
  | { kind: "pick"; items: BranchSelectItem[]; preselected: string | null };

export function walkInBranchChoice<T extends NamedBranch>(
  partyKind: GCashParty["kind"],
  source: BranchChoiceSource<T>,
): WalkInBranchChoice {
  if (partyKind === "member") return { kind: "member" };
  const branches = pickableBranches(source);

  if (!source.viewAll) {
    if (branches.length === 0) return { kind: "unassigned" };
    if (branches.length === 1) return { kind: "fixed", branch: branches[0] };
    return { kind: "pick", items: branchChoiceItems(branches), preselected: null };
  }

  // view_all: any branch, or head office. Their only assigned branch is
  // preselected; with none or several, nothing is, so it is picked on purpose.
  return {
    kind: "pick",
    items: branchChoiceItems(branches, HEAD_OFFICE_LABEL),
    preselected: source.own.length === 1 ? String(source.own[0].id) : null,
  };
}

export type WalkInBranchBody = Record<string, never> | { branch_id: number | null };

/** The `branch_id` part of the create body, or why the form can't send it yet. */
export function walkInBranchPayload(
  choice: WalkInBranchChoice,
  value: string | null,
): { ok: true; body: WalkInBranchBody } | { ok: false; message: string } {
  if (choice.kind !== "pick") return { ok: true, body: {} };
  const picked = parseBranchChoice(value);
  if (!picked.picked) return { ok: false, message: PICK_BRANCH };
  return { ok: true, body: { branch_id: picked.branchId } };
}

/**
 * A GCash row's branch in words. A walk-in row may be another branch's (they
 * stay visible to every branch), which the caller's list doesn't name. Null
 * when the row has none (a member's, head office, or one recorded before #283).
 */
export function gcashBranchLabel(
  branchId: number | null | undefined,
  branches: readonly NamedBranch[],
): string | null {
  if (branchId === null || branchId === undefined) return null;
  return branches.find((b) => b.id === branchId)?.name ?? "Another branch";
}

/** The server's 422 on `branch_id`, in its words; null for any other failure. */
export function branchRefusal(err: unknown): string | null {
  const response = (err as { response?: { status?: number; data?: { errors?: { branch_id?: unknown } } } })
    ?.response;
  if (response?.status !== 422) return null;
  const messages = response.data?.errors?.branch_id;
  const first = Array.isArray(messages) ? messages[0] : undefined;
  return typeof first === "string" && first ? first : null;
}
