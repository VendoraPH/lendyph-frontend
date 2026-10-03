import type { GCashTransaction, Permission } from "@/types";

export type GCashRowAction = "cash_in" | "cash_out";

/**
 * The record buttons a GCash member row offers. Recording a transaction needs
 * `gcash:transact`; `gcash:view` alone only reads, so its rows offer none.
 */
export function gcashRowActions(can: (permission: Permission) => boolean): GCashRowAction[] {
  return can("gcash:transact") ? ["cash_in", "cash_out"] : [];
}

/**
 * Whether a Transactions row offers Paid. Only a pending Cash In can be marked
 * paid, and doing so needs `gcash:transact`, like recording one.
 */
export function gcashCanMarkPaid(
  can: (permission: Permission) => boolean,
  tx: Pick<GCashTransaction, "type" | "status">,
): boolean {
  return can("gcash:transact") && tx.type === "cash_in" && tx.status === "pending";
}
