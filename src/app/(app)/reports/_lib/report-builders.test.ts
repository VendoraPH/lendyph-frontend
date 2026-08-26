import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAgingDoc,
  buildBorrowerDoc,
  buildCashFlowDoc,
  buildCollectionEfficiencyDoc,
  buildDailyCollectionDoc,
  buildDisbursementDoc,
  buildDuePastDueListDoc,
  buildIncomeDoc,
  buildPerformanceDoc,
  buildPortfolioByProductDoc,
  buildPortfolioSummaryDoc,
  buildProvisioningDoc,
  buildReleasesListDoc,
  buildRepaymentsListDoc,
  buildShareCapitalDoc,
  buildStatementOfAccountDoc,
  buildSubsidiaryLedgerDoc,
} from "./report-builders";
import { buildReference, resolveOrgName } from "./report-chrome";
import { DASH, formatValue } from "./formatters";
import { siteConfig } from "@/config/site";
import {
  MAX_REPORT_SPAN_YEARS,
  exceedsReportSpanCap,
} from "./types";
import type { DateRange, FieldItem, KpiItem, ReportDocument, ReportId } from "./types";

/**
 * Contract tests: every payload below mirrors what the API actually returns
 * (ReportService.php / ReportController.php), so a renamed key fails here
 * instead of silently rendering "—" in front of the client.
 */

const RANGE: DateRange = { from: "2026-08-01", to: "2026-08-06" };

function kpi(doc: ReportDocument, label: string): KpiItem {
  for (const section of doc.sections) {
    if (section.kind !== "kpi_grid") continue;
    const item = section.items.find((i) => i.label === label);
    if (item) return item;
  }
  throw new Error(`KPI "${label}" not found in ${doc.reportId}`);
}

function kpiValue(doc: ReportDocument, label: string): string {
  return kpi(doc, label).value;
}

function noteText(doc: ReportDocument): string | null {
  const note = doc.sections.find((s) => s.kind === "note");
  return note && note.kind === "note" ? note.text : null;
}

function tableTotal(doc: ReportDocument, column: string): string | undefined {
  const table = doc.sections.find((s) => s.kind === "table");
  if (!table || table.kind !== "table") return undefined;
  return table.totals?.find((t) => t.column === column)?.value;
}

function tableRows(doc: ReportDocument): Record<string, unknown>[] {
  const table = doc.sections.find((s) => s.kind === "table");
  return table && table.kind === "table" ? table.rows : [];
}

/** A named table — reports now carry several, so position is not enough. */
function namedTable(doc: ReportDocument, title: string) {
  const section = doc.sections.find(
    (s) => s.kind === "table" && s.title === title
  );
  assert.ok(section && section.kind === "table", `table "${title}" not found`);
  return section;
}

function hasTable(doc: ReportDocument, title: string): boolean {
  return doc.sections.some((s) => s.kind === "table" && s.title === title);
}

function namedTableTotal(
  doc: ReportDocument,
  title: string,
  column: string
): string | undefined {
  return namedTable(doc, title).totals?.find((t) => t.column === column)?.value;
}

function fieldItems(doc: ReportDocument, title: string): FieldItem[] {
  const section = doc.sections.find(
    (s) => s.kind === "fields" && s.title === title
  );
  assert.ok(section && section.kind === "fields", `fields "${title}" not found`);
  return section.items;
}

function fieldValue(doc: ReportDocument, title: string, label: string): string {
  const item = fieldItems(doc, title).find((f) => f.label === label);
  assert.ok(item, `field "${label}" not found in "${title}"`);
  return item.value;
}

function assertNoDashes(doc: ReportDocument): void {
  for (const section of doc.sections) {
    if (section.kind !== "kpi_grid") continue;
    for (const item of section.items) {
      assert.notEqual(item.value, DASH, `KPI "${item.label}" rendered a dash`);
    }
  }
}

// ---------------------------------------------------------------------------
// Portfolio Summary — nested portfolio/outstanding/overdue blocks
// ---------------------------------------------------------------------------

// Flat headline keys sit alongside the nested blocks. `outstanding_balance`
// includes insurance, so it is deliberately larger than principal + interest +
// penalty (3,418,151.50) — the two are not meant to match.
const PORTFOLIO_PAYLOAD = {
  active_loans: 42,
  outstanding_balance: 3462980.15,
  at_risk_amount: 458101,
  par_ratio: 12.5,
  par_threshold_days: 30,
  portfolio: { loan_count: 42, total_released: 5250000 },
  outstanding: { principal: 3120450.75, interest: 285300.5, penalty: 12400.25 },
  overdue: { principal: 410200.4, interest: 38100.6, penalty: 9800, loan_count: 7 },
  by_branch: [
    {
      branch_id: 1,
      branch_name: "Main",
      loan_count: 42,
      total_released: 5250000,
      outstanding_balance: 3120450.75,
    },
  ],
  generated_at: "2026-08-06 09:15:00",
};

test("portfolio summary prefers the flat headline figures", () => {
  const doc = buildPortfolioSummaryDoc(PORTFOLIO_PAYLOAD, RANGE);

  assertNoDashes(doc);
  assert.equal(kpiValue(doc, "Total Active Loans"), "42");
  assert.equal(kpiValue(doc, "Outstanding Balance"), "₱3,462,980.15");
  assert.equal(kpiValue(doc, "At Risk (>30d overdue)"), "₱458,101.00");
  assert.equal(kpiValue(doc, "PAR Ratio"), "12.5%");
});

test("PAR ratio is shown as the server sent it, not recomputed from the KPIs", () => {
  const doc = buildPortfolioSummaryDoc(PORTFOLIO_PAYLOAD, RANGE);
  // at_risk ÷ outstanding_balance would be 13.2% — PAR divides by outstanding
  // principal instead, so the server's 12.5% must survive untouched.
  assert.equal(kpiValue(doc, "PAR Ratio"), "12.5%");
  assert.equal(kpi(doc, "PAR Ratio").hint, "Portfolio at Risk, on outstanding principal");
});

test("the at-risk label follows the server's PAR threshold", () => {
  const doc = buildPortfolioSummaryDoc(
    { ...PORTFOLIO_PAYLOAD, par_threshold_days: 60 },
    RANGE
  );
  assert.equal(kpiValue(doc, "At Risk (>60d overdue)"), "₱458,101.00");
});

test("portfolio summary surfaces the overdue loan count as a hint", () => {
  const doc = buildPortfolioSummaryDoc(PORTFOLIO_PAYLOAD, RANGE);
  assert.equal(kpi(doc, "At Risk (>30d overdue)").hint, "7 overdue loans");
});

test("portfolio summary falls back to the nested blocks when the flat keys are absent", () => {
  const { active_loans, outstanding_balance, ...nestedOnly } = PORTFOLIO_PAYLOAD;
  void active_loans;
  void outstanding_balance;
  const doc = buildPortfolioSummaryDoc(nestedOnly, RANGE);

  assert.equal(kpiValue(doc, "Total Active Loans"), "42");
  // outstanding.principal + interest + penalty
  assert.equal(kpiValue(doc, "Outstanding Balance"), "₱3,418,151.50");
  assert.equal(kpi(doc, "Outstanding Balance").hint, "Principal + interest + penalty");
});

test("portfolio summary dashes only the figures the API omits", () => {
  const { at_risk_amount, par_ratio, ...withoutRisk } = PORTFOLIO_PAYLOAD;
  void at_risk_amount;
  void par_ratio;
  const doc = buildPortfolioSummaryDoc(withoutRisk, RANGE);

  assert.equal(kpiValue(doc, "Total Active Loans"), "42");
  assert.equal(kpiValue(doc, "Outstanding Balance"), "₱3,462,980.15");
  assert.equal(kpiValue(doc, "At Risk (>30d overdue)"), DASH);
  assert.equal(kpiValue(doc, "PAR Ratio"), DASH);
});

test("portfolio summary renders the shell when the request failed", () => {
  const doc = buildPortfolioSummaryDoc(null, RANGE);
  assert.equal(kpiValue(doc, "Total Active Loans"), DASH);
  assert.equal(kpiValue(doc, "Outstanding Balance"), DASH);
});

// ---------------------------------------------------------------------------
// Aging — each bucket is { amount, count }, not a bare number
// ---------------------------------------------------------------------------

// Bucket amounts sum to total.amount (451,861.50); bucket counts (12+5+1+9=27)
// deliberately exceed total.count — a loan late in two buckets is one loan.
const AGING_PAYLOAD = {
  as_of_date: "2026-08-06",
  buckets: {
    "1_30": { amount: 128450.5, count: 12 },
    "31_60": { amount: 64200.25, count: 5 },
    "61_90": { amount: 18900, count: 1 },
    over_90: { amount: 240310.75, count: 9 },
  },
  total: { amount: 451861.5, count: 21 },
  generated_at: "2026-08-06 09:15:00",
};

test("aging report reads bucket.amount rather than the bucket object", () => {
  const doc = buildAgingDoc(AGING_PAYLOAD, RANGE);

  assertNoDashes(doc);
  assert.equal(kpiValue(doc, "1–30 Days Overdue"), "₱128,450.50");
  assert.equal(kpiValue(doc, "31–60 Days Overdue"), "₱64,200.25");
  assert.equal(kpiValue(doc, "61–90 Days Overdue"), "₱18,900.00");
  assert.equal(kpiValue(doc, ">90 Days Overdue"), "₱240,310.75");
});

test("aging report shows each bucket's loan count", () => {
  const doc = buildAgingDoc(AGING_PAYLOAD, RANGE);
  assert.equal(kpi(doc, "1–30 Days Overdue").hint, "12 loans");
  assert.equal(kpi(doc, "61–90 Days Overdue").hint, "1 loan");
});

test("aging report states the total and warns that bucket counts do not add up", () => {
  const note = noteText(buildAgingDoc(AGING_PAYLOAD, RANGE));

  assert.ok(note, "expected an aging total note");
  assert.match(note!, /Total overdue: ₱451,861\.50 across 21 delinquent loans/);
  assert.match(note!, /bucket loan counts do not/);
});

test("aging report still warns about counts when the API omits the total block", () => {
  const { total, ...withoutTotal } = AGING_PAYLOAD;
  void total;
  const note = noteText(buildAgingDoc(withoutTotal, RANGE));

  assert.ok(note, "expected the counts caveat");
  assert.doesNotMatch(note!, /Total overdue/);
  assert.match(note!, /one loan late in two buckets|late in two buckets/);
});

// ---------------------------------------------------------------------------
// Borrower / disbursement / income / daily collection
// ---------------------------------------------------------------------------

test("borrower report reads total_active_borrowers", () => {
  const doc = buildBorrowerDoc(
    {
      total_active_borrowers: 318,
      new_borrowers: 24,
      avg_loan_size: 42350.75,
      repeat_borrowers: 96,
      generated_at: "2026-08-06 09:15:00",
    },
    RANGE
  );

  assertNoDashes(doc);
  assert.equal(kpiValue(doc, "Total Active Borrowers"), "318");
  assert.equal(kpiValue(doc, "New Borrowers"), "24");
  assert.equal(kpiValue(doc, "Avg Loan Size"), "₱42,350.75");
  assert.equal(kpiValue(doc, "Repeat Borrowers"), "96");
});

test("disbursement report maps every KPI to a real figure", () => {
  const doc = buildDisbursementDoc(
    {
      loans_released: 37,
      total_disbursed: 1845200.4,
      avg_disbursement: 49870.28,
      pending_release: 5,
      generated_at: "2026-08-06 09:15:00",
    },
    RANGE
  );

  assertNoDashes(doc);
  assert.equal(kpiValue(doc, "Loans Released"), "37");
  assert.equal(kpiValue(doc, "Total Disbursed"), "₱1,845,200.40");
});

test("income report totals the components when the API omits a total", () => {
  const doc = buildIncomeDoc(
    { interest_income: 120500.25, processing_fees: 32400.5, penalty_income: 4800.25 },
    RANGE
  );

  assertNoDashes(doc);
  assert.equal(kpiValue(doc, "Total Income"), "₱157,701.00");
});

