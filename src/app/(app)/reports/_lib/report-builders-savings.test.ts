import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { REPORT_TITLES } from "@/lib/page-titles";
import { SAVINGS_REPORT_SPECS, buildSavingsReportDoc } from "./report-builders-savings";
import type { ReportSection, SavingsReportId } from "./types";

const range = { from: "2026-10-01", to: "2026-10-31" };
const ids = Object.keys(SAVINGS_REPORT_SPECS) as SavingsReportId[];

function section<K extends ReportSection["kind"]>(doc: { sections: ReportSection[] }, kind: K) {
  return doc.sections.find((s) => s.kind === kind) as Extract<ReportSection, { kind: K }> | undefined;
}

describe("savings report builders", () => {
  test("every savings report builds a titled shell from a failed read", () => {
    for (const id of ids) {
      const doc = buildSavingsReportDoc(id, null, range);
      assert.equal(doc.reportId, id);
      assert.equal(doc.meta.title, REPORT_TITLES[id]);
      const table = section(doc, "table");
      assert.ok(table, `${id} has no table`);
      assert.equal(table.rows.length, 0);
      assert.equal(table.totals, undefined, `${id} foots an empty table`);
      // Every KPI, the row count included, is the server's, so a failed read shows dashes.
      const kpis = section(doc, "kpi_grid")!.items;
      for (const item of kpis) assert.equal(item.value, "—", `${id}: ${item.label}`);
    }
  });

  test("totals are the server's, never a sum of the page", () => {
    const doc = buildSavingsReportDoc(
      "savings_deposits",
      {
        data: [
          { transaction_date: "2026-10-02", amount: "100.00", status: "posted", payment_method: "cash" },
          { transaction_date: "2026-10-03", amount: "50.00", status: "posted", payment_method: "gcash" },
        ],
        meta: { total: 2 },
        totals: { total_amount: "999.00" },
      },
      range,
    );
    const kpis = section(doc, "kpi_grid")!.items;
    assert.equal(kpis[0].value, "2");
    assert.match(kpis[1].value, /999\.00/);
    const table = section(doc, "table")!;
    assert.deepEqual(table.totals?.map((t) => t.column), ["amount"]);
    assert.match(table.totals![0].value, /999\.00/);
  });

  test("raw codes and nested users read as text", () => {
    const doc = buildSavingsReportDoc(
      "savings_withdrawals",
      { data: [{ status: "pending_approval", payment_method: "bank_transfer", processed_by: { id: 3, name: "Ana Cruz" } }] },
      range,
    );
    const row = section(doc, "table")!.rows[0];
    assert.equal(row.status, "Pending approval");
    assert.equal(row.payment_method, "Bank transfer");
    assert.equal(row.processed_by, "Ana Cruz");
  });

  test("a page shorter than the server's count says so", () => {
    const doc = buildSavingsReportDoc(
      "savings_register",
      { data: [{ account_number: "SA-1" }], meta: { total: 450 }, totals: { total_balance: "10.00" } },
      range,
    );
    const note = section(doc, "note");
    assert.ok(note);
    assert.match(note.text, /1 of 450 accounts/);
  });

  test("closed/dormant counts come from totals", () => {
    const doc = buildSavingsReportDoc(
      "savings_closed_dormant",
      { data: [], meta: { total: 0 }, totals: { closed_count: 4, dormant_count: 7, total_balance: "0" } },
      range,
    );
    const values = Object.fromEntries(section(doc, "kpi_grid")!.items.map((i) => [i.label, i.value]));
    assert.equal(values.Closed, "4");
    assert.equal(values.Dormant, "7");
  });
});
