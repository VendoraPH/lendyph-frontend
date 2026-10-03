import { test } from "node:test";
import assert from "node:assert/strict";
import { DASH, formatCurrency, formatValue } from "@/lib/report-format";
import { buildDisclosureDoc } from "./disclosure";
import {
  allFields,
  assertPrintableShape,
  blocksOfKind,
  chargeAmount,
  fieldValue,
  hasChargeLine,
  isBlankField,
  prose,
  signatureLabels,
  tableBlock,
  titleBlock,
} from "./doc-assertions";

/**
 * Contract test. The payload below is what
 * `DisclosureService::generateDisclosure()` actually returns — nested under
 * `borrower` / `loan_terms` / `deductions` / `totals` — so a renamed key fails
 * here instead of printing a blank statutory disclosure for a member.
 */
const PAYLOAD = {
  document_title: "DISCLOSURE STATEMENT",
  reference_number: "APP-2026-0042",
  generated_at: "2026-08-26 09:15:00",
  borrower: {
    borrower_code: "MBR-0001",
    full_name: "Juana Dela Cruz",
    address: "12 Mabini St., Poblacion, Cebu City",
    contact_number: "0917-555-0101",
  },
  loan_terms: {
    application_number: "APP-2026-0042",
    loan_account_number: "LN-2026-0042",
    loan_product_name: "Regular Loan",
    principal_amount: 100000,
    interest_rate: 2,
    interest_method: "diminishing",
    term: 6,
    frequency: "monthly",
    penalty_rate: 3,
    grace_period_days: 3,
    start_date: "2026-08-01",
    maturity_date: "2027-02-01",
  },
  deductions: {
    items: [
      { name: "Processing Fee", amount: 2000, type: "percentage", original_value: 2 },
      { name: "Service Fee", amount: 1000, type: "percentage", original_value: 1 },
      { name: "Notarial Fee", amount: 500, type: "fixed", original_value: 500 },
    ],
    total_deductions: 3500,
    net_proceeds: 96500,
  },
  // The server's totals for the whole six-period schedule: deliberately not
  // the three rows below added up, so a test can tell the two apart.
  totals: {
    total_principal: 100000,
    total_interest: 7000,
    total_obligation: 107000,
    total_amortization: 107000,
    total_deductions: 3500,
    net_proceeds: 96500,
    total_finance_charges: 10500,
    unitemised_deductions: 0,
  },
  amortization_schedule: [
    { period_number: 1, due_date: "2026-09-01", principal_due: 16666.67, interest_due: 2000, total_due: 18666.67, remaining_balance: 83333.33 },
    { period_number: 2, due_date: "2026-10-01", principal_due: 16666.67, interest_due: 1666.67, total_due: 18333.34, remaining_balance: 66666.66 },
    { period_number: 3, due_date: "2026-11-01", principal_due: 16666.66, interest_due: 1333.33, total_due: 17999.99, remaining_balance: 50000 },
  ],
  co_makers: [],
};

test("disclosure: a full payload produces the six statutory sections", () => {
  const doc = buildDisclosureDoc(PAYLOAD);
  assertPrintableShape(doc, "disclosure_statement");

  const title = titleBlock(doc);
  assert.equal(title.text, "Disclosure Statement");
  assert.equal(title.subtitle, "on Loan / Credit Transaction");
  assert.match(title.legalRef ?? "", /Republic Act No\. 3765/);
  assert.match(title.legalRef ?? "", /BSP Circular No\. 730/);

  assert.equal(fieldValue(doc, "Name of Borrower"), "Juana Dela Cruz");
  assert.equal(fieldValue(doc, "Loan Account No."), "LN-2026-0042");
  assert.equal(fieldValue(doc, "Term of Loan"), "6 month(s)");
  assert.equal(fieldValue(doc, "Mode of Payment"), "Monthly");
  assert.equal(fieldValue(doc, "Contractual Interest Rate"), "2% per month");
  assert.equal(fieldValue(doc, "Nominal Annual Rate"), "24.00% per annum");
  assert.equal(fieldValue(doc, "Total Amount Payable"), formatCurrency(107000));
  // Formatted, not the raw "2026-08-01" the API sent.
  assert.equal(
    fieldValue(doc, "Date Granted"),
    formatValue(new Date(2026, 7, 1), "date")
  );
});

