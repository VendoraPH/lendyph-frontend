import { formatCurrency, formatDateLong } from "@/lib/format";
import type { SavingsAutoCreditRunResult } from "@/types/savings-servicing";

/** The run's headline figures, all the server's. */
export function runTotalCards(result: SavingsAutoCreditRunResult, posted: boolean): Array<{ label: string; value: string }> {
  const t = result.totals;
  return [
    { label: posted ? "Credited" : "To credit", value: `${t.credit_count} · ${formatCurrency(t.credit_amount)}` },
    { label: "Skipped", value: `${t.skipped_count} · ${formatCurrency(t.skipped_amount)}` },
    { label: "Already credited this cycle", value: String(t.already_credited_count) },
  ];
}

/** The line above the tables: which cycle, and the date every credit posts on. */
export function runHeadline(result: SavingsAutoCreditRunResult, posted: boolean): string {
  const cycle = formatDateLong(result.cycle_date);
  const on = formatDateLong(result.posting_date);
  if (posted) return `The ${cycle} cycle, posted on ${on}.`;
  const late = result.posting_date !== result.cycle_date ? ` A late run posts today's date (${on}).` : "";
  return `The ${cycle} cycle. Nothing is posted until you process the run.${late}`;
}

/** The toast after processing, from the server's totals. */
export function processedMessage(result: SavingsAutoCreditRunResult): { title: string; description: string } {
  const t = result.totals;
  const credited = t.credit_count === 1 ? "1 account credited" : `${t.credit_count} accounts credited`;
  return {
    title: t.credit_count === 0 ? "Nothing to credit this cycle" : `${credited} (${formatCurrency(t.credit_amount)})`,
    description: `${t.skipped_count} skipped, ${t.already_credited_count} already credited.`,
  };
}

/** Whether Process is offered: the preview has something to post. */
export function canProcess(preview: SavingsAutoCreditRunResult | null): boolean {
  return preview !== null && preview.totals.credit_count > 0;
}
