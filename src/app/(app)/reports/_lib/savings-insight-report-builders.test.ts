import { test } from "node:test";
import assert from "node:assert/strict";
import { DASH } from "@/lib/report-format";
import {
  buildSavingsAccountActivityDoc,
  buildSavingsAccountListDoc,
  buildSavingsDepositsDoc,
  buildSavingsInterestAccrualDoc,
  buildSavingsLargeTransactionsDoc,
  buildSavingsMemberStatementDoc,
  buildSavingsSummaryDoc,
  buildSavingsTimeDepositsDoc,
  buildSavingsWithdrawalsDoc,
} from "./savings-insight-report-builders";
import type { DateRange, ReportDocument, ReportSection } from "./types";

const RANGE: DateRange = { from: "2026-11-01", to: "2026-11-30" };

type Table = Extract<ReportSection, { kind: "table" }>;

function kpiValue(doc: ReportDocument, label: string): string | undefined {
  for (const s of doc.sections) {
    if (s.kind === "kpi_grid") {
      const item = s.items.find((i) => i.label === label);
      if (item) return item.value;
    }
  }
  return undefined;
}
function tables(doc: ReportDocument): Table[] {
  return doc.sections.filter((s): s is Table => s.kind === "table");
}
function total(t: Table, column: string): string | undefined {
  return t.totals?.find((x) => x.column === column)?.value;
}
function notes(doc: ReportDocument): string[] {
  return doc.sections.flatMap((s) => (s.kind === "note" ? [s.text] : []));
}
/** Every key the server sends in words never reaches the paper raw. */
function assertNoRawKeys(doc: ReportDocument, keys: string[]) {
  const cells = tables(doc).flatMap((t) => t.rows.flatMap((r) => Object.values(r)));
  for (const key of keys) assert.ok(!cells.includes(key), `raw key "${key}" printed`);
}

const SUMMARY_LINE = {
  opening_balance: "1000.00",
  deposit_count: 2,
  deposits: "500.00",
  withdrawal_count: 1,
  withdrawals: "200.00",
  interest_credited: "10.00",
  tax_withheld: "0.00",
  fee_count: 1,
  fees_charged: "15.00",
  share_capital_transfer_count: 1,
  share_capital_transfers: "1700.00",
  other_movements: "5.00",
  net_movement: "300.00",
  closing_balance: "1300.00",
  new_accounts: 1,
  open_accounts: 4,
  time_deposit_count: 2,
  time_deposits: "20000.00",
  time_deposits_placed_count: 1,
  time_deposits_placed: "10000.00",
  time_deposit_interest: "80.00",
  interest_expense: "90.00",
  total_deposits: "21300.00",
};

// The server's totals are worked out over the whole filter; the browser must
// print them, never a sum of the rows (these rows deliberately don't add up).
const SUMMARY = {
  group_by: "product",
  date_from: "2026-11-01",
  date_to: "2026-11-30",
  rows: [
    { group_id: 1, group_name: "Regular Savings", ...SUMMARY_LINE },
    { group_id: 2, group_name: "Youth Savings", ...SUMMARY_LINE, closing_balance: "0.00", deposits: "0.00" },
  ],
  totals: { ...SUMMARY_LINE, closing_balance: "9999.99", deposits: "777.77", total_deposits: "123456.78" },
};

test("the deposit summary prints the server's totals and names its grouping", () => {
  const doc = buildSavingsSummaryDoc(SUMMARY, RANGE);
  assert.equal(doc.reportId, "savings_summary");
  assert.equal(doc.meta.title, "Deposit Summary");
  assert.match(doc.meta.subtitle ?? "", /by product/i);
  assert.equal(kpiValue(doc, "Closing Balance"), "₱9,999.99");
  assert.equal(kpiValue(doc, "Deposits"), "₱777.77");
  assert.equal(kpiValue(doc, "Total Deposits"), "₱123,456.78");
  assert.equal(kpiValue(doc, "Fees Charged"), "₱15.00");
  const [movement, holdings] = tables(doc);
  assert.equal(movement.columns[0].header, "Product");
  assert.equal(holdings.columns[0].header, "Product");
  assert.equal(movement.rows.length, 2);
  assert.equal(total(movement, "closing_balance"), "₱9,999.99");
  assert.equal(total(movement, "deposits"), "₱777.77");
  assert.equal(total(holdings, "total_deposits"), "₱123,456.78");
});