test("disclosure: the annual rate is annualised by the period the rate is quoted per", () => {
  // The statutory point of the document. A fixed "per month" and a fixed × 12
  // disclosed a 1%-per-day rate — 365% nominal — as 12.00% p.a.
  const daily = buildDisclosureDoc({
    ...PAYLOAD,
    loan_terms: {
      ...PAYLOAD.loan_terms,
      interest_rate: 1,
      interest_rate_frequency: "daily",
      term: 30,
      term_unit: "days",
      frequency: "daily",
    },
  });

  assert.equal(fieldValue(daily, "Contractual Interest Rate"), "1% per day");
  assert.equal(fieldValue(daily, "Nominal Annual Rate"), "365.00% per annum");
  assert.notEqual(fieldValue(daily, "Nominal Annual Rate"), "12.00% per annum");
  assert.equal(fieldValue(daily, "Term of Loan"), "30 day(s)");
  assert.equal(fieldValue(daily, "Mode of Payment"), "Daily");
});

test("disclosure: every rate frequency is disclosed correctly", () => {
  const expected = [
    ["daily", "2% per day", "730.00% per annum"],
    ["weekly", "2% per week", "104.00% per annum"],
    ["bi_weekly", "2% per bi-weekly period", "52.00% per annum"],
    ["semi_monthly", "2% per semi-monthly period", "48.00% per annum"],
    ["monthly", "2% per month", "24.00% per annum"],
  ] as const;

  for (const [rateFrequency, rate, annual] of expected) {
    const doc = buildDisclosureDoc({
      ...PAYLOAD,
      // Paid monthly throughout: the rate follows the period it is quoted
      // per, not the payment frequency.
      loan_terms: { ...PAYLOAD.loan_terms, interest_rate_frequency: rateFrequency },
    });
    assert.equal(fieldValue(doc, "Contractual Interest Rate"), rate, rateFrequency);
    assert.equal(fieldValue(doc, "Nominal Annual Rate"), annual, rateFrequency);
    // `term` is labelled by its `term_unit`: 6 months on every row.
    assert.equal(fieldValue(doc, "Term of Loan"), "6 month(s)", rateFrequency);
  }
});

test("disclosure: a fractional rate is disclosed exactly, as the API sends it", () => {
  // `decimal:4` arrives as a padded string. The rate is stated without the
  // padding and annualised without rounding.
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    loan_terms: { ...PAYLOAD.loan_terms, interest_rate: "1.5000" },
  });
  assert.equal(fieldValue(doc, "Contractual Interest Rate"), "1.5% per month");
  assert.equal(fieldValue(doc, "Nominal Annual Rate"), "18.00% per annum");

  const fourPlaces = buildDisclosureDoc({
    ...PAYLOAD,
    loan_terms: { ...PAYLOAD.loan_terms, interest_rate: "1.1234" },
  });
  assert.equal(fieldValue(fourPlaces, "Contractual Interest Rate"), "1.1234% per month");
  assert.equal(fieldValue(fourPlaces, "Nominal Annual Rate"), "13.4808% per annum");
});

test("disclosure: a payload without a rate frequency is quoted per month", () => {
  // The backend's default, and what every rate before the field meant — even
  // on a daily loan.
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    loan_terms: { ...PAYLOAD.loan_terms, frequency: "daily" },
  });
  assert.equal(fieldValue(doc, "Contractual Interest Rate"), "2% per month");
  assert.equal(fieldValue(doc, "Nominal Annual Rate"), "24.00% per annum");
});

test("disclosure: an unknown rate frequency leaves the annual rate to be filled in", () => {
  // A rule the officer completes beats a confidently wrong statutory figure.
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    loan_terms: { ...PAYLOAD.loan_terms, interest_rate_frequency: "quarterly" },
  });

  assert.equal(fieldValue(doc, "Contractual Interest Rate"), "2% per period");
  assert.ok(isBlankField(doc, "Nominal Annual Rate"));
  // The term is labelled by its own unit, which an unknown frequency cannot
  // change.
  assert.equal(fieldValue(doc, "Term of Loan"), "6 month(s)");
});

test("disclosure: what the items leave out is the server's own lettered line", () => {
  // The letters must add up to "2. Total Finance Charges", so whatever the
  // items do not account for is disclosed as a charge of its own: the server's
  // `unitemised_deductions`, never the items subtracted from the total here.
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    deductions: { items: [], total_deductions: 3500, net_proceeds: 96500 },
    totals: { ...PAYLOAD.totals, unitemised_deductions: 3500 },
  });
  assert.equal(chargeAmount(doc, "b. Other Charges"), formatCurrency(3500));
  assert.equal(chargeAmount(doc, "2. Total Finance Charges"), formatCurrency(10500));

  const partial = buildDisclosureDoc({
    ...PAYLOAD,
    deductions: {
      items: [{ name: "Processing Fee", amount: 2000, type: "percentage" }],
      total_deductions: 3500,
      net_proceeds: 96500,
    },
    totals: { ...PAYLOAD.totals, unitemised_deductions: 1500 },
  });
  assert.equal(chargeAmount(partial, "b. Processing Fee"), formatCurrency(2000));
  assert.equal(chargeAmount(partial, "c. Other Charges"), formatCurrency(1500));

  // A fully itemised payload (0) gains no phantom line.
  assert.ok(!hasChargeLine(buildDisclosureDoc(PAYLOAD), "e. Other Charges"));
  assert.ok(!hasChargeLine(buildDisclosureDoc(PAYLOAD), "e. Adjustment"));
});