test("income report prefers the API's own total key", () => {
  const doc = buildIncomeDoc(
    {
      interest_income: 120500.25,
      processing_fees: 32400.5,
      penalty_income: 4800.25,
      total: 157701,
      generated_at: "2026-08-06 09:15:00",
    },
    RANGE
  );
  assert.equal(kpiValue(doc, "Total Income"), "₱157,701.00");
});

test("daily collection renders whole-percent rates verbatim", () => {
  const doc = buildDailyCollectionDoc(
    {
      date: "2026-08-06",
      total_due: 84500.5,
      total_collected: 73900.25,
      collection_rate: 87.5,
      uncollected: 10600.25,
      generated_at: "2026-08-06 09:15:00",
    },
    RANGE
  );

  assertNoDashes(doc);
  assert.equal(kpiValue(doc, "Collection Rate"), "87.5%");
  assert.equal(kpiValue(doc, "Total Due"), "₱84,500.50");
});

test("a sub-1% rate is not inflated to 80%", () => {
  const doc = buildDailyCollectionDoc(
    { total_due: 100000, total_collected: 800, collection_rate: 0.8, uncollected: 99200 },
    RANGE
  );
  assert.equal(kpiValue(doc, "Collection Rate"), "0.8%");
});

test("a zero rate still renders as a figure, not a dash", () => {
  const doc = buildDailyCollectionDoc(
    { total_due: 0, total_collected: 0, collection_rate: 0, uncollected: 0 },
    RANGE
  );
  assert.equal(kpiValue(doc, "Collection Rate"), "0.0%");
  assert.equal(kpiValue(doc, "Total Due"), "₱0.00");
});

// ---------------------------------------------------------------------------
// Due / Past Due list — amount_remaining, days_overdue, server totals
// ---------------------------------------------------------------------------

const DUE_ROWS = [
  {
    id: 1,
    loan_id: 10,
    loan_account_number: "LN-2026-0001",
    borrower_name: "Maria Santos",
    period_number: 3,
    due_date: "2026-07-15",
    principal_due: 4000,
    interest_due: 1200.5,
    penalty_amount: 250,
    total_due: 5450.5,
    principal_paid: 0,
    interest_paid: 0,
    amount_remaining: 5450.5,
    days_overdue: 22,
    status: "overdue",
  },
  {
    id: 2,
    loan_id: 11,
    loan_account_number: "LN-2026-0002",
    borrower_name: "Jose Dela Cruz",
    period_number: 1,
    due_date: "2026-08-06",
    principal_due: 3000,
    interest_due: 900.25,
    penalty_amount: 0,
    total_due: 3900.25,
    principal_paid: 1000,
    interest_paid: 0,
    amount_remaining: 2900.25,
    days_overdue: 0,
    status: "partial",
  },
];

test("due/past due reads amount_remaining as the row balance", () => {
  const doc = buildDuePastDueListDoc({ data: DUE_ROWS, meta: { total: 2 } }, RANGE);
  const rows = tableRows(doc);

  assert.equal(rows[0].balance, 5450.5);
  assert.equal(rows[1].balance, 2900.25);
  assert.equal(kpiValue(doc, "Total Balance"), "₱8,350.75");
  assert.equal(kpiValue(doc, "Total Amount Due"), "₱9,350.75");
});

test("overdue count comes from days_overdue and is no longer stuck at zero", () => {
  const doc = buildDuePastDueListDoc({ data: DUE_ROWS, meta: { total: 2 } }, RANGE);
  assert.equal(kpiValue(doc, "Overdue Count"), "1");
  assert.equal(tableRows(doc)[0].days_overdue, 22);
});

const DUE_TOTALS = {
  count: 1432,
  overdue_count: 894,
  total_principal_due: 1420100.5,
  total_interest_due: 402099.75,
  total_penalty: 53000,
  total_due: 1875200.25,
  total_balance: 1602340.75,
};

test("due/past due uses the server totals block over the page it was sent", () => {
  const doc = buildDuePastDueListDoc(
    {
      data: DUE_ROWS,
      meta: { current_page: 1, last_page: 8, per_page: 200, total: 1432 },
      totals: DUE_TOTALS,
    },
    RANGE
  );

  assert.equal(kpiValue(doc, "Total Schedules"), "1,432");
  assert.equal(kpiValue(doc, "Overdue Count"), "894");
  assert.equal(kpiValue(doc, "Total Amount Due"), "₱1,875,200.25");
  assert.equal(kpiValue(doc, "Total Balance"), "₱1,602,340.75");
  assert.equal(tableTotal(doc, "balance"), "₱1,602,340.75");
});

test("due/past due breaks the amount due into principal, interest, and penalty", () => {
  const doc = buildDuePastDueListDoc(
    { data: DUE_ROWS, meta: { total: 1432 }, totals: DUE_TOTALS },
    RANGE
  );
  assert.equal(
    kpi(doc, "Total Amount Due").hint,
    "Principal ₱1,420,100.50 · Interest ₱402,099.75 · Penalty ₱53,000.00"
  );
});

test("due/past due falls back to totals.count when the paginator meta is absent", () => {
  const doc = buildDuePastDueListDoc({ data: DUE_ROWS, totals: DUE_TOTALS }, RANGE);
  assert.equal(kpiValue(doc, "Total Schedules"), "1,432");
});

// ---------------------------------------------------------------------------
// Releases / Repayments lists
// ---------------------------------------------------------------------------

const RELEASE_ROWS = [
  {
    id: 1,
    application_number: "APP-2026-0001",
    loan_account_number: "LN-2026-0001",
    borrower_name: "Ana Reyes",
    release_date: "2026-08-03",
    principal_amount: 50000.25,
    term: 6,
    interest_rate: "3.0000",
    status: "released",
  },
  {
    id: 2,
    application_number: "APP-2026-0002",
    loan_account_number: "LN-2026-0002",
    borrower_name: "Ben Uy",
    release_date: "2026-08-05",
    principal_amount: 75000.25,
    term: 12,
    interest_rate: "2.5000",
    status: "ongoing",
  },
];

test("releases list maps LoanResource rows and totals the page when the API sends no totals", () => {
  const doc = buildReleasesListDoc(
    { data: RELEASE_ROWS, meta: { current_page: 1, last_page: 1, per_page: 200, total: 2 } },
    RANGE
  );
  const rows = tableRows(doc);

  assert.equal(rows[0].principal, 50000.25);
  assert.equal(rows[0].borrower_name, "Ana Reyes");
  assert.equal(rows[0].interest_rate, "3.0000");
  assert.equal(kpiValue(doc, "Total Releases"), "2");
  // Two centavo-bearing rows must add up exactly — whole-peso rounding used to
  // make the column disagree with its own total.
  assert.equal(kpiValue(doc, "Total Principal"), "₱125,000.50");
  assert.equal(tableTotal(doc, "principal"), "₱125,000.50");
  assert.equal(noteText(doc), null);
});

test("releases list prefers the server totals over the visible page", () => {
  const doc = buildReleasesListDoc(
    {
      data: RELEASE_ROWS,
      meta: { current_page: 1, last_page: 4, per_page: 200, total: 640 },
      totals: {
        count: 640,
        total_principal: 18450900.75,
        total_net_proceeds: 17920400.5,
        total_outstanding_balance: 12408300.25,
      },
    },
    RANGE
  );

  assert.equal(kpiValue(doc, "Total Releases"), "640");
  assert.equal(kpiValue(doc, "Total Principal"), "₱18,450,900.75");
  assert.equal(kpiValue(doc, "Net Proceeds"), "₱17,920,400.50");
  assert.equal(kpiValue(doc, "Outstanding Balance"), "₱12,408,300.25");
  assert.equal(tableTotal(doc, "principal"), "₱18,450,900.75");
});

test("releases list omits the extra KPIs when the API sends no totals block", () => {
  const doc = buildReleasesListDoc({ data: RELEASE_ROWS, meta: { total: 2 } }, RANGE);
  const grid = doc.sections.find((s) => s.kind === "kpi_grid");

  assert.ok(grid && grid.kind === "kpi_grid");
  assert.deepEqual(
    grid.items.map((i) => i.label),
    ["Total Releases", "Total Principal"]
  );
});

test("repayments list maps RepaymentResource rows and totals them", () => {
  const doc = buildRepaymentsListDoc(
    {
      data: [
        {
          id: 1,
          loan_account_number: "LN-2026-0001",
          borrower_name: "Ana Reyes",
          payment_date: "2026-08-05",
          paid_at: "2026-08-05",
          method: "cash",
          amount_paid: 4520.25,
          amount: 4520.25,
          penalty_applied: 120.5,
          penalty_amount: 120.5,
          status: "completed",
        },
        {
          id: 2,
          loan_account_number: "LN-2026-0002",
          borrower_name: "Ben Uy",
          payment_date: "2026-08-06",
          paid_at: "2026-08-06",
          method: "gcash",
          amount_paid: 3000,
          amount: 3000,
          penalty_applied: 0,
          penalty_amount: 0,
          status: "completed",
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 200, total: 2 },
    },
    RANGE
  );

  assert.equal(kpiValue(doc, "Total Repayments"), "2");
  assert.equal(kpiValue(doc, "Total Collected"), "₱7,520.25");
  assert.equal(kpiValue(doc, "Penalty Collected"), "₱120.50");
  assert.equal(tableRows(doc)[0].method, "cash");
});

test("repayments list uses the server totals and splits principal from interest", () => {
  const doc = buildRepaymentsListDoc(
    {
      data: [],
      meta: { current_page: 1, last_page: 12, per_page: 200, total: 2380 },
      totals: {
        count: 2380,
        total_amount_paid: 9845200.5,
        total_principal_applied: 7120400.25,
        total_interest_applied: 2480300.25,
        total_penalty_applied: 244500,
      },
    },
    RANGE
  );

  assert.equal(kpiValue(doc, "Total Repayments"), "2,380");
  assert.equal(kpiValue(doc, "Total Collected"), "₱9,845,200.50");
  assert.equal(kpiValue(doc, "Penalty Collected"), "₱244,500.00");
  assert.equal(
    kpi(doc, "Total Collected").hint,
    "Principal ₱7,120,400.25 · Interest ₱2,480,300.25"
  );
});

test("an empty list report reports zeroes and no truncation note", () => {
  const doc = buildRepaymentsListDoc({ data: [], meta: { total: 0 } }, RANGE);

  assert.equal(kpiValue(doc, "Total Repayments"), "0");
  assert.equal(kpiValue(doc, "Total Collected"), "₱0.00");
  assert.equal(noteText(doc), null);
  assert.equal(tableTotal(doc, "amount"), undefined);
});

// ---------------------------------------------------------------------------
// Truncation — a partial table must never read as the complete one
// ---------------------------------------------------------------------------

function manyDueRows(count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, i) => ({
    ...DUE_ROWS[0],
    id: i + 1,
    amount_remaining: 100,
    total_due: 100,
  }));
}

test("a truncated page is flagged, and server totals are described as complete", () => {
  const doc = buildDuePastDueListDoc(
    {
      data: manyDueRows(200),
      meta: { current_page: 1, last_page: 8, per_page: 200, total: 1432 },
      totals: DUE_TOTALS,
    },
    RANGE
  );
  const note = noteText(doc);

  assert.ok(note, "expected a truncation note");
  assert.match(note!, /Showing the first 200 of 1,432 rows/);
  assert.match(note!, /cover every row in the period/);
});

test("a truncated page without server totals says the totals are partial", () => {
  const doc = buildDuePastDueListDoc(
    {
      data: manyDueRows(200),
      meta: { current_page: 1, last_page: 8, per_page: 200, total: 1432 },
    },
    RANGE
  );
  const note = noteText(doc);

  assert.ok(note, "expected a truncation note");
  assert.match(note!, /cover only the rows listed/);
  assert.equal(kpiValue(doc, "Total Balance"), "₱20,000.00");
});

test("a full page with no reported row count is still flagged as possibly partial", () => {
  const doc = buildReleasesListDoc(
    Array.from({ length: 200 }, () => RELEASE_ROWS[0]),
    RANGE
  );
  const note = noteText(doc);

  assert.ok(note, "expected a truncation note");
  assert.match(note!, /did not report a row count/);
});

