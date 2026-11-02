import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildLoanDeductions,
  readRestructurableBalance,
  readRestructurePreview,
  restructureSuccessor,
} from "./loan-restructure";
import type { RestructuredIntoLoan } from "@/types/loan";

test("percentage fees carry their percent, not the peso amount", () => {
  assert.deepEqual(
    buildLoanDeductions({
      processingFeePercent: 2,
      serviceFeePercent: 1.5,
      otherDeductions: [],
    }),
    [
      { name: "Processing Fee", amount: 2, type: "percentage" },
      { name: "Service Fee", amount: 1.5, type: "percentage" },
    ],
  );
});

test("carried items go after the two fees and before custom rows, unchanged", () => {
  // The order LoanService::createLoan() adds a product's fees in.
  assert.deepEqual(
    buildLoanDeductions({
      processingFeePercent: 1.5,
      serviceFeePercent: 2.5,
      otherDeductions: [{ name: "Membership Fee", amount: "250.50" }],
      carried: [{ name: "Notarial Fee", amount: 1.25, type: "percentage" }],
    }),
    [
      { name: "Processing Fee", amount: 1.5, type: "percentage" },
      { name: "Service Fee", amount: 2.5, type: "percentage" },
      { name: "Notarial Fee", amount: 1.25, type: "percentage" },
      { name: "Membership Fee", amount: 250.5, type: "fixed" },
    ],
  );
});

test("zero-rate fees are omitted", () => {
  assert.deepEqual(
    buildLoanDeductions({
      processingFeePercent: 0,
      serviceFeePercent: 0,
      otherDeductions: [],
    }),
    [],
  );
});

test("custom rows are sent as fixed peso amounts", () => {
  assert.deepEqual(
    buildLoanDeductions({
      processingFeePercent: 0,
      serviceFeePercent: 0,
      otherDeductions: [{ name: " Notarial fee ", amount: "500" }],
    }),
    [{ name: "Notarial fee", amount: 500, type: "fixed" }],
  );
});

test("blank and zero custom rows are dropped, unnamed ones get a label", () => {
  assert.deepEqual(
    buildLoanDeductions({
      processingFeePercent: 0,
      serviceFeePercent: 0,
      otherDeductions: [
        { name: "", amount: "" },
        { name: "Insurance", amount: "0" },
        { name: "", amount: "250" },
      ],
    }),
    [{ name: "Other Deduction", amount: 250, type: "fixed" }],
  );
});

// ── readRestructurePreview: the shortfall is the server's ──────────────────

test("no shortfall when the server says the principal covers the restructurable balance", () => {
  assert.deepEqual(
    readRestructurePreview({
      restructurable_balance: 59000,
      principal: 59000,
      shortfall: 0,
      remarks_required: false,
      write_off_permission_required: false,
    }),
    {
      restructurableBalance: 59000,
      principal: 59000,
      shortfall: 0,
      remarksRequired: false,
      writeOffPermissionRequired: false,
    },
  );
});

test("the shortfall and both requirements are read from the server, never subtracted here", () => {
  // A figure that disagrees with balance − principal proves nothing is worked
  // out in the browser: the server's ₱20,800.00 stands as sent.
  const view = readRestructurePreview({
    restructurable_balance: "70800.00",
    principal: "50000.00",
    shortfall: "20800.00",
    remarks_required: true,
    write_off_permission_required: true,
  });
  assert.equal(view.restructurableBalance, 70800);
  assert.equal(view.principal, 50000);
  assert.equal(view.shortfall, 20800);
  assert.equal(view.remarksRequired, true);
  assert.equal(view.writeOffPermissionRequired, true);
  assert.equal(readRestructurePreview({ restructurable_balance: 100, principal: 40, shortfall: 1 }).shortfall, 1);
});

test("no restructure section, or a missing or unreadable figure, is unknown (a dash), never 0", () => {
  const unknown = {
    restructurableBalance: null,
    principal: null,
    shortfall: null,
    remarksRequired: null,
    writeOffPermissionRequired: null,
  };
  assert.deepEqual(readRestructurePreview(undefined), unknown);
  assert.deepEqual(readRestructurePreview(null), unknown);
  assert.deepEqual(readRestructurePreview({}), unknown);
  assert.deepEqual(
    readRestructurePreview({ shortfall: "abc", remarks_required: "yes", write_off_permission_required: 1 }),
    unknown,
  );
});

// ── restructureSuccessor ────────────────────────────────────────────────────

const child = (
  id: number,
  status: RestructuredIntoLoan["status"],
  loanAccountNumber: string | null = null,
): RestructuredIntoLoan => ({
  id,
  application_number: `APP-${id}`,
  loan_account_number: loanAccountNumber,
  status,
  principal_amount: 10000,
  start_date: null,
});

test("the successor is the restructure that was released", () => {
  const released = child(12, "released", "LN-0012");
  assert.equal(
    restructureSuccessor([child(10, "rejected"), child(11, "void"), released]),
    released,
  );
});

test("a successor keeps being found after it moves on from released", () => {
  // The new loan does not stop being where the balance went once it is paid
  // off, defaulted or itself restructured.
  for (const status of ["ongoing", "completed", "defaulted", "restructured"] as const) {
    const moved = child(20, status, "LN-0020");
    assert.equal(restructureSuccessor([child(19, "rejected"), moved]), moved, status);
  }
});

test("rejected, voided and unreleased applications are never the successor", () => {
  assert.equal(
    restructureSuccessor([
      child(30, "rejected"),
      child(31, "void"),
      child(32, "draft"),
      child(33, "for_review"),
      child(34, "approved"),
    ]),
    null,
  );
});

test("no restructure applications, or none loaded, has no successor", () => {
  assert.equal(restructureSuccessor([]), null);
  assert.equal(restructureSuccessor(undefined), null);
  assert.equal(restructureSuccessor(null), null);
});

test("an untyped payload row is read the same way", () => {
  // The printable reads `restructured_into` off an untyped record.
  const rows: Record<string, unknown>[] = [
    { id: 40, status: "void" },
    { id: 41, status: "released", loan_account_number: "LN-0041" },
    { id: 42, status: 7 },
  ];
  assert.equal(restructureSuccessor(rows)?.id, 41);
});

test("a restructure starts from the server's restructurable balance, never the outstanding balance", () => {
  // ₱42,000 principal still owed plus ₱400 premium owed: the outstanding
  // balance is ₱42,400, but the premium is carried to the new loan, so the
  // restructure covers ₱42,000. Nothing is subtracted here.
  assert.equal(
    readRestructurableBalance({ restructurable_balance: 42000, outstanding_balance: 42400 }, { outstanding_balance: 42400 }),
    42000,
  );
  assert.equal(readRestructurableBalance({ restructurable_balance: "42000.50" }, null), 42000.5);
  // The loan resource's figure stands in when the summary failed.
  assert.equal(readRestructurableBalance(null, { restructurable_balance: 41000, outstanding_balance: 41400 }), 41000);
});

test("without the server's restructurable balance there is none, not the outstanding balance or principal", () => {
  assert.equal(
    readRestructurableBalance({ outstanding_balance: 42400 }, { outstanding_balance: 42400, principal_amount: 60000 }),
    null,
  );
  assert.equal(readRestructurableBalance({ restructurable_balance: "abc" }, null), null);
  assert.equal(readRestructurableBalance(null, null), null);
});
