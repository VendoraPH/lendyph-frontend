import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency } from "@/lib/format";
import type { GCashTransaction } from "@/types";
import { GCASH_TRANSACTIONS_TITLE, gcashTransactionsReport } from "./transactions-report";

function tx(id: number, over: Partial<GCashTransaction>): GCashTransaction {
  return {
    id,
    reference_no: `GC-${id}`,
    transaction_date: "2026-11-10",
    type: "cash_in",
    amount: 1000,
    charge_amount: 20,
    total_amount: 1020,
    status: "completed",
    transactor_user_id: 1,
    transactor_user: { id: 1, full_name: "Teller One" },
    created_at: "2026-11-10T01:00:00Z",
    updated_at: "2026-11-10T01:00:00Z",
    ...over,
  };
}

const member = { id: 4, full_name: "Ana Cruz", borrower_code: "M-4" };
const rows = [
  tx(3, { type: "cash_out", amount: 500.1, charge_amount: 10.1, total_amount: 510.2, status: "pending", non_member: { id: 9, full_name: "Juan Walk" } }),
  tx(2, { amount: 0.2, charge_amount: 0.1, total_amount: 0.3, borrower: member }),
  tx(1, { borrower: member }),
];

function build(over: Partial<Parameters<typeof gcashTransactionsReport>[0]> = {}) {
  return gcashTransactionsReport({
    rows,
    from: "2026-11-01",
    to: "2026-11-30",
    type: "all",
    status: "all",
    branchOf: (r) => (r.non_member ? "Main" : "Members"),
    ...over,
  });
}

function table(doc: ReturnType<typeof build>) {
  const s = doc.sections.find((x) => x.kind === "table");
  assert.ok(s && s.kind === "table");
  return s;
}

describe("the GCash transactions report", () => {
  test("title, the selected range and the filters in the header", () => {
    const doc = build({ status: "pending" });
    assert.equal(doc.meta.title, GCASH_TRANSACTIONS_TITLE);
    assert.match(doc.meta.period ?? "", /2026/);
    const fields = doc.sections.find((s) => s.kind === "fields");
    assert.ok(fields && fields.kind === "fields");
    assert.deepEqual(fields.items.map((i) => [i.label, i.value]), [
      ["Date Range", doc.meta.period],
      ["Type", "All"],
      ["Status", "Pending"],
    ]);
  });

  test("one row per transaction, with the tab's columns", () => {
    const t = table(build());
    assert.equal(t.rows.length, 3);
    assert.deepEqual(t.rows[0], {
      date: "2026-11-10",
      reference: "GC-3",
      customer: "Juan Walk (Walk-in)",
      branch: "Main",
      type: "Cash Out",
      amount: 500.1,
      charge: 10.1,
      total: 510.2,
      status: "Pending",
      transactor: "Teller One",
    });
  });

  test("totals add up in centavos, with no float drift", () => {
    assert.deepEqual(table(build()).totals, [
      { column: "amount", value: formatCurrency(1500.3) },
      { column: "charge", value: formatCurrency(30.2) },
      { column: "total", value: formatCurrency(1530.5) },
    ]);
  });

  test("the summary splits Cash In from Cash Out", () => {
    const kpis = build().sections.find((s) => s.kind === "kpi_grid");
    assert.ok(kpis && kpis.kind === "kpi_grid");
    assert.deepEqual(
      kpis.items.map((k) => k.value),
      ["3", formatCurrency(1000.2), formatCurrency(500.1), formatCurrency(30.2)],
    );
  });

  test("amounts sent as decimal strings still add up", () => {
    const asText = (v: string) => v as unknown as number;
    const doc = build({ rows: [tx(1, { amount: asText("250.50"), charge_amount: asText("5.00"), total_amount: asText("255.50") })] });
    assert.equal(table(doc).totals?.[2].value, formatCurrency(255.5));
  });

  test("no range and no rows: All time, zero totals", () => {
    const doc = build({ rows: [], from: "", to: "" });
    assert.equal(doc.meta.period, "All time");
    assert.equal(table(doc).totals?.[0].value, formatCurrency(0));
  });
});