test("every figure that makes up the closing has its own column and totals cell, transfers to share capital included", () => {
  const doc = buildSavingsSummaryDoc(SUMMARY, RANGE);
  const [movement] = tables(doc);
  assert.deepEqual(
    movement.columns.map((c) => c.header),
    ["Product", "Opening", "Deposits", "Withdrawals", "Interest", "Tax Withheld", "Fees", "To Share Capital", "Other", "Change in Balance", "Closing"],
  );
  assert.equal(movement.rows[0].share_capital_transfers, "1700.00");
  assert.equal(total(movement, "share_capital_transfers"), "₱1,700.00");
  assert.equal(kpiValue(doc, "Transfers to Share Capital"), "₱1,700.00");
  assert.equal(kpiValue(doc, "Change in Balance"), "₱300.00");
  assert.equal(kpiValue(doc, "Net Movement"), undefined, "no label that reads like the dashboard's deposits less withdrawals");
});

test("the deposit summary by branch reads Branch, and a failed request shows dashes", () => {
  const byBranch = buildSavingsSummaryDoc({ ...SUMMARY, group_by: "branch" }, RANGE);
  assert.equal(tables(byBranch)[0].columns[0].header, "Branch");
  const empty = buildSavingsSummaryDoc(null, RANGE);
  assert.equal(kpiValue(empty, "Closing Balance"), DASH);
  assert.equal(tables(empty)[0].rows.length, 0);
});

const ACCOUNT_ROWS = [
  {
    account_number: "SAV-0001",
    borrower_name: "Ana Reyes",
    borrower_code: "M-1",
    product_name: "Regular Savings",
    branch_name: "Main",
    status: "dormant",
    balance: "1500.00",
    opened_on: "2024-01-05",
    closed_on: null,
    dormant_since: "2026-01-05",
    last_member_activity_on: "2024-01-05",
    account_officer: { id: 3, name: "Kim Cruz" },
  },
];

test("the account listing reads statuses in words, the officer by name, and the server's counts", () => {
  const doc = buildSavingsAccountListDoc({
    data: ACCOUNT_ROWS,
    meta: { total: 40, as_of: "2026-11-12" },
    totals: { account_count: 40, active_count: 30, dormant_count: 6, frozen_count: 1, closed_count: 3, total_balance: "88000.00" },
  });
  assert.equal(doc.reportId, "savings_accounts");
  assert.equal(kpiValue(doc, "Accounts"), "40");
  assert.equal(kpiValue(doc, "Dormant"), "6");
  assert.equal(kpiValue(doc, "Total Balance"), "₱88,000.00");
  const t = tables(doc)[0];
  assert.equal(t.rows[0].status, "Dormant");
  assert.equal(t.rows[0].account_officer, "Kim Cruz");
  assert.equal(total(t, "balance"), "₱88,000.00");
  assert.ok(notes(doc).some((n) => n.includes("1 of 40")), "the truncation note names the shown rows");
  assertNoRawKeys(doc, ["dormant"]);
});

const FLOW_ROWS = [
  {
    date: "2026-11-03",
    reference: "SVT-1",
    account_number: "SAV-0001",
    borrower_name: "Ana Reyes",
    product_name: "Regular Savings",
    branch_name: "Main",
    type: "deposit",
    method: "gcash",
    amount: "600000.00",
    credit: "600000.00",
    debit: "0.00",
    balance_after: "600500.00",
    reversed: false,
    reversed_by_reference: null,
    reversed_on: null,
  },
  {
    date: "2026-11-04",
    reference: "SVT-2",
    account_number: "SAV-0001",
    borrower_name: "Ana Reyes",
    product_name: "Regular Savings",
    branch_name: "Main",
    type: "deposit",
    method: "cash",
    amount: "50.00",
    credit: "50.00",
    debit: "0.00",
    balance_after: "600550.00",
    reversed: true,
    reversed_by_reference: "SVT-3",
    reversed_on: "2026-11-05",
  },
];
const FLOW_TOTALS = { count: 2, reversed_count: 1, total_credit: "600000.00", total_debit: "0.00", total_amount: "600000.00" };

