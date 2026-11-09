import { daysFromToday } from "@/lib/format";
import { toNumber } from "@/lib/report-format";
import { mergeLoanFigure, readRowOutstanding } from "./past-due-outstanding";

/**
 * The filters the page sends to GET /reports/due-past-due. `past_due_only=1`
 * keeps only periods past their grace period (the server's grace rule), so a
 * loan still inside its grace window is not listed, and the report's `totals`
 * (the money cards) follow the same filter.
 */
export const PAST_DUE_REQUEST_PARAMS = { past_due_only: 1 } as const;

/** One loan on the Past Due Loans page. Every money figure is the server's. */
export interface PastDueLoan {
  loanId: number;
  loanNumber: string;
  memberId: string;
  memberName: string;
  daysPastDue: number;
  /** The loan's late, past-grace remaining figure (`loan_past_due_amount`). */
  pastDueAmount: number | null;
  /** Everything owed on the loan (`loan_total_outstanding`). */
  outstandingBalance: number | null;
  /** YYYY-MM-DD of the latest posted repayment (`loan_last_payment_date`). */
  lastPaymentDate: string | null;
  branch: string;
}

/**
 * One GET /reports/due-past-due row: an amortization period, carrying its
 * loan's figures (`loan_*`), the same on every row of that loan.
 */
export interface RawPastDueRow {
  [key: string]: unknown;
  loan?: { loan_account_number?: string } | null;
  borrower?: { full_name?: string; name?: string; borrower_code?: string } | null;
  branch?: { name?: string } | string | null;
}

const num = (v: unknown): number => toNumber(v) ?? 0;

const str = (v: unknown, fallback = ""): string =>
  v === null || v === undefined ? fallback : String(v);

/**
 * The server's days past due, as sent: 0 for a period still inside its grace
 * window, so such a loan never reads late. Counted from the due date only when
 * the row carries neither field, in Manila's calendar days.
 */
const computeDaysPastDue = (raw: RawPastDueRow): number => {
  const direct = toNumber(raw.days_past_due ?? raw.days_overdue);
  if (direct !== null) return direct;
  const dueDate = raw.due_date ?? raw.dueDate;
  if (typeof dueDate === "string") {
    const days = -daysFromToday(dueDate);
    if (Number.isFinite(days) && days > 0) return days;
  }
  return 0;
};

export function mapRow(raw: RawPastDueRow): PastDueLoan {
  // A row without its loan's id is skipped by aggregateByLoan, never keyed by
  // the period's own id.
  const loanId = num(raw.loan_id ?? raw.loanId);
  const branchValue = raw.branch_name ?? raw.branchName ?? raw.branch;
  const lastPayment = raw.loan_last_payment_date;

  return {
    loanId,
    loanNumber: str(
      raw.loan_account_number ?? raw.loan_number ?? raw.loanNumber ?? raw.loan?.loan_account_number,
      loanId ? `#${loanId}` : "—",
    ),
    memberId: str(
      raw.borrower_code ??
        raw.member_id ??
        raw.memberId ??
        raw.borrower?.borrower_code ??
        raw.borrower_id,
      "—",
    ),
    memberName: str(
      raw.borrower_name ??
        raw.member_name ??
        raw.memberName ??
        raw.borrower?.full_name ??
        raw.borrower?.name,
      "—",
    ),
    daysPastDue: computeDaysPastDue(raw),
    pastDueAmount: toNumber(raw.loan_past_due_amount),
    outstandingBalance: readRowOutstanding(raw),
    lastPaymentDate: typeof lastPayment === "string" && lastPayment !== "" ? lastPayment : null,
    branch:
      typeof branchValue === "object" && branchValue !== null
        ? str((branchValue as { name?: string }).name, "—")
        : str(branchValue, "—"),
  };
}

/** The later of two YYYY-MM-DD dates (they sort as text); a real date wins. */
const laterDate = (a: string | null, b: string | null): string | null => {
  if (a === null) return b;
  if (b === null) return a;
  return b > a ? b : a;
};

/**
 * One entry per loan. A loan's periods are separate rows, but its money
 * figures are loan-level and repeated on each, so grouping only picks them
 * (never adds them) and keeps the highest days past due.
 */
export function aggregateByLoan(rows: PastDueLoan[]): PastDueLoan[] {
  const map = new Map<number, PastDueLoan>();
  for (const r of rows) {
    if (!r.loanId) continue;
    const existing = map.get(r.loanId);
    if (!existing) {
      map.set(r.loanId, { ...r });
      continue;
    }
    existing.daysPastDue = Math.max(existing.daysPastDue, r.daysPastDue);
    existing.pastDueAmount = mergeLoanFigure(existing.pastDueAmount, r.pastDueAmount);
    existing.outstandingBalance = mergeLoanFigure(existing.outstandingBalance, r.outstandingBalance);
    existing.lastPaymentDate = laterDate(existing.lastPaymentDate, r.lastPaymentDate);
  }
  return Array.from(map.values());
}

export interface PastDueTotals {
  /** `totals.past_due_amount`, summed by the server once per distinct loan. */
  pastDueAmount: number | null;
  /** `totals.total_outstanding`, summed by the server once per distinct loan. */
  totalOutstanding: number | null;
}

/** The summary cards' money, from the report's `totals`; null shows a dash. */
export function readPastDueTotals(totals: Record<string, unknown> | null): PastDueTotals {
  return {
    pastDueAmount: toNumber(totals?.past_due_amount),
    totalOutstanding: toNumber(totals?.total_outstanding),
  };
}

export interface PastDueSummary extends PastDueTotals {
  memberCount: number;
  loanCount: number;
}

/**
 * The four summary cards. Pass every loaded loan, not the filtered table: the
 * money comes from the server's totals for the whole list, so the counts beside
 * it describe the same set.
 */
export function summarizePastDue(
  loans: PastDueLoan[],
  totals: Record<string, unknown> | null,
): PastDueSummary {
  return {
    memberCount: new Set(loans.map((l) => l.memberId)).size,
    loanCount: loans.length,
    ...readPastDueTotals(totals),
  };
}
