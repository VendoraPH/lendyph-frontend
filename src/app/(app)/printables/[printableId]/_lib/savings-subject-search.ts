import type { SearchPage } from "@/hooks/use-search-page";
import { formatCurrency, formatDate } from "@/lib/format";
import { savingsService, timeDepositService } from "@/services";
import { ACCOUNT_STATUS_LABELS, labelOf } from "@/app/(app)/savings/_lib/savings-rules";
import { TD_STATUS_LABELS } from "@/app/(app)/savings/_lib/time-deposit-rules";
import type { SavingsAccount, SavingsTransaction, TimeDeposit } from "@/types";

/** The savings subjects a document can be printed for. */
export type SavingsSubject = "savings_account" | "savings_withdrawal" | "time_deposit";

/** Rows per search, and what shows before typing. The status line says when there are more. */
const PAGE_SIZE = 25;

export interface SavingsSubjectOption {
  id: number;
  label: string;
  hint: string;
}

const hint = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

export function toAccountOption(a: SavingsAccount): SavingsSubjectOption {
  return {
    id: a.id,
    label: a.account_number,
    hint: hint([a.borrower_name, a.product?.name, labelOf(ACCOUNT_STATUS_LABELS, a.status)]),
  };
}

export function toWithdrawalOption(t: SavingsTransaction): SavingsSubjectOption {
  return {
    id: t.id,
    label: t.reference,
    hint: hint([
      t.borrower_name,
      formatCurrency(t.debit),
      t.date ? formatDate(t.date) : null,
      t.reversed_by_transaction_id != null ? "REVERSED" : null,
    ]),
  };
}

export function toTimeDepositOption(td: TimeDeposit): SavingsSubjectOption {
  return {
    id: td.id,
    label: td.certificate_number,
    hint: hint([td.borrower_name, formatCurrency(td.principal), labelOf(TD_STATUS_LABELS, td.status)]),
  };
}

/** What each subject's search asks the server for, and how a row reads. */
export function savingsSearchParams(subject: SavingsSubject, query: string): Record<string, unknown> {
  return {
    per_page: PAGE_SIZE,
    ...(query ? { search: query } : {}),
    // Counter withdrawals only: a time deposit's funding row is not one.
    ...(subject === "savings_withdrawal" ? { type: "withdrawal" } : {}),
  };
}

/** One page of the subject's list for one query, searched on the server. */
export async function fetchSavingsSubjectPage(
  subject: SavingsSubject,
  query: string,
): Promise<SearchPage<SavingsSubjectOption>> {
  const params = savingsSearchParams(subject, query);
  if (subject === "savings_account") {
    const res = await savingsService.accounts(params);
    return { query, rows: (res.data ?? []).map(toAccountOption), total: res.meta?.total ?? 0 };
  }
  if (subject === "time_deposit") {
    const res = await timeDepositService.list(params);
    return { query, rows: (res.data ?? []).map(toTimeDepositOption), total: res.meta?.total ?? 0 };
  }
  const res = await savingsService.transactions(params);
  const rows = (res.data ?? []).filter((t) => t.time_deposit_id == null).map(toWithdrawalOption);
  return { query, rows, total: res.meta?.total ?? rows.length };
}