test("a bare array response (no envelope) still renders rows and totals", () => {
  const doc = buildReleasesListDoc(RELEASE_ROWS, RANGE);

  assert.equal(tableRows(doc).length, 2);
  assert.equal(kpiValue(doc, "Total Releases"), "2");
  assert.equal(kpiValue(doc, "Total Principal"), "₱125,000.50");
});

// ---------------------------------------------------------------------------
// Data the API sends that the reports used to fetch and discard
// ---------------------------------------------------------------------------

test("portfolio summary renders the by_branch breakdown it used to drop", () => {
  const doc = buildPortfolioSummaryDoc(PORTFOLIO_PAYLOAD, RANGE);
  const table = namedTable(doc, "Breakdown by Branch");

  assert.equal(table.rows.length, 1);
  assert.equal(table.rows[0].branch_name, "Main");
  assert.equal(table.rows[0].loan_count, 42);
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "total_released"), "₱5,250,000.00");
});

test("a branch row with no name is labelled rather than left blank", () => {
  const doc = buildPortfolioSummaryDoc(
    { ...PORTFOLIO_PAYLOAD, by_branch: [{ branch_id: null, loan_count: 3 }] },
    RANGE
  );
  assert.equal(namedTable(doc, "Breakdown by Branch").rows[0].branch_name, "Unassigned");
});

test("portfolio summary omits the branch table when the API sends no branches", () => {
  const { by_branch, ...withoutBranches } = PORTFOLIO_PAYLOAD;
  void by_branch;
  assert.equal(
    hasTable(buildPortfolioSummaryDoc(withoutBranches, RANGE), "Breakdown by Branch"),
    false
  );
});

test("portfolio summary splits outstanding against overdue by component", () => {
  const doc = buildPortfolioSummaryDoc(PORTFOLIO_PAYLOAD, RANGE);
  const table = namedTable(doc, "Outstanding vs Overdue Composition");

  assert.deepEqual(
    table.rows.map((r) => r.component),
    ["Principal", "Interest", "Penalty"]
  );
  assert.equal(table.rows[0].outstanding, 3120450.75);
  assert.equal(table.rows[0].overdue, 410200.4);
  // 3,120,450.75 + 285,300.50 + 12,400.25
  assert.equal(
    namedTableTotal(doc, "Outstanding vs Overdue Composition", "outstanding"),
    "₱3,418,151.50"
  );
});

test("a component the API omitted on both sides is dropped, not shown as zero", () => {
  const doc = buildPortfolioSummaryDoc(
    {
      ...PORTFOLIO_PAYLOAD,
      outstanding: { principal: 100, interest: 20 },
      overdue: { principal: 10, interest: 2 },
    },
    RANGE
  );
  assert.deepEqual(
    namedTable(doc, "Outstanding vs Overdue Composition").rows.map((r) => r.component),
    ["Principal", "Interest"]
  );
});

test("aging report renders a schedule with each bucket's share of the total", () => {
  const doc = buildAgingDoc(AGING_PAYLOAD, RANGE);
  const table = namedTable(doc, "Aging Schedule");

  assert.equal(table.rows.length, 4);
  assert.equal(table.rows[0].amount, 128450.5);
  // 128,450.50 ÷ 451,861.50
  assert.equal(Math.round((table.rows[0].share as number) * 100) / 100, 28.43);
  assert.equal(namedTableTotal(doc, "Aging Schedule", "amount"), "₱451,861.50");
  assert.equal(namedTableTotal(doc, "Aging Schedule", "share"), "100.0%");
});

test("the aging schedule never totals the loan counts", () => {
  // 12 + 5 + 1 + 9 = 27 against a real 21: a loan late in two buckets is one
  // loan, so summing the column would overstate the delinquency.
  const totals = namedTable(buildAgingDoc(AGING_PAYLOAD, RANGE), "Aging Schedule").totals;
  assert.equal(totals?.some((t) => t.column === "count"), false);
});

test("aging shares fall back to the buckets when the API omits the total", () => {
  const { total, ...withoutTotal } = AGING_PAYLOAD;
  void total;
  const doc = buildAgingDoc(withoutTotal, RANGE);
  assert.equal(namedTableTotal(doc, "Aging Schedule", "amount"), "₱451,861.50");
});

test("a zero overdue total reports no share instead of NaN", () => {
  const doc = buildAgingDoc(
    {
      buckets: {
        "1_30": { amount: 0, count: 0 },
        "31_60": { amount: 0, count: 0 },
        "61_90": { amount: 0, count: 0 },
        over_90: { amount: 0, count: 0 },
      },
      total: { amount: 0, count: 0 },
    },
    RANGE
  );
  const table = namedTable(doc, "Aging Schedule");
  assert.equal(table.rows[0].share, null);
  assert.equal(namedTableTotal(doc, "Aging Schedule", "share"), DASH);
});

test("due/past due carries the per-row breakdown the API already sends", () => {
  const rows = tableRows(buildDuePastDueListDoc({ data: DUE_ROWS, meta: { total: 2 } }, RANGE));

  assert.equal(rows[0].period_number, 3);
  assert.equal(rows[0].principal_due, 4000);
  assert.equal(rows[0].interest_due, 1200.5);
  assert.equal(rows[0].penalty_amount, 250);
  assert.equal(rows[1].amount_paid, 1000); // principal_paid + interest_paid
});

test("an unpaid row reports zero paid, while a silent API reports nothing", () => {
  const doc = buildDuePastDueListDoc(
    {
      data: [
        DUE_ROWS[0],
        (() => {
          const { principal_paid, interest_paid, ...silent } = DUE_ROWS[1];
          void principal_paid;
          void interest_paid;
          return silent;
        })(),
      ],
    },
    RANGE
  );
  const rows = tableRows(doc);

  assert.equal(rows[0].amount_paid, 0);
  assert.equal(rows[1].amount_paid, null);
});

test("due/past due footer money comes from the server totals, not the page", () => {
  const doc = buildDuePastDueListDoc(
    { data: DUE_ROWS, meta: { total: 1432 }, totals: DUE_TOTALS },
    RANGE
  );

  assert.equal(tableTotal(doc, "principal_due"), "₱1,420,100.50");
  assert.equal(tableTotal(doc, "interest_due"), "₱402,099.75");
  assert.equal(tableTotal(doc, "penalty_amount"), "₱53,000.00");
});

test("releases list carries the application number", () => {
  const doc = buildReleasesListDoc({ data: RELEASE_ROWS, meta: { total: 2 } }, RANGE);
  assert.equal(tableRows(doc)[0].application_number, "APP-2026-0001");
});

// ---------------------------------------------------------------------------
// Statement of Account / Subsidiary Ledger
//
// The API documents no response schema for either endpoint, so the builders
// read a wide set of aliases. These fixtures pin the primary shape; the alias
// tests below pin the fallbacks.
// ---------------------------------------------------------------------------

const SOA_PAYLOAD = {
  loan: {
    id: 10,
    loan_account_number: "LN-2026-0001",
    application_number: "APP-2026-0001",
    principal_amount: 50000,
    interest_rate: 3,
    term: 6,
    release_date: "2026-02-01",
    maturity_date: "2026-08-01",
    status: "ongoing",
  },
  borrower: { id: 5, full_name: "Maria Santos", borrower_code: "MB-0005" },
  summary: { total_paid: 21000.5, outstanding_balance: 34500.25, overdue_amount: 5450.5 },
  schedule: [
    {
      period_number: 1,
      due_date: "2026-03-01",
      beginning_balance: 50000,
      principal_due: 8000,
      interest_due: 1500,
      penalty_amount: 0,
      total_due: 9500,
      principal_paid: 8000,
      interest_paid: 1500,
      amount_remaining: 0,
      status: "paid",
    },
    {
      period_number: 2,
      due_date: "2026-04-01",
      beginning_balance: 42000,
      principal_due: 8000,
      interest_due: 1260,
      penalty_amount: 250,
      total_due: 9510,
      principal_paid: 0,
      interest_paid: 0,
      amount_remaining: 9510,
      status: "overdue",
    },
  ],
  transactions: [
    {
      id: 1,
      date: "2026-03-01",
      type: "repayment",
      reference: "OR-1001",
      method: "cash",
      amount: 9500,
      running_balance: 42000,
    },
  ],
};

test("statement of account opens with the account particulars", () => {
  const doc = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);

  assert.equal(doc.reportId, "statement_of_account");
  assert.equal(fieldValue(doc, "Account Particulars", "Borrower"), "Maria Santos");
  assert.equal(fieldValue(doc, "Account Particulars", "Loan Account No."), "LN-2026-0001");
  assert.equal(fieldValue(doc, "Account Particulars", "Principal"), "₱50,000.00");
  assert.equal(fieldValue(doc, "Account Particulars", "Interest Rate"), "3.0%");
});

test("statement of account particulars omit what the API did not send", () => {
  const doc = buildStatementOfAccountDoc(
    { loan: { loan_account_number: "LN-2026-0001" }, borrower: { full_name: "Maria Santos" } },
    RANGE
  );
  const labels = fieldItems(doc, "Account Particulars").map((f) => f.label);

  assert.deepEqual(labels, ["Borrower", "Loan Account No."]);
  assert.equal(labels.includes("Maturity Date"), false);
});

test("statement of account reads the summary block for its balances", () => {
  const doc = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);

  assert.equal(kpiValue(doc, "Total Paid"), "₱21,000.50");
  assert.equal(kpiValue(doc, "Outstanding Balance"), "₱34,500.25");
  assert.equal(kpiValue(doc, "Past Due"), "₱5,450.50");
});

test("the amortization schedule sums paid from principal_paid + interest_paid", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE), "Amortization Schedule");

  assert.equal(table.rows[0].amount_paid, 9500);
  assert.equal(table.rows[1].amount_paid, 0);
  assert.equal(table.rows[1].balance, 9510);
  assert.equal(
    table.totals?.find((t) => t.column === "total_due")?.value,
    "₱19,010.00"
  );
});

test("a typed transaction is posted to the correct side of the ledger", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE), "Transaction History");

  assert.equal(table.rows[0].credit, 9500);
  assert.equal(table.rows[0].debit, null);
  assert.equal(table.rows[0].particulars, "repayment");
});

test("explicit debit/credit columns are used verbatim when the API sends them", () => {
  const table = namedTable(
    buildStatementOfAccountDoc(
      {
        ...SOA_PAYLOAD,
        transactions: [
          {
            transaction_date: "2026-02-01",
            description: "Loan release",
            debit: 50000,
            credit: 0,
            balance: 50000,
          },
        ],
      },
      RANGE
    ),
    "Transaction History"
  );

  assert.equal(table.rows[0].debit, 50000);
  assert.equal(table.rows[0].particulars, "Loan release");
  assert.equal(table.rows[0].running_balance, 50000);
});

test("a failed statement request still renders the shell", () => {
  const doc = buildStatementOfAccountDoc(null, RANGE);

  assert.equal(kpiValue(doc, "Outstanding Balance"), DASH);
  assert.equal(namedTable(doc, "Amortization Schedule").rows.length, 0);
});

const LEDGER_PAYLOAD = {
  borrower: {
    id: 5,
    full_name: "Maria Santos",
    borrower_code: "MB-0005",
    branch: { id: 1, name: "Main" },
    status: "active",
  },
  loans: [
    {
      loan_account_number: "LN-2026-0001",
      release_date: "2026-02-01",
      principal_amount: 50000,
      total_paid: 21000.5,
      outstanding_balance: 34500.25,
      overdue_amount: 5450.5,
      status: "ongoing",
    },
    {
      loan_account_number: "LN-2025-0044",
      release_date: "2025-06-01",
      principal_amount: 30000,
      total_paid: 30000,
      outstanding_balance: 0,
      overdue_amount: 0,
      status: "closed",
    },
  ],
  entries: [
    {
      transaction_date: "2026-03-01",
      type: "payment",
      reference: "OR-1001",
      amount: 9500,
      running_balance: 42000,
    },
  ],
};

test("subsidiary ledger lists every loan account for the borrower", () => {
  const doc = buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE);
  const table = namedTable(doc, "Loan Accounts");

  assert.equal(doc.reportId, "subsidiary_ledger");
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0].loan_account_number, "LN-2026-0001");
  assert.equal(namedTableTotal(doc, "Loan Accounts", "principal"), "₱80,000.00");
  assert.equal(namedTableTotal(doc, "Loan Accounts", "balance"), "₱34,500.25");
});