test("disclosure: items above the total are corrected by a negative Adjustment", () => {
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    totals: { ...PAYLOAD.totals, unitemised_deductions: -500 },
  });
  assert.equal(chargeAmount(doc, "e. Adjustment"), formatCurrency(-500));
});

test("disclosure: no unitemised figure from the server adds no line, whatever the items sum to", () => {
  const { unitemised_deductions: _omitted, ...withoutUnitemised } = PAYLOAD.totals;
  void _omitted;
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    deductions: { items: [], total_deductions: 3500, net_proceeds: 96500 },
    totals: withoutUnitemised,
  });
  assert.ok(!hasChargeLine(doc, "b. Other Charges"));
  assert.ok(!hasChargeLine(doc, "b. Adjustment"));
});

test("disclosure: every deduction is disclosed on its own lettered line", () => {
  const doc = buildDisclosureDoc(PAYLOAD);

  assert.equal(chargeAmount(doc, "a. Interest"), formatCurrency(7000));
  assert.equal(chargeAmount(doc, "b. Processing Fee"), formatCurrency(2000));
  assert.equal(chargeAmount(doc, "c. Service Fee"), formatCurrency(1000));
  assert.equal(chargeAmount(doc, "d. Notarial Fee"), formatCurrency(500));
});

test("disclosure: finance charges, deductions and net proceeds are the server's", () => {
  const doc = buildDisclosureDoc(PAYLOAD);

  assert.equal(chargeAmount(doc, "2. Total Finance Charges"), formatCurrency(10500));
  assert.equal(chargeAmount(doc, "Less: Upfront Deductions"), `(${formatCurrency(3500)})`);
  assert.equal(
    chargeAmount(doc, "3. Net Proceeds of Loan (Amount Received by Borrower)"),
    formatCurrency(96500)
  );

  // A figure unlike interest + deductions is printed as sent: the server's.
  const sent = buildDisclosureDoc({
    ...PAYLOAD,
    totals: { ...PAYLOAD.totals, total_finance_charges: 10499.99 },
  });
  assert.equal(chargeAmount(sent, "2. Total Finance Charges"), formatCurrency(10499.99));
});

test("disclosure: a total the server did not send is a dash, never worked out", () => {
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    deductions: { items: PAYLOAD.deductions.items },
    totals: {},
  });

  assert.equal(chargeAmount(doc, "a. Interest"), DASH);
  assert.equal(chargeAmount(doc, "2. Total Finance Charges"), DASH);
  assert.equal(chargeAmount(doc, "Less: Upfront Deductions"), DASH);
  assert.equal(
    chargeAmount(doc, "3. Net Proceeds of Loan (Amount Received by Borrower)"),
    DASH
  );
  const table = tableBlock(doc, "VI. Amortization Schedule");
  assert.equal(table.totals?.principal, DASH);
  assert.equal(table.totals?.interest, DASH);
  assert.equal(table.totals?.amount_due, DASH);
});

test("disclosure: co-makers and the borrower's address are deliberately absent", () => {
  // A decision, pinned so it cannot drift into an accident. The API sends both
  // and this form omits both: R.A. 3765 discloses the cost of credit to the
  // BORROWER, and a co-maker's solidary undertaking is disclosed, signed and
  // notarised on the Promissory Note instead — which does carry every one of
  // them. Revisit as a form-design change, not as a bug fix.
  const doc = buildDisclosureDoc({
    ...PAYLOAD,
    borrower: { ...PAYLOAD.borrower, address: "12 Mabini St., Poblacion, Cebu City" },
    co_makers: [
      { full_name: "Pedro Santos", address: "8 Lapu-Lapu St., Cebu City" },
      { full_name: "Maria Reyes", address: "3 Osmena Blvd., Cebu City" },
    ],
  });

  assert.ok(!allFields(doc).some((f) => f.label === "Address"));
  assert.doesNotMatch(prose(doc), /Pedro Santos|Maria Reyes|Mabini/);
  // Two signatories, both of them parties to the credit transaction itself.
  assert.deepEqual(signatureLabels(doc), [
    "Borrower — Signature Over Printed Name",
    "Creditor / Lending Company",
  ]);
});

