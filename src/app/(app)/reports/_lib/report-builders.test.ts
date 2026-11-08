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
import { DASH, formatCell, formatValue } from "@/lib/report-format";
import { siteConfig } from "@/config/site";
import {
  MAX_REPORT_SPAN_YEARS,
  exceedsReportSpanCap,
  reportScope,
  reportScopeLine,
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

// Flat headline keys sit alongside the nested blocks. `total_outstanding` is
// everything owed, the premium included, so it is deliberately larger than
// principal + interest + penalty (`outstanding.total`, 3,418,151.50).
const PORTFOLIO_PAYLOAD = {
  active_loans: 42,
  total_outstanding: 3462980.15,
  outstanding_principal: 3120450.75,
  at_risk_amount: 458101,
  par_ratio: 12.5,
  par_threshold_days: 30,
  portfolio: { loan_count: 42, total_released: 5250000 },
  outstanding: {
    principal: 3120450.75,
    interest: 285300.5,
    penalty: 12400.25,
    insurance: 44828.65,
    balance: 3462980.15,
    total: 3418151.5,
  },
  overdue: {
    principal: 410200.4,
    interest: 38100.6,
    penalty: 9800,
    loan_count: 7,
    total: 458101,
  },
  by_branch: [
    {
      branch_id: 1,
      branch_name: "Main",
      loan_count: 42,
      total_released: 5250000,
      total_outstanding: 3462980.15,
      outstanding_principal: 3120450.75,
    },
  ],
  by_branch_totals: {
    loan_count: 42,
    total_released: 5250000,
    total_outstanding: 3462980.15,
    outstanding_principal: 3120450.75,
  },
  generated_at: "2026-08-06 09:15:00",
};

test("portfolio summary prefers the flat headline figures", () => {
  const doc = buildPortfolioSummaryDoc(PORTFOLIO_PAYLOAD, RANGE);

  assertNoDashes(doc);
  assert.equal(kpiValue(doc, "Total Active Loans"), "42");
  assert.equal(kpiValue(doc, "Outstanding"), "₱3,462,980.15");
  assert.equal(kpiValue(doc, "Principal Balance"), "₱3,120,450.75");
  assert.equal(kpiValue(doc, "At Risk (>30d overdue)"), "₱458,101.00");
  assert.equal(kpiValue(doc, "PAR Ratio"), "12.5%");
});

test("PAR ratio is shown as the server sent it, not recomputed from the KPIs", () => {
  const doc = buildPortfolioSummaryDoc(PORTFOLIO_PAYLOAD, RANGE);
  // at_risk ÷ total_outstanding would be 13.2% — PAR divides by the Principal
  // Balance instead, so the server's 12.5% must survive untouched.
  assert.equal(kpiValue(doc, "PAR Ratio"), "12.5%");
  assert.equal(kpi(doc, "PAR Ratio").hint, "Portfolio at Risk, on the Principal Balance");
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

test("portfolio summary never adds up the nested blocks in place of the headline balance", () => {
  const { active_loans, total_outstanding, outstanding_principal, ...nestedOnly } = PORTFOLIO_PAYLOAD;
  void active_loans;
  void total_outstanding;
  void outstanding_principal;
  const doc = buildPortfolioSummaryDoc(nestedOnly, RANGE);

  assert.equal(kpiValue(doc, "Total Active Loans"), "42");
  // Not ₱3,418,151.50 (principal + interest + penalty), nor outstanding.total.
  assert.equal(kpiValue(doc, "Outstanding"), DASH);
  assert.equal(kpiValue(doc, "Principal Balance"), DASH);
});

test("portfolio summary dashes only the figures the API omits", () => {
  const { at_risk_amount, par_ratio, ...withoutRisk } = PORTFOLIO_PAYLOAD;
  void at_risk_amount;
  void par_ratio;
  const doc = buildPortfolioSummaryDoc(withoutRisk, RANGE);

  assert.equal(kpiValue(doc, "Total Active Loans"), "42");
  assert.equal(kpiValue(doc, "Outstanding"), "₱3,462,980.15");
  assert.equal(kpiValue(doc, "At Risk (>30d overdue)"), DASH);
  assert.equal(kpiValue(doc, "PAR Ratio"), DASH);
});

test("portfolio summary renders the shell when the request failed", () => {
  const doc = buildPortfolioSummaryDoc(null, RANGE);
  assert.equal(kpiValue(doc, "Total Active Loans"), DASH);
  assert.equal(kpiValue(doc, "Outstanding"), DASH);
});

// ---------------------------------------------------------------------------
// Aging — each bucket is { amount, count }, not a bare number
// ---------------------------------------------------------------------------

// Bucket amounts sum to total.amount (451,861.50); bucket counts (12+5+1+9=27)
// deliberately exceed total.count — a loan late in two buckets is one loan.
const AGING_PAYLOAD = {
  as_of_date: "2026-08-06",
  buckets: {
    "1_30": { amount: 128450.5, count: 12, share_percent: 28.43 },
    "31_60": { amount: 64200.25, count: 5, share_percent: 14.21 },
    "61_90": { amount: 18900, count: 1, share_percent: 4.18 },
    over_90: { amount: 240310.75, count: 9, share_percent: 53.18 },
  },
  total: { amount: 451861.5, count: 21, share_percent: 100 },
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
  assert.equal(kpiValue(doc, "Total Active Members"), "318");
  assert.equal(kpiValue(doc, "New Members"), "24");
  assert.equal(kpiValue(doc, "Avg Loan Size"), "₱42,350.75");
  assert.equal(kpiValue(doc, "Repeat Members"), "96");
});

// GET /reports/borrowers/list: every member who is active or new, with the
// server's own flags and figures. `meta.counts` equals the cards.
const MEMBER_LIST = {
  data: [
    { borrower_id: 5, borrower_code: "MB-0005", borrower_name: "Ana Cruz", branch_name: "Butuan", is_active: true, is_new: true, is_repeat: true, active_loans: 2, loans_released: 3, outstanding: 130000.5, last_release_date: "2026-08-05" },
    { borrower_id: 7, borrower_code: "MB-0007", borrower_name: "Ben Reyes", branch_name: "Cabadbaran", is_active: true, is_new: false, is_repeat: true, active_loans: 1, loans_released: 2, outstanding: 80000, last_release_date: "2026-02-02" },
    { borrower_id: 9, borrower_code: "MB-0009", borrower_name: "Cora Lim", branch_name: "Butuan", is_active: false, is_new: true, is_repeat: false, active_loans: 0, loans_released: 0, outstanding: 0, last_release_date: null },
    { borrower_id: 11, borrower_code: "MB-0011", borrower_name: "Dan Uy", branch_name: "Butuan", is_active: true, is_new: false, is_repeat: false, active_loans: 1, loans_released: 1, outstanding: 5000, last_release_date: "2026-01-15" },
  ],
  meta: { current_page: 1, last_page: 1, per_page: 200, total: 4, counts: { active: 3, new: 2, repeat: 2 } },
};

const MEMBERS_TABLE = "Active and New Members";

test("member report lists the accounts behind the cards, as the server sent them", () => {
  const doc = buildBorrowerDoc({ total_active_borrowers: 3, new_borrowers: 2, repeat_borrowers: 2 }, RANGE, MEMBER_LIST);

  const table = namedTable(doc, MEMBERS_TABLE);
  assert.deepEqual(
    table.columns.map((c) => c.header),
    ["Member No.", "Member", "Branch", "New / Repeat", "Active Loans", "Loans Released", "Outstanding", "Last Release"]
  );
  assert.deepEqual(
    table.rows.map((r) => [r.borrower_code, r.borrower_name, r.branch_name, r.active_loans, r.loans_released, r.outstanding, r.last_release_date]),
    [
      ["MB-0005", "Ana Cruz", "Butuan", 2, 3, 130000.5, "2026-08-05"],
      ["MB-0007", "Ben Reyes", "Cabadbaran", 1, 2, 80000, "2026-02-02"],
      ["MB-0009", "Cora Lim", "Butuan", 0, 0, 0, null],
      ["MB-0011", "Dan Uy", "Butuan", 1, 1, 5000, "2026-01-15"],
    ]
  );
  // The cards stay the summary's figures.
  assert.equal(kpiValue(doc, "Total Active Members"), "3");
  assert.equal(kpiValue(doc, "New Members"), "2");
  assert.equal(kpiValue(doc, "Repeat Members"), "2");
});

test("member list marks New and Repeat from the server's flags", () => {
  const table = namedTable(buildBorrowerDoc(null, RANGE, MEMBER_LIST), MEMBERS_TABLE);
  const column = table.columns.find((c) => c.key === "markers")!;

  assert.deepEqual(
    table.rows.map((r) => formatCell(r, column)),
    ["New, Repeat", "Repeat", "New", DASH]
  );
});

test("member list shows the server's outstanding, with ₱0.00 for a real zero and a dash for a missing figure", () => {
  const doc = buildBorrowerDoc(null, RANGE, {
    data: [MEMBER_LIST.data[2], { ...MEMBER_LIST.data[3], outstanding: undefined, last_release_date: undefined }],
    meta: { total: 2 },
  });
  const table = namedTable(doc, MEMBERS_TABLE);
  const outstanding = table.columns.find((c) => c.key === "outstanding")!;
  const lastRelease = table.columns.find((c) => c.key === "last_release_date")!;

  assert.equal(formatCell(table.rows[0], outstanding), "₱0.00");
  assert.equal(formatCell(table.rows[0], lastRelease), DASH);
  assert.equal(formatCell(table.rows[1], outstanding), DASH);
  assert.equal(formatCell(table.rows[1], lastRelease), DASH);
});

test("member list has no footer: the server sends no column totals, and rows are never added up", () => {
  const table = namedTable(buildBorrowerDoc(null, RANGE, MEMBER_LIST), MEMBERS_TABLE);
  assert.equal(table.totals, undefined);
});

test("member list's truncation note counts members and promises no totals it doesn't show", () => {
  const doc = buildBorrowerDoc(null, RANGE, {
    data: Array.from({ length: 200 }, (_, i) => ({ ...MEMBER_LIST.data[1], borrower_id: i + 1 })),
    meta: { current_page: 1, last_page: 3, per_page: 200, total: 450, counts: { active: 400, new: 60, repeat: 90 } },
  });
  const notes = doc.sections.flatMap((s) => (s.kind === "note" ? [s.text] : []));

  assert.ok(notes.includes("Showing the first 200 of 450 members."), notes.join(" | "));
  assert.ok(notes.every((n) => !/CSV|table totals/.test(n)), notes.join(" | "));
});

test("member list shows no truncation note when every row is listed", () => {
  const notes = buildBorrowerDoc(null, RANGE, MEMBER_LIST).sections.flatMap((s) =>
    s.kind === "note" ? [s.text] : []
  );
  assert.ok(notes.every((n) => !/Showing the first/.test(n)), notes.join(" | "));
});

test("member list says, under the table, how each mark is defined and who a card can count unlisted", () => {
  const doc = buildBorrowerDoc(null, RANGE, MEMBER_LIST);
  const tableAt = doc.sections.findIndex((s) => s.kind === "table" && s.title === MEMBERS_TABLE);
  const after = doc.sections[tableAt + 1];

  assert.ok(after && after.kind === "note", "expected a note right after the table");
  assert.match(after.text, /Active: at least one collectible loan/);
  assert.match(after.text, /each loan's current status, not its status back then/);
  assert.match(after.text, /New: registered in the period/);
  assert.match(after.text, /Repeat: at least 2 loans released/);
  assert.match(after.text, /neither active nor new/);
  assert.doesNotMatch(after.text, /need not match/);
  assert.doesNotMatch(after.text, /Borrower|borrower/);
});

test("member list's empty state says so, in the Member wording", () => {
  const table = namedTable(buildBorrowerDoc(null, RANGE, { data: [], meta: { total: 0 } }), MEMBERS_TABLE);
  assert.equal(table.rows.length, 0);
  assert.equal(table.emptyText, "No member was active or new in the selected period.");
});

test("member report omits the member list when its read failed", () => {
  const doc = buildBorrowerDoc({ new_borrowers: 1 }, RANGE, null);
  assert.equal(hasTable(doc, MEMBERS_TABLE), false);
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

test("disbursement report's title is the name the Reports list shows", () => {
  const doc = buildDisbursementDoc({ loans_released: 1 }, RANGE);
  assert.equal(doc.meta.title, "Disbursement Summary");
});

const DISBURSED_ROWS = [
  { loan_account_number: "LN-1", borrower_name: "Ana Cruz", principal_amount: 1000, net_proceeds: 950, release_date: "2026-08-01", status: "ongoing" },
  { loan_account_number: "LN-2", borrower: { full_name: "Ben Reyes" }, principal_amount: 2000, net_proceeds: 1900, release_date: "2026-08-02", status: "ongoing" },
];

test("disbursement report lists the loan accounts behind the total disbursed", () => {
  const doc = buildDisbursementDoc(
    { loans_released: 2, total_disbursed: 2850.25 },
    RANGE,
    {
      data: DISBURSED_ROWS,
      meta: { total: 2 },
      // Deliberately not the sum of the rows: the footer must show these as sent.
      totals: { count: 2, total_principal: 3000.5, total_net_proceeds: 2850.25 },
    }
  );

  const table = namedTable(doc, "Disbursed Loan Accounts");
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[1].borrower_name, "Ben Reyes");
  assert.equal(table.rows[1].net_proceeds, 1900);
  assert.equal(namedTableTotal(doc, "Disbursed Loan Accounts", "net_proceeds"), "₱2,850.25");
  assert.equal(namedTableTotal(doc, "Disbursed Loan Accounts", "principal"), "₱3,000.50");
  assert.equal(noteText(doc), null);
});

test("disbursement report leads with net proceeds, the figure Total Disbursed adds up", () => {
  const doc = buildDisbursementDoc({ total_disbursed: 2850.25 }, RANGE, {
    data: DISBURSED_ROWS,
    meta: { total: 2 },
    totals: { count: 2, total_principal: 3000.5, total_net_proceeds: 2850.25 },
  });
  const money = namedTable(doc, "Disbursed Loan Accounts").columns.filter(
    (c) => c.format === "currency"
  );

  assert.equal(money[0].key, "net_proceeds");
  assert.equal(
    namedTableTotal(doc, "Disbursed Loan Accounts", "net_proceeds"),
    kpiValue(doc, "Total Disbursed")
  );
});

test("disbursement report shows a dash, not a page sum, when the server sends no totals", () => {
  const doc = buildDisbursementDoc({ total_disbursed: 2850 }, RANGE, {
    data: DISBURSED_ROWS,
    meta: { total: 2 },
  });

  assert.equal(namedTableTotal(doc, "Disbursed Loan Accounts", "net_proceeds"), DASH);
  assert.equal(namedTableTotal(doc, "Disbursed Loan Accounts", "principal"), DASH);
});

test("disbursement report's truncation note counts loans and makes no CSV promise", () => {
  const doc = buildDisbursementDoc({ total_disbursed: 1 }, RANGE, {
    data: Array.from({ length: 200 }, () => DISBURSED_ROWS[0]),
    meta: { current_page: 1, last_page: 3, per_page: 200, total: 450 },
    totals: { count: 450, total_principal: 450000, total_net_proceeds: 427500 },
  });
  const note = noteText(doc);

  assert.ok(note, "expected a truncation note");
  assert.match(note!, /Showing the first 200 of 450 loans\./);
  assert.match(note!, /server's figures for the whole period/);
  assert.doesNotMatch(note!, /CSV/);
});

test("disbursement report labels an ongoing loan Current", () => {
  const doc = buildDisbursementDoc({ total_disbursed: 2850 }, RANGE, {
    data: DISBURSED_ROWS,
    meta: { total: 2 },
  });
  assert.equal(namedTable(doc, "Disbursed Loan Accounts").rows[0].status, "Current");
});

test("disbursement report omits the loan list when releases could not be read", () => {
  const doc = buildDisbursementDoc({ total_disbursed: 1 }, RANGE, null);
  assert.equal(doc.sections.some((s) => s.kind === "table"), false);
});

test("income report shows a dash, not a sum of the components, when the API omits a total", () => {
  const doc = buildIncomeDoc(
    { interest_income: 120500.25, processing_fees: 32400.5, penalty_income: 4800.25 },
    RANGE
  );

  assert.equal(kpiValue(doc, "Interest Income"), "₱120,500.25");
  assert.equal(kpiValue(doc, "Total Income"), DASH);
});

test("income report reads total_income as the server sent it", () => {
  const doc = buildIncomeDoc(
    // Deliberately not the sum of the components: the KPI must show it as sent.
    { interest_income: 120500.25, processing_fees: 32400.5, penalty_income: 4800.25, service_fee: 0, other_fees: 0, total_income: 157700 },
    RANGE
  );

  assertNoDashes(doc);
  assert.equal(kpiValue(doc, "Total Income"), "₱157,700.00");
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

// GET /reports/income/by-loan: one row per loan, every figure summed by the
// server. The totals are deliberately not the sum of these two rows.
const INCOME_BY_LOAN = {
  data: [
    { loan_id: 2, loan_account_number: "LN-000002", borrower_id: 7, borrower_name: "Ben Reyes", payments: 1, interest_income: 2000, penalty_income: 115.98, total_income: 2115.98 },
    { loan_id: 1, loan_account_number: "LN-000001", borrower_id: 5, borrower_name: "Ana Cruz", payments: 2, interest_income: 3000, penalty_income: 0, total_income: 3000 },
  ],
  meta: { current_page: 1, last_page: 1, per_page: 200, total: 2 },
  totals: { count: 2, payments: 3, interest_income: 5000.5, penalty_income: 115.99, total_income: 5116.49 },
};

test("income report lists each loan account's income as the server sent it", () => {
  const doc = buildIncomeDoc(
    { interest_income: 5000.5, processing_fees: 50, penalty_income: 115.99, total: 5166.49 },
    RANGE,
    INCOME_BY_LOAN
  );

  const table = namedTable(doc, "Income by Loan Account");
  assert.deepEqual(
    table.rows.map((r) => [r.loan_account_number, r.borrower_name, r.payments, r.total_income]),
    [
      ["LN-000002", "Ben Reyes", 1, 2115.98],
      ["LN-000001", "Ana Cruz", 2, 3000],
    ]
  );
  assert.equal(namedTableTotal(doc, "Income by Loan Account", "payments"), "3");
  assert.equal(namedTableTotal(doc, "Income by Loan Account", "interest_income"), "₱5,000.50");
  assert.equal(namedTableTotal(doc, "Income by Loan Account", "penalty_income"), "₱115.99");
  assert.equal(namedTableTotal(doc, "Income by Loan Account", "total_income"), "₱5,116.49");
});

test("income by loan never recomputes a row's total in the browser", () => {
  const doc = buildIncomeDoc(null, RANGE, {
    data: [{ ...INCOME_BY_LOAN.data[0], interest_income: 1, penalty_income: 1, total_income: 5 }],
    meta: { total: 1 },
    totals: INCOME_BY_LOAN.totals,
  });

  assert.equal(namedTable(doc, "Income by Loan Account").rows[0].total_income, 5);
});

test("income by loan shows a dash, not a page sum, when the server sends no totals", () => {
  const doc = buildIncomeDoc(null, RANGE, { data: INCOME_BY_LOAN.data, meta: { total: 2 } });

  for (const column of ["payments", "interest_income", "penalty_income", "processing_fee", "total_income"]) {
    assert.equal(namedTableTotal(doc, "Income by Loan Account", column), DASH, column);
  }
});

test("income by loan's truncation note counts loans, and no caption says fees aren't listed", () => {
  const doc = buildIncomeDoc(null, RANGE, {
    data: Array.from({ length: 200 }, (_, i) => ({ ...INCOME_BY_LOAN.data[1], loan_id: i + 1 })),
    meta: { current_page: 1, last_page: 3, per_page: 200, total: 450 },
    totals: { ...INCOME_BY_LOAN.totals, count: 450 },
  });
  const notes = doc.sections.flatMap((s) => (s.kind === "note" ? [s.text] : []));

  assert.ok(notes.some((n) => /^Showing the first 200 of 450 loans\./.test(n)), notes.join(" | "));
  assert.ok(notes.some((n) => /server's figures for the whole period/.test(n)));
  assert.ok(notes.every((n) => !/CSV/.test(n)));
  assert.ok(notes.every((n) => !/not part of this list/.test(n)), notes.join(" | "));
  assert.ok(notes.some((n) => /processing, service and other fees from the loans released in the period/.test(n)), notes.join(" | "));
});

// D9: the same rows with the fee column the backend adds. Deliberately not the
// sum of the rows, so a browser sum cannot pass.
const INCOME_BY_LOAN_WITH_FEES = {
  data: [
    { ...INCOME_BY_LOAN.data[0], processing_fee: 400, total_income: 2515.98 },
    // A loan whose only income in the period is its fee.
    { loan_id: 9, loan_account_number: "LN-000009", borrower_id: 8, borrower_name: "Cora Lim", payments: 0, interest_income: 0, penalty_income: 0, processing_fee: 600, total_income: 600 },
  ],
  meta: { current_page: 1, last_page: 1, per_page: 200, total: 2 },
  totals: { count: 2, payments: 3, interest_income: 5000.5, penalty_income: 115.99, processing_fee: 50, total_income: 5166.49 },
};

test("income by loan shows a Processing Fee column between the income figures and the total", () => {
  const table = namedTable(buildIncomeDoc(null, RANGE, INCOME_BY_LOAN_WITH_FEES), "Income by Loan Account");

  assert.deepEqual(
    table.columns.map((c) => c.header),
    ["Loan #", "Member", "Payments", "Interest", "Penalty", "Processing Fee", "Service Fee", "Other Fees", "Total Income"]
  );
  const column = table.columns.find((c) => c.key === "processing_fee")!;
  assert.equal(column.format, "currency");
  assert.deepEqual(table.rows.map((r) => formatCell(r, column)), ["₱400.00", "₱600.00"]);
  assert.equal(table.rows[1].total_income, 600);
});

test("income by loan's footer reads the server's fee total, so the table traces to the cards", () => {
  const doc = buildIncomeDoc(
    { interest_income: 5000.5, processing_fees: 50, penalty_income: 115.99, total: 5166.49 },
    RANGE,
    INCOME_BY_LOAN_WITH_FEES
  );

  assert.equal(namedTableTotal(doc, "Income by Loan Account", "processing_fee"), kpiValue(doc, "Processing Fees"));
  assert.equal(namedTableTotal(doc, "Income by Loan Account", "total_income"), kpiValue(doc, "Total Income"));
});

test("income by loan reads the totals from meta.totals too", () => {
  const { totals, meta: listMeta, ...rest } = INCOME_BY_LOAN_WITH_FEES;
  const doc = buildIncomeDoc(null, RANGE, { ...rest, meta: { ...listMeta, totals } });

  assert.equal(namedTableTotal(doc, "Income by Loan Account", "processing_fee"), "₱50.00");
});

test("income by loan shows a dash when the server sends no processing fee", () => {
  const doc = buildIncomeDoc(null, RANGE, INCOME_BY_LOAN);
  const table = namedTable(doc, "Income by Loan Account");
  const column = table.columns.find((c) => c.key === "processing_fee")!;

  assert.equal(formatCell(table.rows[0], column), DASH);
  assert.equal(namedTableTotal(doc, "Income by Loan Account", "processing_fee"), DASH);
});

test("income report omits the account list when its read failed", () => {
  const doc = buildIncomeDoc({ total_income: 1 }, RANGE, null);
  assert.equal(hasTable(doc, "Income by Loan Account"), false);
});

test("daily collection renders whole-percent rates verbatim", () => {
  const doc = buildDailyCollectionDoc(
    {
      date: "2026-08-06",
      total_due: 84500.5,
      total_collected: 73900.25,
      collection_rate: 87.5,
      uncollected: 10600.25,
      penalty_collected: 412.5,
      total_received: 74312.75,
      generated_at: "2026-08-06 09:15:00",
    },
    RANGE
  );

  assertNoDashes(doc);
  assert.equal(kpiValue(doc, "Collection Rate"), "87.5%");
  assert.equal(kpiValue(doc, "Total Due"), "₱84,500.50");
});

// Decision 6: the three collected figures are the server's own. Deliberately
// not consistent with each other, so a browser sum of any two cannot pass.
const DAILY_COLLECTION_PAYLOAD = {
  date: "2026-08-06",
  total_due: 84500.5,
  total_collected: 73900.25,
  collection_rate: 87.5,
  uncollected: 10600.25,
  penalty_collected: 412.5,
  total_received: 90000.1,
};

test("daily collection shows collected principal and interest, penalty collected and total received as sent", () => {
  const doc = buildDailyCollectionDoc(DAILY_COLLECTION_PAYLOAD, RANGE);

  assert.equal(kpiValue(doc, "Collected (Principal + Interest)"), "₱73,900.25");
  assert.equal(kpiValue(doc, "Penalty Collected"), "₱412.50");
  assert.equal(kpiValue(doc, "Total Received"), "₱90,000.10");
  assert.equal(kpiValue(doc, "Total Due"), "₱84,500.50");
  assert.equal(kpiValue(doc, "Collection Rate"), "87.5%");
  assert.equal(kpiValue(doc, "Uncollected"), "₱10,600.25");
});

test("daily collection no longer labels principal and interest as the total collected", () => {
  const doc = buildDailyCollectionDoc(DAILY_COLLECTION_PAYLOAD, RANGE);
  const labels = doc.sections.flatMap((s) => (s.kind === "kpi_grid" ? s.items.map((i) => i.label) : []));

  assert.equal(labels.includes("Total Collected"), false);
  assert.deepEqual(labels, [
    "Total Due",
    "Collected (Principal + Interest)",
    "Penalty Collected",
    "Total Received",
    "Collection Rate",
    "Uncollected",
  ]);
});

test("daily collection shows a dash for a figure the server did not send, never a sum", () => {
  const { penalty_collected, total_received, ...older } = DAILY_COLLECTION_PAYLOAD;
  void penalty_collected;
  void total_received;
  const doc = buildDailyCollectionDoc(older, RANGE);

  assert.equal(kpiValue(doc, "Penalty Collected"), DASH);
  // Not total_collected + penalty: Total Received is a server figure only.
  assert.equal(kpiValue(doc, "Total Received"), DASH);
  assert.equal(kpiValue(doc, "Collected (Principal + Interest)"), "₱73,900.25");
});

test("daily collection shows a zero penalty and zero received as ₱0.00, not a dash", () => {
  const doc = buildDailyCollectionDoc(
    { ...DAILY_COLLECTION_PAYLOAD, penalty_collected: 0, total_received: 0 },
    RANGE
  );

  assert.equal(kpiValue(doc, "Penalty Collected"), "₱0.00");
  assert.equal(kpiValue(doc, "Total Received"), "₱0.00");
});

test("daily collection reads only total_collected for principal and interest", () => {
  // `total_amount` and `collected` were loose aliases; neither is the
  // principal-plus-interest figure the label promises.
  const doc = buildDailyCollectionDoc({ total_due: 1000, total_amount: 900, collected: 800 }, RANGE);
  assert.equal(kpiValue(doc, "Collected (Principal + Interest)"), DASH);
});

const COLLECTION_ROWS = [
  { paid_at: "2026-08-06", loan_account_number: "LN-1", borrower_name: "Ana Cruz", amount: 400, penalty_amount: 0, method: "cash", status: "paid" },
  { paid_at: "2026-08-06", loan: { loan_account_number: "LN-2" }, borrower: { full_name: "Ben Reyes" }, amount: 300, penalty_amount: 0, method: "gcash", status: "paid" },
];

test("daily collection lists the payments collected beneath the summary", () => {
  const doc = buildDailyCollectionDoc(
    { total_due: 1000, total_collected: 700, collection_rate: 70, uncollected: 300 },
    RANGE,
    {
      data: COLLECTION_ROWS,
      meta: { total: 2 },
      // Deliberately not the sum of the rows: the footer must show these as sent.
      totals: { count: 2, total_amount_paid: 700.5, total_penalty_applied: 12.25 },
    }
  );

  const table = namedTable(doc, "Payments Collected");
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[1].borrower_name, "Ben Reyes");
  assert.equal(table.rows[1].loan_account_number, "LN-2");
  assert.equal(namedTableTotal(doc, "Payments Collected", "amount"), "₱700.50");
  assert.equal(namedTableTotal(doc, "Payments Collected", "penalty_amount"), "₱12.25");
  assert.equal(noteText(doc), null);
});

test("daily collection shows a dash, not a page sum, when the server sends no totals", () => {
  const doc = buildDailyCollectionDoc(
    { total_due: 1000, total_collected: 700, collection_rate: 70, uncollected: 300 },
    RANGE,
    { data: COLLECTION_ROWS, meta: { total: 2 } }
  );

  assert.equal(namedTableTotal(doc, "Payments Collected", "amount"), DASH);
  assert.equal(namedTableTotal(doc, "Payments Collected", "penalty_amount"), DASH);
});

test("daily collection's truncation note counts repayments and makes no CSV promise", () => {
  const doc = buildDailyCollectionDoc(
    { total_due: 1000, total_collected: 700, collection_rate: 70, uncollected: 300 },
    RANGE,
    {
      data: Array.from({ length: 200 }, () => COLLECTION_ROWS[0]),
      meta: { current_page: 1, last_page: 3, per_page: 200, total: 450 },
      totals: { count: 450, total_amount_paid: 180000, total_penalty_applied: 0 },
    }
  );
  const note = noteText(doc);

  assert.ok(note, "expected a truncation note");
  assert.match(note!, /Showing the first 200 of 450 repayments\./);
  assert.match(note!, /server's figures for the whole period/);
  assert.doesNotMatch(note!, /CSV/);
  assert.equal(namedTableTotal(doc, "Payments Collected", "amount"), "₱180,000.00");
});

test("daily collection omits the account list when repayments could not be read", () => {
  const doc = buildDailyCollectionDoc({ total_due: 1 }, RANGE, null);
  assert.equal(doc.sections.some((s) => s.kind === "table"), false);
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
    amount_paid: 0,
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
    amount_paid: 1000,
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
});

test("due/past due shows dashes, not page sums, when the server sends no totals", () => {
  const doc = buildDuePastDueListDoc({ data: DUE_ROWS, meta: { total: 2 } }, RANGE);

  assert.equal(kpiValue(doc, "Total Amount Due"), DASH);
  assert.equal(kpiValue(doc, "Total Balance"), DASH);
  for (const column of ["principal_due", "interest_due", "penalty_amount", "amount_due", "amount_paid", "balance"]) {
    assert.equal(tableTotal(doc, column), DASH, column);
  }
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

test("releases list maps LoanResource rows and shows a dash, not a page sum, when the API sends no totals", () => {
  const doc = buildReleasesListDoc(
    { data: RELEASE_ROWS, meta: { current_page: 1, last_page: 1, per_page: 200, total: 2 } },
    RANGE
  );
  const rows = tableRows(doc);

  assert.equal(rows[0].principal, 50000.25);
  assert.equal(rows[0].borrower_name, "Ana Reyes");
  assert.equal(rows[0].interest_rate, "3.0000");
  assert.equal(kpiValue(doc, "Total Releases"), "2");
  assert.equal(kpiValue(doc, "Total Principal"), DASH);
  assert.equal(tableTotal(doc, "principal"), DASH);
  assert.equal(noteText(doc), null);
});

test("releases list labels each loan's status as the loans screens do", () => {
  const rows = tableRows(buildReleasesListDoc({ data: RELEASE_ROWS, meta: { total: 2 } }, RANGE));

  // Decision 5a: a `released` loan and an `ongoing` one both read "Current".
  assert.equal(rows[0].status, "Current");
  assert.equal(rows[1].status, "Current");
});

test("releases list prints each loan's rate as stored, not to one decimal", () => {
  const doc = buildReleasesListDoc(
    {
      data: [...RELEASE_ROWS, { ...RELEASE_ROWS[0], id: 3, interest_rate: "1.1250" }],
      meta: { current_page: 1, last_page: 1, per_page: 200, total: 3 },
    },
    RANGE
  );
  const table = doc.sections.find((s) => s.kind === "table");
  assert.ok(table && table.kind === "table");
  const rate = table.columns.find((c) => c.key === "interest_rate");
  assert.ok(rate);

  const rows = tableRows(doc);
  assert.equal(formatCell(rows[0], rate), "3.0%");
  assert.equal(formatCell(rows[1], rate), "2.5%");
  assert.equal(formatCell(rows[2], rate), "1.125%");
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
        total_outstanding: 12408300.25,
        outstanding_principal: 11900000.5,
      },
    },
    RANGE
  );

  assert.equal(kpiValue(doc, "Total Releases"), "640");
  assert.equal(kpiValue(doc, "Total Principal"), "₱18,450,900.75");
  assert.equal(kpiValue(doc, "Net Proceeds"), "₱17,920,400.50");
  assert.equal(kpiValue(doc, "Principal Balance"), "₱11,900,000.50");
  assert.equal(kpiValue(doc, "Outstanding"), "₱12,408,300.25");
  assert.equal(tableTotal(doc, "principal"), "₱18,450,900.75");
});

test("releases list omits Net Proceeds and dashes what's owed when the API sends no totals block", () => {
  const doc = buildReleasesListDoc({ data: RELEASE_ROWS, meta: { total: 2 } }, RANGE);
  const grid = doc.sections.find((s) => s.kind === "kpi_grid");

  assert.ok(grid && grid.kind === "kpi_grid");
  assert.deepEqual(
    grid.items.map((i) => i.label),
    ["Total Releases", "Total Principal", "Principal Balance", "Outstanding"]
  );
  assert.equal(kpiValue(doc, "Outstanding"), DASH);
});

test("repayments list maps RepaymentResource rows and shows dashes, not page sums, without server totals", () => {
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
  assert.equal(kpiValue(doc, "Total Collected"), DASH);
  assert.equal(kpiValue(doc, "Penalty Collected"), DASH);
  assert.equal(tableTotal(doc, "amount"), DASH);
  assert.equal(tableTotal(doc, "penalty_amount"), DASH);
  assert.equal(tableRows(doc)[0].method, "Cash");
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
    "Insurance premium — · Principal ₱7,120,400.25 · Interest ₱2,480,300.25"
  );
});

test("repayments list names the insurance premium collected, from the server's total only", () => {
  const doc = buildRepaymentsListDoc(
    {
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 200, total: 3 },
      totals: {
        count: 3,
        total_amount_paid: 12600,
        total_principal_applied: 10000,
        total_interest_applied: 1800,
        total_penalty_applied: 200,
        total_insurance_applied: 400,
      },
    },
    RANGE
  );

  assert.equal(
    kpi(doc, "Total Collected").hint,
    "Insurance premium ₱400.00 · Principal ₱10,000.00 · Interest ₱1,800.00"
  );
});

test("repayments list says the insurance premium total is unknown, not absent, when the server sent none", () => {
  const doc = buildRepaymentsListDoc(
    {
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 200, total: 3 },
      totals: { count: 3, total_amount_paid: 12200, total_principal_applied: 10000, total_interest_applied: 1800 },
    },
    RANGE
  );

  assert.equal(
    kpi(doc, "Total Collected").hint,
    "Insurance premium — · Principal ₱10,000.00 · Interest ₱1,800.00"
  );
});

test("an empty list report reports zeroes and no truncation note", () => {
  const doc = buildRepaymentsListDoc(
    { data: [], meta: { total: 0 }, totals: { count: 0, total_amount_paid: 0, total_penalty_applied: 0 } },
    RANGE
  );

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

  assert.equal(
    note,
    "Showing the first 200 of 1,432 schedules. The table totals are the server's figures for the whole period, not a sum of the schedules listed."
  );
});

test("a truncated page without server totals shows dashes, never a sum of the rows listed", () => {
  const doc = buildDuePastDueListDoc(
    {
      data: manyDueRows(200),
      meta: { current_page: 1, last_page: 8, per_page: 200, total: 1432 },
    },
    RANGE
  );
  const note = noteText(doc);

  // No totals came back, so the note must not claim the footers are the
  // server's figures: they are dashes.
  assert.equal(
    note,
    "Showing the first 200 of 1,432 schedules. The server did not provide totals for the period, so the table totals show \"—\" rather than a sum of the schedules listed."
  );
  assert.equal(kpiValue(doc, "Total Balance"), DASH);
});

test("a full page with no reported row count is still flagged as possibly partial", () => {
  const doc = buildReleasesListDoc(
    Array.from({ length: 200 }, () => RELEASE_ROWS[0]),
    RANGE
  );
  const note = noteText(doc);

  assert.ok(note, "expected a truncation note");
  assert.match(note!, /did not report a count/);
});

test("a bare array response (no envelope) still renders rows, with a dash for the total it lacks", () => {
  const doc = buildReleasesListDoc(RELEASE_ROWS, RANGE);

  assert.equal(tableRows(doc).length, 2);
  assert.equal(kpiValue(doc, "Total Releases"), "2");
  assert.equal(kpiValue(doc, "Total Principal"), DASH);
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
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "loan_count"), "42");
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "total_released"), "₱5,250,000.00");
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "principal_balance"), "₱3,120,450.75");
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "outstanding"), "₱3,462,980.15");
});