test("subsidiary ledger reads the branch off the nested relation", () => {
  const doc = buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE);
  assert.equal(fieldValue(doc, "Member Particulars", "Branch"), "Main");
  assert.equal(fieldValue(doc, "Member Particulars", "Member No."), "MB-0005");
});

test("ledger totals are summed from the accounts when the API sends no summary", () => {
  const doc = buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE);

  assert.equal(kpiValue(doc, "Total Loans"), "2");
  assert.equal(kpiValue(doc, "Total Released"), "₱80,000.00");
  assert.equal(kpiValue(doc, "Total Paid"), "₱51,000.50");
});

test("a server summary block wins over the summed accounts", () => {
  const doc = buildSubsidiaryLedgerDoc(
    { ...LEDGER_PAYLOAD, summary: { loan_count: 9, total_released: 410000, total_paid: 220000 } },
    RANGE
  );

  assert.equal(kpiValue(doc, "Total Loans"), "9");
  assert.equal(kpiValue(doc, "Total Released"), "₱410,000.00");
});

test("the ledger hides payment history rather than claim there were no payments", () => {
  const { entries, ...withoutEntries } = LEDGER_PAYLOAD;
  void entries;

  assert.equal(hasTable(buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE), "Payment History"), true);
  assert.equal(hasTable(buildSubsidiaryLedgerDoc(withoutEntries, RANGE), "Payment History"), false);
});

test("the ledger subtitle names the borrower it covers", () => {
  assert.equal(buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE).meta.subtitle, "Maria Santos");
});

// ---------------------------------------------------------------------------
// Organization identity
//
// `ORG` used to be a constant in report-builders.ts, which printed one
// cooperative's name on every deployment's reports. The builders now emit
// nothing and `applyChrome()` resolves it — so the assertion here is that they
// stay out of it.
// ---------------------------------------------------------------------------

test("builders leave the organization name to chrome", () => {
  const docs = [
    buildIncomeDoc({ total: 1 }, RANGE),
    buildCashFlowDoc(null, RANGE),
    buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE),
  ];
  for (const doc of docs) {
    assert.equal(doc.meta.org, "", `${doc.reportId} hardcoded an organization`);
  }
});

test("an unconfigured deployment falls back to the site name, never a blank letterhead", () => {
  // Nothing has loaded branding in this process, so the store holds null.
  assert.equal(resolveOrgName(), siteConfig.name);
  assert.equal(resolveOrgName(null, ""), siteConfig.name);
  // Whitespace is not a name — a letterhead of spaces is a blank letterhead.
  assert.equal(resolveOrgName("   "), siteConfig.name);
});

test("a configured organization name wins over the fallback", () => {
  assert.equal(
    resolveOrgName("Binhs Multi-Purpose Cooperative"),
    "Binhs Multi-Purpose Cooperative"
  );
  // Earlier candidates win, so chrome overrides whatever the builder emitted.
  assert.equal(resolveOrgName("Binhs", "Ignored"), "Binhs");
});

/**
 * Exhaustive by construction: `Record<ReportId, true>` fails `npm run
 * typecheck` the moment a report is added without being listed here, which is
 * what makes the runtime assertion below meaningful.
 */
const ALL_REPORT_IDS: Record<ReportId, true> = {
  daily_collection: true,
  portfolio_summary: true,
  income_report: true,
  aging_report: true,
  borrower_report: true,
  disbursement_report: true,
  releases_list: true,
  repayments_list: true,
  due_past_due_list: true,
  statement_of_account: true,
  subsidiary_ledger: true,
  cash_flow: true,
  collection_efficiency: true,
  portfolio_by_product: true,
  share_capital: true,
  performance: true,
  provisioning: true,
};

test("every report id has its own reference prefix", () => {
  const at = new Date(2026, 7, 6, 9, 15);
  const seen = new Map<string, string>();

  for (const id of Object.keys(ALL_REPORT_IDS) as ReportId[]) {
    const reference = buildReference(id, at);
    // A missing entry would stamp "undefined-20260806-0915" on the document.
    assert.match(reference, /^[A-Z]{3}-20260806-0915$/, `${id} has no reference prefix`);

    const prefix = reference.slice(0, 3);
    assert.equal(
      seen.has(prefix),
      false,
      `${id} reuses the "${prefix}" prefix already taken by ${seen.get(prefix)}`
    );
    seen.set(prefix, id);
  }
});

// ---------------------------------------------------------------------------
// Cash Flow — inflows, outflows, and the net that is the point of the report
// ---------------------------------------------------------------------------

// Repayment components sum to `inflows.repayments.total` (1,013,651.50), which
// plus share capital gives `inflows.total` (1,110,151.50). The branch rows are
// loan cash ONLY — share capital has no branch column — so they sum to the
// repayment total, NOT to the statement total.
const CASH_FLOW_PAYLOAD = {
  date_from: "2026-08-01",
  date_to: "2026-08-06",
  inflows: {
    repayments: {
      principal: 812400.25,
      interest: 184300.5,
      penalty: 12750.75,
      overpayment: 4200,
      total: 1013651.5,
      count: 214,
    },
    share_capital_credit: 96500,
    total: 1110151.5,
  },
  outflows: {
    releases: { net_proceeds: 742800.4, total: 742800.4, count: 18 },
    share_capital_debit: 31500,
    total: 774300.4,
  },
  net_movement: 335851.1,
  non_cash: {
    principal_released: 801221,
    total_deductions: 58420.6,
    note: "Deductions are withheld at release and never leave the till; principal_released = net_proceeds + total_deductions.",
  },
  share_capital: {
    branch_scope: "organisation",
    credit: 96500,
    debit: 31500,
    net_movement: 65000,
    count: 41,
    note: "share_capital_ledger has no branch column, so these figures are organisation-wide and are excluded from by_branch.",
  },
  by_branch: [
    {
      branch_id: 1,
      branch_name: "Main",
      inflow_principal: 578400.25,
      inflow_interest: 131200.5,
      inflow_penalty: 8649.5,
      inflow_overpayment: 2200,
      inflow_total: 720450.25,
      repayment_count: 151,
      outflow_net_proceeds: 512800.4,
      outflow_total: 512800.4,
      release_count: 12,
      total_deductions: 40120.6,
      net_movement: 207649.85,
    },
    {
      branch_id: 2,
      branch_name: "Talisay",
      inflow_principal: 234000,
      inflow_interest: 53100,
      inflow_penalty: 4101.25,
      inflow_overpayment: 2000,
      inflow_total: 293201.25,
      repayment_count: 63,
      outflow_net_proceeds: 230000,
      outflow_total: 230000,
      release_count: 6,
      total_deductions: 18300,
      net_movement: 63201.25,
    },
  ],
  generated_at: "2026-08-06 09:15:00",
};

test("cash flow leads with money in, money out, and the net", () => {
  const doc = buildCashFlowDoc(CASH_FLOW_PAYLOAD, RANGE);

  assertNoDashes(doc);
  assert.equal(doc.reportId, "cash_flow");
  assert.equal(kpiValue(doc, "Total Cash In"), "₱1,110,151.50");
  assert.equal(kpiValue(doc, "Total Cash Out"), "₱774,300.40");
  assert.equal(kpiValue(doc, "Net Movement"), "₱335,851.10");
  assert.equal(kpiValue(doc, "Non-Cash Deductions"), "₱58,420.60");
  // principal_released = net_proceeds + total_deductions, so the hint gives the
  // reader the gross figure the release line nets down from.
  assert.equal(
    kpi(doc, "Non-Cash Deductions").hint,
    "Withheld from ₱801,221.00 principal released"
  );
});

test("cash flow itemises both sides of the statement", () => {
  const doc = buildCashFlowDoc(CASH_FLOW_PAYLOAD, RANGE);
  const inflows = namedTable(doc, "Cash Inflows");
  const outflows = namedTable(doc, "Cash Outflows");

  assert.deepEqual(
    inflows.rows.map((r) => r.particulars),
    [
      "Principal collected",
      "Interest collected",
      "Penalty collected",
      "Overpayment received",
      "Share capital contributions",
    ]
  );
  assert.equal(inflows.rows[0].amount, 812400.25);
  assert.equal(outflows.rows[0].particulars, "Loan releases (net proceeds)");
  assert.equal(outflows.rows[0].amount, 742800.4);

  // The footer states what the block adds up to, labelled, not just "Total".
  assert.equal(
    inflows.totals?.find((t) => t.column === "amount")?.label,
    "Total Cash Inflows"
  );
  assert.equal(namedTableTotal(doc, "Cash Inflows", "amount"), "₱1,110,151.50");
  assert.equal(namedTableTotal(doc, "Cash Outflows", "amount"), "₱774,300.40");
});

test("the net movement is restated as its own block, not left as one KPI", () => {
  const doc = buildCashFlowDoc(CASH_FLOW_PAYLOAD, RANGE);

  assert.equal(fieldValue(doc, "Net Cash Movement", "Total cash inflows"), "₱1,110,151.50");
  assert.equal(
    fieldValue(doc, "Net Cash Movement", "Less: total cash outflows"),
    "₱774,300.40"
  );
  assert.equal(
    fieldValue(doc, "Net Cash Movement", "Net movement for the period"),
    "₱335,851.10"
  );
});

test("cash flow reads the repayment components out of their nested block", () => {
  const doc = buildCashFlowDoc(CASH_FLOW_PAYLOAD, RANGE);
  const inflows = namedTable(doc, "Cash Inflows");

  // The components live under `inflows.repayments`, not flat on `inflows` —
  // reading them flat dashed every line while the totals still looked right.
  assert.equal(inflows.rows[0].amount, 812400.25);
  assert.equal(inflows.rows[3].amount, 4200);
  assert.equal(inflows.rows[4].amount, 96500);
  // `outflows.total` includes share capital; only `releases.net_proceeds` is
  // the release line, so reading the wrong one double-counts the withdrawal.
  assert.equal(namedTable(doc, "Cash Outflows").rows[0].amount, 742800.4);
  assert.equal(namedTable(doc, "Cash Outflows").rows[1].amount, 31500);
});

test("cash flow still reads a flat payload that never nested the components", () => {
  const doc = buildCashFlowDoc(
    {
      inflows: { principal: 100.25, interest: 20.5, share_capital_credit: 5 },
      outflows: { net_proceeds: 60.75 },
    },
    RANGE
  );

  assert.equal(namedTable(doc, "Cash Inflows").rows[0].amount, 100.25);
  assert.equal(namedTable(doc, "Cash Outflows").rows[0].amount, 60.75);
  assert.equal(kpiValue(doc, "Total Cash In"), "₱125.75");
});

test("cash flow derives the net when the API states only the two totals", () => {
  const { net_movement, ...withoutNet } = CASH_FLOW_PAYLOAD;
  void net_movement;
  const doc = buildCashFlowDoc(withoutNet, RANGE);

  assert.equal(kpiValue(doc, "Net Movement"), "₱335,851.10");
});

test("cash flow totals the components when a block sends no total", () => {
  const doc = buildCashFlowDoc(
    {
      inflows: { repayments: { principal: 100.25, interest: 20.5 } },
      outflows: { releases: { net_proceeds: 60.75 } },
    },
    RANGE
  );

  assert.equal(kpiValue(doc, "Total Cash In"), "₱120.75");
  assert.equal(kpiValue(doc, "Total Cash Out"), "₱60.75");
  assert.equal(kpiValue(doc, "Net Movement"), "₱60.00");
});

test("a negative net movement is toned as a loss, a positive one as a gain", () => {
  const outflowHeavy = buildCashFlowDoc(
    { inflows: { total: 100 }, outflows: { total: 250 }, net_movement: -150 },
    RANGE
  );
  assert.equal(kpiValue(outflowHeavy, "Net Movement"), "-₱150.00");
  assert.equal(kpi(outflowHeavy, "Net Movement").tone, "negative");
  assert.equal(kpi(buildCashFlowDoc(CASH_FLOW_PAYLOAD, RANGE), "Net Movement").tone, "positive");
});