test("disclosure: the schedule table carries the server's column totals", () => {
  const doc = buildDisclosureDoc(PAYLOAD);
  const table = tableBlock(doc, "VI. Amortization Schedule");

  assert.equal(table.rows.length, 3);
  // Six columns, six keys per row — the old markup declared seven headers for
  // six cells, which shifted every figure one column left.
  assert.equal(table.columns.length, 6);
  // `totals.total_principal`, `total_interest` and `total_amortization`, not
  // the three rows shown added up.
  assert.equal(table.totals?.principal, formatCurrency(100000));
  assert.equal(table.totals?.interest, formatCurrency(7000));
  assert.equal(table.totals?.amount_due, formatCurrency(107000));
});

test("disclosure: a long schedule breaks to its own page", () => {
  const short = buildDisclosureDoc(PAYLOAD);
  assert.equal(blocksOfKind(short, "page_break").length, 0);

  const long = buildDisclosureDoc({
    ...PAYLOAD,
    amortization_schedule: Array.from({ length: 24 }, (_, i) => ({
      period_number: i + 1,
      due_date: "2026-09-01",
      principal_due: 1000,
      interest_due: 100,
      total_due: 1100,
      remaining_balance: 1000 * (24 - i),
    })),
  });
  assert.equal(blocksOfKind(long, "page_break").length, 1);
});

test("disclosure: the R.A. 3765 acknowledgment survives word for word", () => {
  const text = prose(buildDisclosureDoc(PAYLOAD));

  assert.match(
    text,
    /I\/We acknowledge receipt of this Disclosure Statement <em>prior to the consummation<\/em> of the above credit\/loan transaction\./
  );
  assert.match(
    text,
    /I\/We have read and fully understood all the terms and conditions stated herein, including the finance charges, interest rate, penalties, and other charges\./
  );
  assert.match(
    text,
    /issued in compliance with <strong>Republic Act No\. 3765<\/strong>/
  );
  assert.match(
    text,
    /as amended by <strong>BSP Circular No\. 730, Series of 2011<\/strong>/
  );
});

test("disclosure: a null payload still prints a signable blank form", () => {
  const doc = buildDisclosureDoc(null);
  assertPrintableShape(doc, "disclosure_statement");

  // Blanks are rules to be filled in by hand, not dashes.
  assert.ok(isBlankField(doc, "Name of Borrower"));
  assert.ok(isBlankField(doc, "Loan Account No."));
  assert.ok(isBlankField(doc, "Date Granted"));

  // No figures were sent, so none is printed — a dash, never a ₱0.00 the
  // server did not state — but the statutory acknowledgment and sign-off must
  // be on the page regardless.
  assert.equal(chargeAmount(doc, "1. Principal Loan Amount"), DASH);
  assert.equal(chargeAmount(doc, "2. Total Finance Charges"), DASH);
  assert.ok(hasChargeLine(doc, "2. Total Finance Charges"));
  assert.match(prose(doc), /Truth in Lending Act/);
  assert.deepEqual(signatureLabels(doc), [
    "Borrower — Signature Over Printed Name",
    "Creditor / Lending Company",
  ]);

  // No schedule table at all, rather than an empty one claiming there is none.
  assert.equal(blocksOfKind(doc, "table").length, 0);
});

test("disclosure: the legacy flat payload still renders", () => {
  // The shape `LoanDisclosure` in src/types/loan-document.ts describes.
  const doc = buildDisclosureDoc({
    loan_id: 42,
    application_number: "APP-2026-0042",
    borrower_name: "Pedro Santos",
    principal_amount: 50000,
    interest_rate: 3,
    interest_type: "fixed",
    term_months: 12,
    payment_frequency: "bi_weekly",
    processing_fee: 1000,
    service_fee: 500,
    other_deductions: 0,
    net_proceeds: 48500,
    total_payable: 56000,
    amortization_schedule: [
      { period: 1, due_date: "2026-09-01", principal: 4166.67, interest: 1500, amount_due: 5666.67, balance: 45833.33 },
    ],
  });

  assert.equal(fieldValue(doc, "Name of Borrower"), "Pedro Santos");
  assert.equal(fieldValue(doc, "Term of Loan"), "12 month(s)");
  assert.equal(fieldValue(doc, "Mode of Payment"), "Bi weekly");
  // No totals block: interest is a dash, never total payable less principal.
  assert.equal(chargeAmount(doc, "a. Interest"), DASH);
  assert.equal(fieldValue(doc, "Total Amount Payable"), formatCurrency(56000));
  assert.equal(chargeAmount(doc, "b. Processing / Service Fee"), formatCurrency(1000));
  assert.equal(chargeAmount(doc, "c. Service Fee"), formatCurrency(500));
  assert.equal(
    chargeAmount(doc, "3. Net Proceeds of Loan (Amount Received by Borrower)"),
    formatCurrency(48500)
  );
  assert.equal(tableBlock(doc, "VI. Amortization Schedule").rows.length, 1);
});
