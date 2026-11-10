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
import { parseEditLoanId } from "@/app/(app)/loans/new/_lib/edit-loan-id";

/** The loan form's own title in edit mode (`/loans/new?edit={id}`). */
export const EDIT_LOAN_TITLE = "Edit Loan Application";

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
};

/** Fixed sub-pages, whatever section they sit under. */
const SUB_PAGE_TITLES: Readonly<Record<string, string>> = {
  products: "Loan Products",
  amortization: "Amortization Calculator",
  restructure: "Restructure",
  history: "History",
  profile: "Profile",
  "loan-products": "Loan Products",
  "user-roles": "Role and Permissions",
};

/**
 * Sections whose second segment has its own title there: a catalog id, or a
 * "new" page named after what it creates.
 */
const ID_TITLES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  loans: { new: "New Application" },
  borrowers: { new: "New Member" },
  collaterals: { new: "New Collateral" },
  reports: REPORT_TITLES,
  printables: PRINTABLE_TITLES,
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

/**
 * Pages a level further down (`/accounting/journals/new`), by their section and
 * page, as each page titles itself. A record there reads "Detail".
 */
const NESTED_PAGE_TITLES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "accounting/journals": { new: "New Journal Entry" },
  "loans/reminders": { history: "Message History" },
};

/** A record's sub-pages (`/borrowers/{id}/edit`), by section, as each page titles itself. */
const RECORD_PAGE_TITLES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  borrowers: { edit: "Edit Member" },
};

function own<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

/** The menu's title for a route, when the menu lists it. */
export type MenuTitle = (href: string) => string | undefined;

/** A menu entry as `menuTitles` reads it: the sidebar's sections and their pages. */
interface MenuEntry {
  title: string;
  href: string;
  children?: readonly { title: string; href: string }[];
}

/**
 * The menu's titles by route (`/accounting/journals` reads "Journal Entries").
 * A section's own title wins over a page at the same route ("Loans", not
 * "All Loans").
 */
export function menuTitles(menu: readonly MenuEntry[]): MenuTitle {
  const titles = new Map<string, string>();
  for (const section of menu) {
    for (const page of section.children ?? []) {
      if (!titles.has(page.href)) titles.set(page.href, page.title);
    }
  }
  for (const section of menu) titles.set(section.href, section.title);
  return (href) => titles.get(href);
}

/** A route segment as words: "cash_flow" and "cash-flow" both read "Cash flow". */
export function humanizeSegment(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/[-_]/g, " ");
}

/**
 * The breadcrumb label for the segment under `section` (`/reports/cash_flow`
 * reads "Cash Flow Statement"). A report or printable id reads its catalog
 * title, a fixed sub-page its label, a page the menu lists the menu's title
 * (`menuTitle`), and anything else its words. The loan form in edit mode
 * (`?edit={id}`, read as the page reads it) reads the page's own title.
 */
export function subPageTitle(
  section: string,
  segment: string,
  query: { edit?: string | null; menuTitle?: MenuTitle } = {},
): string {
  if (section === "loans" && segment === "new" && parseEditLoanId(query.edit ?? null) !== null) {
    return EDIT_LOAN_TITLE;
  }
  return (
    own(own(ID_TITLES, section) ?? {}, segment) ??
    own(SUB_PAGE_TITLES, segment) ??
    query.menuTitle?.(`/${section}/${segment}`) ??
    humanizeSegment(segment)
  );
}

/**
 * The breadcrumb label for a page a level further down, under `section` and
 * `page`: "Detail" for a record (`/accounting/journals/{id}`), else the page's
 * own title (`/accounting/journals/new` reads "New Journal Entry"), the menu's,
 * or its words.
 */
export function nestedPageTitle(
  section: string,
  page: string,
  segment: string,
  menuTitle?: MenuTitle,
): string {
  if (/^\d+$/.test(segment)) return "Detail";
  return (
    own(own(NESTED_PAGE_TITLES, `${section}/${page}`) ?? {}, segment) ??
    menuTitle?.(`/${section}/${page}/${segment}`) ??
    humanizeSegment(segment)
  );
}

/**
 * The breadcrumb label for a record's page (`/borrowers/{id}`): "Detail", or
 * the page's own title for a sub-page such as `/borrowers/{id}/edit`.
 */
export function detailPageTitle(section: string, subPage: string | undefined): string {
  if (subPage === undefined) return "Detail";
  return own(own(RECORD_PAGE_TITLES, section) ?? {}, subPage) ?? "Detail";
}
