import type {
  AutoPayFilter,
  AutoPayLoanIssue,
  AutoPayPreview,
  AutoPayPreviewQuery,
  AutoPayResult,
  AutoPaySummary,
} from "@/types";

export interface PreviewTotals {
  principal: number;
  interest: number;
  /** Null when the server sent no penalty figure. */
  penalty: number | null;
  /** Includes the penalty. */
  amount: number;
}

/** The preview's totals, as the server sent them. Nothing is added here. */
export function previewTotals(summary: AutoPaySummary): PreviewTotals {
  return {
    principal: summary.total_principal,
    interest: summary.total_interest,
    penalty: summary.total_penalty ?? null,
    amount: summary.total_amount,
  };
}

export interface RunTotals {
  /** The selected part-paid rows' remaining amount. */
  partialTotal: number;
  /** What the run posts for the selection. */
  grandTotal: number;
}

/** The run's total from a preview asked with the selection; null if not sent. */
export function runTotals(summary: AutoPaySummary): RunTotals | null {
  const { partial_total: partialTotal, grand_total: grandTotal } = summary;
  if (typeof partialTotal !== "number" || typeof grandTotal !== "number") return null;
  return { partialTotal, grandTotal };
}

/**
 * The preview query for a filter and a selection, as a key: equal selections
 * in any order give the same key, so a re-render neither re-asks nor drops an
 * answer already shown. `JSON.parse` it back to send it.
 */
export function autoPayTotalsKey(filter: AutoPayFilter, includedScheduleIds: ReadonlySet<number>): string {
  const query: AutoPayPreviewQuery = {
    product_ids: filter.product_ids,
    date_from: filter.date_from,
    date_to: filter.date_to,
    include_schedule_ids: [...includedScheduleIds].sort((a, b) => a - b),
  };
  return JSON.stringify(query);
}

/**
 * How many loans a run would touch: every loan with full dues, plus the loans
 * of the part-paid rows included, each loan counted once.
 */
export function loansAffected(preview: AutoPayPreview, includedScheduleIds: ReadonlySet<number>): number {
  const ids = new Set((preview.loans ?? []).map((l) => l.loan_id));
  for (const row of preview.partial_rows) {
    if (includedScheduleIds.has(row.schedule_id)) ids.add(row.loan_id);
  }
  return ids.size;
}

export interface LoanIssueView {
  loanId: number;
  account: string;
  reason: string;
}

/** A skipped or failed loan with the server's reason, ready to list. */
export function loanIssues(issues: readonly AutoPayLoanIssue[] | undefined): LoanIssueView[] {
  return (issues ?? []).map((i) => ({
    loanId: i.loan_id,
    account: i.loan_account_number || `Loan #${i.loan_id}`,
    reason: i.reason,
  }));
}

export interface RunOutcome {
  processed: number;
  skipped: number;
  failed: number;
  skips: LoanIssueView[];
  failures: LoanIssueView[];
}

/** What a run did, from the server's answer. */
export function runOutcome(result: AutoPayResult): RunOutcome {
  return {
    processed: result.processed,
    skipped: result.skipped,
    failed: result.failed,
    skips: loanIssues(result.skips),
    failures: loanIssues(result.failures),
  };
}
