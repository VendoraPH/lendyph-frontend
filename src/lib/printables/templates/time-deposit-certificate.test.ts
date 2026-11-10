import { test } from "node:test";
import assert from "node:assert/strict";
import type { TimeDeposit } from "@/types";
import { amountInWords } from "../amount-in-words";
import { buildTimeDepositCertificateDoc } from "./time-deposit-certificate";
import { assertPrintableShape, chargeAmount, fieldValue, prose, titleBlock } from "./doc-assertions";
import { formatCurrency } from "./shared";

const TD: TimeDeposit = {
  id: 42,
  certificate_number: "TD-2026-00042",
  borrower_id: 7,
  borrower_name: "Juana Dela Cruz",
  borrower_code: "MBR-0001",
  branch_id: 1,
  branch_name: "Main",
  product: { id: 3, code: "TD90", name: "Time Deposit 90 days" },
  principal: "50000.00",
  annual_rate: "4.0000",
  pretermination_rate: "1.0000",
  withholding_tax_rate: "20.0000",
  term_days: 90,
  placement_date: "2026-08-26",
  maturity_date: "2026-11-24",
  gross_interest: "500.00",
  withholding_tax: "100.00",
  net_interest: "400.00",
  maturity_amount: "50400.00",
  maturity_instruction: "payout",
  funding_method: "cash",
  payout_account_id: null,
  status: "active",
  settled_on: null,
  settled_interest: null,
  settled_tax: null,
  settled_amount: null,
  payout_method: null,
  settled_by: null,
  rolled_over_from_id: null,
  rolled_over_to_id: null,
  created_by: { id: 1, name: "Teller One" },
};

const NOW = new Date(2026, 7, 26);

test("prints the server's figures and keeps the certificate number as its reference", () => {
  const doc = buildTimeDepositCertificateDoc(TD, { now: NOW });
  assertPrintableShape(doc, "time_deposit_certificate");
  assert.equal(doc.reference, "TD-2026-00042");
  assert.equal(doc.subjectId, 42);
  assert.equal(chargeAmount(doc, "Principal"), formatCurrency(50000));
  assert.equal(chargeAmount(doc, "AMOUNT DUE AT MATURITY"), formatCurrency(50400));
  assert.equal(fieldValue(doc, "Amount in words"), amountInWords(50400));
  assert.equal(fieldValue(doc, "Term"), "90 days");
  assert.match(prose(doc), /Juana Dela Cruz/);
  assert.deepEqual(doc.copies, ["Depositor's Copy", "File Copy"]);
});

test("a settled placement says so and prints a single copy", () => {
  const doc = buildTimeDepositCertificateDoc({ ...TD, status: "preterminated" }, { now: NOW });
  assert.match(titleBlock(doc).subtitle ?? "", /PRE-TERMINATED/);
  assert.equal(doc.copies, undefined);
});

test("escapes the member's name in the certifying paragraph", () => {
  const doc = buildTimeDepositCertificateDoc({ ...TD, borrower_name: "<b>X</b>" }, { now: NOW });
  assert.doesNotMatch(prose(doc), /<b>X<\/b>/);
});