test("cash flow breaks down by branch and says why it will not reconcile", () => {
  const doc = buildCashFlowDoc(CASH_FLOW_PAYLOAD, RANGE);
  const table = namedTable(doc, "Breakdown by Branch");

  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0].branch_name, "Main");
  // Loan cash only: this equals inflows.repayments.total (1,013,651.50), NOT
  // inflows.total (1,110,151.50) — the difference is the share capital credit.
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "inflows"), "₱1,013,651.50");
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "outflows"), "₱742,800.40");
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "net"), "₱270,851.10");

  // The server explains the gap in its own words; the builder prints them.
  const note = noteText(doc);
  assert.ok(note, "expected the share capital scoping note");
  assert.match(note!, /no branch column/);
  assert.equal(note, CASH_FLOW_PAYLOAD.share_capital.note);
});

test("the branch rows are loan cash only and say so rather than appearing wrong", () => {
  const doc = buildCashFlowDoc(CASH_FLOW_PAYLOAD, RANGE);
  const branchInflows = namedTableTotal(doc, "Breakdown by Branch", "inflows");

  // A reader who adds the branch column and compares it to the headline must
  // find the discrepancy explained, not left to guess at a bug.
  assert.notEqual(branchInflows, kpiValue(doc, "Total Cash In"));
  assert.equal(branchInflows, "₱1,013,651.50");
  assert.ok(noteText(doc));
});

test("cash flow omits the branch table when the API sends no branches", () => {
  const { by_branch, ...withoutBranches } = CASH_FLOW_PAYLOAD;
  void by_branch;
  const doc = buildCashFlowDoc(withoutBranches, RANGE);

  assert.equal(hasTable(doc, "Breakdown by Branch"), false);
  // Nothing to reconcile, so no caveat to explain.
  assert.equal(noteText(doc), null);
});

test("a failed cash flow request still renders the statement shell", () => {
  const doc = buildCashFlowDoc(null, RANGE);

  assert.equal(kpiValue(doc, "Total Cash In"), DASH);
  assert.equal(kpiValue(doc, "Net Movement"), DASH);
  // The lines still stand, so the document reads as a statement with unknown
  // figures rather than as an error page.
  assert.equal(namedTable(doc, "Cash Inflows").rows.length, 5);
  assert.equal(namedTableTotal(doc, "Cash Inflows", "amount"), DASH);
  assert.equal(fieldValue(doc, "Net Cash Movement", "Net movement for the period"), DASH);
});

// ---------------------------------------------------------------------------
// Collection Efficiency — the same ratio, segmented two ways
// ---------------------------------------------------------------------------

// Both breakdowns sum to the headline figures, so the footers can be asserted
// against them.
const EFFICIENCY_PAYLOAD = {
  date_from: "2026-08-01",
  date_to: "2026-08-06",
  total_due: 1250400.5,
  total_collected: 1063840.25,
  collection_rate: 85.08,
  uncollected: 186560.25,
  by_branch: [
    {
      branch_id: 1,
      branch_name: "Main",
      total_due: 820300.5,
      total_collected: 731200.25,
      collection_rate: 89.14,
      uncollected: 89100.25,
    },
    {
      branch_id: 2,
      branch_name: "Talisay",
      total_due: 430100,
      total_collected: 332640,
      collection_rate: 77.34,
      uncollected: 97460,
    },
  ],
  // One row per calendar month, clamped to the range at both ends. July
  // deliberately exceeds 100%: arrears billed in June were settled in July, so
  // July collected more than July billed. That is a timing effect, not a bug.
  by_period: [
    {
      period: "2026-06",
      label: "Jun 2026",
      date_from: "2026-06-01",
      date_to: "2026-06-30",
      total_due: 402100.25,
      total_collected: 300000,
      collection_rate: 74.61,
      uncollected: 102100.25,
    },
    {
      period: "2026-07",
      label: "Jul 2026",
      date_from: "2026-07-01",
      date_to: "2026-07-31",
      total_due: 418200.25,
      total_collected: 493360.25,
      collection_rate: 117.97,
      uncollected: 0,
    },
    {
      period: "2026-08",
      label: "Aug 2026",
      date_from: "2026-08-01",
      date_to: "2026-08-06",
      total_due: 430100,
      total_collected: 270480,
      collection_rate: 62.89,
      uncollected: 159620,
    },
  ],
  note: "Both sides of every ratio are scoped identically (loan status + branch). A by_period rate above 100% is a timing effect — arrears from an earlier bucket settled in a later one — not double counting.",
  generated_at: "2026-08-06 09:15:00",
};

test("collection efficiency reports the headline ratio as the server sent it", () => {
  const doc = buildCollectionEfficiencyDoc(EFFICIENCY_PAYLOAD, RANGE);

  assertNoDashes(doc);
  assert.equal(doc.reportId, "collection_efficiency");
  assert.equal(kpiValue(doc, "Total Due"), "₱1,250,400.50");
  assert.equal(kpiValue(doc, "Total Collected"), "₱1,063,840.25");
  // 85.08 rounds to one decimal for display; the value itself is untouched.
  assert.equal(kpiValue(doc, "Collection Efficiency"), "85.1%");
  assert.equal(kpiValue(doc, "Uncollected"), "₱186,560.25");
});

test("collection efficiency renders the branch and the monthly breakdown", () => {
  const doc = buildCollectionEfficiencyDoc(EFFICIENCY_PAYLOAD, RANGE);
  const branches = namedTable(doc, "Efficiency by Branch");
  const periods = namedTable(doc, "Monthly Trend");

  assert.equal(branches.rows.length, 2);
  assert.equal(branches.rows[0].label, "Main");
  assert.equal(branches.rows[0].collection_rate, 89.14);

  assert.equal(periods.rows.length, 3);
  // The API sends a human label beside the raw period key; prefer it.
  assert.deepEqual(
    periods.rows.map((r) => r.label),
    ["Jun 2026", "Jul 2026", "Aug 2026"]
  );
  assert.equal(namedTableTotal(doc, "Monthly Trend", "total_collected"), "₱1,063,840.25");
});

test("a monthly bucket over 100% is printed as-is, never clamped", () => {
  const doc = buildCollectionEfficiencyDoc(EFFICIENCY_PAYLOAD, RANGE);
  const july = namedTable(doc, "Monthly Trend").rows[1];

  // Arrears billed in June and settled in July make July collect more than
  // July billed. Clamping this to 100% would hide a real recovery — and the
  // scoping guard that keeps the PERIOD rate honest does not apply per month.
  assert.equal(july.collection_rate, 117.97);
  assert.equal(formatValue(july.collection_rate, "percent"), "118.0%");
  assert.ok((july.total_collected as number) > (july.total_due as number));
});

test("collection efficiency prints the server's explanation of the ratio", () => {
  const doc = buildCollectionEfficiencyDoc(EFFICIENCY_PAYLOAD, RANGE);

  // Without this a reader meets a 118% month with no way to tell a timing
  // effect from double counting.
  assert.equal(noteText(doc), EFFICIENCY_PAYLOAD.note);
  assert.match(noteText(doc)!, /above 100% is a timing effect/);
});

test("collection efficiency omits the note when the API sends none", () => {
  const { note, ...withoutNote } = EFFICIENCY_PAYLOAD;
  void note;
  assert.equal(noteText(buildCollectionEfficiencyDoc(withoutNote, RANGE)), null);
});

test("the efficiency footer is the period rate, never the average of the rows", () => {
  const doc = buildCollectionEfficiencyDoc(EFFICIENCY_PAYLOAD, RANGE);

  // Averaging 89.14 and 77.34 would print 83.2% and weight a small branch the
  // same as a large one.
  assert.equal(namedTableTotal(doc, "Efficiency by Branch", "collection_rate"), "85.1%");
  assert.equal(namedTableTotal(doc, "Efficiency by Branch", "total_due"), "₱1,250,400.50");
  assert.equal(namedTableTotal(doc, "Efficiency by Branch", "uncollected"), "₱186,560.25");
});

test("a row without a rate falls back to collected over due", () => {
  const doc = buildCollectionEfficiencyDoc(
    {
      ...EFFICIENCY_PAYLOAD,
      by_branch: [{ branch_name: "Silay", total_due: 200, total_collected: 150 }],
    },
    RANGE
  );
  const row = namedTable(doc, "Efficiency by Branch").rows[0];

  assert.equal(row.collection_rate, 75);
  assert.equal(row.uncollected, 50);
});

test("an unnamed branch is labelled rather than left blank", () => {
  const doc = buildCollectionEfficiencyDoc(
    { ...EFFICIENCY_PAYLOAD, by_branch: [{ total_due: 10, total_collected: 10 }] },
    RANGE
  );
  assert.equal(namedTable(doc, "Efficiency by Branch").rows[0].label, "Unassigned");
});

test("a failed collection efficiency request still renders both tables", () => {
  const doc = buildCollectionEfficiencyDoc(null, RANGE);

  assert.equal(kpiValue(doc, "Total Due"), DASH);
  assert.equal(kpiValue(doc, "Collection Efficiency"), DASH);
  assert.equal(namedTable(doc, "Efficiency by Branch").rows.length, 0);
  assert.equal(namedTable(doc, "Monthly Trend").rows.length, 0);
  assert.equal(namedTable(doc, "Monthly Trend").totals, undefined);
});

// ---------------------------------------------------------------------------
// Loan Portfolio by Product
// ---------------------------------------------------------------------------

// The product rows sum exactly to `totals` — the derived-table join on the
// backend exists so that they do.
const PRODUCT_PAYLOAD = {
  as_of_date: "2026-08-06",
  par_threshold_days: 30,
  products: [
    {
      loan_product_id: 1,
      product_name: "Salary Loan",
      loan_count: 128,
      total_released: 4820500.5,
      outstanding: 2914300.25,
      outstanding_principal: 2810400,
      avg_interest_rate: 2.5,
      overdue_amount: 184200.75,
      at_risk_amount: 177617.28,
      par_ratio: 6.32,
      portfolio_share: 53,
    },
    {
      loan_product_id: 2,
      product_name: "Business Loan",
      loan_count: 46,
      total_released: 3210000,
      outstanding: 2105400.5,
      outstanding_principal: 2020100.25,
      avg_interest_rate: 3,
      overdue_amount: 298650.25,
      at_risk_amount: 286450.21,
      par_ratio: 14.18,
      portfolio_share: 35.29,
    },
    {
      loan_product_id: 3,
      product_name: "Emergency Loan",
      loan_count: 212,
      total_released: 1064500.25,
      outstanding: 402100.75,
      outstanding_principal: 390200.5,
      avg_interest_rate: 1.5,
      overdue_amount: 41200,
      at_risk_amount: 39995.55,
      par_ratio: 10.25,
      portfolio_share: 11.71,
    },
  ],
  totals: {
    product_count: 3,
    loan_count: 386,
    total_released: 9095000.75,
    outstanding: 5421801.5,
    outstanding_principal: 5220700.75,
    avg_interest_rate: 2.02,
    overdue_amount: 524051,
    at_risk_amount: 504063.04,
    par_ratio: 9.66,
  },
  generated_at: "2026-08-06 09:15:00",
};

test("portfolio by product summarises the whole book, then lists each product", () => {
  const doc = buildPortfolioByProductDoc(PRODUCT_PAYLOAD, RANGE);
  const table = namedTable(doc, "Portfolio by Product");

  assertNoDashes(doc);
  assert.equal(doc.reportId, "portfolio_by_product");
  assert.equal(kpiValue(doc, "Loan Products"), "3");
  assert.equal(kpi(doc, "Loan Products").hint, "386 loans");
  assert.equal(kpiValue(doc, "Total Released"), "₱9,095,000.75");
  assert.equal(kpiValue(doc, "Outstanding Balance"), "₱5,421,801.50");
  assert.equal(kpiValue(doc, "Overdue Amount"), "₱524,051.00");

  assert.equal(table.rows.length, 3);
  assert.equal(table.rows[0].product_name, "Salary Loan");
  assert.equal(table.rows[0].par_ratio, 6.32);
});

test("portfolio by product prefers the server totals over the rows", () => {
  const doc = buildPortfolioByProductDoc(
    {
      ...PRODUCT_PAYLOAD,
      totals: { ...PRODUCT_PAYLOAD.totals, total_released: 9999999 },
    },
    RANGE
  );

  assert.equal(kpiValue(doc, "Total Released"), "₱9,999,999.00");
  assert.equal(namedTableTotal(doc, "Portfolio by Product", "total_released"), "₱9,999,999.00");
});

