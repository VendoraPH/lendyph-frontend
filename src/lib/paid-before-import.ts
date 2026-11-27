import { formatCurrency } from "@/lib/format";
import { toNumber } from "@/lib/report-format";

/**
 * The words beside a Total Paid that holds what an imported loan's file says
 * was paid before the import (the server's `paid_before_import`): "Including
 * ₱23,600.00 paid before the import". Null when the server sent nothing above
 * ₱0.00, so a loan that was not imported reads as it always has. The figure is
 * the server's; nothing is added up here.
 */
export function paidBeforeImportNote(amount: unknown): string | null {
  const value = toNumber(amount);
  return value !== null && value > 0 ? `Including ${formatCurrency(value)} paid before the import` : null;
}
