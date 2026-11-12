/**
 * The withdrawal slip and the two time deposit documents, each rendered from
 * a fixture shaped like the catalog's payload, and from nothing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPrintable } from "../print-render";
import {
  assertPrintableShape,
  chargeAmount,
  fieldValue,
  hasChargeLine,
  isBlankField,
  notes,
  prose,
  titleBlock,
} from "./doc-assertions";
import { buildTimeDepositEarlyTerminationDoc } from "./savings-td-early-termination";
import { buildTimeDepositMaturityNoticeDoc } from "./savings-td-maturity-notice";
import { buildSavingsWithdrawalSlipDoc } from "./savings-withdrawal-slip";

const ACCOUNT = {
  id: 9,
  account_number: "SAV-2026-00009",
  borrower_name: "Juana Dela Cruz",
  borrower_code: "MBR-0001",
  branch_name: "Main",
  product: { id: 1, code: "RS", name: "Regular Savings", kind: "regular" },
  status: "active",
};

const WITHDRAWAL = {
  id: 31,
  account_id: 9,
  account_number: "SAV-2026-00009",
  reference: "SVT-2026-00031",
  type: "withdrawal",
  date: "2026-11-10",
  debit: "1500.50",
  credit: "0.00",
  balance_after: "3099.50",
  method: "cash",
  external_reference: null,
  reversed_by_transaction_id: null,
  approval_id: null,
  fee_amount: "15.00",
  created_by: { id: 2, name: "Teller Tess" },
};

// ── Withdrawal slip ──

test("the slip prints the withdrawal in figures and words, with its fee as a separate entry", () => {
  const doc = buildSavingsWithdrawalSlipDoc({ transaction: WITHDRAWAL, account: ACCOUNT });
  assertPrintableShape(doc, "savings_withdrawal_slip");
  assert.equal(doc.reference, "SVT-2026-00031");
  assert.equal(chargeAmount(doc, "AMOUNT WITHDRAWN"), "₱1,500.50");
  assert.equal(fieldValue(doc, "Amount in words"), "One Thousand Five Hundred Pesos and Fifty Centavos");
  assert.equal(fieldValue(doc, "Excess-withdrawal fee (its own entry)"), "₱15.00");
  assert.equal(fieldValue(doc, "Balance after this withdrawal"), "₱3,099.50");
  assert.equal(fieldValue(doc, "Payment method"), "Cash");
  assert.deepEqual(doc.copies, ["Depositor's Copy", "File Copy"]);
  assert.match(renderPrintable(doc), /Teller Tess/);
});

test("a reversed withdrawal is stamped on every copy", () => {
  const doc = buildSavingsWithdrawalSlipDoc({ transaction: { ...WITHDRAWAL, reversed_by_transaction_id: 40 }, account: ACCOUNT });
  assert.match(titleBlock(doc).subtitle ?? "", /REVERSED/);
  assert.ok(doc.copies?.every((c) => c.startsWith("REVERSED")));
});

test("a row that isn't a withdrawal, or couldn't be read, prints a blank slip and says so", () => {
  for (const raw of [null, { transaction: { ...WITHDRAWAL, type: "deposit" }, account: ACCOUNT }]) {
    const doc = buildSavingsWithdrawalSlipDoc(raw);
    assertPrintableShape(doc, "savings_withdrawal_slip");
    assert.equal(doc.incomplete, true);
    assert.equal(chargeAmount(doc, "AMOUNT WITHDRAWN"), "_______________");
    assert.ok(isBlankField(doc, "Amount in words"));
  }
});

// ── Time deposits ──

const DEPOSIT = {
  id: 5,
  certificate_number: "TD-2026-00005",
  borrower_name: "Juana Dela Cruz",
  borrower_code: "MBR-0001",
  branch_name: "Main",
  product: { id: 2, code: "TD90", name: "90-day Time Deposit" },
  principal: "20000.00",
  annual_rate: "3.1250",
  pretermination_rate: "1.5000",
  term_days: 90,
  placement_date: "2026-09-01",
  maturity_date: "2026-11-30",
  gross_interest: "154.11",
  withholding_tax: "0.00",
  net_interest: "154.11",
  maturity_amount: "20154.11",
  maturity_instruction: "payout",
  payout_account_number: "SAV-2026-00009",
  status: "active",
  settled_on: null,
  settled_interest: null,
  settled_tax: null,
  settled_amount: null,
};

test("the maturity notice prints the placement's own figures and instruction", () => {
  const doc = buildTimeDepositMaturityNoticeDoc({ deposit: DEPOSIT });
  assertPrintableShape(doc, "time_deposit_maturity_notice");
  assert.equal(chargeAmount(doc, "AMOUNT DUE AT MATURITY"), "₱20,154.11");
  assert.equal(fieldValue(doc, "Instruction at maturity"), "Pay out principal and interest");
  const text = prose(doc);
  assert.match(text, /3.125% per annum/);
  assert.match(text, /matures on <strong><u>Nov 30, 2026<\/u><\/strong>/);
  assert.match(text, /savings account No. SAV-2026-00009/);
  assert.equal(doc.incomplete, undefined);
});

test("a rollover's notice says it is placed again at the rate in force on the maturity date", () => {
  const doc = buildTimeDepositMaturityNoticeDoc({ deposit: { ...DEPOSIT, maturity_instruction: "rollover_all" } });
  assert.match(prose(doc), /placed again for the same term at the rate in force on the maturity date\./);
  assert.doesNotMatch(prose(doc), /by credit to savings account/);
});

test("a settled placement's notice says it was settled", () => {
  const doc = buildTimeDepositMaturityNoticeDoc({ deposit: { ...DEPOSIT, status: "withdrawn", settled_on: "2026-11-30" } });
  assert.match(titleBlock(doc).subtitle ?? "", /SETTLED/);
  assert.match(prose(doc), /has been settled/);
});

test("a maturity notice whose placement couldn't be read is blank and says so", () => {
  const doc = buildTimeDepositMaturityNoticeDoc(null);
  assert.equal(doc.incomplete, true);
  assert.equal(chargeAmount(doc, "AMOUNT DUE AT MATURITY"), "_______________");
});

test("the early termination form prints the server's quote at the regular rate fixed at placement", () => {
  const doc = buildTimeDepositEarlyTerminationDoc({
    deposit: DEPOSIT,
    quote: { date: "2026-11-12", days_held: 72, rate: "1.5000", gross_interest: "59.18", withholding_tax: "0.00", penalty: "0.00", payout: "20059.18" },
  });
  assertPrintableShape(doc, "time_deposit_early_termination");
  assert.equal(chargeAmount(doc, "AMOUNT TO BE PAID"), "₱20,059.18");
  assert.equal(chargeAmount(doc, "Add: Interest for 72 days at 1.5% per annum"), "₱59.18");
  assert.match(prose(doc), /regular savings rate fixed at placement \(1.5% per annum\)/);
  assert.match(notes(doc), /worked out again/);
});

test("without a quote the termination figures are blank lines", () => {
  const doc = buildTimeDepositEarlyTerminationDoc({ deposit: DEPOSIT, quote: null });
  assert.equal(chargeAmount(doc, "AMOUNT TO BE PAID"), "_______________");
});

test("a pre-terminated placement prints what was paid", () => {
  const doc = buildTimeDepositEarlyTerminationDoc({
    deposit: { ...DEPOSIT, status: "preterminated", settled_on: "2026-11-05", settled_interest: "53.42", settled_tax: "0.00", settled_amount: "20053.42" },
  });
  assert.equal(titleBlock(doc).subtitle, "PRE-TERMINATED");
  assert.equal(chargeAmount(doc, "AMOUNT PAID"), "₱20,053.42");
  assert.equal(hasChargeLine(doc, "AMOUNT TO BE PAID"), false);
});