test("deposits print the server's total, leave reversed rows out of it, and mark them", () => {
  const doc = buildSavingsDepositsDoc({ data: FLOW_ROWS, meta: { total: 2 }, totals: FLOW_TOTALS }, RANGE);
  assert.equal(doc.reportId, "savings_deposits");
  assert.equal(kpiValue(doc, "Deposits"), "2");
  assert.equal(kpiValue(doc, "Reversed"), "1");
  assert.equal(kpiValue(doc, "Amount Deposited"), "₱600,000.00");
  const t = tables(doc)[0];
  assert.equal(t.rows[0].method, "GCash");
  assert.equal(t.rows[0].reversed, "—");
  assert.match(String(t.rows[1].reversed), /SVT-3/);
  assert.equal(total(t, "amount"), "₱600,000.00");
  assertNoRawKeys(doc, ["deposit", "gcash", "cash"]);
});

test("withdrawals total the server's money out", () => {
  const doc = buildSavingsWithdrawalsDoc(
    { data: [{ ...FLOW_ROWS[0], type: "closing", credit: "0.00", debit: "600000.00" }], meta: { total: 1 }, totals: { ...FLOW_TOTALS, total_credit: "0.00", total_debit: "600000.00" } },
    RANGE,
  );
  assert.equal(doc.reportId, "savings_withdrawals");
  assert.equal(kpiValue(doc, "Amount Withdrawn"), "₱600,000.00");
  assert.equal(tables(doc)[0].rows[0].type, "Closing payout");
});

test("large transactions say the alert amount the server used", () => {
  const doc = buildSavingsLargeTransactionsDoc(
    { data: FLOW_ROWS.slice(0, 1), meta: { total: 1, threshold: "500000.00" }, totals: FLOW_TOTALS, threshold: "500000.00" },
    RANGE,
  );
  assert.equal(doc.reportId, "savings_large_transactions");
  assert.equal(kpiValue(doc, "Alert Amount"), "₱500,000.00");
  assert.equal(kpiValue(doc, "Money In"), "₱600,000.00");
  assert.equal(kpiValue(doc, "Money Out"), "₱0.00");
});

test("time deposits outstanding read rates unrounded and instructions in words", () => {
  const doc = buildSavingsTimeDepositsDoc({
    data: [
      {
        certificate_number: "TD-0001",
        borrower_name: "Ana Reyes",
        product_name: "90-day TD",
        placement_date: "2026-10-01",
        maturity_date: "2026-12-30",
        days_to_maturity: 48,
        principal: "10000.00",
        annual_rate: "3.1250",
        net_interest: "77.05",
        maturity_amount: "10077.05",
        maturity_instruction: "rollover_all",
        status: "active",
      },
    ],
    meta: { total: 1, as_of: "2026-11-12" },
    totals: { count: 1, total_principal: "10000.00", total_net_interest: "77.05", total_maturity_amount: "10077.05" },
    as_of: "2026-11-12",
  });
  assert.equal(doc.reportId, "savings_time_deposits");
  assert.equal(kpiValue(doc, "Principal"), "₱10,000.00");
  const row = tables(doc)[0].rows[0];
  assert.equal(row.annual_rate, "3.125%");
  assert.equal(row.maturity_instruction, "Roll over principal and interest");
  assert.equal(row.status, "Active");
  assert.match(doc.meta.asOf ?? "", /2026/);
});

