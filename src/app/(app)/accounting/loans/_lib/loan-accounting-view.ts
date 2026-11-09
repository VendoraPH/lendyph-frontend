/**
 * The Loan Accounting screen's view helpers: the list's query and how its
 * figures read. Every figure is the server's; nothing here adds, subtracts or
 * divides money.
 */
import { LOAN_STATUS_LABELS } from "@/constants/loan-status";
import { normaliseSearchQuery } from "@/hooks/use-search-page";
import { AGING_BUCKETS, agingBucketLabel } from "@/lib/accounting/aging";
import { formatCentavos } from "@/lib/accounting/money";
import type {
  LoanAccountingGroup,
  LoanAccountingLoansQuery,
} from "@/services/accounting.service";
import type {
  AccountingMemberRef,
  AgingBucket,
  LoanAccountingSummary,
} from "@/types";
import { agingBucketItems, type SelectItemOption } from "../../_lib/select-items";

/** Rows per page of the Loan Accounting list. */
export const LOAN_ACCOUNTING_PAGE_SIZE = 25;

/**
 * The aging table's count column. The server's `count` and `count_total` are
 * outstanding instalments (schedule rows), not loans, so it isn't "Accounts".
 */
export const AGING_COUNT_HEADING = "Instalments";

/** "Any bucket" as a Select value: a Select cannot hold an empty string. */
export const ANY_BUCKET = "any";

/** What the list's controls hold. `bucket` is a bucket or `ANY_BUCKET`. */
export interface LoanAccountingFilters {
  asOf: string;
  branchId?: number;
  bucket: string;
  pastDueOnly: boolean;
  /** As typed; normalised before it is sent. */
  search: string;
  group: LoanAccountingGroup;
  page: number;
}

function isAgingBucket(value: string): value is AgingBucket {
  return (AGING_BUCKETS as readonly string[]).includes(value);
}

/** What `GET /accounting/loan-accounting/loans` is asked: one page, every filter on the server. */
export function loanAccountingQuery(filters: LoanAccountingFilters): LoanAccountingLoansQuery {
  const query: LoanAccountingLoansQuery = {
    as_of: filters.asOf,
    page: filters.page,
    per_page: LOAN_ACCOUNTING_PAGE_SIZE,
    group: filters.group,
  };
  if (filters.branchId !== undefined) query.branch_id = filters.branchId;
  if (isAgingBucket(filters.bucket)) query.bucket = filters.bucket;
  if (filters.pastDueOnly) query.past_due_only = true;
  const search = normaliseSearchQuery(filters.search);
  if (search) query.search = search;
  return query;
}

/** Identifies one request, so a page knows whether its answer is for the filters on screen. */
export function loanAccountingKey(query: LoanAccountingLoansQuery): string {
  return JSON.stringify(query);
}

/** The group switch's value as a group; anything else reads as by loan. */
export function groupFromValue(value: string | null): LoanAccountingGroup {
  return value === "member" ? "member" : "loan";
}

export function bucketLabel(bucket: AgingBucket): string {
  return agingBucketLabel(bucket);
}

/**
 * The bucket filter: "Any bucket", then each bucket with the server's row count
 * (`meta.stats`, which ignores the bucket filter) once it has answered.
 */
export function bucketFilterItems(
  stats: Record<AgingBucket, number> | null,
): SelectItemOption[] {
  return [
    { value: ANY_BUCKET, label: "Any bucket" },
    ...agingBucketItems.map((item) => {
      const count = stats?.[item.value as AgingBucket];
      return typeof count === "number" ? { ...item, label: `${item.label} (${count})` } : item;
    }),
  ];
}

const PERCENT = /^\d+(?:\.\d+)?$/;

/** The server's `share_percent` ("12.50") as "12.50%"; anything else is a dash. */
export function sharePercentLabel(share: string | null | undefined): string {
  return typeof share === "string" && PERCENT.test(share) ? `${share}%` : "—";
}

/** The bar's fill: the server's percent as a number, kept between 0 and 100. */
export function shareBarValue(share: string | null | undefined): number {
  if (typeof share !== "string" || !PERCENT.test(share)) return 0;
  return Math.min(100, Number(share));
}

