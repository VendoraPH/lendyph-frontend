import type { Permission } from "@/types";

/**
 * Who sees what of AMLA screening and the orders register, decided as
 * lendyph-backend's AMLA-B5 endpoints decide it: each needs its key and every
 * branch, under the /amla guard's `amla:view`. The server still decides every
 * step; a refusal shows its words.
 */

type Can = (permission: Permission) => boolean;

export const AMLA_SCREENING_PERMISSION: Permission = "amla:screening";
export const AMLA_SANCTIONS_PERMISSION: Permission = "amla:sanctions";

export interface AmlaScreeningAccess {
  /** Watchlists, rescreens and match review. */
  screening: boolean;
  /** The orders register: record, read, and the release steps. */
  orders: boolean;
  /** Picking the member an order names searches members (`borrowers:view`). */
  pickMember: boolean;
  /** Picking the accounts an order holds lists the member's savings accounts (`savings:view`). */
  pickAccounts: boolean;
}

export function amlaScreeningAccess(can: Can): AmlaScreeningAccess {
  const headOffice = can("amla:view") && can("branches:view_all");
  const orders = headOffice && can(AMLA_SANCTIONS_PERMISSION);
  return {
    screening: headOffice && can(AMLA_SCREENING_PERMISSION),
    orders,
    pickMember: orders && can("borrowers:view"),
    pickAccounts: orders && can("savings:view"),
  };
}

export interface AmlaReleaseActions {
  request: boolean;
  approve: boolean;
  reject: boolean;
  withdraw: boolean;
}

/**
 * The release steps an order offers this user. Four eyes: the person who asked
 * for a release only withdraws it, and a different `amla:sanctions` holder
 * approves or rejects it. A 403 or 409 from the server still wins.
 */
export function amlaReleaseActions(
  order: { status: string; pending_release: { requested_by: { id: number } | null } | null },
  userId: number | null,
  can: Can,
): AmlaReleaseActions {
  const none = { request: false, approve: false, reject: false, withdraw: false };
  if (order.status !== "active" || userId === null || !can(AMLA_SANCTIONS_PERMISSION) || !can("branches:view_all")) return none;
  if (order.pending_release === null) return { ...none, request: true };
  const asker = order.pending_release.requested_by?.id === userId;
  return { ...none, approve: !asker, reject: !asker, withdraw: asker };
}
