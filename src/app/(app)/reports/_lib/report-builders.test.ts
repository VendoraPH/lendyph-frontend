import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAgingDoc,
  buildBorrowerDoc,
  buildDailyCollectionDoc,
  buildDisbursementDoc,
  buildDuePastDueListDoc,
  buildIncomeDoc,
  buildPortfolioSummaryDoc,
  buildReleasesListDoc,
  buildRepaymentsListDoc,
  buildStatementOfAccountDoc,
  buildSubsidiaryLedgerDoc,
} from "./report-builders";
import { DASH } from "./formatters";
import type { DateRange, FieldItem, KpiItem, ReportDocument } from "./types";

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
