/**
 * Moving a member to another branch (Phase 6, multi-branch decision 7; backend
 * MB-BE4). A move is its own action, `POST /borrowers/{id}/transfer`, with a
 * reason and an audit row; the server refuses it while the member still has
 * anything open. A plain edit can only fill in a missing branch: a changed
 * branch answers 422, an unchanged one is accepted. Pure, so it runs under
 * `tsx --test`; the server decides every refusal.
 */

import { getErrorMessage, httpStatusOf, validationErrors } from "@/lib/api-error";
import { pickableBranches } from "@/lib/branch-choice";
import type { Permission } from "@/types";

/** What these rules read of a member. */
export interface MemberBranchSource {
  branch?: { id: number; name?: string; code?: string } | null;
  branch_id?: number | null;
}

/** A branch as the branch list sends it; `status` arrives with backend MB-BE1. */
export interface TransferBranch {
  id: number;
  name: string;
  code?: string;
  is_active?: boolean;
  status?: string;
}

export const REASON_MAX = 500;

/** Edit Member's caption once the branch is set. */
export const EDIT_BRANCH_LOCKED_CAPTION =
  "To move this member to another branch, use Transfer member on the member's page.";

/** Edit Member's caption while the branch is missing. */
export const EDIT_BRANCH_FILL_CAPTION =
  "Pick the member's branch. After that, moving the member goes through Transfer member.";

/** The server's own words (TransferBorrowerRequest), so the form and a refusal read alike. */
const PICK_DESTINATION = "Choose the branch to move this member to.";
const GIVE_REASON = "Give a reason for the transfer.";
const REASON_TOO_LONG = `The reason can be at most ${REASON_MAX} characters.`;
const FAILED = "We couldn't transfer this member. Please try again.";
const BUSY = "This member is busy or was changed at the same moment. Try again in a moment.";
const OUT_OF_REACH = "This member is outside your branches now, or no longer exists, so they can't be transferred.";

/** The fixed copy `getErrorMessage` gives a 409 without readable words; BUSY replaces it. */
const GENERIC_CONFLICT = getErrorMessage({ response: { status: 409, data: {} } });

/**
 * What the transfer needs (TransferBorrowerRequest): `borrowers:transfer`, and
 * `borrowers:view` because the answer is the member's full record.
 */
const TRANSFER_PERMISSIONS: readonly Permission[] = ["borrowers:view", "borrowers:transfer"];

/** The member's branch id: the relation's, else the bare id; null when there's none. */
export function memberBranchId(member: MemberBranchSource): number | null {
  return member.branch?.id ?? member.branch_id ?? null;
}

/** Edit Member's branch picker is read-only once the member has a branch. */
export function editBranchLocked(member: MemberBranchSource): boolean {
  return memberBranchId(member) !== null;
}

/**
 * Transfer member is offered to holders of both `borrowers:view` and
 * `borrowers:transfer`, for a member who has a branch (one with none gets it
 * by editing; the server refuses a transfer then).
 */
export function canTransferMember(
  can: (permission: Permission) => boolean,
  member: MemberBranchSource,
): boolean {
  return TRANSFER_PERMISSIONS.every((permission) => can(permission)) && memberBranchId(member) !== null;
}

/** Active: `status` when the answer carries it, else `is_active`. */
function receivesMembers(branch: TransferBranch): boolean {
  if (branch.status !== undefined) return branch.status === "active";
  return branch.is_active !== false;
}

/**
 * Where the member can be moved: the branches the caller can see (their own,
 * or every listed one with `branches:view_all`), active ones only, minus the
 * member's current branch.
 */
export function transferDestinations<T extends TransferBranch>(
  listed: readonly T[],
  caller: { viewAll: boolean; own: readonly T[] },
  currentBranchId: number | null,
): T[] {
  return pickableBranches({ viewAll: caller.viewAll, own: caller.own, listed }).filter(
    (b) => b.id !== currentBranchId && receivesMembers(b),
  );
}

export type TransferRequest =
  | { ok: true; body: { branch_id: number; reason: string } }
  | { ok: false; errors: { branch_id?: string; reason?: string } };

/** The request body, or why the dialog can't send it yet. */
export function transferRequest(branchValue: string | null, reason: string): TransferRequest {
  const branchId = branchValue !== null && /^\d+$/.test(branchValue) ? Number(branchValue) : 0;
  if (branchId <= 0) return { ok: false, errors: { branch_id: PICK_DESTINATION } };
  const trimmed = reason.trim();
  if (trimmed === "") return { ok: false, errors: { reason: GIVE_REASON } };
  if (trimmed.length > REASON_MAX) return { ok: false, errors: { reason: REASON_TOO_LONG } };
  return { ok: true, body: { branch_id: branchId, reason: trimmed } };
}

/** What the dialog shows after a refused or failed transfer. */
export interface TransferFailure {
  /** A refusal of the reason: shown under the reason. */
  reason: string | null;
  /** Anything else: above the buttons, in the server's words or ours. */
  general: string | null;
  /** 409: nothing was saved, so the same transfer can be sent again. */
  retry: boolean;
  /** 404: the member is outside the caller's branches now, so sending again can't help. */
  outOfReach: boolean;
}

/**
 * Where a refused transfer is shown, by the server's answer:
 * - 422: a refusal of the reason under the reason; anything else (what the
 *   member still has open, a hidden, suspended or closed destination, the
 *   member's own branch) above the buttons, in the server's words.
 * - 409: the member was busy (another write held their branch lock) or
 *   changed at the same moment, and nothing was saved: the server's words,
 *   with a way to try again.
 * - 404: the member is outside the caller's branches now, or gone. The
 *   framework's text never shows.
 * - Anything else (a missing permission, a failure): its words.
 */
export function transferFailure(err: unknown): TransferFailure {
  const status = httpStatusOf(err);
  if (status === 409) {
    const words = getErrorMessage(err, BUSY);
    return { reason: null, general: words === GENERIC_CONFLICT ? BUSY : words, retry: true, outOfReach: false };
  }
  if (status === 404) return { reason: null, general: OUT_OF_REACH, retry: false, outOfReach: true };

  const errors = validationErrors(err);
  const reason = errors?.reason?.[0] ?? null;
  const other = errors
    ? Object.entries(errors)
        .filter(([key]) => key !== "reason")
        .flatMap(([, messages]) => messages)[0]
    : undefined;
  if (reason !== null && other === undefined) return { reason, general: null, retry: false, outOfReach: false };
  return { reason, general: other ?? getErrorMessage(err, FAILED), retry: false, outOfReach: false };
}
