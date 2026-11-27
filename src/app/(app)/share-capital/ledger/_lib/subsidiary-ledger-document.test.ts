import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency } from "@/lib/format";
import type { ShareCapitalLedgerEntry } from "@/types";
import { SUBSIDIARY_LEDGER_TITLE, ledgerEntryNumbers, subsidiaryLedgerDocument } from "./subsidiary-ledger-document";

function entry(id: number, date: string, debit: number, credit: number, balance: number, ref: string | null = null): ShareCapitalLedgerEntry {
  return {
    id,
    borrower_id: 7,
    borrower_name: "Ana Cruz",
    borrower_code: "M-0007",
    date,
    description: credit > 0 ? "Manual credit entry" : "Withdrawal",
    reference: `SC-${id}`,
    reference_number: ref,
    debit,
    credit,
    created_at: null,
    running_balance: balance,
  };
}

// As the API sends them: newest first.
const entries = [
  entry(3, "2026-03-31", 0, 500, 2_300, "CSH-1002325-2026-0002"),
  entry(2, "2026-02-15", 200, 0, 1_800),
  entry(1, "2026-01-01", 0, 1_000, 2_000, "GC-778899"),
];
const period = { opening_balance: 1_000, total_credits: 1_500, total_debits: 200, ending_balance: 2_300 };

function build() {
  return subsidiaryLedgerDocument({
    member: { name: "Ana Cruz", code: "M-0007" },
    range: { from: "2026-01-01", to: "2026-03-31" },
    entries,
    period,
    generatedAt: new Date("2026-11-21T01:00:00Z"),
  });
}

function table(doc: ReturnType<typeof build>) {
  const section = doc.sections.find((s) => s.kind === "table");
  assert.ok(section && section.kind === "table");
  return section;
}

describe("the share capital subsidiary ledger document", () => {
  test("header: title, member name and ID, and the selected range", () => {
    const doc = build();
    assert.equal(doc.meta.title, SUBSIDIARY_LEDGER_TITLE);
    assert.equal(doc.meta.subtitle, "Ana Cruz (M-0007)");
    assert.equal(doc.meta.referenceKey, "M-0007");
    const fields = doc.sections.find((s) => s.kind === "fields");
    assert.ok(fields && fields.kind === "fields");
    assert.deepEqual(fields.items.map((i) => i.label), ["Member Name", "Member ID", "Date Range"]);
    assert.equal(fields.items[2].value, doc.meta.period);
    assert.match(doc.meta.period ?? "", /2026/);
  });

  test("the opening row first, then entries oldest first with the server's running balances", () => {
    const rows = table(build()).rows;
    assert.equal(rows[0].description, "Opening Balance (before the period)");
    assert.equal(rows[0].balance, formatCurrency(1_000));
    assert.deepEqual(rows.slice(1).map((r) => r.date), ["2026-01-01", "2026-02-15", "2026-03-31"]);
    assert.deepEqual(rows.slice(1).map((r) => r.balance), [2_000, 1_800, 2_300].map((n) => formatCurrency(n)));
  });

  test("each entry shows the ledger's own number and its reference, a dash when it has none", () => {
    const section = table(build());
    assert.deepEqual(section.columns.map((c) => c.header), [
      "Date", "Entry No.", "Reference No.", "Description", "Debit", "Credit", "Running Balance",
    ]);
    const [opening, ...rows] = section.rows;
    assert.deepEqual(rows.map((r) => [r.entryNo, r.referenceNo]), [
      ["SC-1", "GC-778899"],
      ["SC-2", "—"],
      ["SC-3", "CSH-1002325-2026-0002"],
    ]);
    assert.deepEqual([opening.entryNo, opening.referenceNo], ["", ""], "the opening balance is no entry");
  });

  test("an entry's two numbers, shared with the screen: the SC- number, and the reference or a dash", () => {
    assert.deepEqual(ledgerEntryNumbers({ reference: "SC-9", reference_number: "CSH-0012-2026-0007" }), {
      entryNo: "SC-9",
      referenceNo: "CSH-0012-2026-0007",
    });
    for (const none of [null, "", undefined]) {
      assert.deepEqual(ledgerEntryNumbers({ reference: "SC-9", reference_number: none }), { entryNo: "SC-9", referenceNo: "—" });
    }
  });

  test("debit and credit are blank where an entry has none", () => {
    const [, first, second] = table(build()).rows;
    assert.equal(first.debit, "");
    assert.equal(first.credit, formatCurrency(1_000));
    assert.equal(second.debit, formatCurrency(200));
    assert.equal(second.credit, "");
  });

  test("totals and closing balance are the server's period figures, not sums", () => {
    const doc = build();
    assert.deepEqual(table(doc).totals, [
      { column: "debit", value: formatCurrency(200) },
      { column: "credit", value: formatCurrency(1_500) },
      { column: "balance", value: formatCurrency(2_300) },
    ]);
    const kpis = doc.sections.find((s) => s.kind === "kpi_grid");
    assert.ok(kpis && kpis.kind === "kpi_grid");
    assert.deepEqual(kpis.items.map((k) => k.value), [1_000, 200, 1_500, 2_300].map((n) => formatCurrency(n)));
  });

  test("no range: every entry, an opening balance with no 'before' wording", () => {
    const doc = subsidiaryLedgerDocument({ member: { name: "Ana Cruz", code: "M-0007" }, range: {}, entries: [], period: { ...period, opening_balance: 0 } });
    assert.equal(doc.meta.period, "All time");
    assert.equal(table(doc).rows[0].description, "Opening Balance");
  });
});