/** A server figure in ₱ with two decimals; a missing one is a dash, and zero is ₱0.00. */
export function centavosOrDash(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? formatCentavos(value) : "—";
}

export function daysPastDueLabel(days: number): string {
  if (days <= 0) return "Not due";
  return days === 1 ? "1 day" : `${days} days`;
}

/** A loan's `display_status` in words, as the loan pages read it. */
export function displayStatusLabel(status: string): string {
  if (Object.hasOwn(LOAN_STATUS_LABELS, status)) {
    return LOAN_STATUS_LABELS[status as keyof typeof LOAN_STATUS_LABELS];
  }
  const words = status.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A member on the list: name and code only. */
export function memberLabel(member: AccountingMemberRef): string {
  return member.code ? `${member.name} · ${member.code}` : member.name;
}

/** A loan's account number; an imported loan has none and reads as a dash. */
export function accountNumberLabel(accountNumber: string | null): string {
  return accountNumber ?? "—";
}

/** One figure on a card, already formatted. */
export interface FigureView {
  label: string;
  value: string;
  hint?: string;
  /** The server says this figure needs review. */
  needsReview?: boolean;
}

type Books = NonNullable<LoanAccountingSummary["books"]>;
type Comparison = NonNullable<LoanAccountingSummary["books_vs_records"]>;

/**
 * The books' cards. Until the server sends `books`, every figure is a dash. The
 * clearing badge is the server's `adjustments_clearing_needs_review`, never a
 * test of the balance here.
 */
export function booksFigureViews(books: Books | undefined): {
  figures: FigureView[];
  clearingNeedsReview: boolean;
} {
  const clearingNeedsReview = books?.adjustments_clearing_needs_review === true;
  return {
    figures: [
      { label: "Gross loans receivable", value: centavosOrDash(books?.gross) },
      { label: "Less allowance for credit losses", value: centavosOrDash(books?.allowance) },
      {
        label: "Less unearned income on restructured loans",
        value: centavosOrDash(books?.unearned_income),
        hint: "Interest and penalty capitalised at restructure, not yet collected.",
      },
      { label: "Net loans receivable", value: centavosOrDash(books?.net) },
      {
        label: "Loan adjustments clearing",
        value: centavosOrDash(books?.adjustments_clearing),
        hint: "Any balance left here needs review.",
        needsReview: clearingNeedsReview,
      },
    ],
    clearingNeedsReview,
  };
}

/** How the books-against-records card reads; every figure is a dash until the server sends it. */
export function booksVsRecordsView(comparison: Comparison | undefined): {
  status: "reconciled" | "differs" | "pending";
  label: string;
  text: string;
  figures: FigureView[];
} {
  const figures: FigureView[] = [
    { label: "Loans receivable in the books", value: centavosOrDash(comparison?.books_principal) },
    {
      label: "Principal Balance on the loan records",
      value: centavosOrDash(comparison?.records_principal),
    },
    { label: "Difference (books less records)", value: centavosOrDash(comparison?.difference) },
  ];
  if (!comparison) {
    return {
      status: "pending",
      label: "Not available yet",
      text: "The comparison with the books isn't available yet.",
      figures,
    };
  }
  if (comparison.is_reconciled) {
    return {
      status: "reconciled",
      label: "Reconciled",
      text: "The loans receivable in the books equal the principal still owed on the loan records.",
      figures,
    };
  }
  // Only the server's sign is read: a negative difference means the books
  // hold less than the records.
  if (comparison.difference < 0) {
    return {
      status: "differs",
      label: "Not reconciled",
      text: "The books hold less than the loan records. Imported loans and loans released before the books existed post no release journal, so their principal is on the loan records but not in the books. Entering the opening balances corrects it.",
      figures,
    };
  }
  return {
    status: "differs",
    label: "Not reconciled",
    text: "The books and the loan records differ. This usually means loans were released before the books existed, or an opening balance has not been entered yet. Entering the opening balances corrects it.",
    figures,
  };
}