test("the branch footer is the server's by_branch_totals, read figure by figure", () => {
  const doc = buildPortfolioSummaryDoc(
    {
      ...PORTFOLIO_PAYLOAD,
      // Deliberately unlike the row, so a sum of the rows cannot pass.
      by_branch_totals: { loan_count: 50, total_released: 6000000.5, total_outstanding: 4000000.25 },
    },
    RANGE
  );
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "loan_count"), "50");
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "total_released"), "₱6,000,000.50");
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "outstanding"), "₱4,000,000.25");
});

test("the branch footer shows dashes, not a sum of the branches, without by_branch_totals", () => {
  const { by_branch_totals, ...withoutTotals } = PORTFOLIO_PAYLOAD;
  void by_branch_totals;
  const doc = buildPortfolioSummaryDoc(withoutTotals, RANGE);

  for (const column of ["loan_count", "total_released", "principal_balance", "outstanding"]) {
    assert.equal(namedTableTotal(doc, "Breakdown by Branch", column), DASH, column);
  }
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
    ["Principal", "Interest", "Penalty", "Insurance Premium"]
  );
  assert.equal(table.rows[0].outstanding, 3120450.75);
  assert.equal(table.rows[0].overdue, 410200.4);
  // Everything owed, the same figure as the card; the premium is never overdue.
  assert.equal(
    namedTableTotal(doc, "Outstanding vs Overdue Composition", "outstanding"),
    "₱3,462,980.15"
  );
  assert.equal(
    namedTableTotal(doc, "Outstanding vs Overdue Composition", "overdue"),
    "₱458,101.00"
  );
});

