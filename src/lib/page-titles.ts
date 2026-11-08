/**
 * Page titles by route id, shared by the header's breadcrumb and the report
 * and printable catalogs, so a breadcrumb reads the same title as the menu
 * ("Cash Flow Statement", not "Cash_flow").
 *
 * Titles only: no service or template imports, so the header can read them
 * without pulling either catalog into its bundle. The type imports below are
 * erased at build time.
 */
import type { ReportId } from "@/app/(app)/reports/_lib/types";
import type { PrintableId } from "@/lib/printables/types";

export const REPORT_TITLES: Readonly<Record<ReportId, string>> = {
  daily_collection: "Daily Collection Report",
  repayments_list: "Repayments List",
  collection_efficiency: "Collection Efficiency",
  performance: "Officer / Branch Performance",
  cash_flow: "Cash Flow Statement",
  share_capital: "Share Capital Report",
  provisioning: "Loan Loss Provisioning",
  portfolio_summary: "Portfolio Summary",
  income_report: "Income Report",
  aging_report: "Aging Report",
  portfolio_by_product: "Loan Portfolio by Product",
  due_past_due_list: "Due / Past Due List",
  borrower_report: "Member Report",
  disbursement_report: "Disbursement Summary",
  releases_list: "Releases List",
  statement_of_account: "Statement of Account",
  subsidiary_ledger: "Subsidiary Ledger",
  savings_register: "Savings Account Register",
  savings_balances: "Savings Balances",
  savings_deposits: "Savings Deposits",
  savings_withdrawals: "Savings Withdrawals",
  savings_transfers: "Savings Transfers",
  savings_interest_postings: "Savings Interest Postings",
  savings_closed_dormant: "Closed & Dormant Savings Accounts",
};

export const PRINTABLE_TITLES: Readonly<Record<PrintableId, string>> = {
  disclosure_statement: "Disclosure Statement",
  promissory_note: "Promissory Note",
  release_voucher: "Loan Release Voucher",
  amortization_schedule: "Amortization Schedule",
  demand_letter: "Demand Letter",
  official_receipt: "Official Receipt",
  share_capital_certificate: "Share Capital Certificate",
  member_ledger_card: "Member Ledger Card",
  savings_receipt: "Savings Transaction Receipt",
};

/** Fixed sub-pages, whatever section they sit under. */
const SUB_PAGE_TITLES: Readonly<Record<string, string>> = {
  new: "New Application",
  products: "Loan Products",
  amortization: "Amortization Calculator",
  restructure: "Restructure",
  history: "History",
  profile: "Profile",
  "loan-products": "Loan Products",
  "user-roles": "Role and Permissions",
};

/**
 * Sections whose second segment is a catalog id, or that name a shared
 * segment their own way (`/savings/products` are not loan products).
 */
const ID_TITLES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  reports: REPORT_TITLES,
  printables: PRINTABLE_TITLES,
  savings: { products: "Savings Products" },
  "credit-scoring": {
    borrowers: "Member Scores",
    assessment: "Credit Assessment",
    "scorecard-configuration": "Scorecard Configuration",
    "risk-monitoring": "Risk Monitoring",
    "score-history": "Score History",
  },
  payments: { history: "Payment History" },
  "share-capital": {
    ledger: "Subsidiary Ledger",
    pledges: "Pledge Entry",
    "auto-credit": "Auto-Credit",
  },
};

function own<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

/** A route segment as words: "cash_flow" and "cash-flow" both read "Cash flow". */
export function humanizeSegment(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/[-_]/g, " ");
}

/**
 * The breadcrumb label for the segment under `section` (`/reports/cash_flow`
 * reads "Cash Flow Statement"). A report or printable id reads its catalog
 * title, a fixed sub-page its label, and anything else its words.
 */
export function subPageTitle(section: string, segment: string): string {
  return (
    own(own(ID_TITLES, section) ?? {}, segment) ??
    own(SUB_PAGE_TITLES, segment) ??
    humanizeSegment(segment)
  );
}
