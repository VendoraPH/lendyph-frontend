import { test } from "node:test";
import assert from "node:assert/strict";
import { DASH, formatCurrency } from "@/lib/report-format";
import {
  buildSavingsBalancesDoc,
  buildSavingsDormantDoc,
  buildSavingsGlControlDoc,
  buildSavingsInterestPostingsDoc,
  buildSavingsStatementDoc,
  buildSavingsTransactionsDoc,
  buildTimeDepositMaturitiesDoc,
} from "./savings-report-builders";
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
function table(doc: ReportDocument): Table {
  const t = doc.sections.find((s): s is Table => s.kind === "table");
  assert.ok(t, "no table");
  return t;
}
function total(doc: ReportDocument, column: string): string | undefined {
  return table(doc).totals?.find((t) => t.column === column)?.value;
}
function note(doc: ReportDocument): string | null {
  const n = doc.sections.find((s) => s.kind === "note");
  return n && n.kind === "note" ? n.text : null;
}

const ACCOUNTS = [
  {
    account_number: "SA-1",
    borrower_name: "Ana Reyes",
    product_name: "Regular Savings",
    status: "active",
    balance: "1000.00",
    hold_amount: "0.00",
    available_balance: "900.00",
    accrued_interest: "1.20",
    last_member_activity_on: "2026-11-02",
  },
  {
    account_number: "SA-2",
    borrower_name: "Ben Cruz",
    product_name: "Regular Savings",
    status: "dormant",
    balance: "500.00",
    hold_amount: "500.00",
    available_balance: "0.00",
    accrued_interest: "0.40",
    last_member_activity_on: "2025-01-15",
  },
];

test("savings balances: KPIs and footers are the server's totals, labelled statuses, as of a day", () => {
  const doc = buildSavingsBalancesDoc({
    data: ACCOUNTS,
    meta: { total: 2 },
    totals: {
      account_count: 2,
      total_balance: "99999.00",
      total_hold: "500.00",
      total_available: "900.00",
      total_accrued_interest: "1.60",
    },
    as_of: "2026-11-07",
  });
  assert.equal(doc.reportId, "savings_balances");
  assert.ok(doc.meta.asOf);
  assert.equal(doc.meta.period, undefined);
  // The server's figure, not 1,500 summed from the rows.
  assert.equal(kpiValue(doc, "Total Deposits"), formatCurrency(99999));
  assert.equal(total(doc, "balance"), formatCurrency(99999));
  assert.equal(total(doc, "hold_amount"), formatCurrency(500));
  assert.deepEqual(table(doc).rows.map((r) => r.status), ["Active", "Dormant"]);
  assert.equal(note(doc), null);
});

test("savings balances: no totals from the server means dashes, never a sum", () => {
  const doc = buildSavingsBalancesDoc({ data: ACCOUNTS, meta: { total: 450 } });
  assert.equal(kpiValue(doc, "Total Deposits"), DASH);
  assert.equal(total(doc, "balance"), DASH);
  assert.equal(kpiValue(doc, "Accounts"), "450");
  assert.match(note(doc) ?? "", /first 2 of 450 accounts/);
});

test("savings balances: a failed request still renders the shell", () => {
  const doc = buildSavingsBalancesDoc(null);
  assert.equal(table(doc).rows.length, 0);
  assert.equal(kpiValue(doc, "Total Deposits"), DASH);
});

test("time deposit maturities: server totals, labelled instruction and status, the payout split only when sent", () => {
  const raw = {
    data: [
      {
        certificate_number: "TD-1",
        borrower_name: "Ana Reyes",
        product_name: "TD 90",
        principal: "50000.00",
        annual_rate: "4.0000",
        term_days: 90,
        maturity_date: "2026-11-24",
        net_interest: "400.00",
        maturity_amount: "50400.00",
        maturity_instruction: "rollover_principal",
        status: "active",
      },
    ],
    meta: { total: 1 },
    totals: { count: 1, total_principal: "50000.00", total_net_interest: "400.00", total_maturity_amount: "50400.00" },
  };
  const doc = buildTimeDepositMaturitiesDoc(raw, RANGE);
  assert.equal(doc.reportId, "time_deposit_maturities");
  assert.ok(doc.meta.period);
  assert.equal(kpiValue(doc, "Due at Maturity"), formatCurrency(50400));
  assert.equal(total(doc, "maturity_amount"), formatCurrency(50400));
  assert.equal(kpiValue(doc, "To Pay Out"), undefined);
  const row = table(doc).rows[0];
  assert.equal(row.maturity_instruction, "Roll over principal, pay out interest");
  assert.equal(row.status, "Active");

  const withPayout = buildTimeDepositMaturitiesDoc({ ...raw, totals: { ...raw.totals, payout_amount: "400.00" } }, RANGE);
  assert.equal(kpiValue(withPayout, "To Pay Out"), formatCurrency(400));
});

test("an unknown status reads Other, never the raw key", () => {
  const doc = buildSavingsBalancesDoc({ data: [{ ...ACCOUNTS[0], status: "escheated" }], meta: { total: 1 } });
  assert.equal(table(doc).rows[0].status, "Other");
});

test("savings transactions: types and methods in words, money in and out are the server's totals", () => {
  const doc = buildSavingsTransactionsDoc(
    {
      data: [
        { date: "2026-11-03", reference: "SVT-20261103-000001", type: "transfer_out", method: "savings", debit: "200.00", credit: "0.00", balance_after: "800.00" },
        { date: "2026-11-04", reference: "SVT-20261104-000002", type: "deposit", method: "bank_transfer", debit: "0.00", credit: "500.00", balance_after: "1300.00" },
      ],
      meta: { total: 2, totals: { count: 2, total_credit: "7777.00", total_debit: "1234.50" } },
    },
    RANGE,
  );
  assert.equal(doc.reportId, "savings_transactions");
  assert.deepEqual(table(doc).rows.map((r) => [r.type, r.method]), [
    ["Transfer out", "Savings account"],
    ["Deposit", "Bank transfer"],
  ]);
  assert.equal(kpiValue(doc, "Money In"), formatCurrency(7777));
  assert.equal(total(doc, "debit"), formatCurrency(1234.5));
});