test("the composition footer shows dashes, not a sum of the components, without a total", () => {
  const doc = buildPortfolioSummaryDoc(
    {
      ...PORTFOLIO_PAYLOAD,
      total_outstanding: undefined,
      outstanding: { principal: 3120450.75, interest: 285300.5, penalty: 12400.25 },
      overdue: { principal: 410200.4, interest: 38100.6, penalty: 9800, loan_count: 7 },
    },
    RANGE
  );
  assert.equal(namedTableTotal(doc, "Outstanding vs Overdue Composition", "outstanding"), DASH);
  assert.equal(namedTableTotal(doc, "Outstanding vs Overdue Composition", "overdue"), DASH);
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

test("aging report renders a schedule with the server's share of the total per bucket", () => {
  const doc = buildAgingDoc(AGING_PAYLOAD, RANGE);
  const table = namedTable(doc, "Aging Schedule");

  assert.equal(table.rows.length, 4);
  assert.equal(table.rows[0].amount, 128450.5);
  assert.deepEqual(table.rows.map((r) => r.share), [28.43, 14.21, 4.18, 53.18]);
  assert.equal(namedTableTotal(doc, "Aging Schedule", "amount"), "₱451,861.50");
  assert.equal(namedTableTotal(doc, "Aging Schedule", "share"), "100.0%");
});

test("a share is the server's figure, never divided out of the amounts", () => {
  // A share deliberately unlike amount ÷ total: whatever the server sends is
  // what the report shows.
  const doc = buildAgingDoc(
    {
      ...AGING_PAYLOAD,
      buckets: { ...AGING_PAYLOAD.buckets, "1_30": { amount: 128450.5, count: 12, share_percent: 30 } },
    },
    RANGE
  );
  assert.equal(namedTable(doc, "Aging Schedule").rows[0].share, 30);
});

test("a bucket the server sent no share for shows a dash, not a computed one", () => {
  const doc = buildAgingDoc(
    {
      ...AGING_PAYLOAD,
      buckets: { ...AGING_PAYLOAD.buckets, "31_60": { amount: 64200.25, count: 5 } },
    },
    RANGE
  );
  const table = namedTable(doc, "Aging Schedule");
  assert.equal(table.rows[1].share, null);
  assert.equal(table.rows[0].share, 28.43);
});

test("the aging schedule never totals the loan counts", () => {
  // 12 + 5 + 1 + 9 = 27 against a real 21: a loan late in two buckets is one
  // loan, so summing the column would overstate the delinquency.
  const totals = namedTable(buildAgingDoc(AGING_PAYLOAD, RANGE), "Aging Schedule").totals;
  assert.equal(totals?.some((t) => t.column === "count"), false);
});

test("aging shows a dash, not a sum of the buckets, when the API omits the total", () => {
  const { total, ...withoutTotal } = AGING_PAYLOAD;
  void total;
  const doc = buildAgingDoc(withoutTotal, RANGE);
  const table = namedTable(doc, "Aging Schedule");

  // The buckets and their shares are still listed as sent; only the total row
  // needs the server's total.
  assert.equal(table.rows[0].amount, 128450.5);
  assert.equal(table.rows[0].share, 28.43);
  assert.equal(namedTableTotal(doc, "Aging Schedule", "amount"), DASH);
  assert.equal(namedTableTotal(doc, "Aging Schedule", "share"), DASH);
});

test("a zero overdue total reports no share instead of NaN", () => {
  // The server sends `share_percent: null` for every bucket when the total is 0.
  const doc = buildAgingDoc(
    {
      buckets: {
        "1_30": { amount: 0, count: 0, share_percent: null },
        "31_60": { amount: 0, count: 0, share_percent: null },
        "61_90": { amount: 0, count: 0, share_percent: null },
        over_90: { amount: 0, count: 0, share_percent: null },
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
  assert.equal(rows[1].amount_paid, 1000); // the server's amount_paid
});

test("a row's Paid is the server's amount_paid, never its components added up", () => {
  const doc = buildDuePastDueListDoc(
    {
      data: [
        DUE_ROWS[0],
        (() => {
          const { amount_paid, ...silent } = DUE_ROWS[1];
          void amount_paid;
          return silent;
        })(),
      ],
    },
    RANGE
  );
  const rows = tableRows(doc);

  // An unpaid row the server reports as 0 stays a real zero.
  assert.equal(rows[0].amount_paid, 0);
  // principal_paid (1,000) + interest_paid (0) is not worked out here.
  assert.equal(rows[1].amount_paid, null);
  const table = namedTable(doc, "Due / Past Due");
  const paid = table.columns.find((c) => c.key === "amount_paid");
  assert.ok(paid);
  assert.equal(formatCell(rows[1], paid), DASH);
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

test("due/past due's Paid total is the server's figure, never the page added up", () => {
  const withPaid = buildDuePastDueListDoc(
    { data: DUE_ROWS, meta: { total: 1432 }, totals: { ...DUE_TOTALS, total_paid: 272859.5 } },
    RANGE
  );
  assert.equal(tableTotal(withPaid, "amount_paid"), "₱272,859.50");

  // The rows on this page paid 1,000.00 between them; that is not the total.
  const without = buildDuePastDueListDoc(
    { data: DUE_ROWS, meta: { total: 1432 }, totals: DUE_TOTALS },
    RANGE
  );
  assert.equal(tableTotal(without, "amount_paid"), DASH);
});

test("releases list carries the application number", () => {
  const doc = buildReleasesListDoc({ data: RELEASE_ROWS, meta: { total: 2 } }, RANGE);
  assert.equal(tableRows(doc)[0].application_number, "APP-2026-0001");
});

// ---------------------------------------------------------------------------
// Statement of Account / Subsidiary Ledger
//
// These fixtures pin the shape ReportService sends; the alias tests below pin
// the fallbacks the builders still read. Every total is the server's.
// ---------------------------------------------------------------------------

const SOA_PAYLOAD = {
  as_of: "2026-11-05",
  schedule_note: null,
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
  summary: { total_paid: 9500, outstanding_balance: 34500.25, overdue_amount: 5450.5 },
  amortization_schedule: [
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
      amount_paid: 9500,
      total_paid: 9615.98,
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
      amount_paid: 0,
      total_paid: 0,
      amount_remaining: 9510,
      status: "overdue",
    },
  ],
  schedule_totals: {
    principal_due: 16000,
    interest_due: 2760,
    penalty_amount: 250,
    total_due: 19010,
    amount_paid: 9500,
    total_paid: 9615.98,
  },
  transactions: [
    {
      date: "2026-03-01",
      receipt_number: "OR-1001",
      amount_paid: 9500,
      principal_applied: 8000,
      interest_applied: 1500,
      penalty_applied: 0,
      debit: null,
      credit: 9500,
      principal_balance: 42000,
    },
  ],
  transaction_totals: { debit: 0, credit: 9500 },
};

test("statement of account opens with the account particulars", () => {
  const doc = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);

  assert.equal(doc.reportId, "statement_of_account");
  assert.equal(fieldValue(doc, "Account Particulars", "Member"), "Maria Santos");
  assert.equal(fieldValue(doc, "Account Particulars", "Loan Account No."), "LN-2026-0001");
  assert.equal(fieldValue(doc, "Account Particulars", "Principal"), "₱50,000.00");
  assert.equal(fieldValue(doc, "Account Particulars", "Interest Rate"), "3.0%");
});

test("statement of account labels the loan's status as the loans screens do", () => {
  const doc = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);
  assert.equal(fieldValue(doc, "Account Particulars", "Status"), "Current");
});

test("statement of account states a fractional rate exactly", () => {
  const doc = buildStatementOfAccountDoc(
    { ...SOA_PAYLOAD, loan: { ...SOA_PAYLOAD.loan, interest_rate: "1.1250" } },
    RANGE
  );
  // Not "1.1%": a loan's own rate keeps every stored place.
  assert.equal(fieldValue(doc, "Account Particulars", "Interest Rate"), "1.125%");
});

test("statement of account particulars omit what the API did not send", () => {
  const doc = buildStatementOfAccountDoc(
    { loan: { loan_account_number: "LN-2026-0001" }, borrower: { full_name: "Maria Santos" } },
    RANGE
  );
  const labels = fieldItems(doc, "Account Particulars").map((f) => f.label);

  assert.deepEqual(labels, ["Member", "Loan Account No."]);
  assert.equal(labels.includes("Maturity Date"), false);
});

test("statement of account reads the summary block for its balances", () => {
  const doc = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);

  assert.equal(kpiValue(doc, "Total Paid"), "₱9,500.00");
  assert.equal(kpiValue(doc, "Outstanding Balance"), "₱34,500.25");
  assert.equal(kpiValue(doc, "Past Due"), "₱5,450.50");
});

test("statement of account says what the Outstanding Balance is made of", () => {
  const doc = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);
  assert.equal(
    kpi(doc, "Outstanding Balance").hint,
    "Principal, interest, penalty and insurance premium still owed"
  );
});

test("statement of account's Past Due is the server's summary.overdue_amount only", () => {
  // The grace-rule figure. The loose aliases are other figures, so a summary
  // without overdue_amount shows a dash rather than one of them.
  const doc = buildStatementOfAccountDoc(
    {
      ...SOA_PAYLOAD,
      summary: { total_paid: 9500, outstanding_balance: 34500.25, past_due_amount: 1, total_overdue: 2 },
    },
    RANGE
  );
  assert.equal(kpiValue(doc, "Past Due"), DASH);

  const zero = buildStatementOfAccountDoc(
    { ...SOA_PAYLOAD, summary: { ...SOA_PAYLOAD.summary, overdue_amount: 0 } },
    RANGE
  );
  assert.equal(kpiValue(zero, "Past Due"), "₱0.00");
});

test("statement of account's transaction Reference is the payment's receipt number", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE), "Transaction History");
  const column = table.columns.find((c) => c.key === "reference")!;

  assert.equal(table.rows[0].reference, "OR-1001");
  assert.equal(formatCell(table.rows[0], column), "OR-1001");
});

test("a transaction without a receipt number shows a dash, never the row's id", () => {
  const { receipt_number, ...withoutReceipt } = SOA_PAYLOAD.transactions[0];
  void receipt_number;
  const table = namedTable(
    buildStatementOfAccountDoc(
      { ...SOA_PAYLOAD, transactions: [{ ...withoutReceipt, id: 42 }] },
      RANGE
    ),
    "Transaction History"
  );
  const column = table.columns.find((c) => c.key === "reference")!;

  assert.equal(table.rows[0].reference, null);
  assert.equal(formatCell(table.rows[0], column), DASH);
});

test("statement of account's schedule Balance is the server's amount_remaining only", () => {
  const [first, second] = SOA_PAYLOAD.amortization_schedule;
  const { amount_remaining, ...withoutRemaining } = second;
  void amount_remaining;
  const table = namedTable(
    buildStatementOfAccountDoc(
      {
        ...SOA_PAYLOAD,
        // `balance` and `remaining_balance` are not the period's remaining
        // amount; a row without amount_remaining shows a dash.
        amortization_schedule: [first, { ...withoutRemaining, balance: 1, remaining_balance: 2 }],
      },
      RANGE
    ),
    "Amortization Schedule"
  );
  const column = table.columns.find((c) => c.key === "balance")!;

  assert.equal(table.rows[0].balance, 0);
  assert.equal(formatCell(table.rows[0], column), "₱0.00");
  assert.equal(table.rows[1].balance, null);
  assert.equal(formatCell(table.rows[1], column), DASH);
});

test("the amortization schedule shows each period's paid figure as the server sent it", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE), "Amortization Schedule");

  assert.equal(table.rows[0].total_paid, 9615.98);
  assert.equal(table.rows[1].total_paid, 0);
  assert.equal(table.rows[1].balance, 9510);
});

test("a period without total_paid shows a dash, not amount_paid or its components added up", () => {
  const [first, second] = SOA_PAYLOAD.amortization_schedule;
  const { total_paid, ...withoutPaid } = first;
  void total_paid;
  const table = namedTable(
    buildStatementOfAccountDoc(
      { ...SOA_PAYLOAD, amortization_schedule: [withoutPaid, second] },
      RANGE
    ),
    "Amortization Schedule"
  );
  const paid = table.columns.find((c) => c.key === "total_paid");
  assert.ok(paid);
  assert.equal(paid.header, "Period Paid");

  assert.equal(table.rows[0].total_paid, null);
  assert.equal(formatCell(table.rows[0], paid), DASH);
  assert.equal(table.columns.some((c) => c.key === "amount_paid"), false);
});

