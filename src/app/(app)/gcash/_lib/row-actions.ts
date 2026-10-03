import type { Permission } from "@/types";

export type GCashRowAction = "cash_in" | "cash_out";

/**
 * The record buttons a GCash member row offers. Recording a transaction needs
 * `gcash:transact`; `gcash:view` alone only reads, so its rows offer none.
 */
export function gcashRowActions(can: (permission: Permission) => boolean): GCashRowAction[] {
  return can("gcash:transact") ? ["cash_in", "cash_out"] : [];
}
