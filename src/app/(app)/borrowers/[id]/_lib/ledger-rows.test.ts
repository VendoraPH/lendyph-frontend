import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BorrowerLedgerEntry } from "@/types";
import { ledgerRowCells } from "./ledger-rows";

// What GET /borrowers/{id}/ledger (`BorrowerController::ledger()`) sends:
// every row carries both sides, the side it doesn't use as 0.
const RELEASE: BorrowerLedgerEntry = {
  id: 1,
  date: "2026-11-06",
  description: "Loan released",
  reference: "LN-000078",
  debit: 15000,
  credit: 0,
  balance: 15000,
};
const PAYMENT: BorrowerLedgerEntry = {
  id: 2,
  date: "2026-11-06",
  description: "Payment received via Cash",
  reference: "RCP-000478",
  debit: 0,
  credit: 2725,
  balance: 12275,
};

test("a release shows its loan account number and its principal as a debit", () => {
  assert.deepEqual(ledgerRowCells(RELEASE), {
    reference: "LN-000078",
    debit: "₱15,000.00",
    credit: "—",
  });
});

test("a payment shows its receipt number and the amount paid as a credit", () => {
  assert.deepEqual(ledgerRowCells(PAYMENT), {
    reference: "RCP-000478",
    debit: "—",
    credit: "₱2,725.00",
  });
});

test("a row without a reference reads a dash", () => {
  assert.equal(ledgerRowCells({ ...PAYMENT, reference: null }).reference, "—");
});

test("the tab shows no running balance: the server's takes whole payments off the principal", () => {
  const tab = readFileSync(
    join(process.cwd(), "src/app/(app)/borrowers/[id]/_components/ledger-tab.tsx"),
    "utf8",
  );
  assert.doesNotMatch(tab, /<TableHead[^>]*>Balance<\/TableHead>/);
  assert.match(tab, /ledgerRowCells\(entry\)/);
});