test("savings transactions: no totals means dashes", () => {
  const doc = buildSavingsTransactionsDoc({ data: [{ type: "deposit", credit: "5.00", debit: "0.00" }] }, RANGE);
  assert.equal(kpiValue(doc, "Money In"), DASH);
  assert.equal(total(doc, "credit"), DASH);
});

test("interest postings: run statuses in words and the server's gross, tax and net", () => {
  const doc = buildSavingsInterestPostingsDoc(
    {
      data: [{ period_start: "2026-07-01", period_end: "2026-09-30", product_name: "Regular Savings", branch_name: "Main", status: "posted", account_count: 40, total_gross: "100.00", total_tax: "0.00", total_net: "100.00" }],
      meta: { total: 1 },
      totals: { count: 1, total_gross: "900.00", total_tax: "20.00", total_net: "880.00" },
    },
    RANGE,
  );
  assert.equal(doc.reportId, "savings_interest_postings");
  assert.equal(table(doc).rows[0].status, "Posted");
  assert.equal(kpiValue(doc, "Net Credited"), formatCurrency(880));
  assert.equal(total(doc, "total_tax"), formatCurrency(20));
});

test("dormant accounts: as of a day, the balance held is the server's", () => {
  const doc = buildSavingsDormantDoc({
    data: [{ account_number: "SAV-2026-000001", balance: "50.00", dormant_since: "2026-01-01" }],
    meta: { total: 1 },
    totals: { account_count: 1, total_balance: "4321.00" },
    as_of: "2026-11-10",
  });
  assert.equal(doc.reportId, "savings_dormant");
  assert.ok(doc.meta.asOf);
  assert.equal(kpiValue(doc, "Balance Held"), formatCurrency(4321));
  assert.equal(kpiValue(doc, "Dormant Accounts"), "1");
});

test("statement: the account's particulars, opening and closing balances and the running balance as sent", () => {
  const doc = buildSavingsStatementDoc(
    {
      account: { account_number: "SAV-2026-000007", borrower_name: "Ana Reyes", borrower_code: "MB-0001", product_name: "Regular Savings", branch_name: "Main", status: "dormant" },
      opening_balance: "1000.00",
      closing_balance: "1450.00",
      totals: { credit: "500.00", debit: "50.00" },
      rows: [
        { date: "2026-11-02", reference: "SVT-1", type: "deposit", method: "cash", credit: "500.00", debit: "0.00", balance_after: "1500.00" },
        { date: "2026-11-03", reference: "SVT-2", type: "withdrawal", method: "gcash", credit: "0.00", debit: "50.00", balance_after: "1450.00" },
      ],
    },
    RANGE,
  );
  assert.equal(doc.reportId, "savings_statement");
  assert.equal(doc.meta.referenceKey, "SAV-2026-000007");
  const fields = doc.sections.find((s) => s.kind === "fields");
  assert.ok(fields && fields.kind === "fields");
  assert.deepEqual(fields.items.find((i) => i.label === "Status"), { label: "Status", value: "Dormant" });
  assert.equal(kpiValue(doc, "Opening Balance"), formatCurrency(1000));
  assert.equal(kpiValue(doc, "Closing Balance"), formatCurrency(1450));
  assert.deepEqual(table(doc).rows.map((r) => [r.type, r.method, r.balance_after]), [
    ["Deposit", "Cash", "1500.00"],
    ["Withdrawal", "GCash", "1450.00"],
  ]);
});

test("statement: a failed request still renders, with dashes", () => {
  const doc = buildSavingsStatementDoc(null, RANGE);
  assert.equal(kpiValue(doc, "Opening Balance"), DASH);
  assert.equal(table(doc).rows.length, 0);
});

test("GL control: each branch's subledger, GL and difference are the server's", () => {
  const doc = buildSavingsGlControlDoc({
    as_of: "2026-11-10",
    rows: [
      { branch_name: "Main", account_code: "2050", account_name: "Savings Deposits", subledger_balance: "1000.00", gl_balance: "990.00", difference: "10.00" },
    ],
    totals: { subledger_balance: "1000.00", gl_balance: "990.00", difference: "10.00" },
  });
  assert.equal(doc.reportId, "savings_gl_control");
  assert.ok(doc.meta.asOf);
  assert.equal(kpiValue(doc, "Difference"), formatCurrency(10));
  assert.equal(table(doc).rows[0].difference, "10.00");
  assert.equal(kpiValue(buildSavingsGlControlDoc({ rows: [] }), "Difference"), DASH);
});

test("no savings report shows a dollar sign or Borrower", () => {
  const docs = [
    buildSavingsBalancesDoc(null),
    buildSavingsTransactionsDoc(null, RANGE),
    buildTimeDepositMaturitiesDoc(null, RANGE),
    buildSavingsInterestPostingsDoc(null, RANGE),
    buildSavingsDormantDoc(null),
    buildSavingsStatementDoc(null, RANGE),
    buildSavingsGlControlDoc(null),
  ];
  for (const doc of docs) {
    const text = JSON.stringify(doc);
    assert.doesNotMatch(text, /\$|USD/, doc.reportId);
    assert.doesNotMatch(text, /borrower(?!_)/i, doc.reportId);
  }
});