test("the schedule's Paid footer is total_paid, never amount_paid", () => {
  const { total_paid, ...withoutTotal } = SOA_PAYLOAD.schedule_totals;
  void total_paid;
  const doc = buildStatementOfAccountDoc({ ...SOA_PAYLOAD, schedule_totals: withoutTotal }, RANGE);
  assert.equal(namedTableTotal(doc, "Amortization Schedule", "total_paid"), DASH);

  const sent = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);
  assert.equal(namedTableTotal(sent, "Amortization Schedule", "total_paid"), "₱9,615.98");
});

test("the schedule footer is the server's schedule_totals", () => {
  const doc = buildStatementOfAccountDoc(
    {
      ...SOA_PAYLOAD,
      // Deliberately unlike the rows, so a sum of the rows cannot pass.
      schedule_totals: {
        principal_due: 48000,
        interest_due: 7560.5,
        penalty_amount: 1250.25,
        total_due: 56810.75,
        total_paid: 28500,
      },
    },
    RANGE
  );

  assert.equal(namedTableTotal(doc, "Amortization Schedule", "principal_due"), "₱48,000.00");
  assert.equal(namedTableTotal(doc, "Amortization Schedule", "interest_due"), "₱7,560.50");
  assert.equal(namedTableTotal(doc, "Amortization Schedule", "penalty_amount"), "₱1,250.25");
  assert.equal(namedTableTotal(doc, "Amortization Schedule", "total_due"), "₱56,810.75");
  assert.equal(namedTableTotal(doc, "Amortization Schedule", "total_paid"), "₱28,500.00");
});

test("the transaction footer is the server's transaction_totals", () => {
  const doc = buildStatementOfAccountDoc(
    { ...SOA_PAYLOAD, transaction_totals: { debit: 0, credit: 21000.5 } },
    RANGE
  );

  assert.equal(namedTableTotal(doc, "Transaction History", "debit"), "₱0.00");
  assert.equal(namedTableTotal(doc, "Transaction History", "credit"), "₱21,000.50");
});

test("statement footers show dashes, not sums of the rows, without the server's totals", () => {
  const { schedule_totals, transaction_totals, ...withoutTotals } = SOA_PAYLOAD;
  void schedule_totals;
  void transaction_totals;
  const doc = buildStatementOfAccountDoc(withoutTotals, RANGE);

  for (const column of ["principal_due", "interest_due", "penalty_amount", "total_due", "total_paid"]) {
    assert.equal(namedTableTotal(doc, "Amortization Schedule", column), DASH, column);
  }
  assert.equal(namedTableTotal(doc, "Transaction History", "debit"), DASH);
  assert.equal(namedTableTotal(doc, "Transaction History", "credit"), DASH);
});

test("a transaction row carries the server's debit and credit", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE), "Transaction History");

  assert.equal(table.rows[0].credit, 9500);
  assert.equal(table.rows[0].debit, null);
  assert.equal(table.rows[0].principal_balance, 42000);
});

test("a transaction row shows the insurance premium it collected, so the balance's drop is explained", () => {
  // The statement opens at principal + premium owed; each payment takes off
  // its principal and its premium. The column is the server's figure only.
  const table = namedTable(
    buildStatementOfAccountDoc(
      {
        ...SOA_PAYLOAD,
        transactions: [
          { ...SOA_PAYLOAD.transactions[0], credit: 9900, amount_paid: 9900, insurance_applied: 400, principal_balance: 42000 },
          { ...SOA_PAYLOAD.transactions[0], date: "2026-04-01", insurance_applied: 0, principal_balance: 34000 },
        ],
      },
      RANGE
    ),
    "Transaction History"
  );
  const column = table.columns.find((c) => c.key === "insurance_applied");

  assert.equal(column?.header, "Insurance Premium");
  assert.equal(column?.format, "currency");
  assert.equal(table.rows[0].insurance_applied, 400);
  assert.equal(table.rows[1].insurance_applied, 0);
  // Placed right before the running balance it explains.
  const keys = table.columns.map((c) => c.key);
  assert.equal(keys.indexOf("insurance_applied"), keys.indexOf("principal_balance") - 1);
});

test("a line without the server's premium figure shows a dash, never a worked-out one", () => {
  const { insurance_applied, ...withoutPremium } = {
    ...SOA_PAYLOAD.transactions[0],
    insurance_applied: 400,
  };
  void insurance_applied;
  const table = namedTable(
    buildStatementOfAccountDoc(
      {
        ...SOA_PAYLOAD,
        transactions: [withoutPremium, { ...SOA_PAYLOAD.transactions[0], insurance_applied: 400 }],
      },
      RANGE
    ),
    "Transaction History"
  );
  const column = table.columns.find((c) => c.key === "insurance_applied")!;

  assert.equal(table.rows[0].insurance_applied, null);
  assert.equal(formatCell(table.rows[0], column), DASH);
});

test("a typed transaction is posted to the correct side of the ledger", () => {
  const table = namedTable(
    buildStatementOfAccountDoc(
      {
        ...SOA_PAYLOAD,
        transactions: [
          {
            date: "2026-03-01",
            type: "repayment",
            reference: "OR-1001",
            method: "cash",
            amount: 9500,
            principal_balance: 42000,
          },
        ],
      },
      RANGE
    ),
    "Transaction History"
  );

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
  // `balance` stays an alias of `principal_balance` for one release.
  assert.equal(table.rows[0].principal_balance, 50000);
});

test("a failed statement request still renders the shell", () => {
  const doc = buildStatementOfAccountDoc(null, RANGE);

  assert.equal(kpiValue(doc, "Outstanding Balance"), DASH);
  assert.equal(namedTable(doc, "Amortization Schedule").rows.length, 0);
});

// ---------------------------------------------------------------------------
// D3: the Statement of Account's High findings. Payloads follow the contract
// between the backend and frontend slices of round fx.
// ---------------------------------------------------------------------------

const SOA_ADJUSTED = {
  ...SOA_PAYLOAD,
  as_of: "2026-11-05",
  schedule_note: "A balance adjustment restated this schedule on Nov 3, 2026.",
  loan: { ...SOA_PAYLOAD.loan, status: "ongoing", status_label: "Past Due", has_build_up: false },
  transactions: [
    {
      type: "payment",
      date: "2026-10-05",
      receipt_number: "RCP-000012",
      payment_method: "GCash",
      reference_number: "GC12345678",
      particulars: "Payment RCP-000012",
      credit: 10000,
      debit: null,
      principal_applied: 5910.11,
      interest_applied: 3855.03,
      penalty_applied: 234.86,
      insurance_applied: 100,
      build_up_applied: 0,
      principal_balance: 74089.89,
      balance: 74089.89,
    },
    {
      type: "adjustment",
      date: "2026-11-03",
      receipt_number: null,
      payment_method: null,
      reference_number: null,
      particulars: "Balance adjustment",
      credit: 600,
      debit: null,
      principal_applied: null,
      interest_applied: null,
      penalty_applied: null,
      insurance_applied: null,
      build_up_applied: null,
      principal_balance: 73489.89,
      balance: 73489.89,
    },
  ],
};

const SOA_BUILD_UP = {
  ...SOA_PAYLOAD,
  loan: { ...SOA_PAYLOAD.loan, has_build_up: true },
  amortization_schedule: [
    { ...SOA_PAYLOAD.amortization_schedule[0], total_due: 4330, build_up_due: 100, total_payment: 4430 },
  ],
  // Deliberately unlike the row, so a sum of the rows cannot pass.
  schedule_totals: { ...SOA_PAYLOAD.schedule_totals, total_due: 8660, build_up_due: 200, total_payment: 8860 },
  transactions: [
    {
      ...SOA_ADJUSTED.transactions[0],
      credit: 4430,
      principal_applied: 4000,
      interest_applied: 330,
      penalty_applied: 0,
      insurance_applied: 25,
      build_up_applied: 100,
    },
  ],
};

test("finding 1: an adjustment is its own line, in the running balance", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_ADJUSTED, RANGE), "Transaction History");

  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[1].particulars, "Balance adjustment");
  assert.equal(table.rows[1].credit, 600);
  assert.equal(table.rows[1].principal_balance, 73489.89);
});

test("finding 1: an adjustment line has no method or split, so those cells show a dash", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_ADJUSTED, RANGE), "Transaction History");
  for (const key of ["method", "principal_applied", "interest_applied", "penalty_applied", "insurance_applied"]) {
    const column = table.columns.find((c) => c.key === key)!;
    assert.equal(formatCell(table.rows[1], column), DASH, key);
  }
});

test("finding 1: the schedule shows the server's note when an adjustment restated it", () => {
  const doc = buildStatementOfAccountDoc(SOA_ADJUSTED, RANGE);
  const scheduleAt = doc.sections.findIndex((s) => s.kind === "table" && s.title === "Amortization Schedule");
  const after = doc.sections[scheduleAt + 1];

  assert.ok(after && after.kind === "note", "expected a note right after the schedule");
  assert.equal(after.text, SOA_ADJUSTED.schedule_note);
});

test("finding 1: no note when the schedule wasn't restated, or the server sent none", () => {
  const { schedule_note, ...withoutNote } = SOA_PAYLOAD;
  void schedule_note;
  for (const payload of [SOA_PAYLOAD, withoutNote]) {
    const doc = buildStatementOfAccountDoc(payload, RANGE);
    assert.equal(doc.sections.some((s) => s.kind === "note"), false);
  }
});

test("finding 2: the column is Principal Balance, and each line shows its split in order", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_ADJUSTED, RANGE), "Transaction History");

  assert.deepEqual(
    table.columns.map((c) => c.header),
    ["Date", "Reference", "Particulars", "Method", "Receipt Amount", "Debit", "Credit", "Principal", "Interest", "Penalty", "Insurance Premium", "Principal Balance"]
  );
  assert.equal(table.rows[0].principal_applied, 5910.11);
  assert.equal(table.rows[0].interest_applied, 3855.03);
  assert.equal(table.rows[0].penalty_applied, 234.86);
  assert.equal(table.rows[0].insurance_applied, 100);
  assert.equal(table.rows[0].principal_balance, 74089.89);
});

test("finding 2: the split comes as sent, never worked out from the amount", () => {
  const { principal_applied, ...withoutPrincipal } = SOA_ADJUSTED.transactions[0];
  void principal_applied;
  const table = namedTable(
    buildStatementOfAccountDoc({ ...SOA_ADJUSTED, transactions: [withoutPrincipal] }, RANGE),
    "Transaction History"
  );
  const column = table.columns.find((c) => c.key === "principal_applied")!;
  assert.equal(formatCell(table.rows[0], column), DASH);
});

test("finding 2: a line without principal_balance shows a dash, not the old principal-plus-premium figure", () => {
  const { principal_balance, balance, ...rest } = SOA_ADJUSTED.transactions[0];
  void principal_balance;
  void balance;
  const table = namedTable(
    buildStatementOfAccountDoc({ ...SOA_ADJUSTED, transactions: [{ ...rest, running_balance: 99 }] }, RANGE),
    "Transaction History"
  );
  const column = table.columns.find((c) => c.key === "principal_balance")!;
  assert.equal(formatCell(table.rows[0], column), DASH);
});

test("finding 3: Total Due and its footer are shown as the server sends them, penalty included", () => {
  const penaltyRow = { ...SOA_PAYLOAD.amortization_schedule[1], principal_due: 6092.54, interest_due: 1706.43, penalty_amount: 121.85, total_due: 7920.82 };
  const doc = buildStatementOfAccountDoc(
    { ...SOA_PAYLOAD, amortization_schedule: [penaltyRow], schedule_totals: { ...SOA_PAYLOAD.schedule_totals, total_due: 94197.28 } },
    RANGE
  );
  assert.equal(namedTable(doc, "Amortization Schedule").rows[0].total_due, 7920.82);
  assert.equal(namedTableTotal(doc, "Amortization Schedule", "total_due"), "₱94,197.28");
});

test("finding 4: the Method column shows the stored method with the reference number", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_ADJUSTED, RANGE), "Transaction History");
  const column = table.columns.find((c) => c.key === "method")!;

  assert.equal(formatCell(table.rows[0], column), "GCash (Ref. GC12345678)");
  // The Reference column stays the receipt number.
  assert.equal(table.rows[0].reference, "RCP-000012");
});

test("finding 4: a cash payment shows its method alone", () => {
  const table = namedTable(
    buildStatementOfAccountDoc(
      { ...SOA_ADJUSTED, transactions: [{ ...SOA_ADJUSTED.transactions[0], payment_method: "Cash", reference_number: null }] },
      RANGE
    ),
    "Transaction History"
  );
  assert.equal(table.rows[0].method, "Cash");
});

test("finding 4: the label wins over a raw method key", () => {
  const table = namedTable(
    buildStatementOfAccountDoc(
      { ...SOA_ADJUSTED, transactions: [{ ...SOA_ADJUSTED.transactions[0], method: "gcash", reference_number: null }] },
      RANGE
    ),
    "Transaction History"
  );
  assert.equal(table.rows[0].method, "GCash");
});

test("finding 5: the statement reads As of the server's date, with no period", () => {
  const doc = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);

  assert.equal(doc.meta.period, undefined);
  assert.equal(doc.meta.asOf, formatValue("2026-11-05", "date"));
  assert.deepEqual(reportScope(doc.meta), { label: "As of", value: formatValue("2026-11-05", "date") });
  assert.equal(reportScopeLine(doc.meta), `As of ${formatValue("2026-11-05", "date")}`);
});

test("finding 5: without the server's date, As of shows a dash, and the picked range never prints", () => {
  const { as_of, ...withoutDate } = SOA_PAYLOAD;
  void as_of;
  for (const payload of [withoutDate, null]) {
    const doc = buildStatementOfAccountDoc(payload, RANGE);
    assert.equal(reportScopeLine(doc.meta), `As of ${DASH}`);
  }
});

test("finding 5: every other report keeps its Period line", () => {
  const doc = buildIncomeDoc(null, RANGE);
  assert.equal(doc.meta.asOf, undefined);
  assert.equal(reportScope(doc.meta).label, "Period:");
  assert.equal(reportScopeLine(doc.meta), `Period: ${doc.meta.period}`);
});

test("finding 6: Status is the server's label, Past Due included", () => {
  const doc = buildStatementOfAccountDoc(SOA_ADJUSTED, RANGE);
  assert.equal(fieldValue(doc, "Account Particulars", "Status"), "Past Due");
});

test("finding 7: a build-up loan's schedule gets the two columns, with the server's totals", () => {
  const doc = buildStatementOfAccountDoc(SOA_BUILD_UP, RANGE);
  const table = namedTable(doc, "Amortization Schedule");
  const keys = table.columns.map((c) => c.key);

  assert.equal(table.columns.find((c) => c.key === "build_up_due")?.header, "Share Capital Build-Up");
  assert.equal(table.columns.find((c) => c.key === "total_payment")?.header, "Total Payment");
  assert.equal(keys.indexOf("build_up_due"), keys.indexOf("total_due") + 1);
  assert.equal(keys.indexOf("total_payment"), keys.indexOf("build_up_due") + 1);
  assert.equal(table.rows[0].build_up_due, 100);
  assert.equal(table.rows[0].total_payment, 4430);
  assert.equal(namedTableTotal(doc, "Amortization Schedule", "build_up_due"), "₱200.00");
  assert.equal(namedTableTotal(doc, "Amortization Schedule", "total_payment"), "₱8,860.00");
});

test("finding 7: a build-up loan's lines show the build-up, so a line adds up to the amount received", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_BUILD_UP, RANGE), "Transaction History");
  const keys = table.columns.map((c) => c.key);

  assert.equal(table.columns.find((c) => c.key === "build_up_applied")?.header, "Build-Up");
  assert.equal(keys.indexOf("build_up_applied"), keys.indexOf("insurance_applied") + 1);
  assert.equal(keys.indexOf("principal_balance"), keys.indexOf("build_up_applied") + 1);
  assert.equal(table.rows[0].build_up_applied, 100);
});

test("finding 7: a build-up column shows a dash where the server sent no figure, and no browser sum", () => {
  const { build_up_due, total_payment, ...row } = SOA_BUILD_UP.amortization_schedule[0];
  void build_up_due;
  void total_payment;
  const doc = buildStatementOfAccountDoc(
    { ...SOA_BUILD_UP, amortization_schedule: [row], schedule_totals: SOA_PAYLOAD.schedule_totals },
    RANGE
  );
  const table = namedTable(doc, "Amortization Schedule");

  for (const key of ["build_up_due", "total_payment"]) {
    assert.equal(formatCell(table.rows[0], table.columns.find((c) => c.key === key)!), DASH, key);
    assert.equal(namedTableTotal(doc, "Amortization Schedule", key), DASH, key);
  }
});

