/**
 * The loan page's Ledger, read from GET /loans/{id}/ledger.
 *
 * The Ledger used to merge the repayments with the interest ledger entries
 * and walk the running balances in the browser, opening the interest column
 * from a figure solved backwards out of the schedule. The server now sends
 * every row with its own figures and the balances after it.
 *
 * WHAT THIS PROVES: each row's figures and balances are the ones the server
 * sent, put in the Debit or Credit column by the row's kind (an adjustment's
 * by its sign); a figure the server did not send is null (a dash) while 0
 * stays 0; every kind has a plain label; and the receipt, amount paid and
 * Void button come from the payment the row names.
 * WHAT IT DOES NOT PROVE: the figures; those are the backend's ledger tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerKindLabel, ledgerRowDescription, ledgerRowPayment, ledgerShowsScb, readLoanLedger } from "./loan-ledger";

const balances = (principal: number, interest: number, penalty: number, scb: number) => ({
  principal,
  interest,
  penalty,
  scb,
});

const RELEASE = {
  date: "2026-01-15",
  kind: "release",
  repayment_id: null,
  loan_adjustment_id: null,
  description: "Loan released",
  principal: 60000,
  interest: 0,
  penalty: 0,
  insurance: 0,
  scb: 600,
  balances: balances(60000, 0, 0, 600),
};

const PAYMENT = {
  date: "2026-02-15",
  kind: "repayment",
  repayment_id: 41,
  loan_adjustment_id: null,
  description: "payment",
  principal: 10000,
  interest: "1800.00",
  penalty: 0,
  insurance: 400,
  scb: 100,
  balances: balances(50000, 0, 0, 500),
};

test("readLoanLedger keeps the server's rows in order, with its balances as sent", () => {
  const ledger = readLoanLedger({ rows: [RELEASE, PAYMENT], closing: balances(50000, 0, 0, 500) });
  assert.ok(ledger);
  assert.deepEqual(
    ledger.rows.map((r) => [r.kind, r.date, r.balances]),
    [
      ["release", "2026-01-15", balances(60000, 0, 0, 600)],
      ["repayment", "2026-02-15", balances(50000, 0, 0, 500)],
    ],
  );
  assert.deepEqual(ledger.closing, balances(50000, 0, 0, 500));
});

test("a release, charge or void raises the balances: its figures are debits, 0 kept as 0", () => {
  const ledger = readLoanLedger({ rows: [RELEASE], closing: balances(60000, 0, 0, 600) });
  const row = ledger!.rows[0];
  assert.deepEqual(row.principal, { debit: 60000, credit: null });
  // A 0% loan's release interest is ₱0.00, not a dash.
  assert.deepEqual(row.interest, { debit: 0, credit: null });
  assert.deepEqual(row.scb, { debit: 600, credit: null });

  for (const kind of ["extension_charge", "penalty_charge", "void"]) {
    const r = readLoanLedger({ rows: [{ ...RELEASE, kind, penalty: 150 }], closing: {} })!.rows[0];
    assert.deepEqual(r.penalty, { debit: 150, credit: null }, kind);
  }
});

test("a payment lowers the balances: its figures are credits, read as numbers", () => {
  const row = readLoanLedger({ rows: [PAYMENT], closing: {} })!.rows[0];
  assert.deepEqual(row.principal, { debit: null, credit: 10000 });
  assert.deepEqual(row.interest, { debit: null, credit: 1800 });
  assert.deepEqual(row.penalty, { debit: null, credit: 0 });
  assert.deepEqual(row.insurance, { amount: 400, restored: false });
  const ext = readLoanLedger({ rows: [{ ...PAYMENT, kind: "extension_payment" }], closing: {} })!.rows[0];
  assert.deepEqual(ext.interest, { debit: null, credit: 1800 });
});

test("an adjustment's signed figure goes by its sign: negative lowers (credit), positive raises (debit)", () => {
  const row = readLoanLedger({
    rows: [{ ...RELEASE, kind: "adjustment", principal: -5000, interest: 250, penalty: 0 }],
    closing: {},
  })!.rows[0];
  assert.deepEqual(row.principal, { debit: null, credit: 5000 });
  assert.deepEqual(row.interest, { debit: 250, credit: null });
  assert.deepEqual(row.penalty, { debit: 0, credit: null });
});

test("a figure or balance the server did not send is null (a dash)", () => {
  const row = readLoanLedger({
    rows: [{ date: "2026-03-01", kind: "repayment", repayment_id: 7, balances: { principal: 100 } }],
    closing: {},
  })!.rows[0];
  assert.deepEqual(row.principal, { debit: null, credit: null });
  assert.deepEqual(row.insurance, { amount: null, restored: false });
  assert.deepEqual(row.balances, { principal: 100, interest: null, penalty: null, scb: null });
  assert.equal(row.description, "");
});

test("readLoanLedger is null when the answer has no rows list", () => {
  assert.equal(readLoanLedger(null), null);
  assert.equal(readLoanLedger({ closing: {} }), null);
  assert.deepEqual(readLoanLedger({ rows: [] })!.rows, []);
});

test("every kind has a plain label", () => {
  assert.equal(ledgerKindLabel("release"), "Loan released");
  assert.equal(ledgerKindLabel("repayment"), "Payment");
  assert.equal(ledgerKindLabel("extension_payment"), "Extension payment");
  assert.equal(ledgerKindLabel("extension_charge"), "Extension interest charged");
  assert.equal(ledgerKindLabel("penalty_charge"), "Penalty charged");
  assert.equal(ledgerKindLabel("adjustment"), "Adjustment");
  assert.equal(ledgerKindLabel("void"), "Payment voided");
  // A kind added later still reads as words, never as a code.
  assert.equal(ledgerKindLabel("interest_rebate"), "Interest rebate");
});

test("ledgerRowPayment: a payment row shows its receipt, amount paid and a Void button", () => {
  const repayment = { id: 41, receipt_number: "OR-2026-0001", amount_paid: "12300.00", status: "completed" };
  assert.deepEqual(ledgerRowPayment({ kind: "repayment", repaymentId: 41 }, repayment, "current"), {
    refNo: "OR-2026-0001",
    amountPaid: 12300,
    voided: false,
    canVoid: true,
  });
});

test("ledgerRowPayment: a voided payment can't be voided again; its void row shows no amount paid", () => {
  const repayment = { id: 41, receipt_number: null, amount_paid: 12300, status: "voided" };
  assert.deepEqual(ledgerRowPayment({ kind: "repayment", repaymentId: 41 }, repayment, "current"), {
    refNo: "OR-000041",
    amountPaid: 12300,
    voided: true,
    canVoid: false,
  });
  assert.deepEqual(ledgerRowPayment({ kind: "void", repaymentId: 41 }, repayment, "current"), {
    refNo: "OR-000041",
    amountPaid: null,
    voided: false,
    canVoid: false,
  });
});

test("ledgerRowPayment: an extension's payment is never voided from here", () => {
  const repayment = { id: 9, amount_paid: 1800, status: "completed" };
  assert.equal(ledgerRowPayment({ kind: "extension_payment", repaymentId: 9 }, repayment, "current").canVoid, false);
  assert.equal(ledgerRowPayment({ kind: "extension_payment", repaymentId: 9 }, repayment, "current").amountPaid, 1800);
});

test("ledgerRowPayment: no payment on the row, or none loaded, is a dash and no Void", () => {
  assert.deepEqual(ledgerRowPayment({ kind: "release", repaymentId: null }, undefined, "current"), {
    refNo: "—",
    amountPaid: null,
    voided: false,
    canVoid: false,
  });
  assert.deepEqual(ledgerRowPayment({ kind: "repayment", repaymentId: 41 }, undefined, "current"), {
    refNo: "—",
    amountPaid: null,
    voided: false,
    canVoid: false,
  });
});

test("ledgerRowPayment: no Void on a restructured loan; the server refuses those voids", () => {
  const repayment = { id: 41, amount_paid: 12300, status: "completed" };
  assert.equal(ledgerRowPayment({ kind: "repayment", repaymentId: 41 }, repayment, "restructured").canVoid, false);
  assert.equal(ledgerRowPayment({ kind: "repayment", repaymentId: 41 }, repayment, "past_due").canVoid, true);
});

test("a void row's premium is put back, not collected again", () => {
  const row = readLoanLedger({
    rows: [{ ...PAYMENT, kind: "void", insurance: 400 }],
    closing: {},
  })!.rows[0];
  assert.deepEqual(row.insurance, { amount: 400, restored: true });
  // Its other figures raise the balances again.
  assert.deepEqual(row.principal, { debit: 10000, credit: null });
});

test("the voided payment's description drops the server's '(voided)': the badge says it once", () => {
  assert.equal(ledgerRowDescription("Payment OR-2026-0001 (voided)", true), "Payment OR-2026-0001");
  assert.equal(ledgerRowDescription("Payment OR-2026-0001 voided", false), "Payment OR-2026-0001 voided");
  // Not voided: the description is shown as sent.
  assert.equal(ledgerRowDescription("Payment OR-2026-0001 (voided)", false), "Payment OR-2026-0001 (voided)");
});

test("ledgerShowsScb: the schedule's rule, or any row whose build-up is not 0", () => {
  const plain = readLoanLedger({ rows: [{ ...PAYMENT, scb: 0 }], closing: {} });
  const withScb = readLoanLedger({ rows: [{ ...PAYMENT, scb: 0 }, { ...PAYMENT, scb: 100 }], closing: {} });
  assert.equal(ledgerShowsScb(true, plain), true);
  assert.equal(ledgerShowsScb(false, plain), false);
  assert.equal(ledgerShowsScb(false, withScb), true);
  assert.equal(ledgerShowsScb(false, null), false);
});

test("the monthly late penalty reads one Ledger row per charge, each as the server sent it", () => {
  const charge = (date: string, description: string, penalty: number, running: number) => ({
    date,
    kind: "penalty_charge",
    repayment_id: null,
    loan_adjustment_id: null,
    description,
    principal: 0,
    interest: 0,
    penalty,
    insurance: 0,
    scb: 0,
    balances: balances(9000, 400, running, 0),
  });
  const view = readLoanLedger({
    rows: [
      charge("2026-10-04", "Late penalty, period 2", 90, 90),
      charge("2026-11-01", "Late penalty, period 2, month 2", 90, 180),
    ],
    closing: balances(9000, 400, 180, 0),
  })!;

  assert.deepEqual(
    view.rows.map((r) => [r.date, r.label, r.description, r.penalty.debit, r.penalty.credit, r.balances.penalty]),
    [
      ["2026-10-04", "Penalty charged", "Late penalty, period 2", 90, null, 90],
      ["2026-11-01", "Penalty charged", "Late penalty, period 2, month 2", 90, null, 180],
    ],
  );
  assert.notEqual(view.rows[0].key, view.rows[1].key);
  assert.equal(view.closing.penalty, 180);
});