test("portfolio by product sums the rows when the API sends no totals block", () => {
  const { totals, ...withoutTotals } = PRODUCT_PAYLOAD;
  void totals;
  const doc = buildPortfolioByProductDoc(withoutTotals, RANGE);

  assert.equal(kpiValue(doc, "Loan Products"), "3");
  assert.equal(kpiValue(doc, "Total Released"), "₱9,095,000.75");
  assert.equal(namedTableTotal(doc, "Portfolio by Product", "loan_count"), "386");
  assert.equal(namedTableTotal(doc, "Portfolio by Product", "overdue_amount"), "₱524,051.00");
});

test("portfolio by product renders each product's share of the book", () => {
  const doc = buildPortfolioByProductDoc(PRODUCT_PAYLOAD, RANGE);
  const table = namedTable(doc, "Portfolio by Product");

  // Which product dominates is the question this report exists to answer, and
  // the server already computed the share — it was being fetched and dropped.
  assert.deepEqual(
    table.rows.map((r) => r.portfolio_share),
    [53, 35.29, 11.71]
  );
  // Shares share a denominator, so unlike the rate columns they do total.
  assert.equal(namedTableTotal(doc, "Portfolio by Product", "portfolio_share"), "100.0%");
});

test("the weighted PAR and average rate are quoted as hints, not column totals", () => {
  const doc = buildPortfolioByProductDoc(PRODUCT_PAYLOAD, RANGE);

  // Server-weighted over the whole book, with the PAR window it was measured
  // against — averaging 6.32 / 14.18 / 10.25 would give 10.25%, not 9.66%.
  assert.equal(kpi(doc, "Overdue Amount").hint, "PAR 9.7% (>30d)");
  assert.equal(kpi(doc, "Total Released").hint, "Avg rate 2.0%");
});

test("neither PAR nor the average rate is totalled across products", () => {
  const totals = namedTable(buildPortfolioByProductDoc(PRODUCT_PAYLOAD, RANGE), "Portfolio by Product")
    .totals;

  assert.equal(totals?.some((t) => t.column === "par_ratio"), false);
  assert.equal(totals?.some((t) => t.column === "avg_interest_rate"), false);
});

test("a product row with no name is labelled rather than left blank", () => {
  const doc = buildPortfolioByProductDoc({ products: [{ loan_count: 4 }] }, RANGE);
  assert.equal(namedTable(doc, "Portfolio by Product").rows[0].product_name, "Unassigned");
});

test("a failed portfolio-by-product request dashes every figure", () => {
  const doc = buildPortfolioByProductDoc(null, RANGE);

  // Zero products is a claim the failed request cannot support.
  assert.equal(kpiValue(doc, "Loan Products"), DASH);
  assert.equal(kpiValue(doc, "Total Released"), DASH);
  assert.equal(namedTable(doc, "Portfolio by Product").rows.length, 0);
});

test("an empty product list is a real zero, not an unknown", () => {
  const doc = buildPortfolioByProductDoc({ products: [] }, RANGE);
  assert.equal(kpiValue(doc, "Loan Products"), "0");
});

// ---------------------------------------------------------------------------
// Share Capital
// ---------------------------------------------------------------------------

// closing = opening + credits − debits, both breakdowns sum to the period
// credits/debits, and the member rows carry their own opening balance so
// opening + credits − debits closes each row too.
const SHARE_CAPITAL_PAYLOAD = {
  date_from: "2026-06-01",
  date_to: "2026-08-06",
  branch_scope: "organisation",
  opening_balance: 2450000,
  credits: 386500.5,
  debits: 74200.25,
  net_movement: 312300.25,
  closing_balance: 2762300.25,
  entry_count: 402,
  // Members still HOLDING capital at date_to …
  member_count: 214,
  // … versus members whose balance MOVED in the period. Different populations.
  members_with_activity: 37,
  subscription: {
    pledged_member_count: 198,
    auto_credit_member_count: 143,
    total_subscribed_per_period: 99000,
    total_paid_in: 2762300.25,
    by_schedule: [
      { schedule: "15th", member_count: 120, amount: 60000 },
      { schedule: "30th", member_count: 78, amount: 39000 },
    ],
    note: "total_subscribed_per_period is the sum of PER-SCHEDULE pledges (15th / 30th / both), not a lump-sum subscription, so it is not directly comparable to total_paid_in.",
  },
  by_month: [
    {
      period: "2026-06",
      label: "Jun 2026",
      date_from: "2026-06-01",
      date_to: "2026-06-30",
      credits: 128400.5,
      debits: 21000,
      net_movement: 107400.5,
      closing_balance: 2557400.5,
    },
    {
      period: "2026-07",
      label: "Jul 2026",
      date_from: "2026-07-01",
      date_to: "2026-07-31",
      credits: 131600,
      debits: 28200.25,
      net_movement: 103399.75,
      closing_balance: 2660800.25,
    },
    {
      period: "2026-08",
      label: "Aug 2026",
      date_from: "2026-08-01",
      date_to: "2026-08-06",
      credits: 126500,
      debits: 25000,
      net_movement: 101500,
      closing_balance: 2762300.25,
    },
  ],
  // Present only for callers holding `reports:export`; see the omitted-roster
  // fixture below for what every other role receives.
  by_member: [
    {
      borrower_id: 5,
      borrower_code: "MB-0005",
      full_name: "Maria Santos",
      opening_balance: 78500,
      credits: 18000,
      debits: 0,
      net_movement: 18000,
      closing_balance: 96500,
    },
    {
      borrower_id: 8,
      borrower_code: "MB-0008",
      full_name: "Jose Dela Cruz",
      opening_balance: 53700,
      credits: 12500.5,
      debits: 5000,
      net_movement: 7500.5,
      closing_balance: 61200.5,
    },
  ],
  generated_at: "2026-08-06 09:15:00",
};

test("share capital opens and closes the period", () => {
  const doc = buildShareCapitalDoc(SHARE_CAPITAL_PAYLOAD, RANGE);

  assertNoDashes(doc);
  assert.equal(doc.reportId, "share_capital");
  assert.equal(kpiValue(doc, "Opening Balance"), "₱2,450,000.00");
  assert.equal(kpiValue(doc, "Total Credits"), "₱386,500.50");
  assert.equal(kpiValue(doc, "Total Debits"), "₱74,200.25");
  assert.equal(kpiValue(doc, "Closing Balance"), "₱2,762,300.25");
});

test("share capital keeps holders and movers as the different counts they are", () => {
  const doc = buildShareCapitalDoc(SHARE_CAPITAL_PAYLOAD, RANGE);

  // 214 members hold capital; only 37 of them moved this period. Swapping
  // these two understates the membership by a factor of six.
  assert.equal(fieldValue(doc, "Subscription Status", "Members holding share capital"), "214");
  assert.equal(
    fieldValue(doc, "Subscription Status", "Members with movement this period"),
    "37"
  );
  assert.equal(fieldValue(doc, "Subscription Status", "Ledger entries posted"), "402");
});

test("share capital reads the subscription block the API actually sends", () => {
  const doc = buildShareCapitalDoc(SHARE_CAPITAL_PAYLOAD, RANGE);

  assert.equal(fieldValue(doc, "Subscription Status", "Pledged per period"), "₱99,000.00");
  assert.equal(
    fieldValue(doc, "Subscription Status", "Total paid in to date"),
    "₱2,762,300.25"
  );
  assert.equal(fieldValue(doc, "Subscription Status", "Members with an active pledge"), "198");
  assert.equal(fieldValue(doc, "Subscription Status", "Of which on auto-credit"), "143");
});

test("the per-period pledge is never netted against paid-in capital", () => {
  const doc = buildShareCapitalDoc(SHARE_CAPITAL_PAYLOAD, RANGE);
  const labels = fieldItems(doc, "Subscription Status").map((f) => f.label);

  // ₱99,000 is a RECURRING per-schedule commitment, not a lump sum, so
  // "unpaid subscription = 99,000 − 2,762,300.25" is meaningless. The field
  // must not exist at all.
  assert.equal(labels.includes("Unpaid subscription"), false);
  assert.equal(labels.includes("Total subscribed"), false);

  // And the server's explanation of why is printed, not paraphrased.
  const notes = doc.sections.filter((sec) => sec.kind === "note");
  assert.ok(
    notes.some(
      (n) => n.kind === "note" && n.text === SHARE_CAPITAL_PAYLOAD.subscription.note
    ),
    "expected the per-schedule pledge note"
  );
});

test("share capital derives the closing balance when the API omits it", () => {
  const doc = buildShareCapitalDoc(
    { opening_balance: 2450000, credits: 386500.5, debits: 74200.25 },
    RANGE
  );

  assert.equal(kpiValue(doc, "Closing Balance"), "₱2,762,300.25");
});

test("share capital totals the monthly and per-member movement", () => {
  const doc = buildShareCapitalDoc(SHARE_CAPITAL_PAYLOAD, RANGE);
  const months = namedTable(doc, "Monthly Movement");
  const members = namedTable(doc, "Movement by Member");

  assert.equal(months.rows.length, 3);
  // The API sends a human label alongside the raw period key; prefer it.
  assert.equal(months.rows[0].label, "Jun 2026");
  assert.equal(months.rows[2].closing_balance, 2762300.25);
  assert.equal(namedTableTotal(doc, "Monthly Movement", "credits"), "₱386,500.50");
  assert.equal(namedTableTotal(doc, "Monthly Movement", "debits"), "₱74,200.25");
  assert.equal(namedTableTotal(doc, "Monthly Movement", "net"), "₱312,300.25");

  assert.equal(members.rows.length, 2);
  assert.equal(members.rows[0].member_name, "Maria Santos");
  assert.equal(members.rows[0].member_no, "MB-0005");
  // A member row is a ledger line: opening + credits − debits = closing.
  assert.equal(members.rows[0].opening_balance, 78500);
  assert.equal(members.rows[0].balance, 96500);
  assert.equal(namedTableTotal(doc, "Movement by Member", "opening_balance"), "₱132,200.00");
  assert.equal(namedTableTotal(doc, "Movement by Member", "balance"), "₱157,700.50");
});

test("a running closing balance is never totalled", () => {
  const totals = namedTable(
    buildShareCapitalDoc(SHARE_CAPITAL_PAYLOAD, RANGE),
    "Monthly Movement"
  ).totals;
  assert.equal(totals?.some((t) => t.column === "closing_balance"), false);
});

test("share capital states when it was scoped to one branch", () => {
  const orgWide = buildShareCapitalDoc(SHARE_CAPITAL_PAYLOAD, RANGE);
  const branchScoped = buildShareCapitalDoc(
    { ...SHARE_CAPITAL_PAYLOAD, branch_scope: "borrower_branch" },
    RANGE
  );

  const scopeNote = (doc: ReportDocument) =>
    doc.sections.some(
      (sec) => sec.kind === "note" && /Scoped to the selected branch/.test(sec.text)
    );

  // `branch_id` IS honoured, via the member's branch — so when it was applied
  // the report says so rather than reading as organisation-wide.
  assert.equal(scopeNote(branchScoped), true);
  assert.equal(scopeNote(orgWide), false);
});

// What a `collector` or `viewer` receives: identical aggregates, no roster.
// `by_member` is null rather than [] — an empty array would assert that no
// member holds share capital, which `member_count: 214` flatly contradicts.
const SHARE_CAPITAL_ROSTER_OMITTED = (() => {
  const { by_member, ...rest } = SHARE_CAPITAL_PAYLOAD;
  void by_member;
  return {
    ...rest,
    by_member: null,
    by_member_omitted: {
      reason: "permission_required",
      required_permission: "reports:export",
      message:
        "Per-member share capital holdings are limited to roles that can export reports. " +
        "Every aggregate figure in this report is complete and unaffected.",
    },
  };
})();