test("finding 7: a loan without a build-up, or a server that doesn't say, gets neither column", () => {
  for (const payload of [SOA_ADJUSTED, SOA_PAYLOAD]) {
    const doc = buildStatementOfAccountDoc(payload, RANGE);
    const schedule = namedTable(doc, "Amortization Schedule").columns.map((c) => c.key);
    const lines = namedTable(doc, "Transaction History").columns.map((c) => c.key);

    assert.equal(schedule.includes("build_up_due"), false);
    assert.equal(schedule.includes("total_payment"), false);
    assert.equal(lines.includes("build_up_applied"), false);
  }
});

test("the Overpayment column shows only when a line has a non-zero overpayment", () => {
  const line = SOA_ADJUSTED.transactions[0];
  const withOverpayment = buildStatementOfAccountDoc(
    {
      ...SOA_ADJUSTED,
      transactions: [
        { ...line, overpayment_applied: 150.5 },
        { ...line, overpayment_applied: 0 },
      ],
      // Deliberately unlike the rows, so a sum of the rows cannot pass.
      transaction_totals: { debit: 0, credit: 20000, overpayment_applied: 900.25 },
    },
    RANGE
  );
  const table = namedTable(withOverpayment, "Transaction History");
  const column = table.columns.find((c) => c.key === "overpayment_applied");
  const keys = table.columns.map((c) => c.key);

  assert.equal(column?.header, "Overpayment");
  assert.equal(column?.format, "currency");
  assert.equal(keys.indexOf("principal_balance"), keys.indexOf("overpayment_applied") + 1);
  assert.equal(formatCell(table.rows[0], column!), "₱150.50");
  assert.equal(formatCell(table.rows[1], column!), "₱0.00");
  assert.equal(namedTableTotal(withOverpayment, "Transaction History", "overpayment_applied"), "₱900.25");

  for (const transactions of [
    [{ ...line, overpayment_applied: 0 }, { ...line, overpayment_applied: "0.00" }],
    [line],
  ]) {
    const none = buildStatementOfAccountDoc({ ...SOA_ADJUSTED, transactions }, RANGE);
    const lines = namedTable(none, "Transaction History");
    assert.equal(lines.columns.some((c) => c.key === "overpayment_applied"), false);
    assert.equal(lines.totals?.some((t) => t.column === "overpayment_applied"), false);
  }
});

test("the Overpayment total shows a dash when the server sends none, never a sum of the lines", () => {
  const doc = buildStatementOfAccountDoc(
    { ...SOA_ADJUSTED, transactions: [{ ...SOA_ADJUSTED.transactions[0], overpayment_applied: 150.5 }] },
    RANGE
  );
  assert.equal(namedTableTotal(doc, "Transaction History", "overpayment_applied"), DASH);
});

test("the statement's wider tables print in the PDF's smaller type, and only those", () => {
  const plain = buildStatementOfAccountDoc(SOA_ADJUSTED, RANGE);
  assert.equal(namedTable(plain, "Amortization Schedule").compact, false);
  assert.equal(namedTable(plain, "Transaction History").compact, true);

  const buildUp = buildStatementOfAccountDoc(SOA_BUILD_UP, RANGE);
  assert.equal(namedTable(buildUp, "Amortization Schedule").compact, true);
});

test("finding 7: the Outstanding Balance card stays the summary's figure, without the build-up", () => {
  const doc = buildStatementOfAccountDoc(SOA_BUILD_UP, RANGE);
  assert.equal(kpiValue(doc, "Outstanding Balance"), "₱34,500.25");
});

test("the subsidiary ledger keeps its own Balance column and running balance", () => {
  const table = namedTable(
    buildSubsidiaryLedgerDoc(
      { borrower: { full_name: "Maria Santos" }, loans: [], transactions: [{ date: "2026-03-01", credit: 100, running_balance: 900 }] },
      RANGE
    ),
    "Payment History"
  );
  assert.equal(table.columns.at(-1)?.header, "Balance");
  assert.equal(table.rows[0].running_balance, 900);
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
      outstanding_balance: 31000,
      outstanding_principal: 31000,
      total_outstanding: 34500.25,
      overdue_amount: 5450.5,
      status: "ongoing",
      display_status: "past_due",
    },
    {
      loan_account_number: "LN-2025-0044",
      release_date: "2025-06-01",
      principal_amount: 30000,
      total_paid: 30000,
      outstanding_balance: 0,
      outstanding_principal: 0,
      total_outstanding: 0,
      overdue_amount: 0,
      status: "closed",
      display_status: "closed",
    },
  ],
  totals: {
    total_loans: 2,
    total_portfolio: 80000,
    total_principal: 80000,
    total_paid: 51000.5,
    total_outstanding: 34500.25,
  },
  loans_totals: {
    principal_amount: 80000,
    total_paid: 51000.5,
    outstanding_principal: 31000,
    total_outstanding: 34500.25,
    overdue_amount: 5450.5,
  },
};

const LEDGER_ENTRIES = [
  {
    transaction_date: "2026-03-01",
    type: "payment",
    reference: "OR-1001",
    amount: 9500,
    running_balance: 42000,
  },
];

test("subsidiary ledger lists every loan account for the borrower", () => {
  const doc = buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE);
  const table = namedTable(doc, "Loan Accounts");

  assert.equal(doc.reportId, "subsidiary_ledger");
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0].loan_account_number, "LN-2026-0001");
  assert.equal(namedTableTotal(doc, "Loan Accounts", "principal"), "₱80,000.00");
  assert.equal(namedTableTotal(doc, "Loan Accounts", "total_paid"), "₱51,000.50");
  assert.equal(namedTableTotal(doc, "Loan Accounts", "principal_balance"), "₱31,000.00");
  assert.equal(namedTableTotal(doc, "Loan Accounts", "outstanding"), "₱34,500.25");
  // The server's Past Due total, from its column totals.
  assert.equal(namedTableTotal(doc, "Loan Accounts", "overdue"), "₱5,450.50");
});

test("subsidiary ledger labels each loan's status as the loans screens do", () => {
  const rows = namedTable(buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE), "Loan Accounts").rows;
  // The server's display_status: a loan past grace reads Past Due, as on the loans screens.
  assert.deepEqual(rows.map((r) => r.status), ["Past Due", "Closed"]);
  assert.equal(rows[0].overdue, 5450.5);
});

test("subsidiary ledger reads the branch off the nested relation", () => {
  const doc = buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE);
  assert.equal(fieldValue(doc, "Member Particulars", "Branch"), "Main");
  assert.equal(fieldValue(doc, "Member Particulars", "Member No."), "MB-0005");
});

test("ledger KPIs read the server's totals block", () => {
  const doc = buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE);

  assert.equal(kpiValue(doc, "Total Loans"), "2");
  assert.equal(kpiValue(doc, "Total Released"), "₱80,000.00");
  assert.equal(kpiValue(doc, "Total Paid"), "₱51,000.50");
  assert.equal(kpiValue(doc, "Outstanding"), "₱34,500.25");
});

test("the ledger shows each loan's Principal Balance and Outstanding as sent, never the old alias", () => {
  const doc = buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE);
  const table = namedTable(doc, "Loan Accounts");

  assert.deepEqual(
    table.columns.map((c) => c.header).filter((h) => /Balance|Outstanding/.test(h)),
    ["Principal Balance", "Outstanding"]
  );
  assert.equal(table.rows[0].principal_balance, 31000);
  assert.equal(table.rows[0].outstanding, 34500.25);
  assert.throws(() => kpiValue(doc, "Outstanding Balance"), /not found/);
});

test("the ledger's KPIs and footer are the server's figures, not the accounts added up", () => {
  const doc = buildSubsidiaryLedgerDoc(
    {
      ...LEDGER_PAYLOAD,
      totals: {
        total_loans: 9,
        total_principal: 410000,
        total_paid: 220000.75,
        total_outstanding: 190000.25,
      },
    },
    RANGE
  );

  assert.equal(kpiValue(doc, "Total Loans"), "9");
  assert.equal(kpiValue(doc, "Total Released"), "₱410,000.00");
  assert.equal(kpiValue(doc, "Total Paid"), "₱220,000.75");
  assert.equal(kpiValue(doc, "Outstanding"), "₱190,000.25");
  assert.equal(namedTableTotal(doc, "Loan Accounts", "principal"), "₱410,000.00");
  assert.equal(namedTableTotal(doc, "Loan Accounts", "total_paid"), "₱220,000.75");
  assert.equal(namedTableTotal(doc, "Loan Accounts", "outstanding"), "₱190,000.25");
});

test("the ledger shows dashes, not sums of the accounts, without server totals", () => {
  const { totals, loans_totals, ...withoutTotals } = LEDGER_PAYLOAD;
  void totals;
  void loans_totals;
  const doc = buildSubsidiaryLedgerDoc(withoutTotals, RANGE);

  for (const label of ["Total Loans", "Total Released", "Total Paid", "Outstanding"]) {
    assert.equal(kpiValue(doc, label), DASH, label);
  }
  for (const column of ["principal", "total_paid", "principal_balance", "outstanding", "overdue"]) {
    assert.equal(namedTableTotal(doc, "Loan Accounts", column), DASH, column);
  }
});

test("the ledger hides payment history rather than claim there were no payments", () => {
  assert.equal(
    hasTable(buildSubsidiaryLedgerDoc({ ...LEDGER_PAYLOAD, entries: LEDGER_ENTRIES }, RANGE), "Payment History"),
    true
  );
  assert.equal(hasTable(buildSubsidiaryLedgerDoc(LEDGER_PAYLOAD, RANGE), "Payment History"), false);
});

test("payment history is never footed with a sum of its entries", () => {
  const doc = buildSubsidiaryLedgerDoc({ ...LEDGER_PAYLOAD, entries: LEDGER_ENTRIES }, RANGE);
  assert.equal(namedTable(doc, "Payment History").totals, undefined);
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
  const at = new Date("2026-08-06T01:15:00Z");
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
      insurance: 400,
      overpayment: 3800,
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
  by_branch_totals: {
    inflow_total: 1013651.5,
    outflow_total: 742800.4,
    net_movement: 270851.1,
  },
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
      "Insurance premium collected",
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
  assert.equal(inflows.rows[3].amount, 400);
  assert.equal(inflows.rows[4].amount, 3800);
  assert.equal(inflows.rows[5].amount, 96500);
  // `outflows.total` includes share capital; only `releases.net_proceeds` is
  // the release line, so reading the wrong one double-counts the withdrawal.
  assert.equal(namedTable(doc, "Cash Outflows").rows[0].amount, 742800.4);
  assert.equal(namedTable(doc, "Cash Outflows").rows[1].amount, 31500);
});

test("cash flow shows the insurance premium collected as its own repayment line, a dash when not sent", () => {
  // Premium collected from payments is cash in, inside the repayments total;
  // it is never income and never added to a total here.
  const doc = buildCashFlowDoc(CASH_FLOW_PAYLOAD, RANGE);
  const line = namedTable(doc, "Cash Inflows").rows.find((r) => r.particulars === "Insurance premium collected");
  assert.equal(line?.amount, 400);
  assert.equal(namedTableTotal(doc, "Cash Inflows", "amount"), "₱1,110,151.50");

  const older = buildCashFlowDoc(
    { inflows: { repayments: { principal: 100.25, interest: 20.5, total: 120.75 }, total: 120.75 } },
    RANGE
  );
  const missing = namedTable(older, "Cash Inflows").rows.find((r) => r.particulars === "Insurance premium collected");
  assert.equal(missing?.amount, null);
});

test("cash flow still reads a flat payload that never nested the components", () => {
  const doc = buildCashFlowDoc(
    {
      inflows: { principal: 100.25, interest: 20.5, share_capital_credit: 5, total: 125.75 },
      outflows: { net_proceeds: 60.75, total: 60.75 },
    },
    RANGE
  );

  assert.equal(namedTable(doc, "Cash Inflows").rows[0].amount, 100.25);
  assert.equal(namedTable(doc, "Cash Outflows").rows[0].amount, 60.75);
  assert.equal(kpiValue(doc, "Total Cash In"), "₱125.75");
});

test("cash flow never derives the net from the two totals", () => {
  const { net_movement, ...withoutNet } = CASH_FLOW_PAYLOAD;
  void net_movement;
  const doc = buildCashFlowDoc(withoutNet, RANGE);

  // Not ₱335,851.10 (cash in less cash out).
  assert.equal(kpiValue(doc, "Net Movement"), DASH);
  assert.equal(kpi(doc, "Net Movement").tone, "neutral");
  assert.equal(fieldValue(doc, "Net Cash Movement", "Net movement for the period"), DASH);
});

test("cash flow never totals the lines when a block sends no total", () => {
  const doc = buildCashFlowDoc(
    {
      inflows: { repayments: { principal: 100.25, interest: 20.5 } },
      outflows: { releases: { net_proceeds: 60.75 } },
    },
    RANGE
  );

  // The lines still show; only the totals the server did not send are dashes.
  assert.equal(namedTable(doc, "Cash Inflows").rows[0].amount, 100.25);
  assert.equal(kpiValue(doc, "Total Cash In"), DASH);
  assert.equal(kpiValue(doc, "Total Cash Out"), DASH);
  assert.equal(kpiValue(doc, "Net Movement"), DASH);
  assert.equal(namedTableTotal(doc, "Cash Inflows", "amount"), DASH);
  assert.equal(namedTableTotal(doc, "Cash Outflows", "amount"), DASH);
});

test("a branch row's net is the server's, never cash in less cash out", () => {
  const [main, talisay] = CASH_FLOW_PAYLOAD.by_branch;
  const { net_movement, ...mainWithoutNet } = main;
  void net_movement;
  const table = namedTable(
    buildCashFlowDoc({ ...CASH_FLOW_PAYLOAD, by_branch: [mainWithoutNet, talisay] }, RANGE),
    "Breakdown by Branch"
  );

  assert.equal(table.rows[0].net, null);
  assert.equal(table.rows[1].net, 63201.25);
});

test("the cash flow branch footer is by_branch_totals, or dashes without it", () => {
  const withTotals = buildCashFlowDoc(
    {
      ...CASH_FLOW_PAYLOAD,
      // Deliberately unlike the rows, so a sum of the rows cannot pass.
      by_branch_totals: { inflow_total: 2000000.5, outflow_total: 1500000.25, net_movement: 500000.25 },
    },
    RANGE
  );
  assert.equal(namedTableTotal(withTotals, "Breakdown by Branch", "inflows"), "₱2,000,000.50");
  assert.equal(namedTableTotal(withTotals, "Breakdown by Branch", "outflows"), "₱1,500,000.25");
  assert.equal(namedTableTotal(withTotals, "Breakdown by Branch", "net"), "₱500,000.25");

  const { by_branch_totals, ...withoutTotals } = CASH_FLOW_PAYLOAD;
  void by_branch_totals;
  const without = buildCashFlowDoc(withoutTotals, RANGE);
  for (const column of ["inflows", "outflows", "net"]) {
    assert.equal(namedTableTotal(without, "Breakdown by Branch", column), DASH, column);
  }
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

// Decision 5c: the server puts share capital paid in and out into the row of
// each member's branch, and a member with no branch into an "Unassigned" row
// (`branch_id` null), so the branch rows add up to the statement totals:
// cash in ₱1,013,651.50 loan cash + ₱96,500.00 share capital = ₱1,110,151.50,
// cash out ₱742,800.40 + ₱31,500.00 = ₱774,300.40.
const CASH_FLOW_WITH_SHARE_BY_BRANCH = {
  ...CASH_FLOW_PAYLOAD,
  share_capital: {
    ...CASH_FLOW_PAYLOAD.share_capital,
    // The server's wording is for developers (field names, formulas) and is
    // never printed on the report.
    note:
      "No branch filter applied, so these figures are organisation-wide. In by_branch, share capital paid in and out on its own is in the row of the branch each member belongs to (inflow_share_capital, outflow_share_capital, inside inflow_total and outflow_total).",
  },
  by_branch: [
    {
      ...CASH_FLOW_PAYLOAD.by_branch[0],
      inflow_repayments: 720450.25,
      inflow_share_capital: 60000,
      inflow_total: 780450.25,
      outflow_share_capital: 20000,
      outflow_total: 532800.4,
      share_capital_count: 25,
      net_movement: 247649.85,
    },
    {
      ...CASH_FLOW_PAYLOAD.by_branch[1],
      inflow_repayments: 293201.25,
      inflow_share_capital: 35000,
      inflow_total: 328201.25,
      outflow_share_capital: 11000,
      outflow_total: 241000,
      share_capital_count: 14,
      net_movement: 87201.25,
    },
    {
      branch_id: null,
      branch_name: "Unassigned",
      inflow_repayments: 0,
      inflow_share_capital: 1500,
      inflow_total: 1500,
      repayment_count: 0,
      outflow_net_proceeds: 0,
      outflow_share_capital: 500,
      outflow_total: 500,
      release_count: 0,
      share_capital_count: 2,
      net_movement: 1000,
    },
  ],
  by_branch_totals: {
    inflow_share_capital: 96500,
    inflow_total: 1110151.5,
    outflow_share_capital: 31500,
    outflow_total: 774300.4,
    net_movement: 335851.1,
  },
};

const CASH_FLOW_BRANCH_NOTE =
  "Share capital paid in and out is in the row of the branch each member belongs to; " +
  "members with no branch are under Unassigned.";

test("cash flow breaks down by branch, members' share capital included, in plain words", () => {
  const doc = buildCashFlowDoc(CASH_FLOW_WITH_SHARE_BY_BRANCH, RANGE);
  const table = namedTable(doc, "Breakdown by Branch");

  assert.equal(table.rows.length, 3);
  assert.equal(table.rows[0].branch_name, "Main");
  // Loan cash plus the members' share capital, as the server sent each row.
  assert.equal(table.rows[0].inflows, 780450.25);
  assert.equal(table.rows[0].outflows, 532800.4);
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "inflows"), "₱1,110,151.50");
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "outflows"), "₱774,300.40");
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "net"), "₱335,851.10");

  // The builder's own sentence, never the server's technical note.
  const note = noteText(doc);
  assert.equal(note, CASH_FLOW_BRANCH_NOTE);
  assert.notEqual(note, CASH_FLOW_WITH_SHARE_BY_BRANCH.share_capital.note);
  assert.doesNotMatch(note!, /inflow_share_capital|by_branch|organisation-wide/);
});

