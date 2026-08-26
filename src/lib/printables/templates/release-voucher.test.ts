import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, formatValue } from "@/lib/report-format";
import { amountInWords } from "../amount-in-words";
import { buildReleaseVoucherDoc } from "./release-voucher";
import { BLANK_LINE } from "./shared";
import {
  allChargeLines,
  assertPrintableShape,
  chargeAmount,
  fieldValue,
  hasChargeLine,
  isBlankField,
  signatureLabels,
  signatures,
  titleBlock,
} from "./doc-assertions";

/**
 * `LoanResource` as returned by `GET /loans/{id}` with the release relations
 * eager-loaded. Note `deductions` is an ARRAY of named items — `Loan.deductions`
 * in src/types/loan.ts declares `Record<string, number>`, which the API has
 * never sent.
 */
const LOAN = {
  id: 42,
  application_number: "APP-2026-0042",
  loan_account_number: "LN-2026-0042",
  principal_amount: 100000,
  interest_rate: 2,
  interest_method: "diminishing",
  term: 6,
  frequency: "monthly",
  start_date: "2026-08-01",
  maturity_date: "2027-02-01",
  release_date: "2026-08-01",
  released_at: "2026-08-01T09:12:00",
  approved_at: "2026-07-30T14:00:00",
  purpose: "Working capital",
  deductions: [
    { name: "Processing Fee", amount: 2000, type: "percentage", original_value: 2 },
    { name: "Service Fee", amount: 1000, type: "percentage", original_value: 1 },
    { name: "Notarial Fee", amount: 500, type: "fixed", original_value: 500 },
  ],
  total_deductions: 3500,
  net_proceeds: 96500,
  status: "released",
  borrower: {
    id: 7,
    borrower_code: "MBR-0001",
    full_name: "Juana Dela Cruz",
    address: "12 Mabini St., Poblacion, Cebu City",
  },
  loan_product: { id: 3, name: "Regular Loan" },
  branch: { id: 1, name: "Main Branch" },
  account_officer: { id: 11, full_name: "Rita Lopez" },
  approved_by_user: { id: 12, full_name: "Ana Bautista" },
  released_by_user: { id: 13, full_name: "Carlo Uy" },
};

test("release voucher: header identifies the payee and the loan", () => {
  const doc = buildReleaseVoucherDoc(LOAN);
  assertPrintableShape(doc, "release_voucher");

  assert.equal(titleBlock(doc).text, "Loan Release Voucher");
  assert.equal(fieldValue(doc, "Payee / Borrower"), "Juana Dela Cruz");
  assert.equal(fieldValue(doc, "Loan Account No."), "LN-2026-0042");
  assert.equal(fieldValue(doc, "Member No."), "MBR-0001");
  assert.equal(fieldValue(doc, "Loan Product"), "Regular Loan");
  assert.equal(fieldValue(doc, "Branch"), "Main Branch");
  assert.equal(fieldValue(doc, "Purpose"), "Working capital");
});

test("release voucher: deductions are itemised and sum to the total", () => {
  const doc = buildReleaseVoucherDoc(LOAN);

  assert.equal(chargeAmount(doc, "Processing Fee"), `(${formatCurrency(2000)})`);
  assert.equal(chargeAmount(doc, "Service Fee"), `(${formatCurrency(1000)})`);
  assert.equal(chargeAmount(doc, "Notarial Fee"), `(${formatCurrency(500)})`);

  // The itemised lines must add up to the printed total, or the member is
  // being handed a voucher that argues with itself.
  assert.equal(
    chargeAmount(doc, "Total Deductions"),
    `(${formatCurrency(2000 + 1000 + 500)})`
  );
});

test("release voucher: net proceeds equal principal less deductions", () => {
  const doc = buildReleaseVoucherDoc(LOAN);

  assert.equal(chargeAmount(doc, "Principal Loan Amount"), formatCurrency(100000));
  assert.equal(
    chargeAmount(doc, "NET PROCEEDS (Amount Released to Borrower)"),
    formatCurrency(100000 - 3500)
  );
  assert.equal(
    fieldValue(doc, "Net proceeds in words"),
    amountInWords(96500)
  );

  // The grand rule is what makes the net proceeds read as the bottom line.
  const netLine = allChargeLines(doc).find(
    (l) => l.label === "NET PROCEEDS (Amount Released to Borrower)"
  );
  assert.equal(netLine?.rule, "grand");
});

test("release voucher: the server's net proceeds win over a local subtraction", () => {
  // If the API and a naive principal − deductions ever disagree, the cash that
  // actually left the drawer is what the server recorded.
  const doc = buildReleaseVoucherDoc({ ...LOAN, net_proceeds: 96000 });
  assert.equal(
    chargeAmount(doc, "NET PROCEEDS (Amount Released to Borrower)"),
    formatCurrency(96000)
  );
});