test("a withheld member roster is explained, not rendered as an empty table", () => {
  const doc = buildShareCapitalDoc(SHARE_CAPITAL_ROSTER_OMITTED, RANGE);

  // The table must be GONE, not empty. Rendering it would print "No member
  // share capital activity was recorded in this period." to a collector — a
  // false statement, and one the KPI grid above it contradicts.
  assert.equal(hasTable(doc, "Movement by Member"), false);

  const notes = doc.sections.filter((sec) => sec.kind === "note");
  assert.ok(
    notes.some(
      (n) =>
        n.kind === "note" &&
        n.text === SHARE_CAPITAL_ROSTER_OMITTED.by_member_omitted.message
    ),
    "expected the server's omission message in place of the table"
  );
});

test("withholding the roster leaves every aggregate untouched", () => {
  const full = buildShareCapitalDoc(SHARE_CAPITAL_PAYLOAD, RANGE);
  const gated = buildShareCapitalDoc(SHARE_CAPITAL_ROSTER_OMITTED, RANGE);

  // The permission gates the roster, nothing else — so the headline figures
  // and the subscription block must be byte-identical between the two roles.
  const grid = (doc: ReportDocument) =>
    doc.sections.find((sec) => sec.kind === "kpi_grid");
  assert.deepEqual(grid(gated), grid(full));
  assert.deepEqual(
    fieldItems(gated, "Subscription Status"),
    fieldItems(full, "Subscription Status")
  );
  assert.deepEqual(
    namedTable(gated, "Monthly Movement"),
    namedTable(full, "Monthly Movement")
  );
  // member_count is an aggregate and stays correct without the roster.
  assert.equal(
    fieldValue(gated, "Subscription Status", "Members holding share capital"),
    "214"
  );
});

test("a genuinely empty roster still reads as empty, not as withheld", () => {
  // [] with no omission block is the authorised caller seeing a cooperative
  // with no share capital holders. That IS the empty state.
  const doc = buildShareCapitalDoc({ ...SHARE_CAPITAL_PAYLOAD, by_member: [] }, RANGE);
  const table = namedTable(doc, "Movement by Member");

  assert.equal(table.rows.length, 0);
  assert.equal(table.totals, undefined);
  assert.match(table.emptyText!, /No member share capital activity/);
});

test("a failed share capital request still renders the shell", () => {
  const doc = buildShareCapitalDoc(null, RANGE);

  assert.equal(kpiValue(doc, "Opening Balance"), DASH);
  assert.equal(kpiValue(doc, "Closing Balance"), DASH);
  assert.equal(fieldValue(doc, "Subscription Status", "Pledged per period"), DASH);
  assert.equal(fieldValue(doc, "Subscription Status", "Members holding share capital"), DASH);
  assert.equal(namedTable(doc, "Monthly Movement").rows.length, 0);
});

// ---------------------------------------------------------------------------
// Officer / Branch Performance
// ---------------------------------------------------------------------------

// There is NO grand-total block in this response. Officer rows and branch rows
// each cover the same book, so both sum to the same headline figures — that is
// what makes summing them exact rather than a guess.
const PERFORMANCE_PAYLOAD = {
  date_from: "2026-08-01",
  date_to: "2026-08-06",
  as_of_date: "2026-08-06",
  par_threshold_days: 30,
  by_officer: [
    {
      account_officer_id: 3,
      account_officer_name: "A. Maputol",
      loan_count: 61,
      released_count: 42,
      released_amount: 2140500.5,
      collected: 1480200.25,
      payment_count: 310,
      outstanding: 1284300.75,
      outstanding_principal: 1210400.5,
      overdue_amount: 96400.5,
      at_risk_amount: 90780.25,
      par_ratio: 7.5,
      active_borrowers: 38,
    },
    {
      account_officer_id: 7,
      account_officer_name: "R. Villanueva",
      loan_count: 44,
      released_count: 27,
      released_amount: 1305200.25,
      collected: 902450,
      payment_count: 194,
      outstanding: 812400.5,
      outstanding_principal: 760300.25,
      overdue_amount: 148900.25,
      at_risk_amount: 139380.1,
      par_ratio: 18.33,
      active_borrowers: 24,
    },
    {
      // A real row, not a gap: loans with no officer are still portfolio, and
      // dropping them stops the rows reconciling to the book.
      account_officer_id: null,
      account_officer_name: "Unassigned",
      loan_count: 9,
      released_count: 5,
      released_amount: 210000,
      collected: 98200,
      payment_count: 21,
      outstanding: 175400.25,
      outstanding_principal: 165000,
      overdue_amount: 12400,
      at_risk_amount: 9200,
      par_ratio: 5.58,
      active_borrowers: 4,
    },
  ],
  by_branch: [
    {
      branch_id: 1,
      branch_name: "Main",
      loan_count: 78,
      released_count: 51,
      released_amount: 2740500.75,
      collected: 1902650.25,
      payment_count: 386,
      outstanding: 1584300.5,
      outstanding_principal: 1490200.25,
      overdue_amount: 181200.75,
      at_risk_amount: 170500.4,
      par_ratio: 11.44,
      active_borrowers: 46,
    },
    {
      branch_id: 2,
      branch_name: "Talisay",
      loan_count: 36,
      released_count: 23,
      released_amount: 915200,
      collected: 578200,
      payment_count: 139,
      outstanding: 687801,
      outstanding_principal: 645500.5,
      overdue_amount: 76500,
      at_risk_amount: 68859.95,
      par_ratio: 12.51,
      active_borrowers: 20,
    },
  ],
  note: "released_* and collected cover date_from..date_to; outstanding, overdue, at_risk and active_borrowers are as_of_date figures over the whole book.",
  generated_at: "2026-08-06 09:15:00",
};

test("performance sums its headline from the rows, since the API sends no totals", () => {
  const doc = buildPerformanceDoc(PERFORMANCE_PAYLOAD, RANGE);

  assertNoDashes(doc);
  assert.equal(doc.reportId, "performance");
  assert.equal(kpiValue(doc, "Loans Released"), "74");
  assert.equal(kpiValue(doc, "Amount Released"), "₱3,655,700.75");
  assert.equal(kpiValue(doc, "Total Collected"), "₱2,480,850.25");
  // Outstanding sums exactly (one loan, one officer); borrower counts do not,
  // which is why the fourth headline is this and not "Active Borrowers".
  assert.equal(kpiValue(doc, "Outstanding Balance"), "₱2,272,101.50");
});

test("the officer rows and the branch rows describe the same book", () => {
  const doc = buildPerformanceDoc(PERFORMANCE_PAYLOAD, RANGE);

  assert.equal(
    namedTableTotal(doc, "By Account Officer", "released_amount"),
    namedTableTotal(doc, "By Branch", "released_amount")
  );
  assert.equal(
    namedTableTotal(doc, "By Account Officer", "outstanding_balance"),
    namedTableTotal(doc, "By Branch", "outstanding_balance")
  );
  assert.equal(namedTableTotal(doc, "By Branch", "released_amount"), "₱3,655,700.75");
});

test("performance reports by officer and mirrors it by branch", () => {
  const doc = buildPerformanceDoc(PERFORMANCE_PAYLOAD, RANGE);
  const officers = namedTable(doc, "By Account Officer");
  const branches = namedTable(doc, "By Branch");

  assert.deepEqual(
    officers.rows.map((r) => r.label),
    ["A. Maputol", "R. Villanueva", "Unassigned"]
  );
  assert.equal(officers.rows[0].released_count, 42);
  assert.equal(officers.rows[0].collected_amount, 1480200.25);
  assert.equal(officers.rows[0].outstanding_balance, 1284300.75);
  assert.equal(officers.rows[0].active_borrowers, 38);

  assert.deepEqual(
    branches.rows.map((r) => r.label),
    ["Main", "Talisay"]
  );
});

test("the unassigned officer row is carried, never dropped", () => {
  const doc = buildPerformanceDoc(PERFORMANCE_PAYLOAD, RANGE);
  const rows = namedTable(doc, "By Account Officer").rows;
  const unassigned = rows.find((r) => r.label === "Unassigned");

  // account_officer_id is null on this row; the name is what the API sends and
  // the figures are real portfolio.
  assert.ok(unassigned, "the unassigned row must render");
  assert.equal(unassigned!.released_amount, 210000);
  // Without it the officer rows would be ₱210,000 short of the branch rows.
  assert.equal(namedTableTotal(doc, "By Account Officer", "released_amount"), "₱3,655,700.75");
});

test("a row mixing two clocks says which column is which", () => {
  const doc = buildPerformanceDoc(PERFORMANCE_PAYLOAD, RANGE);
  const headers = namedTable(doc, "By Account Officer").columns.map((c) => c.header);

  // Period production against an as-of-today book, in one row. Unlabelled, a
  // reader takes ₱2.1M released and ₱1.28M outstanding as the same loans.
  assert.equal(headers.includes("Amount Released (period)"), true);
  assert.equal(headers.includes("Collected (period)"), true);
  assert.equal(headers.includes("Outstanding (to date)"), true);
  assert.equal(headers.includes("PAR (to date)"), true);
  assert.equal(headers.includes("Borrowers (to date)"), true);

  // And the server's own sentence is printed under the tables.
  assert.equal(noteText(doc), PERFORMANCE_PAYLOAD.note);
});

test("the performance footer never averages PAR nor sums distinct borrowers", () => {
  const totals = namedTable(
    buildPerformanceDoc(PERFORMANCE_PAYLOAD, RANGE),
    "By Account Officer"
  ).totals;

  // Averaging 7.5 / 18.33 / 5.58 states a PAR the portfolio does not have, and
  // 38 + 24 + 4 double-counts any borrower served by two officers. The API
  // states neither as a grand total, so neither gets a footer.
  assert.equal(totals?.some((t) => t.column === "par_ratio"), false);
  assert.equal(totals?.some((t) => t.column === "active_borrowers"), false);
  // The money and the release counts do sum exactly.
  assert.equal(totals?.find((t) => t.column === "released_count")?.value, "74");
  assert.equal(totals?.find((t) => t.column === "overdue_amount")?.value, "₱257,700.75");
});

test("a loan with no account officer is reported, not dropped", () => {
  const doc = buildPerformanceDoc(
    { by_officer: [{ released_count: 3, released_amount: 45000 }] },
    RANGE
  );
  assert.equal(namedTable(doc, "By Account Officer").rows[0].label, "Unassigned");
});

test("a failed performance request still renders both tables", () => {
  const doc = buildPerformanceDoc(null, RANGE);

  assert.equal(kpiValue(doc, "Loans Released"), DASH);
  assert.equal(kpiValue(doc, "Amount Released"), DASH);
  assert.equal(kpiValue(doc, "Outstanding Balance"), DASH);
  assert.equal(namedTable(doc, "By Account Officer").rows.length, 0);
  assert.equal(namedTable(doc, "By Branch").rows.length, 0);
  // The two-clocks caveat still prints — it is about the columns, not the data.
  assert.match(noteText(doc)!, /cover the selected period/);
});

// ---------------------------------------------------------------------------
// Loan Loss Provisioning
// ---------------------------------------------------------------------------

// Bucket amounts match AGING_PAYLOAD's — this endpoint calls agingReport()
// rather than re-deriving the boundaries — and `buckets` is an OBJECT keyed by
// bucket, not an array. Each bucket carries the rate BOTH ways: `rate` as a
// fraction and `rate_percent` as whole percent.
const PROVISIONING_PAYLOAD = {
  as_of_date: "2026-08-06",
  buckets: {
    "1_30": {
      amount: 128450.5,
      count: 12,
      rate: 0.05,
      rate_percent: 5,
      required_allowance: 6422.53,
    },
    "31_60": {
      amount: 64200.25,
      count: 5,
      rate: 0.15,
      rate_percent: 15,
      required_allowance: 9630.04,
    },
    "61_90": {
      amount: 18900,
      count: 1,
      rate: 0.25,
      rate_percent: 25,
      required_allowance: 4725,
    },
    over_90: {
      amount: 240310.75,
      count: 9,
      rate: 0.5,
      rate_percent: 50,
      required_allowance: 120155.38,
    },
  },
  totals: {
    amount: 451861.5,
    // Distinct delinquent LOANS — NOT 12 + 5 + 1 + 9 = 27.
    count: 21,
    required_allowance: 140932.95,
    effective_rate: 31.19,
  },
  rates: { "1_30": 0.05, "31_60": 0.15, "61_90": 0.25, over_90: 0.5 },
  policy_note:
    "Provision rates are POLICY, not arithmetic. They are a class constant only because there is no settings table for them yet; each cooperative board may set its own ladder.",
  generated_at: "2026-08-06 09:15:00",
};

