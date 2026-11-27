import { formatCurrency, formatDate, formatDateLong } from "@/lib/format";
import type {
  AutoCreditRunLine,
  SavingsAutoCreditRunDetail,
  SavingsAutoCreditRunResult,
  SavingsAutoCreditRunSummary,
} from "@/types/savings-servicing";

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

/** A run line's account and member, as the server named them. */
export function runLineAccount(line: AutoCreditRunLine): { account: string; member: string } {
  return { account: line.account_number ?? `Account #${line.account_id}`, member: line.borrower_name ?? "—" };
}

/** One past run's row (gap round B7), in the server's words and figures; a branch user's cover their branches. */
export function pastRunCells(run: SavingsAutoCreditRunSummary): {
  cycle: string;
  postedOn: string;
  method: string;
  settlement: string;
  posted: string;
  skipped: string;
  by: string;
} {
  const account = run.settlement_account;
  return {
    cycle: run.cycle_label,
    postedOn: formatDate(run.posted_on),
    method: run.reference_number ? `${run.method_label} · ${run.reference_number}` : run.method_label,
    settlement: account ? `${account.code} ${account.name}` : "—",
    posted: `${run.posted_count} · ${formatCurrency(run.posted_total)}`,
    skipped: run.skipped_count === null ? "—" : String(run.skipped_count),
    by: run.run_by?.name ?? "System",
  };
}

/** What a past run's skipped list says when it lists nothing; null when it has rows to show. */
export function skippedListNote(run: Pick<SavingsAutoCreditRunDetail, "skips_recorded" | "skipped">): string | null {
  if (!run.skips_recorded || run.skipped === null) {
    return "This run is from before skipped instructions were recorded, so its skips aren't listed.";
  }
  return run.skipped.length === 0 ? "Nothing was skipped on this run." : null;
}