test("interest accrual says it is shown only, and reads why a line earns nothing", () => {
  const doc = buildSavingsInterestAccrualDoc({
    data: [
      {
        account_number: "SAV-0002",
        borrower_name: "Ben Cruz",
        product_name: "Regular Savings",
        balance: "100.00",
        accrual_from: "2026-10-01",
        accrual_to: "2026-11-11",
        days: 42,
        average_daily_balance: "100.00",
        gross_interest: "0.00",
        tax: "0.00",
        net_interest: "0.00",
        skip_reason: "below_minimum_adb",
      },
    ],
    meta: { total: 1 },
    totals: { account_count: 1, total_gross_interest: "0.00", total_tax: "0.00", total_net_interest: "0.00" },
  });
  assert.equal(doc.reportId, "savings_interest_accrual");
  assert.equal(kpiValue(doc, "Gross Interest"), "₱0.00");
  assert.equal(tables(doc)[0].rows[0].skip_reason, "Average daily balance below the product's minimum");
  assert.ok(notes(doc).some((n) => /nothing posts/i.test(n)));
});

test("account activity prints each account's server figures and the whole-filter totals", () => {
  const doc = buildSavingsAccountActivityDoc(
    {
      data: [
        {
          account_number: "SAV-0001",
          borrower_name: "Ana Reyes",
          product_name: "Regular Savings",
          status: "active",
          opening_balance: "100.00",
          credits: "50.00",
          debits: "20.00",
          transaction_count: 3,
          closing_balance: "130.00",
          last_transaction_on: "2026-11-09",
        },
      ],
      meta: { total: 1 },
      totals: { account_count: 1, transaction_count: 3, total_opening_balance: "100.00", total_credits: "50.00", total_debits: "20.00", total_closing_balance: "130.00" },
    },
    RANGE,
  );
  assert.equal(doc.reportId, "savings_account_activity");
  assert.equal(kpiValue(doc, "Closing Balance"), "₱130.00");
  assert.equal(total(tables(doc)[0], "closing_balance"), "₱130.00");
});

test("the member statement shows one table per account, the member by name and code only, and the totals", () => {
  const doc = buildSavingsMemberStatementDoc(
    {
      member: { id: 7, name: "Ana Reyes", code: "M-1", branch_id: 1, branch_name: "Main" },
      date_from: "2026-11-01",
      date_to: "2026-11-30",
      accounts: [
        {
          account: { account_number: "SAV-0001", product_name: "Regular Savings", status: "active" },
          opening_balance: "100.00",
          closing_balance: "150.00",
          totals: { credit: "60.00", debit: "10.00" },
          rows: [{ date: "2026-11-02", reference: "SVT-9", type: "deposit", method: "cash", credit: "60.00", debit: "0.00", balance_after: "160.00" }],
        },
      ],
      time_deposits: [
        { certificate_number: "TD-1", product_name: "90-day TD", placement_date: "2026-10-01", maturity_date: "2026-12-30", principal: "10000.00", status: "active", outstanding: true },
      ],
      totals: { account_count: 1, opening_balance: "100.00", credit: "60.00", debit: "10.00", closing_balance: "150.00", time_deposit_count: 1, time_deposits: "10000.00", total_deposits: "10150.00" },
    },
    RANGE,
  );
  assert.equal(doc.reportId, "savings_member_statement");
  assert.equal(doc.meta.referenceKey, "M-1");
  assert.equal(kpiValue(doc, "Total Deposits"), "₱10,150.00");
  const t = tables(doc);
  assert.equal(t.length, 2, "one account table and one time deposit table");
  assert.match(t[0].title ?? "", /SAV-0001/);
  assert.equal(t[0].rows[0].type, "Deposit");
  assert.equal(total(t[0], "balance_after"), "₱150.00");
  assert.equal(t[1].rows[0].outstanding, "Yes");
  const fields = doc.sections.find((s) => s.kind === "fields");
  assert.ok(fields && fields.kind === "fields");
  assert.deepEqual(
    fields.items.map((i) => i.label),
    ["Member", "Member Code", "Branch"],
  );
});

test("a member statement that couldn't be read is blank, not a false ₱0.00", () => {
  const doc = buildSavingsMemberStatementDoc(null, RANGE);
  assert.equal(kpiValue(doc, "Total Deposits"), DASH);
});
