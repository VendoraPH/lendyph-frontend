import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency } from "@/lib/format";
import type { GCashTransaction, GCashTransactionTotals } from "@/types";
import {
  GCASH_TRANSACTIONS_TITLE,
  TRANSACTIONS_CHANGED,
  gcashTransactionsReport,
  transactionsExportRefusal,
} from "./transactions-report";

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

/**
 * `meta.totals` exactly as the server sends it. Deliberately not the sum or
 * the count of `rows`, so a document that works its own figures out from the
 * rows can't pass for one that shows these.
 */
const SERVER_TOTALS: GCashTransactionTotals = {
  count: 12,
  amount: "23000.00",
  cash_in: "15000.00",
  cash_out: "8000.00",
  charges: "240.00",
  total: "23140.00",
  pending: { count: 2, amount: "3000.00", charges: "40.00", total: "3040.00" },
};
const NONE_PENDING = { count: 0, amount: "0.00", charges: "0.00", total: "0.00" };

function build(over: Partial<Parameters<typeof gcashTransactionsReport>[0]> = {}) {
  return gcashTransactionsReport({
    rows,
    total: rows.length,
    totals: SERVER_TOTALS,
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

function tiles(doc: ReturnType<typeof build>) {
  const s = doc.sections.find((x) => x.kind === "kpi_grid");
  assert.ok(s && s.kind === "kpi_grid");
  return s.items;
}

function summary(doc: ReturnType<typeof build>) {
  return tiles(doc).map((k) => [k.label, k.value]);
}

function chargesHint(doc: ReturnType<typeof build>) {
  return tiles(doc).find((k) => k.label === "Charges")?.hint;
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

  test("each row's amounts are kept exactly as the server sent them", () => {
    const asText = (v: string) => v as unknown as number;
    const t = table(build({ rows: [tx(1, { amount: asText("250.50"), charge_amount: asText("5.00"), total_amount: asText("255.50") })] }));
    assert.deepEqual(
      [t.rows[0].amount, t.rows[0].charge, t.rows[0].total],
      ["250.50", "5.00", "255.50"],
    );
  });

  test("totals show the server's figures when sent", () => {
    const doc = build();
    assert.deepEqual(summary(doc), [
      ["Transactions", "12"],
      ["Cash In", formatCurrency(15000)],
      ["Cash Out", formatCurrency(8000)],
      ["Charges", formatCurrency(240)],
    ]);
    assert.deepEqual(table(doc).totals, [
      { column: "amount", value: formatCurrency(23000) },
      { column: "charge", value: formatCurrency(240) },
      { column: "total", value: formatCurrency(23140) },
    ]);
  });

  test("the charges say how much is on pending Cash Ins, not yet income", () => {
    assert.equal(chargesHint(build()), `${formatCurrency(40)} pending, not yet income`);
    assert.equal(chargesHint(build({ totals: { ...SERVER_TOTALS, pending: NONE_PENDING } })), undefined);
  });

  test("totals read — when the server sends none", () => {
    const doc = build({ totals: null, total: 3 });
    assert.deepEqual(summary(doc), [
      ["Transactions", "3"],
      ["Cash In", "—"],
      ["Cash Out", "—"],
      ["Charges", "—"],
    ]);
    assert.deepEqual(table(doc).totals, [
      { column: "amount", value: "—" },
      { column: "charge", value: "—" },
      { column: "total", value: "—" },
    ]);
    assert.equal(chargesHint(doc), undefined);
    // No count either: a dash, not the rows counted here.
    assert.equal(summary(build({ totals: null, total: null }))[0][1], "—");
  });

  test("no range and no rows: All time, and the server's zero totals read ₱0.00", () => {
    const zero: GCashTransactionTotals = {
      count: 0,
      amount: "0.00",
      cash_in: "0.00",
      cash_out: "0.00",
      charges: "0.00",
      total: "0.00",
      pending: NONE_PENDING,
    };
    const doc = build({ rows: [], total: 0, totals: zero, from: "", to: "" });
    assert.equal(doc.meta.period, "All time");
    assert.equal(table(doc).rows.length, 0);
    assert.deepEqual(summary(doc).map(([, value]) => value), [
      "0",
      formatCurrency(0),
      formatCurrency(0),
      formatCurrency(0),
    ]);
    assert.equal(table(doc).totals?.[2].value, formatCurrency(0));
  });
});

describe("whether the drained transactions can be exported", () => {
  const whole = { rows, total: 3, truncated: false, totals: { ...SERVER_TOTALS, count: 3 } };

  test("a whole list that matches the server's count can", () => {
    assert.equal(transactionsExportRefusal(whole), null);
  });

  test("a list cut short is refused, saying how many loaded", () => {
    assert.equal(
      transactionsExportRefusal({ ...whole, truncated: true, total: 250 }),
      "Only 3 of 250 transactions could be loaded. Narrow the date range and try again.",
    );
  });

  test("rows that no longer match the server's count are refused: the transactions changed", () => {
    assert.equal(TRANSACTIONS_CHANGED, "The transactions changed while the report was being made. Please try again.");
    // One recorded or marked paid after page 1: a row missing, or a row too many.
    assert.equal(transactionsExportRefusal({ ...whole, totals: { ...SERVER_TOTALS, count: 4 } }), TRANSACTIONS_CHANGED);
    assert.equal(transactionsExportRefusal({ ...whole, totals: { ...SERVER_TOTALS, count: 2 } }), TRANSACTIONS_CHANGED);
  });

  test("a repeated row is refused even when the count matches", () => {
    const repeated = [rows[0], rows[1], rows[0]];
    assert.equal(transactionsExportRefusal({ ...whole, rows: repeated }), TRANSACTIONS_CHANGED);
  });

  test("without totals the count isn't checked, but a repeated row still is", () => {
    assert.equal(transactionsExportRefusal({ ...whole, totals: null, total: null }), null);
    assert.equal(
      transactionsExportRefusal({ ...whole, totals: null, rows: [...rows, rows[2]] }),
      TRANSACTIONS_CHANGED,
    );
  });
});
