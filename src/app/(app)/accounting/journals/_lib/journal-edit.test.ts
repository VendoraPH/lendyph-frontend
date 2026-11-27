import { test } from "node:test";
import assert from "node:assert/strict";
import type { JournalEntry } from "@/types";
import { centavosAsInput, draftFromEntry } from "./journal-edit";
import { previewLines } from "@/lib/accounting/journal";

function entry(over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 7,
    journal_no: "",
    date: "2026-11-03",
    source: "manual",
    reference: "JV-7",
    description: "Office rent",
    branch_id: 2,
    status: "draft",
    total_debit: 1500050,
    total_credit: 1500050,
    lines: [
      { account_id: 5, description: "Rent", debit: 1500050, credit: 0 },
      { account_id: 1, description: null, debit: 0, credit: 1500050 },
    ],
    ...over,
  };
}

test("centavos become the text the amount box takes, with no arithmetic drift", () => {
  assert.equal(centavosAsInput(1500050), "15000.50");
  assert.equal(centavosAsInput(5), "0.05");
  assert.equal(centavosAsInput(100), "1.00");
  assert.equal(centavosAsInput(123456789012345), "1234567890123.45");
});

test("a draft's lines open in the editor with the unused side blank", () => {
  const d = draftFromEntry(entry());
  assert.deepEqual(d.lines, [
    { account_id: 5, description: "Rent", debit: "15000.50", credit: "" },
    { account_id: 1, description: "", debit: "", credit: "15000.50" },
  ]);
  assert.equal(d.reference, "JV-7");
  assert.equal(d.branch_id, 2);
  assert.equal(d.date, "2026-11-03");
});

test("the editor's lines send the same centavos the draft stored", () => {
  const e = entry();
  assert.deepEqual(
    previewLines(draftFromEntry(e)).map((l) => [l.debit, l.credit]),
    e.lines.map((l) => [l.debit, l.credit]),
  );
});

test("a draft with fewer than two lines opens with blank rows to fill", () => {
  const d = draftFromEntry(entry({ lines: [], reference: null }));
  assert.equal(d.lines.length, 2);
  assert.equal(d.reference, "");
});
