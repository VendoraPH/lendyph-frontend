/**
 * The permission each lending write needs, with the reason a user without it
 * reads on the disabled button (`PermissionButton`). Each permission is the one
 * the server's form request checks, so a role the server refuses is never
 * offered the action as if it would work.
 */
import type { Permission } from "@/types";

export interface PermissionGate {
  permission: Permission;
  tooltip: string;
}

/** POST /loans/{loan}/repayments (StoreRepaymentRequest). */
export const PAYMENT_CREATE_GATE: PermissionGate = {
  permission: "payments:create",
  tooltip: "Your role doesn't have permission to record payments",
};

/**
 * A payment on a loan that can be extended (a one-month loan) is checked
 * against the server's payment preview, which decides whether it asks
 * "Extend loan?" first.
 */
export const ONE_MONTH_PREVIEW_GATE: PermissionGate = {
  permission: "payments:view",
  tooltip: "Checking a payment on a one-month loan needs permission to view payments",
};

/** POST /loans/{loan}/extend (ExtendLoanRequest), and "Yes, extend" on a partial payment. */
export const LOAN_EXTEND_GATE: PermissionGate = {
  permission: "loans:extend",
  tooltip: "Your role doesn't have permission to extend loans",
};

/** POST /loans/{loan}/adjustments (StoreLoanAdjustmentRequest). */
export const LOAN_ADJUSTMENT_CREATE_GATE: PermissionGate = {
  permission: "loan_adjustments:create",
  tooltip: "Your role doesn't have permission to request loan adjustments",
};

/**
 * Pledge Entry's row Entry, POST /share-capital/ledger
 * (StoreShareCapitalLedgerRequest), and its bulk Manual Entry, POST
 * /pledges/bulk-entries (ShareCapitalBulkEntryRequest).
 */
export const PLEDGE_ENTRY_CREATE_GATE: PermissionGate = {
  permission: "share_capital:create",
  tooltip: "Your role doesn't have permission to record share capital entries",
};

/**
 * A pledge's amount and schedule, PUT /pledges/{pledge}
 * (UpdateShareCapitalPledgeRequest), and its auto-credit switch, PATCH
 * /pledges/{pledge}/auto-credit (authorized in the controller).
 */
export const PLEDGE_UPDATE_GATE: PermissionGate = {
  permission: "share_capital:update",
  tooltip: "Your role doesn't have permission to change share capital pledges",
};

/** PATCH /loans/{loan}/auto-pay (ToggleAutoPayRequest). */
export const AUTO_PAY_TOGGLE_GATE: PermissionGate = {
  permission: "auto_pay:toggle",
  tooltip: "Turning Auto-Pay on or off needs permission to manage Auto-Pay",
};

/**
 * Record Payment on the loan page: recording needs payments:create, and on a
 * loan whose partial payment asks "Extend loan?" (`asksToExtend`) the payment
 * also needs payments:view for its preview. The missing permission's reason
 * is the one shown.
 */
export function recordPaymentGate(
  asksToExtend: boolean,
  can: (permission: Permission) => boolean,
): PermissionGate {
  return asksToExtend && can(PAYMENT_CREATE_GATE.permission)
    ? ONE_MONTH_PREVIEW_GATE
    : PAYMENT_CREATE_GATE;
}
