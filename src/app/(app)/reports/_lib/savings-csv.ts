import type { SavingsCsvReport } from "@/services/report.service";
import type { ReportId } from "./types";

/** The savings reports whose CSV the server writes, by report id. */
const SAVINGS_CSV: Partial<Record<ReportId, SavingsCsvReport>> = {
  savings_balances: "balances",
  savings_transactions: "transactions",
  time_deposit_maturities: "time-deposit-maturities",
  savings_interest_postings: "interest-postings",
  savings_dormant: "dormant",
  savings_gl_control: "gl-control",
  savings_summary: "summary",
  savings_accounts: "accounts",
  savings_deposits: "deposits",
  savings_withdrawals: "withdrawals",
  savings_large_transactions: "large-transactions",
  savings_time_deposits: "time-deposits",
  savings_interest_accrual: "interest-accrual",
  savings_account_activity: "account-activity",
};

/**
 * The server export behind a savings report's CSV, or null when it has none:
 * the per-account statement is a printable, and the member statement needs
 * its member.
 */
export function savingsCsvReport(id: ReportId, subjectId: number | null): SavingsCsvReport | null {
  if (id === "savings_member_statement") return subjectId ? `member-statement/${subjectId}` : null;
  return SAVINGS_CSV[id] ?? null;
}