test("the branch rows add up to the statement totals, so the footer matches the headline", () => {
  const doc = buildCashFlowDoc(CASH_FLOW_WITH_SHARE_BY_BRANCH, RANGE);

  // A reader who adds the branch column and compares it to the headline finds
  // the same figure: share capital is inside the rows, not left out of them.
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "inflows"), kpiValue(doc, "Total Cash In"));
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "outflows"), kpiValue(doc, "Total Cash Out"));
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "net"), kpiValue(doc, "Net Movement"));
  // The old caveat is gone: nothing needs adding back.
  assert.doesNotMatch(noteText(doc)!, /cannot be attributed|loan collections and releases only|add the share capital lines back/);
});

test("cash flow lists members without a branch in an Unassigned row", () => {
  const table = namedTable(buildCashFlowDoc(CASH_FLOW_WITH_SHARE_BY_BRANCH, RANGE), "Breakdown by Branch");
  const unassigned = table.rows[2];

  assert.equal(unassigned.branch_name, "Unassigned");
  assert.equal(unassigned.inflows, 1500);
  assert.equal(unassigned.outflows, 500);
  assert.equal(unassigned.net, 1000);
});

test("a branch row with a null branch_id and no name still reads Unassigned", () => {
  const table = namedTable(
    buildCashFlowDoc(
      {
        ...CASH_FLOW_PAYLOAD,
        by_branch: [{ branch_id: null, branch_name: null, inflow_total: 1500, outflow_total: 500, net_movement: 1000 }],
      },
      RANGE
    ),
    "Breakdown by Branch"
  );
  assert.equal(table.rows[0].branch_name, "Unassigned");
});

test("the branch note is the same plain sentence whether or not the server sends a note", () => {
  const { note, ...shareWithoutNote } = CASH_FLOW_WITH_SHARE_BY_BRANCH.share_capital;
  void note;
  const without = buildCashFlowDoc({ ...CASH_FLOW_WITH_SHARE_BY_BRANCH, share_capital: shareWithoutNote }, RANGE);

  assert.equal(noteText(without), CASH_FLOW_BRANCH_NOTE);
  assert.equal(noteText(buildCashFlowDoc(CASH_FLOW_WITH_SHARE_BY_BRANCH, RANGE)), CASH_FLOW_BRANCH_NOTE);
});

test("cash flow says where payments' share capital build-up is counted, without moving a total", () => {
  // The server leaves a payment's build-up out of the share capital lines (it
  // is already cash inside the repayment's overpayment) and reports it apart,
  // so a reader comparing with the Share Capital report needs to be told.
  const doc = buildCashFlowDoc(
    {
      ...CASH_FLOW_PAYLOAD,
      share_capital: {
        ...CASH_FLOW_PAYLOAD.share_capital,
        build_up_from_payments: 1250.5,
        build_up_credit: 1300.5,
        build_up_debit: 50,
      },
    },
    RANGE
  );
  const notes = doc.sections.flatMap((s) => (s.kind === "note" ? [s.text] : []));
  const buildUp = notes.find((text) => /build-up/i.test(text));

  assert.ok(buildUp, "expected a share capital build-up note");
  assert.match(buildUp!, /₱1,250\.50/);
  assert.match(buildUp!, /Overpayment received/);
  assert.match(buildUp!, /Share capital contributions/);
  assert.match(buildUp!, /Share Capital report/);
  // Text only: the lines and totals are the server's, unchanged.
  assert.equal(namedTable(doc, "Cash Inflows").rows.length, 6);
  assert.equal(namedTable(doc, "Cash Inflows").rows[5].amount, 96500);
  assert.equal(kpiValue(doc, "Total Cash In"), "₱1,110,151.50");
  assert.equal(kpiValue(doc, "Net Movement"), "₱335,851.10");
});