test("release voucher: four signatures, in the order money moves", () => {
  const doc = buildReleaseVoucherDoc(LOAN);

  assert.deepEqual(signatureLabels(doc), [
    "Prepared by",
    "Approved by",
    "Released by",
    "Received by",
  ]);

  const [prepared, approved, released, received] = signatures(doc);
  assert.equal(prepared?.name, "Rita Lopez");
  assert.equal(approved?.name, "Ana Bautista");
  assert.equal(released?.name, "Carlo Uy");
  assert.equal(received?.name, "Juana Dela Cruz");
});

test("release voucher: a loan with no deductions still balances", () => {
  const doc = buildReleaseVoucherDoc({
    ...LOAN,
    deductions: [],
    total_deductions: 0,
    net_proceeds: 100000,
  });

  assert.equal(chargeAmount(doc, "No deductions applied"), formatCurrency(0));
  assert.equal(chargeAmount(doc, "Total Deductions"), `(${formatCurrency(0)})`);
  assert.equal(
    chargeAmount(doc, "NET PROCEEDS (Amount Released to Borrower)"),
    formatCurrency(100000)
  );
});

test("release voucher: an unitemised total is disclosed as a line, not a gap", () => {
  // The server's `total_deductions` outranks the array it came with — but the
  // reader must not be left to find the difference. This printed
  // "No deductions applied  P0.00" directly above
  // "Total Deductions  (P5,000.00)".
  const doc = buildReleaseVoucherDoc({
    ...LOAN,
    deductions: [],
    total_deductions: 5000,
    net_proceeds: 95000,
  });

  assert.ok(!hasChargeLine(doc, "No deductions applied"));
  assert.equal(
    chargeAmount(doc, "Other deductions"),
    `(${formatCurrency(5000)})`
  );
  assert.equal(chargeAmount(doc, "Total Deductions"), `(${formatCurrency(5000)})`);

  // A partial itemisation is topped up to the total the same way.
  const partial = buildReleaseVoucherDoc({
    ...LOAN,
    deductions: [{ name: "Processing Fee", amount: 2000 }],
    total_deductions: 3500,
  });
  assert.equal(
    chargeAmount(partial, "Other deductions"),
    `(${formatCurrency(1500)})`
  );
  assert.equal(
    chargeAmount(partial, "Total Deductions"),
    `(${formatCurrency(3500)})`
  );

  // And when they already agree, no phantom line appears.
  assert.ok(!hasChargeLine(buildReleaseVoucherDoc(LOAN), "Other deductions"));
});

test("release voucher: dates are formatted and the term carries its unit", () => {
  const doc = buildReleaseVoucherDoc(LOAN);

  assert.equal(
    fieldValue(doc, "Release Date"),
    formatValue(new Date(2026, 7, 1), "date")
  );
  assert.equal(
    fieldValue(doc, "Maturity Date"),
    formatValue(new Date(2027, 1, 1), "date")
  );
  // A bare "6" read as months whatever the loan's frequency was.
  assert.equal(fieldValue(doc, "Term"), "6 month(s)");
  assert.equal(
    fieldValue(buildReleaseVoucherDoc({ ...LOAN, term: 90, frequency: "daily" }), "Term"),
    "90 day(s)"
  );
});

test("release voucher: a null payload prints a blank form, not a zero-peso release", () => {
  const doc = buildReleaseVoucherDoc(null);
  assertPrintableShape(doc, "release_voucher");

  assert.ok(isBlankField(doc, "Payee / Borrower"));
  assert.ok(isBlankField(doc, "Loan Account No."));

  // A voucher is a form, so an unreadable loan still prints one to complete by
  // hand. But it must carry blanks: printing P0.00 / "Zero Pesos" directly
  // above "Received from the cooperative the sum stated above" states a sum
  // that was never released, over a Received-by signature line.
  assert.notEqual(chargeAmount(doc, "Principal Loan Amount"), formatCurrency(0));
  assert.equal(chargeAmount(doc, "Principal Loan Amount"), BLANK_LINE);
  assert.equal(
    chargeAmount(doc, "NET PROCEEDS (Amount Released to Borrower)"),
    BLANK_LINE
  );

  assert.equal(fieldValue(doc, "Net proceeds in words"), BLANK_LINE);

  // Surfaced so the hook warns instead of reporting a successful open.
  assert.equal(doc.incomplete, true);

  assert.deepEqual(signatureLabels(doc), [
    "Prepared by",
    "Approved by",
    "Released by",
    "Received by",
  ]);
  assert.equal(signatures(doc)[0]?.name, null);
});

test("release voucher: a real loan still prints its figures, not blanks", () => {
  const doc = buildReleaseVoucherDoc(LOAN);
  assert.notEqual(chargeAmount(doc, "Principal Loan Amount"), BLANK_LINE);
  assert.equal(doc.incomplete, undefined);
});
