import { test } from "node:test";
import assert from "node:assert/strict";
import { DASH, formatCurrency } from "@/lib/report-format";
import { buildSavingsBalancesDoc, buildTimeDepositMaturitiesDoc } from "./savings-report-builders";
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
    last_transaction_at: "2026-11-02",
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
    last_transaction_at: "2025-01-15",
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
        annual_interest_rate: "4.0000",
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
  assert.notEqual(row.maturity_instruction, "rollover_principal");
  assert.notEqual(row.status, "active");

  const withPayout = buildTimeDepositMaturitiesDoc({ ...raw, totals: { ...raw.totals, payout_amount: "400.00" } }, RANGE);
  assert.equal(kpiValue(withPayout, "To Pay Out"), formatCurrency(400));
});
