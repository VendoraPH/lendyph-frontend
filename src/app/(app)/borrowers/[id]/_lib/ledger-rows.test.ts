import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BorrowerLedgerEntry } from "@/types";
import {
  ledgerClosingCells,
  ledgerRowCells,
  memberLedgerReportHref,
  readMemberLedger,
} from "./ledger-rows";

// What GET /borrowers/{id}/ledger sends: every row carries both sides, the side
// it doesn't use as 0, and names its loan. A payment also sends what the member
// actually handed over.
const RELEASE: BorrowerLedgerEntry = {
  id: 1,
  date: "2026-11-06",
  description: "Loan released",
  reference: "LN-000078",
  debit: 15000,
  credit: 0,
  balance: 15000,
  loan_id: 78,
  loan_account_number: "LN-000078",
  kind: "release",
  repayment_id: null,
};
const PAYMENT: BorrowerLedgerEntry = {
  id: 2,
  date: "2026-11-06",
  description: "Payment received via Cash",
  reference: "RCP-000478",
  debit: 0,
  credit: 2725,
  balance: 12275,
  loan_id: 78,
  loan_account_number: "LN-000078",
  kind: "repayment",
  repayment_id: 478,
  amount_paid: 2725,
  insurance: 0,
  scb: 0,
};

test("a release shows its loan, its principal as a debit, and the server's balance", () => {
  assert.deepEqual(ledgerRowCells(RELEASE), {
    loan: "LN-000078",
    reference: "LN-000078",
    debit: "₱15,000.00",
    credit: "—",
    amountPaid: null,
    balance: "₱15,000.00",
  });
});

test("a payment shows its receipt number, the credit, and the server's balance", () => {
  assert.deepEqual(ledgerRowCells(PAYMENT), {
    loan: "LN-000078",
    reference: "RCP-000478",
    debit: "—",
    credit: "₱2,725.00",
    amountPaid: null,
    balance: "₱12,275.00",
  });
});

test("a row without a reference reads a dash", () => {
  assert.equal(ledgerRowCells({ ...PAYMENT, reference: null }).reference, "—");
});

test("a balance of zero reads ₱0.00; a balance the server didn't send reads a dash", () => {
  assert.equal(ledgerRowCells({ ...PAYMENT, balance: 0 }).balance, "₱0.00");
  assert.equal(ledgerRowCells({ ...PAYMENT, balance: null }).balance, "—");
});

test("a row that names no loan reads a dash", () => {
  assert.equal(ledgerRowCells({ ...PAYMENT, loan_account_number: null }).loan, "—");
  assert.equal(ledgerRowCells({ ...PAYMENT, loan_account_number: undefined }).loan, "—");
});

test("a payment whose amount paid differs from its credit shows the amount paid", () => {
  const cells = ledgerRowCells({ ...PAYMENT, amount_paid: 3000, credit: 2725, insurance: 275 });
  assert.equal(cells.credit, "₱2,725.00");
  assert.equal(cells.amountPaid, "₱3,000.00");
});

test("a payment that only paid premium has no credit but still shows the amount paid", () => {
  const cells = ledgerRowCells({ ...PAYMENT, amount_paid: 500, credit: 0, insurance: 500 });
  assert.equal(cells.credit, "—");
  assert.equal(cells.amountPaid, "₱500.00");
});

test("an amount paid equal to the credit, in whatever form it was sent, shows nothing extra", () => {
  assert.equal(ledgerRowCells({ ...PAYMENT, amount_paid: "2725.00" }).amountPaid, null);
  assert.equal(ledgerRowCells({ ...PAYMENT, amount_paid: null }).amountPaid, null);
});

test("readMemberLedger keeps the rows and meta.closing as the server sent them", () => {
  const closing = { principal: 12000, interest: 200, penalty: 75, balance: 12275 };
  assert.deepEqual(readMemberLedger({ data: [RELEASE, PAYMENT], meta: { closing } }), {
    entries: [RELEASE, PAYMENT],
    closing,
  });
});

test("readMemberLedger has no closing when the server sent none", () => {
  assert.deepEqual(readMemberLedger({ data: [RELEASE] }), { entries: [RELEASE], closing: null });
});

test("the footer reads the server's closing, zero as ₱0.00", () => {
  assert.deepEqual(
    ledgerClosingCells({ principal: 12000, interest: 200.5, penalty: 0, balance: 12200.5 }),
    { principal: "₱12,000.00", interest: "₱200.50", penalty: "₱0.00", balance: "₱12,200.50" },
  );
});

test("the footer reads dashes for a closing the server didn't send", () => {
  assert.deepEqual(ledgerClosingCells(null), {
    principal: "—",
    interest: "—",
    penalty: "—",
    balance: "—",
  });
});

test("Open in Reports opens the Subsidiary Ledger with this member selected", () => {
  assert.equal(memberLedgerReportHref(42), "/reports/subsidiary_ledger?member=42");
});

test("the tab shows the server's Balance and doesn't say it hides it", () => {
  const tab = readFileSync(
    join(process.cwd(), "src/app/(app)/borrowers/[id]/_components/ledger-tab.tsx"),
    "utf8",
  );
  assert.match(tab, /<TableHead[^>]*>Balance<\/TableHead>/);
  assert.match(tab, /<TableHead[^>]*>Loan<\/TableHead>/);
  assert.match(tab, /<TableFooter>/);
  assert.match(tab, /memberLedgerReportHref\(borrowerId\)/);
  assert.doesNotMatch(tab, /which is not shown/);
});
