import type { Loan, LoanStatus } from "@/types/loan";

// ── Tabs / status filtering ──

// "active" is a virtual tab value (not a real status) used when the Active
// Loans KPI card is clicked — it matches any post-release, not-yet-completed
// status so the table reflects what's still in the portfolio.
export type FilterTab = "all" | "active" | LoanStatus;

export const ACTIVE_STATUSES: LoanStatus[] = [
  "released",
  "current",
  "ongoing",
  "past_due",
];

export const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "for_review", label: "For Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "released", label: "Released" },
  { value: "current", label: "Current" },
  { value: "past_due", label: "Past Due" },
  { value: "completed", label: "Completed" },
];

export function matchesTab(loan: Loan, tab: FilterTab): boolean {
  if (tab === "all") return true;
  if (tab === "active") return ACTIVE_STATUSES.includes(loan.status);
  return loan.status === tab;
}

// ── Field-fallback helpers (Loan carries both flat and nested shapes) ──

export function loanBorrowerName(loan: Loan): string {
  return (
    loan.borrower?.full_name ??
    loan.borrower?.name ??
    loan.borrower_name ??
    ""
  );
}

export function loanProductName(loan: Loan): string {
  return loan.loan_product?.name ?? loan.loan_product_name ?? "";
}

export function loanProductId(loan: Loan): number | null {
  return loan.loan_product_id ?? loan.loan_product?.id ?? null;
}

export function loanTerm(loan: Loan): number | null {
  return loan.term ?? loan.term_months ?? null;
}

// ── Search ──

export function matchesSearch(loan: Loan, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystacks = [
    loan.application_number ?? "",
    loanBorrowerName(loan),
    loanProductName(loan),
    loan.purpose ?? "",
  ];
  return haystacks.some((h) => h.toLowerCase().includes(needle));
}

// ── Date range (inclusive) ──

export function matchesDateRange(
  loan: Loan,
  from: Date | null,
  to: Date | null,
): boolean {
  if (!from && !to) return true;
  const createdAt = loan.created_at ? new Date(loan.created_at) : null;
  if (!createdAt || isNaN(createdAt.getTime())) return false;
  if (from && createdAt < startOfDay(from)) return false;
  if (to && createdAt > endOfDay(to)) return false;
  return true;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

// ── Sorting ──

export type SortDir = "asc" | "desc";

export type LoanSortKey =
  | "application_number"
  | "borrower"
  | "product"
  | "amount"
  | "term"
  | "status"
  | "created_at";

// Status order = tab order, so sort reflects the user's mental model from
// the existing FILTER_TABS row.
const STATUS_ORDER: Record<string, number> = Object.fromEntries(
  FILTER_TABS.filter((t) => t.value !== "all" && t.value !== "active").map(
    (t, i) => [t.value, i],
  ),
);

export function compareLoans(
  a: Loan,
  b: Loan,
  key: LoanSortKey,
  dir: SortDir,
): number {
  const mul = dir === "asc" ? 1 : -1;
  const cmp = compareByKey(a, b, key);
  return cmp * mul;
}

function compareByKey(a: Loan, b: Loan, key: LoanSortKey): number {
  switch (key) {
    case "application_number":
      return compareString(a.application_number, b.application_number);
    case "borrower":
      return compareString(loanBorrowerName(a), loanBorrowerName(b));
    case "product":
      return compareString(loanProductName(a), loanProductName(b));
    case "amount":
      return compareNumber(a.principal_amount, b.principal_amount);
    case "term":
      return compareNumber(loanTerm(a), loanTerm(b));
    case "status":
      return compareNumber(
        STATUS_ORDER[a.status] ?? Number.POSITIVE_INFINITY,
        STATUS_ORDER[b.status] ?? Number.POSITIVE_INFINITY,
      );
    case "created_at":
      return compareDate(a.created_at, b.created_at);
  }
}

function compareString(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const aMissing = !a;
  const bMissing = !b;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return a!.localeCompare(b!);
}

function compareNumber(
  a: number | null | undefined,
  b: number | null | undefined,
): number {
  const aMissing = a == null;
  const bMissing = b == null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return (a as number) - (b as number);
}

function compareDate(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const aT = a ? new Date(a).getTime() : NaN;
  const bT = b ? new Date(b).getTime() : NaN;
  const aMissing = isNaN(aT);
  const bMissing = isNaN(bT);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return aT - bT;
}

// ── URL parsers ──

export function numOrNull(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function dateOrNull(v: string | null): Date | null {
  if (!v) return null;
  // Accept only YYYY-MM-DD to keep URL stable and avoid TZ surprises.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function clampOneOf<T>(v: T, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v) ? v : fallback;
}
