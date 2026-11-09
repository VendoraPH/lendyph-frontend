/**
 * The entry form's balance panel, read from the server's preview
 * (`POST /accounting/journals/preview`). Nothing here adds or subtracts: the
 * totals, `out_by` and `heavier_side` are the server's.
 */
import { previewIsBalanced } from "@/lib/accounting/journal";
import { formatCentavos } from "@/lib/accounting/money";
import type { JournalPreview } from "@/types";

export type BalanceTone = "pending" | "failed" | "empty" | "balanced" | "out";

export interface BalanceStatus {
  tone: BalanceTone;
  title: string;
  detail: string | null;
}

/** "Out by ₱500.00 (debits higher)", from `out_by` and `heavier_side`. */
export function outByText(preview: JournalPreview): string {
  const amount = `Out by ${formatCentavos(preview.out_by)}`;
  if (preview.heavier_side === "debit") return `${amount} (debits higher)`;
  if (preview.heavier_side === "credit") return `${amount} (credits higher)`;
  return amount;
}

/**
 * The panel's state. `failed` is the message of a preview request that failed
 * for the current lines; `preview` is null until the answer for them arrives.
 * "Balanced" only by `previewIsBalanced` (two lines, a debit total above zero
 * and `is_balanced`): an empty or all-zero body is "balanced" to the server
 * (0 = 0) but isn't an entry yet, so it reads as waiting for amounts.
 */
export function balanceStatus(
  preview: JournalPreview | null,
  failed: string | null,
): BalanceStatus {
  if (failed !== null) {
    return { tone: "failed", title: "Totals unavailable", detail: failed };
  }
  if (preview === null) {
    return { tone: "pending", title: "Checking the totals…", detail: null };
  }
  if (preview.line_count === 0 || (preview.total_debit === 0 && preview.total_credit === 0)) {
    return { tone: "empty", title: "Enter the amounts", detail: null };
  }
  if (previewIsBalanced(preview)) {
    return { tone: "balanced", title: "Balanced", detail: null };
  }
  if (preview.is_balanced) {
    return { tone: "empty", title: "Add a second line", detail: "An entry needs a debit and a credit." };
  }
  return { tone: "out", title: "Not balanced", detail: outByText(preview) };
}