test("provisioning states the overdue book and what must be set aside against it", () => {
  const doc = buildProvisioningDoc(PROVISIONING_PAYLOAD, RANGE);

  assertNoDashes(doc);
  assert.equal(doc.reportId, "provisioning");
  assert.equal(kpiValue(doc, "Total Overdue"), "₱451,861.50");
  assert.equal(kpiValue(doc, "Required Allowance"), "₱140,932.95");
  // The server's own weighted figure, not the mean of 5 / 15 / 25 / 50.
  assert.equal(kpiValue(doc, "Effective Provision Rate"), "31.2%");
  // Distinct delinquent loans, so 21 rather than the 27 bucket counts sum to.
  assert.equal(kpiValue(doc, "Delinquent Loans"), "21");
});

test("provisioning displays the whole-percent rate, not the fraction", () => {
  const table = namedTable(buildProvisioningDoc(PROVISIONING_PAYLOAD, RANGE), "Provisioning Schedule");

  // The API sends `rate: 0.05` AND `rate_percent: 5`. Reading `rate` would
  // print a 5% provision as "0.1%" — off by a factor of a hundred on a figure
  // the board signs off.
  assert.deepEqual(
    table.rows.map((r) => r.rate),
    [5, 15, 25, 50]
  );
  assert.equal(formatValue(table.rows[0].rate, "percent"), "5.0%");
  assert.equal(formatValue(table.rows[3].rate, "percent"), "50.0%");
});

test("a bucket sending only the fraction is still shown as whole percent", () => {
  const doc = buildProvisioningDoc(
    {
      buckets: {
        "1_30": { amount: 100, count: 1, rate: 0.05 },
        "31_60": { amount: 0, count: 0, rate: 0.15 },
        "61_90": { amount: 0, count: 0, rate: 0.25 },
        over_90: { amount: 0, count: 0, rate: 0.5 },
      },
    },
    RANGE
  );
  const rows = namedTable(doc, "Provisioning Schedule").rows;

  assert.equal(rows[0].rate, 5);
  // …and the allowance follows the corrected rate: 100 × 5% = 5, not 0.05.
  assert.equal(rows[0].required_allowance, 5);
});

test("provisioning is a four-column schedule with a totals row", () => {
  const doc = buildProvisioningDoc(PROVISIONING_PAYLOAD, RANGE);
  const table = namedTable(doc, "Provisioning Schedule");

  assert.deepEqual(
    table.columns.map((c) => c.key),
    ["bucket", "amount", "rate", "required_allowance"]
  );
  // `buckets` is an object; the canonical order comes from the aging buckets.
  assert.deepEqual(
    table.rows.map((r) => r.bucket),
    ["1–30 Days", "31–60 Days", "61–90 Days", "Over 90 Days"]
  );
  assert.equal(table.rows[0].amount, 128450.5);
  assert.equal(table.rows[3].required_allowance, 120155.38);

  assert.equal(namedTableTotal(doc, "Provisioning Schedule", "amount"), "₱451,861.50");
  assert.equal(
    namedTableTotal(doc, "Provisioning Schedule", "required_allowance"),
    "₱140,932.95"
  );
  // Four provisioning rates do not add up to anything.
  assert.equal(table.totals?.some((t) => t.column === "rate"), false);
});

test("provisioning multiplies amount by rate when the API sends no allowance", () => {
  const doc = buildProvisioningDoc(
    {
      as_of_date: "2026-08-06",
      buckets: {
        "1_30": { amount: 128450.5, count: 12 },
        "31_60": { amount: 64200.25, count: 5 },
        "61_90": { amount: 18900, count: 1 },
        over_90: { amount: 240310.75, count: 9 },
      },
      totals: { amount: 451861.5, count: 21 },
      // The policy ladder as fractions, exactly as the API sends it.
      rates: { "1_30": 0.05, "31_60": 0.15, "61_90": 0.25, over_90: 0.5 },
    },
    RANGE
  );
  const rows = namedTable(doc, "Provisioning Schedule").rows;

  // Rates read off the top-level policy map, scaled to whole percent.
  assert.equal(rows[0].rate, 5);
  assert.equal(Math.round((rows[0].required_allowance as number) * 100) / 100, 6422.53);
  assert.equal(Math.round((rows[3].required_allowance as number) * 100) / 100, 120155.38);
  // A centavo below the server's ₱140,932.95: the fallback adds up unrounded
  // products, while the server rounds each bucket before summing. Exactly why
  // the server's own figure is preferred whenever it sends one.
  assert.equal(kpiValue(doc, "Required Allowance"), "₱140,932.94");
});

test("provisioning names the rates as policy, not as a derived figure", () => {
  const note = noteText(buildProvisioningDoc(PROVISIONING_PAYLOAD, RANGE));

  assert.ok(note, "expected the provisioning note");
  assert.match(note!, /Computed as of/);
  // The server's own wording, so a board that revises the ladder revises one
  // place rather than two.
  assert.match(note!, /Provision rates are POLICY, not arithmetic/);
  assert.match(note!, /late in two buckets is still one delinquent loan/);
});

test("a failed provisioning request still renders every bucket", () => {
  const doc = buildProvisioningDoc(null, RANGE);
  const table = namedTable(doc, "Provisioning Schedule");

  assert.equal(kpiValue(doc, "Total Overdue"), DASH);
  assert.equal(kpiValue(doc, "Required Allowance"), DASH);
  assert.equal(kpiValue(doc, "Effective Provision Rate"), DASH);
  assert.equal(table.rows.length, 4);
  assert.equal(table.rows[0].amount, null);
  assert.equal(namedTableTotal(doc, "Provisioning Schedule", "required_allowance"), DASH);
  // No as-of date to quote, so the note leads with the policy caveat instead.
  assert.doesNotMatch(noteText(doc)!, /Computed as of/);
});

// ---------------------------------------------------------------------------
// Reporting period cap
//
// The API rejects a period wider than ten years with a 422 attributed to
// whichever date field was sent. No preset can breach it; the two custom date
// inputs can, so the picker needs to refuse the range before Generate.
// ---------------------------------------------------------------------------

const TODAY = new Date(2026, 7, 6);

test("an ordinary reporting period is not flagged", () => {
  assert.equal(exceedsReportSpanCap({ from: "2026-08-01", to: "2026-08-06" }, TODAY), false);
  assert.equal(exceedsReportSpanCap({ from: "2020-01-01", to: "2026-08-06" }, TODAY), false);
});

test("exactly ten years is allowed; a day more is not", () => {
  // The server returns early when start + 10y >= end, so the boundary itself
  // is inside the cap. Off by one here means a 422 on a legal range.
  assert.equal(exceedsReportSpanCap({ from: "2016-08-06", to: "2026-08-06" }, TODAY), false);
  assert.equal(exceedsReportSpanCap({ from: "2016-08-05", to: "2026-08-06" }, TODAY), true);
});

test("an open end is measured against today, exactly as the server does", () => {
  assert.equal(exceedsReportSpanCap({ from: "2016-08-06", to: "" }, TODAY), false);
  assert.equal(exceedsReportSpanCap({ from: "1999-01-01", to: "" }, TODAY), true);
  assert.equal(exceedsReportSpanCap({ from: "", to: "1999-01-01" }, TODAY), true);
});

test("a reversed range is judged on its absolute span", () => {
  assert.equal(exceedsReportSpanCap({ from: "2026-08-06", to: "1999-01-01" }, TODAY), true);
});

test("an empty or half-typed range is not a violation", () => {
  // Blocking Generate while someone is still typing a date would be worse than
  // the 422 this guard exists to avoid.
  assert.equal(exceedsReportSpanCap({ from: "", to: "" }, TODAY), false);
  assert.equal(exceedsReportSpanCap({ from: "20", to: "2026-08-06" }, TODAY), false);
});

test("the cap is read from local calendar parts, not UTC", () => {
  // Parsed as UTC, "2016-08-06" is the 6th at 08:00 in Manila, which shifts
  // the boundary comparison — the same bug presetRange already documents.
  assert.equal(MAX_REPORT_SPAN_YEARS, 10);
  assert.equal(exceedsReportSpanCap({ from: "2016-01-01", to: "2026-01-01" }, TODAY), false);
  assert.equal(exceedsReportSpanCap({ from: "2015-12-31", to: "2026-01-01" }, TODAY), true);
});

// ---------------------------------------------------------------------------
// Export compatibility
//
// The PDF, Word, Excel and CSV exporters each switch over `ReportSection.kind`
// and ignore anything they do not recognise, and each renders a totals row by
// matching `totals[].column` against a column key. Both are silent failures —
// a whole section or a footer figure simply vanishes from the download — so
// they are asserted here rather than discovered in a client's inbox.
// ---------------------------------------------------------------------------

const EXPORTABLE_SECTION_KINDS = ["kpi_grid", "table", "fields", "note", "signatures"];

const NEW_REPORT_DOCS: [string, (raw: unknown) => ReportDocument][] = [
  ["cash_flow", (raw) => buildCashFlowDoc(raw, RANGE)],
  ["collection_efficiency", (raw) => buildCollectionEfficiencyDoc(raw, RANGE)],
  ["portfolio_by_product", (raw) => buildPortfolioByProductDoc(raw, RANGE)],
  ["share_capital", (raw) => buildShareCapitalDoc(raw, RANGE)],
  ["performance", (raw) => buildPerformanceDoc(raw, RANGE)],
  ["provisioning", (raw) => buildProvisioningDoc(raw, RANGE)],
];

const NEW_REPORT_PAYLOADS: Record<string, unknown> = {
  cash_flow: CASH_FLOW_PAYLOAD,
  collection_efficiency: EFFICIENCY_PAYLOAD,
  portfolio_by_product: PRODUCT_PAYLOAD,
  share_capital: SHARE_CAPITAL_PAYLOAD,
  performance: PERFORMANCE_PAYLOAD,
  provisioning: PROVISIONING_PAYLOAD,
};

test("every new report uses only section kinds the four exporters render", () => {
  for (const [id, build] of NEW_REPORT_DOCS) {
    for (const raw of [NEW_REPORT_PAYLOADS[id], null]) {
      for (const section of build(raw).sections) {
        assert.ok(
          EXPORTABLE_SECTION_KINDS.includes(section.kind),
          `${id} emits "${section.kind}", which no exporter renders`
        );
      }
    }
  }
});

test("every totals row targets a column that actually exists", () => {
  for (const [id, build] of NEW_REPORT_DOCS) {
    for (const section of build(NEW_REPORT_PAYLOADS[id]).sections) {
      if (section.kind !== "table") continue;
      const keys = section.columns.map((c) => c.key);
      for (const total of section.totals ?? []) {
        assert.ok(
          keys.includes(total.column),
          `${id} totals "${total.column}" in "${section.title}", which is not one of ${keys.join(", ")}`
        );
      }
    }
  }
});

test("the permission-gated share capital variant exports like any other", () => {
  // The roster is replaced by a note, and `note` is one of the five kinds all
  // four exporters render — so a viewer's PDF carries the explanation too,
  // rather than silently dropping the section.
  const doc = buildShareCapitalDoc(SHARE_CAPITAL_ROSTER_OMITTED, RANGE);

  for (const section of doc.sections) {
    assert.ok(
      EXPORTABLE_SECTION_KINDS.includes(section.kind),
      `gated share capital emits "${section.kind}", which no exporter renders`
    );
  }
  assert.equal(doc.sections[0].kind, "kpi_grid");
  assert.ok(doc.sections.some((sec) => sec.kind === "table"));
});

test("every new report leads with a KPI grid and carries at least one table", () => {
  for (const [id, build] of NEW_REPORT_DOCS) {
    const sections = build(NEW_REPORT_PAYLOADS[id]).sections;
    assert.equal(sections[0].kind, "kpi_grid", `${id} does not lead with headline figures`);
    assert.ok(
      sections.some((s) => s.kind === "table"),
      `${id} has no table`
    );
  }
});