test("cash flow adds no build-up note when payments credited no share capital", () => {
  for (const buildUp of [0, null]) {
    const doc = buildCashFlowDoc(
      {
        ...CASH_FLOW_PAYLOAD,
        share_capital: { ...CASH_FLOW_PAYLOAD.share_capital, build_up_from_payments: buildUp },
      },
      RANGE
    );
    const notes = doc.sections.flatMap((s) => (s.kind === "note" ? [s.text] : []));
    assert.ok(!notes.some((text) => /build-up/i.test(text)), String(buildUp));
  }
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
  assert.equal(namedTable(doc, "Cash Inflows").rows.length, 6);
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

test("a row without a rate or uncollected figure shows dashes, never derives them", () => {
  const doc = buildCollectionEfficiencyDoc(
    {
      ...EFFICIENCY_PAYLOAD,
      by_branch: [{ branch_name: "Silay", total_due: 200, total_collected: 150 }],
    },
    RANGE
  );
  const table = namedTable(doc, "Efficiency by Branch");
  const row = table.rows[0];

  // Not 75% (collected over due) nor ₱50.00 (due less collected).
  assert.equal(row.collection_rate, null);
  assert.equal(row.uncollected, null);
  for (const key of ["collection_rate", "uncollected"]) {
    const column = table.columns.find((c) => c.key === key);
    assert.ok(column);
    assert.equal(formatCell(row, column), DASH, key);
  }
});

test("missing headline figures are dashes, never derived from the others or the rows", () => {
  const { uncollected, collection_rate, total_due, ...partial } = EFFICIENCY_PAYLOAD;
  void uncollected;
  void collection_rate;
  void total_due;
  const doc = buildCollectionEfficiencyDoc(partial, RANGE);

  assert.equal(kpiValue(doc, "Total Due"), DASH);
  assert.equal(kpiValue(doc, "Collection Efficiency"), DASH);
  assert.equal(kpiValue(doc, "Uncollected"), DASH);
  // The footers are the headline four, so they dash with it rather than
  // adding up the branch or month rows.
  for (const title of ["Efficiency by Branch", "Monthly Trend"]) {
    assert.equal(namedTableTotal(doc, title, "total_due"), DASH, title);
    assert.equal(namedTableTotal(doc, title, "uncollected"), DASH, title);
    assert.equal(namedTableTotal(doc, title, "collection_rate"), DASH, title);
    assert.equal(namedTableTotal(doc, title, "total_collected"), "₱1,063,840.25", title);
  }
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
      total_outstanding: 2914300.25,
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
      total_outstanding: 2105400.5,
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
      total_outstanding: 402100.75,
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
    total_outstanding: 5421801.5,
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
  assert.equal(kpiValue(doc, "Principal Balance"), "₱5,220,700.75");
  assert.equal(kpiValue(doc, "Outstanding"), "₱5,421,801.50");
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

test("portfolio by product shows dashes, not sums of the rows, without a totals block", () => {
  const { totals, ...withoutTotals } = PRODUCT_PAYLOAD;
  void totals;
  const doc = buildPortfolioByProductDoc(withoutTotals, RANGE);

  // Not 3 / ₱9,095,000.75 / 386 / ₱524,051.00, the rows counted and added up.
  assert.equal(kpiValue(doc, "Loan Products"), DASH);
  assert.equal(kpi(doc, "Loan Products").hint, undefined);
  assert.equal(kpiValue(doc, "Total Released"), DASH);
  assert.equal(kpiValue(doc, "Principal Balance"), DASH);
  assert.equal(kpiValue(doc, "Outstanding"), DASH);
  assert.equal(kpiValue(doc, "Overdue Amount"), DASH);
  for (const column of ["loan_count", "total_released", "principal_balance", "outstanding", "overdue_amount", "portfolio_share"]) {
    assert.equal(namedTableTotal(doc, "Portfolio by Product", column), DASH, column);
  }
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
  // A rate, so every place the server sends: 2.02%, not 2.0%.
  assert.equal(kpi(doc, "Total Released").hint, "Avg rate 2.02%");
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

test("an empty product list reports the server's zero, not an unknown", () => {
  const doc = buildPortfolioByProductDoc(
    {
      products: [],
      totals: {
        product_count: 0,
        loan_count: 0,
        total_released: 0,
        outstanding: 0,
        overdue_amount: 0,
      },
    },
    RANGE
  );
  assert.equal(kpiValue(doc, "Loan Products"), "0");
  assert.equal(kpi(doc, "Loan Products").hint, "0 loans");
  assert.equal(kpiValue(doc, "Total Released"), "₱0.00");
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
  by_month_totals: { credits: 386500.5, debits: 74200.25, net_movement: 312300.25 },
  by_member_totals: {
    opening_balance: 132200,
    credits: 30500.5,
    debits: 5000,
    closing_balance: 157700.5,
  },
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

test("share capital never derives the net or the closing balance", () => {
  const doc = buildShareCapitalDoc(
    { opening_balance: 2450000, credits: 386500.5, debits: 74200.25 },
    RANGE
  );

  // Not ₱2,762,300.25 (opening + credits − debits) nor ₱312,300.25.
  assert.equal(kpiValue(doc, "Closing Balance"), DASH);
  assert.equal(fieldValue(doc, "Subscription Status", "Net movement for the period"), DASH);
});

test("a share capital row's net and closing are the server's, never worked out", () => {
  const [june, ...laterMonths] = SHARE_CAPITAL_PAYLOAD.by_month;
  const { net_movement, ...juneWithoutNet } = june;
  void net_movement;
  const [maria, jose] = SHARE_CAPITAL_PAYLOAD.by_member;
  const { closing_balance, ...mariaWithoutClosing } = maria;
  void closing_balance;
  const doc = buildShareCapitalDoc(
    {
      ...SHARE_CAPITAL_PAYLOAD,
      by_month: [juneWithoutNet, ...laterMonths],
      by_member: [mariaWithoutClosing, jose],
    },
    RANGE
  );

  // Not ₱107,400.50 (credits − debits) nor ₱96,500.00 (opening + net).
  assert.equal(namedTable(doc, "Monthly Movement").rows[0].net, null);
  assert.equal(namedTable(doc, "Movement by Member").rows[0].balance, null);
  assert.equal(namedTable(doc, "Movement by Member").rows[1].balance, 61200.5);
});

test("share capital footers are the server's monthly and per-member totals", () => {
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
  assert.equal(namedTableTotal(doc, "Movement by Member", "credits"), "₱30,500.50");
  assert.equal(namedTableTotal(doc, "Movement by Member", "debits"), "₱5,000.00");
  assert.equal(namedTableTotal(doc, "Movement by Member", "balance"), "₱157,700.50");
});

test("share capital footers show dashes, not sums of the rows, without server totals", () => {
  const { by_month_totals, by_member_totals, ...withoutTotals } = SHARE_CAPITAL_PAYLOAD;
  void by_month_totals;
  void by_member_totals;
  const doc = buildShareCapitalDoc(withoutTotals, RANGE);

  for (const column of ["credits", "debits", "net"]) {
    assert.equal(namedTableTotal(doc, "Monthly Movement", column), DASH, column);
  }
  for (const column of ["opening_balance", "credits", "debits", "balance"]) {
    assert.equal(namedTableTotal(doc, "Movement by Member", column), DASH, column);
  }
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
    by_member_totals: null,
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

// Officer rows and branch rows each cover the same book, so the server's three
// totals blocks (`totals`, `by_officer_totals`, `by_branch_totals`) carry the
// same figures.
const PERFORMANCE_TOTALS = {
  released_count: 74,
  released_amount: 3655700.75,
  collected: 2480850.25,
  total_outstanding: 2272101.5,
  outstanding_principal: 2135700.75,
  overdue_amount: 257700.75,
};

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
      total_outstanding: 1284300.75,
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
      total_outstanding: 812400.5,
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
      total_outstanding: 175400.25,
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
      total_outstanding: 1584300.5,
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
      total_outstanding: 687801,
      outstanding_principal: 645500.5,
      overdue_amount: 76500,
      at_risk_amount: 68859.95,
      par_ratio: 12.51,
      active_borrowers: 20,
    },
  ],
  totals: PERFORMANCE_TOTALS,
  by_officer_totals: PERFORMANCE_TOTALS,
  by_branch_totals: PERFORMANCE_TOTALS,
  note: "released_* and collected cover date_from..date_to; outstanding, overdue, at_risk and active_borrowers are as_of_date figures over the whole book.",
  generated_at: "2026-08-06 09:15:00",
};

test("performance reads its headline from the server's totals", () => {
  const doc = buildPerformanceDoc(PERFORMANCE_PAYLOAD, RANGE);

  assertNoDashes(doc);
  assert.equal(doc.reportId, "performance");
  assert.equal(kpiValue(doc, "Loans Released"), "74");
  assert.equal(kpiValue(doc, "Amount Released"), "₱3,655,700.75");
  assert.equal(kpiValue(doc, "Total Collected"), "₱2,480,850.25");
  // Borrower counts do not total (a borrower can sit under two officers),
  // which is why the last headlines are these and not "Active Borrowers".
  assert.equal(kpiValue(doc, "Principal Balance"), "₱2,135,700.75");
  assert.equal(kpiValue(doc, "Outstanding"), "₱2,272,101.50");
});

test("each performance block is read from its own server totals", () => {
  const doc = buildPerformanceDoc(
    {
      ...PERFORMANCE_PAYLOAD,
      // Deliberately unlike each other and the rows, so neither a sum of the
      // rows nor a shared block can pass.
      totals: { ...PERFORMANCE_TOTALS, released_amount: 1000000.5 },
      by_officer_totals: { ...PERFORMANCE_TOTALS, released_amount: 2000000.25 },
      by_branch_totals: { ...PERFORMANCE_TOTALS, released_amount: 3000000.75 },
    },
    RANGE
  );

  assert.equal(kpiValue(doc, "Amount Released"), "₱1,000,000.50");
  assert.equal(namedTableTotal(doc, "By Account Officer", "released_amount"), "₱2,000,000.25");
  assert.equal(namedTableTotal(doc, "By Branch", "released_amount"), "₱3,000,000.75");
});

test("performance shows dashes, not sums of the rows, without server totals", () => {
  const { totals, by_officer_totals, by_branch_totals, ...withoutTotals } = PERFORMANCE_PAYLOAD;
  void totals;
  void by_officer_totals;
  void by_branch_totals;
  const doc = buildPerformanceDoc(withoutTotals, RANGE);

  for (const label of ["Loans Released", "Amount Released", "Total Collected", "Principal Balance", "Outstanding"]) {
    assert.equal(kpiValue(doc, label), DASH, label);
  }
  for (const title of ["By Account Officer", "By Branch"]) {
    for (const column of [
      "released_count",
      "released_amount",
      "collected_amount",
      "principal_balance",
      "outstanding",
      "overdue_amount",
    ]) {
      assert.equal(namedTableTotal(doc, title, column), DASH, `${title} ${column}`);
    }
  }
});

test("the officer rows and the branch rows describe the same book", () => {
  const doc = buildPerformanceDoc(PERFORMANCE_PAYLOAD, RANGE);

  assert.equal(
    namedTableTotal(doc, "By Account Officer", "released_amount"),
    namedTableTotal(doc, "By Branch", "released_amount")
  );
  assert.equal(
    namedTableTotal(doc, "By Account Officer", "outstanding"),
    namedTableTotal(doc, "By Branch", "outstanding")
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
  assert.equal(officers.rows[0].outstanding, 1284300.75);
  assert.equal(officers.rows[0].principal_balance, 1210400.5);
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
  // With it the officer rows reconcile to the server's officer total.
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
  assert.equal(headers.includes("Members (to date)"), true);

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
  // The money and the release counts are the server's officer totals.
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
  assert.equal(kpiValue(doc, "Outstanding"), DASH);
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

test("a bucket without rate_percent shows no rate, never the fraction scaled up", () => {
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

  // Not 5 (0.05 × 100), and the fraction itself is never shown as "0.1%".
  assert.equal(rows[0].rate, null);
  // Nor is the allowance worked out as 100 × 5%.
  assert.equal(rows[0].required_allowance, null);
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

test("provisioning never multiplies amount by rate, sums the buckets, or divides the totals", () => {
  const doc = buildProvisioningDoc(
    {
      as_of_date: "2026-08-06",
      buckets: {
        "1_30": { amount: 128450.5, count: 12, rate_percent: 5 },
        "31_60": { amount: 64200.25, count: 5, rate_percent: 15 },
        "61_90": { amount: 18900, count: 1, rate_percent: 25 },
        over_90: { amount: 240310.75, count: 9, rate_percent: 50 },
      },
      totals: { count: 21 },
      // The policy ladder as fractions, exactly as the API sends it.
      rates: { "1_30": 0.05, "31_60": 0.15, "61_90": 0.25, over_90: 0.5 },
    },
    RANGE
  );
  const rows = namedTable(doc, "Provisioning Schedule").rows;

  assert.equal(rows[0].rate, 5);
  // Not ₱6,422.53 (amount × rate).
  assert.equal(rows[0].required_allowance, null);
  // Not ₱451,861.50 (the buckets added up), nor a rate of allowance ÷ amount.
  assert.equal(kpiValue(doc, "Total Overdue"), DASH);
  assert.equal(kpiValue(doc, "Required Allowance"), DASH);
  assert.equal(kpiValue(doc, "Effective Provision Rate"), DASH);
  assert.equal(namedTableTotal(doc, "Provisioning Schedule", "amount"), DASH);
  assert.equal(namedTableTotal(doc, "Provisioning Schedule", "required_allowance"), DASH);
  assert.equal(kpiValue(doc, "Delinquent Loans"), "21");
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

test("payment report rows name the method and status in words, never the stored keys", () => {
  const doc = buildRepaymentsListDoc(
    {
      data: [
        { paid_at: "2026-11-06", amount: 2725, method: "gcash", status: "completed" },
        { paid_at: "2026-11-06", amount: 500, method: "bank_transfer", status: "voided" },
      ],
    },
    RANGE
  );
  assert.deepEqual(
    tableRows(doc).map((row) => [row.method, row.status]),
    [
      ["GCash", "Completed"],
      ["Bank Transfer", "Voided"],
    ]
  );
});

// ---------------------------------------------------------------------------
// Round fz: the Statement of Account's Medium and Low findings. Payloads follow
// the contract between the backend and frontend slices.
// ---------------------------------------------------------------------------

const SOA_FULL = {
  ...SOA_PAYLOAD,
  loan: {
    ...SOA_PAYLOAD.loan,
    status_label: "Current",
    product_name: "Salary Loan",
    released_at: "2026-02-01",
    member_address: "Butuan City, Agusan del Norte",
    branch_name: "Main Branch",
    account_officer_name: "Pedro Reyes",
    payment_frequency: "Monthly",
    interest_type: "Straight",
    term_label: "6 months",
    rate_label: "3.0% per month",
    extensions_count: 2,
    has_build_up: true,
  },
  summary: {
    ...SOA_PAYLOAD.summary,
    total_paid: 3000,
    insurance_owed: 1000,
    principal_paid: 1700,
    interest_paid: 800,
    penalty_paid: 50,
    insurance_paid: 400,
    build_up_paid: 50,
  },
  schedule_totals: { ...SOA_PAYLOAD.schedule_totals, balance: 59908.92 },
  transactions: [
    {
      type: "release",
      kind: "release",
      date: "2026-02-01",
      description: "Loan released",
      reference: "LN-2026-0001",
      amount_paid: 0,
      debit: 50000,
      credit: null,
      voided: false,
      principal_applied: -50000,
      interest_applied: 0,
      penalty_applied: 0,
      insurance_applied: 0,
      build_up_applied: 0,
      overpayment_applied: 0,
      principal_balance: 50000,
    },
    {
      type: "charge",
      kind: "penalty_charge",
      date: "2026-03-05",
      description: "Late penalty charged",
      amount_paid: 0,
      debit: 121.85,
      credit: null,
      voided: false,
      principal_applied: 0,
      interest_applied: 0,
      penalty_applied: -121.85,
      insurance_applied: 0,
      build_up_applied: 0,
      overpayment_applied: 0,
      principal_balance: 50000,
    },
    {
      type: "payment",
      kind: "repayment",
      date: "2026-03-06",
      receipt_number: "RCP-000004",
      description: "Payment RCP-000004 (voided)",
      amount_paid: 1000,
      credit: null,
      debit: null,
      voided: true,
      principal_applied: 0,
      interest_applied: 0,
      penalty_applied: 0,
      insurance_applied: 0,
      build_up_applied: 0,
      overpayment_applied: 0,
      principal_balance: 50000,
    },
    {
      type: "payment",
      kind: "repayment",
      date: "2026-03-07",
      receipt_number: "RCP-000008",
      description: "Extension payment RCP-000008",
      amount_paid: 3000,
      credit: 2950,
      debit: null,
      voided: false,
      principal_applied: 1700,
      interest_applied: 800,
      penalty_applied: 50,
      insurance_applied: 400,
      build_up_applied: 50,
      overpayment_applied: 0,
      principal_balance: 48300,
    },
  ],
  transaction_totals: { debit: 50121.85, credit: 2950 },
};

test("finding 8: the Balance Summary has the insurance premium owed, as sent", () => {
  assert.equal(kpiValue(buildStatementOfAccountDoc(SOA_FULL, RANGE), "Insurance Premium Owed"), "₱1,000.00");
  const zero = { ...SOA_FULL, summary: { ...SOA_FULL.summary, insurance_owed: 0 } };
  assert.equal(kpiValue(buildStatementOfAccountDoc(zero, RANGE), "Insurance Premium Owed"), "₱0.00");
  assert.equal(kpiValue(buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE), "Insurance Premium Owed"), DASH);
});

test("finding 9: Total Paid is broken down into the server's parts, with the same total", () => {
  const doc = buildStatementOfAccountDoc(SOA_FULL, RANGE);
  const title = "What Has Been Paid";
  assert.equal(fieldValue(doc, title, "Principal Paid"), "₱1,700.00");
  assert.equal(fieldValue(doc, title, "Interest Paid"), "₱800.00");
  assert.equal(fieldValue(doc, title, "Penalty Paid"), "₱50.00");
  assert.equal(fieldValue(doc, title, "Insurance Premium Paid"), "₱400.00");
  assert.equal(fieldValue(doc, title, "Share Capital Build-Up Paid"), "₱50.00");
  assert.equal(fieldValue(doc, title, "Total Paid"), "₱3,000.00");
  assert.equal(kpiValue(doc, "Total Paid"), "₱3,000.00");
});

test("finding 9: a part the server didn't send is a dash, never the rest worked out", () => {
  const doc = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);
  assert.equal(fieldValue(doc, "What Has Been Paid", "Principal Paid"), DASH);
  assert.equal(fieldValue(doc, "What Has Been Paid", "Total Paid"), "₱9,500.00");
  // Only a build-up loan has the build-up line.
  const labels = fieldItems(doc, "What Has Been Paid").map((f) => f.label);
  assert.equal(labels.includes("Share Capital Build-Up Paid"), false);
});

test("finding 10: Account Particulars carry the account's details", () => {
  const doc = buildStatementOfAccountDoc(SOA_FULL, RANGE);
  const field = (label: string) => fieldValue(doc, "Account Particulars", label);
  assert.equal(field("Loan Product"), "Salary Loan");
  assert.equal(field("Release Date"), formatValue("2026-02-01", "date"));
  assert.equal(field("Address"), "Butuan City, Agusan del Norte");
  assert.equal(field("Branch"), "Main Branch");
  assert.equal(field("Account Officer"), "Pedro Reyes");
  assert.equal(field("Payment Frequency"), "Monthly");
  assert.equal(field("Interest Type"), "Straight");
});

test("finding 10: the address falls back to the borrower block the server already sends", () => {
  const doc = buildStatementOfAccountDoc(
    { ...SOA_PAYLOAD, borrower: { ...SOA_PAYLOAD.borrower, address: "Cebu City" } },
    RANGE
  );
  assert.equal(fieldValue(doc, "Account Particulars", "Address"), "Cebu City");
});

test("finding 11: term and rate read with their units, and extensions are counted", () => {
  const doc = buildStatementOfAccountDoc(SOA_FULL, RANGE);
  assert.equal(fieldValue(doc, "Account Particulars", "Term"), "6 months");
  assert.equal(fieldValue(doc, "Account Particulars", "Interest Rate"), "3.0% per month");
  assert.equal(fieldValue(doc, "Account Particulars", "Extensions"), "2");
});

test("finding 11: a loan never extended has no Extensions line", () => {
  const doc = buildStatementOfAccountDoc(
    { ...SOA_FULL, loan: { ...SOA_FULL.loan, extensions_count: 0 } },
    RANGE
  );
  const labels = fieldItems(doc, "Account Particulars").map((f) => f.label);
  assert.equal(labels.includes("Extensions"), false);
});

test("finding 12: a voided payment names its amount in the mark, never under Credit", () => {
  const doc = buildStatementOfAccountDoc(SOA_FULL, RANGE);
  const table = namedTable(doc, "Transaction History");
  const column = (key: string) => table.columns.find((c) => c.key === key)!;

  assert.equal(table.rows[2].particulars, "Payment RCP-000004 (Voided): ₱1,000.00");
  assert.equal(table.rows[2].voided, true);
  assert.equal(table.rows[3].voided, false);
  assert.equal(table.rows[2].credit, null);
  assert.equal(table.rows[2].debit, null);
  assert.equal(formatCell(table.rows[2], column("credit")), DASH);
  assert.equal(formatCell(table.rows[2], column("debit")), DASH);
  // The server's parts are 0 on a voided line, and they read as a zero.
  assert.equal(formatCell(table.rows[2], column("principal_applied")), "₱0.00");
  assert.equal(formatCell(table.rows[2], column("amount_paid")), DASH);
  // Out of every total: the footers are the server's, without the voided ₱1,000.00.
  assert.equal(namedTableTotal(doc, "Transaction History", "credit"), "₱2,950.00");
  assert.equal(namedTableTotal(doc, "Transaction History", "amount_paid"), "₱3,000.00");
});

test("finding 12: a voided line whose server still sends a credit keeps it out of the column", () => {
  const voided = { ...SOA_FULL.transactions[2], credit: 1000, debit: 5 };
  const table = namedTable(
    buildStatementOfAccountDoc({ ...SOA_FULL, transactions: [voided] }, RANGE),
    "Transaction History"
  );
  assert.equal(table.rows[0].credit, null);
  assert.equal(table.rows[0].debit, null);
});

test("finding 12: a voided line with no receipt amount has the mark alone", () => {
  const { amount_paid, ...withoutAmount } = SOA_FULL.transactions[2];
  void amount_paid;
  const table = namedTable(
    buildStatementOfAccountDoc({ ...SOA_FULL, transactions: [withoutAmount] }, RANGE),
    "Transaction History"
  );
  assert.equal(table.rows[0].particulars, "Payment RCP-000004 (Voided)");
});

test("release and charge lines show the debit, and a dash in every applied part", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_FULL, RANGE), "Transaction History");
  const parts = ["principal_applied", "interest_applied", "penalty_applied", "insurance_applied", "build_up_applied"];

  for (const [index, debit] of [[0, "₱50,000.00"], [1, "₱121.85"]] as const) {
    const row = table.rows[index];
    assert.equal(formatCell(row, table.columns.find((c) => c.key === "debit")!), debit);
    for (const key of parts) {
      const text = formatCell(row, table.columns.find((c) => c.key === key)!);
      assert.equal(text, DASH, `${String(row.particulars)} ${key}`);
    }
  }
});

test("an adjustment line shows its credit or debit, and a dash in every applied part", () => {
  const adjustment = {
    type: "adjustment",
    kind: "waiver",
    date: "2026-04-01",
    description: "Penalty waived",
    amount_paid: 0,
    debit: null,
    credit: 374.77,
    voided: false,
    principal_applied: 0,
    interest_applied: 0,
    penalty_applied: 374.77,
    insurance_applied: 0,
    build_up_applied: 0,
    overpayment_applied: 0,
    principal_balance: 48300,
  };
  const table = namedTable(
    buildStatementOfAccountDoc({ ...SOA_FULL, transactions: [...SOA_FULL.transactions, adjustment] }, RANGE),
    "Transaction History"
  );
  assert.equal(table.rows[4].credit, 374.77);
  assert.equal(formatCell(table.rows[4], table.columns.find((c) => c.key === "penalty_applied")!), DASH);
});

test("a payment line keeps its parts as the server sent them", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_FULL, RANGE), "Transaction History");
  assert.equal(table.rows[3].principal_applied, 1700);
  assert.equal(table.rows[3].interest_applied, 800);
  assert.equal(table.rows[3].penalty_applied, 50);
  assert.equal(table.rows[3].insurance_applied, 400);
  assert.equal(table.rows[3].build_up_applied, 50);
});

test("a payment shows the receipt's amount beside the Credit, which leaves out build-up", () => {
  const doc = buildStatementOfAccountDoc(SOA_FULL, RANGE);
  const table = namedTable(doc, "Transaction History");
  const receipt = table.columns.find((c) => c.key === "amount_paid")!;
  const keys = table.columns.map((c) => c.key);

  assert.equal(receipt.header, "Receipt Amount");
  assert.equal(keys.indexOf("amount_paid"), keys.indexOf("debit") - 1);
  assert.equal(formatCell(table.rows[3], receipt), "₱3,000.00");
  assert.equal(table.rows[3].credit, 2950);
  // The two footers differ by the build-up, and neither is worked out here.
  assert.equal(namedTableTotal(doc, "Transaction History", "credit"), "₱2,950.00");
  assert.equal(namedTableTotal(doc, "Transaction History", "amount_paid"), "₱3,000.00");
});

test("the Receipt Amount footer is the server's: its line total, else Total Paid, else a dash", () => {
  const sent = buildStatementOfAccountDoc(
    { ...SOA_FULL, transaction_totals: { ...SOA_FULL.transaction_totals, amount_paid: 3100 } },
    RANGE
  );
  assert.equal(namedTableTotal(sent, "Transaction History", "amount_paid"), "₱3,100.00");

  const neither = buildStatementOfAccountDoc(
    { ...SOA_FULL, summary: { ...SOA_FULL.summary, total_paid: undefined } },
    RANGE
  );
  assert.equal(namedTableTotal(neither, "Transaction History", "amount_paid"), DASH);
});

test("release, charge and adjustment lines have no receipt amount", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_FULL, RANGE), "Transaction History");
  const receipt = table.columns.find((c) => c.key === "amount_paid")!;
  assert.equal(formatCell(table.rows[0], receipt), DASH);
  assert.equal(formatCell(table.rows[1], receipt), DASH);
});

test("the insurance premium debit line shows its Debit and a dash in every part", () => {
  const premiumDebit = {
    type: "charge",
    kind: "insurance_debit",
    date: "2026-02-01",
    description: "Insurance premium owed",
    particulars: "Insurance premium owed",
    amount_paid: 0,
    debit: 1000,
    credit: null,
    voided: false,
    insurance_applied: -1000,
    principal_applied: 0,
    interest_applied: 0,
    penalty_applied: 0,
    build_up_applied: 0,
    overpayment_applied: 0,
    principal_balance: 50000,
  };
  const [release, ...rest] = SOA_FULL.transactions;
  const table = namedTable(
    buildStatementOfAccountDoc({ ...SOA_FULL, transactions: [release, premiumDebit, ...rest] }, RANGE),
    "Transaction History"
  );
  const row = table.rows[1];
  assert.equal(row.particulars, "Insurance premium owed");
  assert.equal(formatCell(row, table.columns.find((c) => c.key === "debit")!), "₱1,000.00");
  for (const key of ["amount_paid", "credit", "insurance_applied", "principal_applied", "interest_applied", "penalty_applied"]) {
    assert.equal(formatCell(row, table.columns.find((c) => c.key === key)!), DASH, key);
  }

  // Its negative part alone doesn't bring the premium column on.
  const onlyDebit = namedTable(
    buildStatementOfAccountDoc({ ...SOA_FULL, transactions: [release, premiumDebit] }, RANGE),
    "Transaction History"
  );
  assert.equal(onlyDebit.columns.some((c) => c.key === "insurance_applied"), false);
});

test("finding 9: an overpayment joins the paid parts when there is one", () => {
  const paid = (overpayment_paid: unknown) =>
    fieldItems(
      buildStatementOfAccountDoc({ ...SOA_FULL, summary: { ...SOA_FULL.summary, overpayment_paid } }, RANGE),
      "What Has Been Paid"
    ).map((f) => [f.label, f.value]);

  const labels = paid(150.5).map(([label]) => label);
  assert.deepEqual(paid(150.5).find(([label]) => label === "Overpayment"), ["Overpayment", "₱150.50"]);
  assert.equal(labels.indexOf("Overpayment"), labels.indexOf("Total Paid") - 1);
  assert.equal(paid(0).some(([label]) => label === "Overpayment"), false);
  assert.equal(paid(undefined).some(([label]) => label === "Overpayment"), false);
});

test("finding 12: a description that already says voided isn't marked twice", () => {
  const table = namedTable(
    buildStatementOfAccountDoc(
      { ...SOA_FULL, transactions: [{ ...SOA_FULL.transactions[2], description: "Voided payment RCP-000004" }] },
      RANGE
    ),
    "Transaction History"
  );
  assert.equal(table.rows[0].particulars, "Voided payment RCP-000004: ₱1,000.00");
});

test("finding 13: every Ledger line is listed, with the release as a debit", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_FULL, RANGE), "Transaction History");
  assert.equal(table.rows.length, 4);
  assert.equal(table.rows[0].particulars, "Loan released");
  assert.equal(table.rows[0].debit, 50000);
  assert.equal(table.rows[0].reference, "LN-2026-0001");
  assert.equal(table.rows[1].particulars, "Late penalty charged");
  assert.equal(table.rows[1].debit, 121.85);
  assert.equal(
    namedTableTotal(buildStatementOfAccountDoc(SOA_FULL, RANGE), "Transaction History", "debit"),
    "₱50,121.85"
  );
});

