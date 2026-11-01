/**
 * The balance adjustment dialog's pure parts. The server works out the
 * adjustment (`GET /loans/{id}/balance-adjustment-preview` to show it,
 * `POST /loans/{id}/adjustments` to store it); nothing is calculated here.
 */

/** Digits with up to two decimals, as the server accepts. */
const TARGET_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * The typed target principal balance, trimmed, or null when the server would
 * refuse it (blank, negative, more than two decimals, not a plain number).
 * Kept as the typed string so it reaches the server unrounded.
 */
export function targetPrincipalInput(raw: string): string | null {
  const value = raw.trim();
  return TARGET_PATTERN.test(value) ? value : null;
}

/** `new_values` for a balance adjustment: the target, never an amount. */
export function balanceAdjustmentNewValues(target: string): { target_principal_balance: string } {
  return { target_principal_balance: target };
}

export interface BalanceAdjustmentPreviewView {
  currentPrincipal: number;
  target: number;
  adjustment: number;
  resultingPrincipal: number;
}

function figure(raw: unknown): number | null {
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** The server's preview figures, or null when any of them is missing. */
export function readBalanceAdjustmentPreview(data: unknown): BalanceAdjustmentPreviewView | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const currentPrincipal = figure(d.outstanding_principal);
  const target = figure(d.target_principal_balance);
  const adjustment = figure(d.adjustment_amount);
  const resultingPrincipal = figure(d.resulting_principal_balance);
  if (currentPrincipal === null || target === null || adjustment === null || resultingPrincipal === null) {
    return null;
  }
  return { currentPrincipal, target, adjustment, resultingPrincipal };
}