test("finding 14: extension payments keep the server's label, and a replaced period's note shows", () => {
  const doc = buildStatementOfAccountDoc(
    {
      ...SOA_FULL,
      amortization_schedule: [
        { ...SOA_PAYLOAD.amortization_schedule[0], period_number: 2, note: "Replaced by an extension on Nov 5, 2026" },
        SOA_PAYLOAD.amortization_schedule[1],
      ],
    },
    RANGE
  );
  assert.equal(namedTable(doc, "Transaction History").rows[3].particulars, "Extension payment RCP-000008");
  const notes = doc.sections.flatMap((s) => (s.kind === "note" ? [s.text] : []));
  assert.deepEqual(notes, ["Period 2: Replaced by an extension on Nov 5, 2026"]);
});

test("finding 14: the server's schedule note names the replacement, so row notes don't repeat it", () => {
  const doc = buildStatementOfAccountDoc(
    {
      ...SOA_FULL,
      schedule_note: "Period 1 was replaced by period 2: extension EXT-1 on May 20, 2026.",
      amortization_schedule: [{ ...SOA_PAYLOAD.amortization_schedule[0], period_number: 2, note: "Replaces period 1" }],
    },
    RANGE
  );
  const notes = doc.sections.flatMap((s) => (s.kind === "note" ? [s.text] : []));
  assert.deepEqual(notes, ["Period 1 was replaced by period 2: extension EXT-1 on May 20, 2026."]);
});

test("finding 15: each balance is named for what it holds, and the schedule's has a total", () => {
  const doc = buildStatementOfAccountDoc(SOA_FULL, RANGE);
  const schedule = namedTable(doc, "Amortization Schedule");
  const header = (key: string) => schedule.columns.find((c) => c.key === key)?.header;
  assert.equal(header("beginning_balance"), "Beginning Principal");
  assert.equal(header("total_paid"), "Period Paid");
  assert.equal(header("balance"), "Period Balance");
  assert.equal(namedTableTotal(doc, "Amortization Schedule", "balance"), "₱59,908.92");

  const lines = namedTable(doc, "Transaction History");
  assert.equal(lines.columns.at(-1)?.header, "Principal Balance");
});

test("finding 15: without the server's schedule_totals.balance the total is a dash", () => {
  const doc = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);
  assert.equal(namedTableTotal(doc, "Amortization Schedule", "balance"), DASH);
});

test("finding 19: the statement hands its loan number to the reference", () => {
  assert.equal(buildStatementOfAccountDoc(SOA_FULL, RANGE).meta.referenceKey, "LN-2026-0001");
  assert.equal(buildStatementOfAccountDoc(null, RANGE).meta.referenceKey, undefined);
});

test("finding 25: period statuses read capitalised, a phrase in words", () => {
  const table = namedTable(
    buildStatementOfAccountDoc(
      {
        ...SOA_PAYLOAD,
        amortization_schedule: [
          { ...SOA_PAYLOAD.amortization_schedule[0], status: "paid" },
          { ...SOA_PAYLOAD.amortization_schedule[0], status: "partial" },
          { ...SOA_PAYLOAD.amortization_schedule[0], status: "closed_by_extension" },
          { ...SOA_PAYLOAD.amortization_schedule[0], status: null },
        ],
      },
      RANGE
    ),
    "Amortization Schedule"
  );
  assert.deepEqual(table.rows.map((r) => r.status), ["Paid", "Partial", "Closed By Extension", null]);
});

test("finding 26: Past Due and Outstanding are red only when something is owed", () => {
  const owing = buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE);
  assert.equal(kpi(owing, "Past Due").tone, "negative");
  assert.equal(kpi(owing, "Outstanding Balance").tone, "negative");

  const clear = buildStatementOfAccountDoc(
    { ...SOA_PAYLOAD, summary: { ...SOA_PAYLOAD.summary, overdue_amount: 0, outstanding_balance: "0.00" } },
    RANGE
  );
  assert.equal(kpi(clear, "Past Due").value, "₱0.00");
  assert.equal(kpi(clear, "Past Due").tone, "neutral");
  assert.equal(kpi(clear, "Outstanding Balance").tone, "neutral");
});

test("finding 26: the premium column stays out when no line collected premium", () => {
  const table = namedTable(buildStatementOfAccountDoc(SOA_PAYLOAD, RANGE), "Transaction History");
  assert.equal(table.columns.some((c) => c.key === "insurance_applied"), false);

  const zeros = namedTable(
    buildStatementOfAccountDoc(
      { ...SOA_PAYLOAD, transactions: [{ ...SOA_PAYLOAD.transactions[0], insurance_applied: 0 }] },
      RANGE
    ),
    "Transaction History"
  );
  assert.equal(zeros.columns.some((c) => c.key === "insurance_applied"), false);
});

test("finding 26: the premium column has a total: the server's line total, else its Insurance Premium Paid", () => {
  const paid = buildStatementOfAccountDoc(SOA_FULL, RANGE);
  assert.equal(namedTableTotal(paid, "Transaction History", "insurance_applied"), "₱400.00");

  const lineTotal = buildStatementOfAccountDoc(
    { ...SOA_FULL, transaction_totals: { ...SOA_FULL.transaction_totals, insurance_applied: 425 } },
    RANGE
  );
  assert.equal(namedTableTotal(lineTotal, "Transaction History", "insurance_applied"), "₱425.00");

  const neither = buildStatementOfAccountDoc(
    { ...SOA_FULL, summary: { ...SOA_FULL.summary, insurance_paid: undefined } },
    RANGE
  );
  assert.equal(namedTableTotal(neither, "Transaction History", "insurance_applied"), DASH);
});

// ---------------------------------------------------------------------------
// Outstanding means everything owed (`total_outstanding`); a principal-only
// figure reads Principal Balance (`outstanding_principal`). The old aliases hold
// principal plus premium, so none is ever read under either label.
// ---------------------------------------------------------------------------

const OLD_ALIASES = { outstanding_balance: 111, outstanding: 222, total_outstanding_balance: 333 };
const OWED = { outstanding_principal: 1000.5, total_outstanding: 1500.25 };

function assertOwedKpis(doc: ReportDocument): void {
  assert.equal(kpiValue(doc, "Principal Balance"), "₱1,000.50");
  assert.equal(kpiValue(doc, "Outstanding"), "₱1,500.25");
  assert.throws(() => kpiValue(doc, "Outstanding Balance"), /not found/);
}

function assertAliasesGiveDashes(doc: ReportDocument): void {
  assert.equal(kpiValue(doc, "Principal Balance"), DASH);
  assert.equal(kpiValue(doc, "Outstanding"), DASH);
}

function assertOwedColumns(table: ReturnType<typeof namedTable>): void {
  const owed = table.columns
    .filter((c) => c.key === "principal_balance" || c.key === "outstanding")
    .map((c) => [c.key, c.header.replace(" (to date)", "")]);
  assert.deepEqual(owed, [["principal_balance", "Principal Balance"], ["outstanding", "Outstanding"]]);
  assert.equal(table.columns.some((c) => c.key === "outstanding_balance"), false);
}

test("portfolio summary: Principal Balance and Outstanding, and a dash for the old alias", () => {
  assertOwedKpis(buildPortfolioSummaryDoc({ ...OLD_ALIASES, ...OWED }, RANGE));
  assertAliasesGiveDashes(buildPortfolioSummaryDoc(OLD_ALIASES, RANGE));
});

test("portfolio summary by branch: both columns and footers, never the old alias", () => {
  const doc = buildPortfolioSummaryDoc(
    {
      by_branch: [{ branch_name: "Main", loan_count: 1, ...OLD_ALIASES, ...OWED }, { branch_name: "Old", ...OLD_ALIASES }],
      by_branch_totals: { ...OLD_ALIASES, ...OWED },
    },
    RANGE
  );
  const table = namedTable(doc, "Breakdown by Branch");
  assertOwedColumns(table);
  assert.equal(table.rows[0].principal_balance, 1000.5);
  assert.equal(table.rows[0].outstanding, 1500.25);
  assert.equal(table.rows[1].principal_balance, null);
  assert.equal(table.rows[1].outstanding, null);
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "principal_balance"), "₱1,000.50");
  assert.equal(namedTableTotal(doc, "Breakdown by Branch", "outstanding"), "₱1,500.25");

  const old = buildPortfolioSummaryDoc({ by_branch: [{ branch_name: "Old" }], by_branch_totals: OLD_ALIASES }, RANGE);
  assert.equal(namedTableTotal(old, "Breakdown by Branch", "outstanding"), DASH);
});

test("portfolio summary composition: the premium has a row, and the footer is everything owed", () => {
  const doc = buildPortfolioSummaryDoc(
    {
      total_outstanding: 1500.25,
      outstanding: { principal: 1000.5, interest: 300, penalty: 99.75, insurance: 100, total: 1400.25, balance: 1100.5 },
      overdue: { principal: 10, total: 10 },
    },
    RANGE
  );
  const table = namedTable(doc, "Outstanding vs Overdue Composition");
  assert.deepEqual(table.rows.map((r) => r.component), ["Principal", "Interest", "Penalty", "Insurance Premium"]);
  assert.equal(table.rows[3].outstanding, 100);
  assert.equal(namedTableTotal(doc, "Outstanding vs Overdue Composition", "outstanding"), "₱1,500.25");

  const old = buildPortfolioSummaryDoc({ outstanding: { principal: 1, total: 1 } }, RANGE);
  assert.equal(namedTableTotal(old, "Outstanding vs Overdue Composition", "outstanding"), DASH);
});

test("releases list: Principal Balance and Outstanding, and a dash for the old alias", () => {
  assertOwedKpis(buildReleasesListDoc({ data: [], meta: { totals: { ...OLD_ALIASES, ...OWED } } }, RANGE));
  assertAliasesGiveDashes(buildReleasesListDoc({ data: [], meta: { totals: OLD_ALIASES } }, RANGE));
});

test("portfolio by product: both cards, columns and footers, never the old alias", () => {
  const doc = buildPortfolioByProductDoc(
    { products: [{ product_name: "Salary", ...OLD_ALIASES, ...OWED }, { product_name: "Old", ...OLD_ALIASES }], totals: { ...OLD_ALIASES, ...OWED } },
    RANGE
  );
  assertOwedKpis(doc);
  const table = namedTable(doc, "Portfolio by Product");
  assertOwedColumns(table);
  assert.equal(table.rows[0].principal_balance, 1000.5);
  assert.equal(table.rows[0].outstanding, 1500.25);
  assert.equal(table.rows[1].outstanding, null);
  assert.equal(namedTableTotal(doc, "Portfolio by Product", "principal_balance"), "₱1,000.50");
  assert.equal(namedTableTotal(doc, "Portfolio by Product", "outstanding"), "₱1,500.25");
  assertAliasesGiveDashes(buildPortfolioByProductDoc({ products: [], totals: OLD_ALIASES }, RANGE));
});

test("performance: both cards, columns and footers, never the old alias", () => {
  const doc = buildPerformanceDoc(
    {
      totals: { ...OLD_ALIASES, ...OWED },
      by_officer: [{ account_officer_name: "Pedro", ...OLD_ALIASES, ...OWED }],
      by_officer_totals: { ...OLD_ALIASES, ...OWED },
      by_branch: [{ branch_name: "Old", ...OLD_ALIASES }],
      by_branch_totals: OLD_ALIASES,
    },
    RANGE
  );
  assertOwedKpis(doc);
  const officers = namedTable(doc, "By Account Officer");
  assertOwedColumns(officers);
  assert.equal(officers.rows[0].principal_balance, 1000.5);
  assert.equal(officers.rows[0].outstanding, 1500.25);
  assert.equal(namedTableTotal(doc, "By Account Officer", "outstanding"), "₱1,500.25");
  assert.equal(namedTable(doc, "By Branch").rows[0].outstanding, null);
  assert.equal(namedTableTotal(doc, "By Branch", "outstanding"), DASH);
  assertAliasesGiveDashes(buildPerformanceDoc({ totals: OLD_ALIASES }, RANGE));
});

test("portfolio summary is as of a day, not a period: the server's day, whatever range is held", () => {
  const doc = buildPortfolioSummaryDoc({ ...PORTFOLIO_PAYLOAD, generated_at: "2026-11-07 09:15:00" }, RANGE);
  assert.equal(doc.meta.asOf, formatValue("2026-11-07", "date"));
  assert.equal(doc.meta.period, undefined);
});

test("a failed portfolio summary request still says what day it is as of", () => {
  const doc = buildPortfolioSummaryDoc(null, RANGE);
  assert.ok(doc.meta.asOf && doc.meta.asOf !== DASH);
  assert.equal(doc.meta.period, undefined);
});

// ---------------------------------------------------------------------------
// Round fz browser check
// ---------------------------------------------------------------------------

test("income report: service and other fee cards, as the server sent them", () => {
  const doc = buildIncomeDoc(
    {
      interest_income: 34122.44,
      processing_fees: 17176.4,
      penalty_income: 0,
      service_fee: 9228.84,
      other_fees: 6000,
      total_income: 66527.68,
    },
    RANGE
  );
  assert.equal(kpiValue(doc, "Service Fees"), "₱9,228.84");
  assert.equal(kpiValue(doc, "Other Fees"), "₱6,000.00");
  assert.equal(kpiValue(doc, "Total Income"), "₱66,527.68");

  const missing = buildIncomeDoc({ interest_income: 1, total_income: 1 }, RANGE);
  assert.equal(kpiValue(missing, "Service Fees"), DASH);
  assert.equal(kpiValue(missing, "Other Fees"), DASH);
});

test("income report: each loan's service and other fees, with the server's totals", () => {
  const doc = buildIncomeDoc(null, RANGE, {
    data: [
      { loan_account_number: "LN-000003", borrower_name: "Maria Reyes", payments: 2, interest_income: 4171.09, penalty_income: 0, processing_fee: 1500, service_fee: 700, other_fees: 500, total_income: 6871.09 },
    ],
    meta: { total: 1 },
    totals: { payments: 2, interest_income: 4171.09, penalty_income: 0, processing_fee: 1500, service_fee: 9228.84, other_fees: 6000, total_income: 6871.09 },
  });
  const table = namedTable(doc, "Income by Loan Account");
  const headers = table.columns.map((c) => c.header);
  assert.deepEqual(headers.slice(headers.indexOf("Processing Fee"), headers.indexOf("Total Income") + 1), [
    "Processing Fee",
    "Service Fee",
    "Other Fees",
    "Total Income",
  ]);
  assert.equal(table.rows[0].service_fee, 700);
  assert.equal(table.rows[0].other_fees, 500);
  assert.equal(namedTableTotal(doc, "Income by Loan Account", "service_fee"), "₱9,228.84");
  assert.equal(namedTableTotal(doc, "Income by Loan Account", "other_fees"), "₱6,000.00");

  const noTotals = buildIncomeDoc(null, RANGE, { data: table.rows, meta: { total: 1 } });
  assert.equal(namedTableTotal(noTotals, "Income by Loan Account", "service_fee"), DASH);
});

test("due and past due: a schedule status reads in words with a capital", () => {
  const rows = tableRows(
    buildDuePastDueListDoc(
      { data: [{ ...DUE_ROWS[0], status: "pending" }, { ...DUE_ROWS[0], status: "overdue" }, { ...DUE_ROWS[0], status: "partially_paid" }], meta: { total: 3 } },
      RANGE
    )
  );
  assert.deepEqual(rows.map((r) => r.status), ["Pending", "Overdue", "Partially Paid"]);
});

test("releases list: a loan past grace reads Past Due, from the server's display_status", () => {
  const rows = tableRows(
    buildReleasesListDoc(
      {
        data: [
          { ...RELEASE_ROWS[0], status: "ongoing", display_status: "past_due" },
          { ...RELEASE_ROWS[0], status: "ongoing", display_status: "ongoing" },
          { ...RELEASE_ROWS[0], status: "released" },
        ],
        meta: { total: 3 },
      },
      RANGE
    )
  );
  assert.deepEqual(rows.map((r) => r.status), ["Past Due", "Current", "Current"]);
});
